#include "websocket_stream_server.h"
#include <iostream>
#include <cstring>
#include <thread>
#include <chrono>

#ifdef _WIN32
#include <winsock2.h>
#include <ws2tcpip.h>
#pragma comment(lib, "ws2_32.lib")
#else
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#include <arpa/inet.h>
#endif

namespace cargo_xray {

namespace {

#ifdef _WIN32
    using socket_t = SOCKET;
    const socket_t INVALID_SOCK = INVALID_SOCKET;
    const int SOCK_ERROR = SOCKET_ERROR;
#else
    using socket_t = int;
    const socket_t INVALID_SOCK = -1;
    const int SOCK_ERROR = -1;
#endif

    struct WebSocketFrame {
        bool fin;
        bool masked;
        uint8_t opcode;
        uint64_t payload_length;
        uint32_t masking_key;
    };

    bool parse_ws_frame(const uint8_t* data, size_t len, WebSocketFrame& frame, size_t& header_size) {
        if (len < 2) return false;

        frame.fin = (data[0] & 0x80) != 0;
        frame.opcode = data[0] & 0x0F;
        frame.masked = (data[1] & 0x80) != 0;
        frame.payload_length = data[1] & 0x7F;

        size_t offset = 2;

        if (frame.payload_length == 126) {
            if (len < 4) return false;
            frame.payload_length = (data[2] << 8) | data[3];
            offset = 4;
        } else if (frame.payload_length == 127) {
            if (len < 10) return false;
            frame.payload_length = 0;
            for (int i = 0; i < 8; ++i) {
                frame.payload_length = (frame.payload_length << 8) | data[2 + i];
            }
            offset = 10;
        }

        if (frame.masked) {
            if (len < offset + 4) return false;
            frame.masking_key = 0;
            for (int i = 0; i < 4; ++i) {
                frame.masking_key = (frame.masking_key << 8) | data[offset + i];
            }
            offset += 4;
        }

        header_size = offset;
        return true;
    }

    size_t build_ws_frame(uint8_t* buffer, const uint8_t* payload, size_t payload_len, bool binary = true) {
        buffer[0] = binary ? 0x82 : 0x81;

        size_t header_size = 2;

        if (payload_len < 126) {
            buffer[1] = static_cast<uint8_t>(payload_len);
        } else if (payload_len < 65536) {
            buffer[1] = 126;
            buffer[2] = static_cast<uint8_t>((payload_len >> 8) & 0xFF);
            buffer[3] = static_cast<uint8_t>(payload_len & 0xFF);
            header_size = 4;
        } else {
            buffer[1] = 127;
            for (int i = 0; i < 8; ++i) {
                buffer[2 + i] = static_cast<uint8_t>((payload_len >> (56 - i * 8)) & 0xFF);
            }
            header_size = 10;
        }

        if (payload && payload_len > 0) {
            std::memcpy(buffer + header_size, payload, payload_len);
        }

        return header_size + payload_len;
    }

    std::string base64_encode(const std::string& input) {
        const std::string chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        std::string result;
        result.reserve(((input.size() + 2) / 3) * 4);

        int val = 0, valb = -6;
        for (unsigned char c : input) {
            val = (val << 8) + c;
            valb += 8;
            while (valb >= 0) {
                result.push_back(chars[(val >> valb) & 0x3F]);
                valb -= 6;
            }
        }
        if (valb > -6) {
            result.push_back(chars[((val << 8) >> (valb + 8)) & 0x3F]);
        }
        while (result.size() % 4) {
            result.push_back('=');
        }
        return result;
    }

    std::string sha1_hex(const std::string& input) {
        uint32_t h0 = 0x67452301;
        uint32_t h1 = 0xEFCDAB89;
        uint32_t h2 = 0x98BADCFE;
        uint32_t h3 = 0x10325476;
        uint32_t h4 = 0xC3D2E1F0;

        std::string msg = input;
        uint64_t orig_len = msg.size() * 8;
        
        msg += static_cast<char>(0x80);
        while (msg.size() % 64 != 56) {
            msg += static_cast<char>(0x00);
        }
        
        for (int i = 7; i >= 0; --i) {
            msg += static_cast<char>((orig_len >> (i * 8)) & 0xFF);
        }

        for (size_t offset = 0; offset < msg.size(); offset += 64) {
            uint32_t w[80];
            for (int i = 0; i < 16; ++i) {
                w[i] = (static_cast<uint8_t>(msg[offset + i * 4]) << 24) |
                       (static_cast<uint8_t>(msg[offset + i * 4 + 1]) << 16) |
                       (static_cast<uint8_t>(msg[offset + i * 4 + 2]) << 8) |
                       (static_cast<uint8_t>(msg[offset + i * 4 + 3]));
            }
            for (int i = 16; i < 80; ++i) {
                w[i] = w[i-3] ^ w[i-8] ^ w[i-14] ^ w[i-16];
                w[i] = (w[i] << 1) | (w[i] >> 31);
            }

            uint32_t a = h0, b = h1, c = h2, d = h3, e = h4;

            for (int i = 0; i < 80; ++i) {
                uint32_t f, k;
                if (i < 20) {
                    f = (b & c) | (~b & d);
                    k = 0x5A827999;
                } else if (i < 40) {
                    f = b ^ c ^ d;
                    k = 0x6ED9EBA1;
                } else if (i < 60) {
                    f = (b & c) | (b & d) | (c & d);
                    k = 0x8F1BBCDC;
                } else {
                    f = b ^ c ^ d;
                    k = 0xCA62C1D6;
                }

                uint32_t temp = ((a << 5) | (a >> 27)) + f + e + k + w[i];
                e = d;
                d = c;
                c = (b << 30) | (b >> 2);
                b = a;
                a = temp;
            }

            h0 += a;
            h1 += b;
            h2 += c;
            h3 += d;
            h4 += e;
        }

        std::string result;
        result.reserve(20);
        auto add_word = [&](uint32_t word) {
            for (int i = 3; i >= 0; --i) {
                result += static_cast<char>((word >> (i * 8)) & 0xFF);
            }
        };
        add_word(h0);
        add_word(h1);
        add_word(h2);
        add_word(h3);
        add_word(h4);
        return result;
    }

}

WebSocketStreamServer::WebSocketStreamServer(uint16_t port)
    : port_(port)
    , state_(ServerState::STOPPED)
    , client_count_(0)
    , server_impl_(nullptr)
    , accept_thread_(nullptr)
{
}

WebSocketStreamServer::~WebSocketStreamServer() {
    stop();
}

bool WebSocketStreamServer::start() {
    if (state_ != ServerState::STOPPED) return false;
    state_ = ServerState::STARTING;

    SimulatedDataGenerator gen;
    auto volume_data = std::make_shared<VolumeData>(
        gen.generate_container_scan(128, 128, 128)
    );
    set_volume_data(volume_data);

    std::thread(&WebSocketStreamServer::accept_loop, this).detach();
    
    return true;
}

void WebSocketStreamServer::stop() {
    if (state_ == ServerState::STOPPED || state_ == ServerState::STOPPING) return;
    state_ = ServerState::STOPPING;
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    state_ = ServerState::STOPPED;
}

void WebSocketStreamServer::accept_loop() {
#ifdef _WIN32
    WSADATA wsa_data;
    if (WSAStartup(MAKEWORD(2, 2), &wsa_data) != 0) {
        std::cerr << "WSAStartup failed" << std::endl;
        state_ = ServerState::STOPPED;
        return;
    }
#endif

    socket_t server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd == INVALID_SOCK) {
        std::cerr << "Failed to create socket" << std::endl;
        state_ = ServerState::STOPPED;
        return;
    }

    int opt = 1;
#ifdef _WIN32
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, reinterpret_cast<const char*>(&opt), sizeof(opt));
#else
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));
#endif

    sockaddr_in address;
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(port_);

    if (bind(server_fd, reinterpret_cast<sockaddr*>(&address), sizeof(address)) < 0) {
        std::cerr << "Bind failed on port " << port_ << std::endl;
#ifdef _WIN32
        closesocket(server_fd);
        WSACleanup();
#else
        close(server_fd);
#endif
        state_ = ServerState::STOPPED;
        return;
    }

    if (listen(server_fd, 5) < 0) {
        std::cerr << "Listen failed" << std::endl;
#ifdef _WIN32
        closesocket(server_fd);
        WSACleanup();
#else
        close(server_fd);
#endif
        state_ = ServerState::STOPPED;
        return;
    }

    state_ = ServerState::RUNNING;
    std::cout << "[CargoX-Ray] WebSocket server running on ws://localhost:" << port_ << std::endl;
    std::cout << "[CargoX-Ray] Volume stream endpoint: /volume-stream" << std::endl;

    while (state_ == ServerState::RUNNING) {
        sockaddr_in client_addr;
#ifdef _WIN32
        int addrlen = sizeof(client_addr);
#else
        socklen_t addrlen = sizeof(client_addr);
#endif
        socket_t client_fd = accept(server_fd, reinterpret_cast<sockaddr*>(&client_addr), &addrlen);
        
        if (client_fd == INVALID_SOCK) {
            if (state_ != ServerState::RUNNING) break;
            continue;
        }

        client_count_++;
        std::cout << "[CargoX-Ray] Client connected, total: " << client_count_ << std::endl;

        std::thread([this, client_fd]() {
            handle_client(reinterpret_cast<void*>(client_fd));
            client_count_--;
            std::cout << "[CargoX-Ray] Client disconnected, total: " << client_count_ << std::endl;
        }).detach();
    }

#ifdef _WIN32
    closesocket(server_fd);
    WSACleanup();
#else
    close(server_fd);
#endif
}

void WebSocketStreamServer::handle_client(void* client_handle) {
    socket_t client_fd = reinterpret_cast<socket_t>(client_handle);
    
    char buffer[8192];
    std::string request;
    
    int bytes_read;
    bool handshake_done = false;

    while (state_ == ServerState::RUNNING) {
        bytes_read = recv(client_fd, buffer, sizeof(buffer) - 1, 0);
        if (bytes_read <= 0) break;

        buffer[bytes_read] = '\0';
        request += buffer;

        if (!handshake_done) {
            if (request.find("\r\n\r\n") != std::string::npos) {
                size_t get_pos = request.find("GET ");
                if (get_pos == std::string::npos) break;

                size_t key_pos = request.find("Sec-WebSocket-Key:");
                if (key_pos == std::string::npos) break;

                size_t key_start = key_pos + 19;
                size_t key_end = request.find("\r\n", key_start);
                std::string client_key = request.substr(key_start, key_end - key_start);
                
                while (!client_key.empty() && client_key.back() == ' ') {
                    client_key.pop_back();
                }
                while (!client_key.empty() && client_key.front() == ' ') {
                    client_key.erase(client_key.begin());
                }

                std::string accept_key = base64_encode(
                    sha1_hex(client_key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
                );

                std::string response = 
                    "HTTP/1.1 101 Switching Protocols\r\n"
                    "Upgrade: websocket\r\n"
                    "Connection: Upgrade\r\n"
                    "Sec-WebSocket-Accept: " + accept_key + "\r\n\r\n";

                send(client_fd, response.c_str(), static_cast<int>(response.size()), 0);
                handshake_done = true;
                request.clear();

                broadcast_volume_info();
                std::this_thread::sleep_for(std::chrono::milliseconds(100));
                stream_full_volume();
            }
        } else {
            if (bytes_read < 2) continue;
            
            WebSocketFrame frame;
            size_t header_size;
            if (!parse_ws_frame(reinterpret_cast<uint8_t*>(buffer), bytes_read, frame, header_size)) {
                continue;
            }

            if (frame.opcode == 0x8) {
                break;
            } else if (frame.opcode == 0x1 || frame.opcode == 0x2) {
                std::string msg(buffer + header_size, frame.payload_length);
                
                if (msg.find("request_volume") != std::string::npos) {
                    stream_full_volume();
                }
            }
        }
    }

#ifdef _WIN32
    closesocket(client_fd);
#else
    close(client_fd);
#endif
}

void WebSocketStreamServer::broadcast_volume_info() {
}

void WebSocketStreamServer::stream_full_volume() {
    std::lock_guard<std::mutex> lock(data_mutex_);
    if (!volume_data_) return;

    std::cout << "[CargoX-Ray] Streaming full volume: " 
              << volume_data_->dimensions.width << "x"
              << volume_data_->dimensions.height << "x"
              << volume_data_->dimensions.depth << std::endl;
}

void WebSocketStreamServer::stream_slices(uint32_t start_slice, uint32_t end_slice) {
    std::lock_guard<std::mutex> lock(data_mutex_);
    if (!volume_data_) return;
}

void WebSocketStreamServer::send_binary(void* client_handle, const uint8_t* data, size_t size) {
    socket_t client_fd = reinterpret_cast<socket_t>(client_handle);
    
    std::vector<uint8_t> frame_buffer(size + 16);
    size_t frame_size = build_ws_frame(frame_buffer.data(), data, size, true);
    
    send(client_fd, reinterpret_cast<const char*>(frame_buffer.data()), static_cast<int>(frame_size), 0);
}

void WebSocketStreamServer::send_text(void* client_handle, const std::string& message) {
    socket_t client_fd = reinterpret_cast<socket_t>(client_handle);
    
    std::vector<uint8_t> frame_buffer(message.size() + 16);
    size_t frame_size = build_ws_frame(frame_buffer.data(), 
                                       reinterpret_cast<const uint8_t*>(message.c_str()), 
                                       message.size(), false);
    
    send(client_fd, reinterpret_cast<const char*>(frame_buffer.data()), static_cast<int>(frame_size), 0);
}

void WebSocketStreamServer::prepare_slice_packet(uint32_t slice_index, std::vector<uint8_t>& buffer) {
    if (!volume_data_) return;

    const size_t slice_size = volume_data_->slice_size();
    buffer.resize(4 + slice_size * 2);

    buffer[0] = static_cast<uint8_t>(slice_index & 0xFF);
    buffer[1] = static_cast<uint8_t>((slice_index >> 8) & 0xFF);
    buffer[2] = static_cast<uint8_t>((slice_index >> 16) & 0xFF);
    buffer[3] = static_cast<uint8_t>((slice_index >> 24) & 0xFF);

    const size_t offset = slice_index * slice_size;
    std::memcpy(buffer.data() + 4, volume_data_->density_data.data() + offset, slice_size);
    std::memcpy(buffer.data() + 4 + slice_size, volume_data_->z_effective_data.data() + offset, slice_size);
}

} // namespace cargo_xray
