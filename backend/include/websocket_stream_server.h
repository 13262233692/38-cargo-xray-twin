#ifndef WEBSOCKET_STREAM_SERVER_H
#define WEBSOCKET_STREAM_SERVER_H

#include "volume_data.h"
#include "simulated_data_generator.h"
#include <cstdint>
#include <string>
#include <memory>
#include <functional>
#include <vector>
#include <mutex>
#include <atomic>

namespace cargo_xray {

using StreamCallback = std::function<void(const std::string& message)>;
using BinaryCallback = std::function<void(const uint8_t* data, size_t size)>;

enum class ServerState {
    STOPPED,
    STARTING,
    RUNNING,
    STOPPING
};

class WebSocketStreamServer {
public:
    WebSocketStreamServer(uint16_t port = 8080);
    ~WebSocketStreamServer();

    bool start();
    void stop();
    bool is_running() const { return state_ == ServerState::RUNNING; }

    void set_volume_data(std::shared_ptr<VolumeData> data) {
        std::lock_guard<std::mutex> lock(data_mutex_);
        volume_data_ = data;
    }

    void broadcast_volume_info();
    void stream_slices(uint32_t start_slice = 0, uint32_t end_slice = 0);
    void stream_full_volume();

    void on_client_connected(StreamCallback callback) {
        connect_callback_ = std::move(callback);
    }

    void on_client_disconnected(StreamCallback callback) {
        disconnect_callback_ = std::move(callback);
    }

    uint16_t port() const { return port_; }
    size_t connected_clients() const { return client_count_; }

private:
    void accept_loop();
    void handle_client(void* client_handle);
    void send_binary(void* client_handle, const uint8_t* data, size_t size);
    void send_text(void* client_handle, const std::string& message);

    void prepare_slice_packet(uint32_t slice_index, std::vector<uint8_t>& buffer);

    uint16_t port_;
    std::atomic<ServerState> state_;
    std::atomic<size_t> client_count_;

    std::shared_ptr<VolumeData> volume_data_;
    mutable std::mutex data_mutex_;

    SimulatedDataGenerator data_generator_;

    StreamCallback connect_callback_;
    StreamCallback disconnect_callback_;

    void* server_impl_;
    void* accept_thread_;
};

class VolumeStreamSession {
public:
    VolumeStreamSession(std::shared_ptr<VolumeData> data) 
        : volume_data_(std::move(data))
        , current_slice_(0)
        , streaming_(false) {}

    void start_streaming(uint32_t start = 0) {
        current_slice_ = start;
        streaming_ = true;
    }

    void stop_streaming() {
        streaming_ = false;
    }

    bool get_next_slice(uint32_t& index, const uint8_t*& density, const uint8_t*& zeff) {
        if (!volume_data_ || !streaming_) return false;
        
        const uint32_t depth = volume_data_->dimensions.depth;
        if (current_slice_ >= depth) {
            streaming_ = false;
            return false;
        }

        const size_t slice_size = volume_data_->slice_size();
        const size_t offset = current_slice_ * slice_size;

        index = current_slice_;
        density = volume_data_->density_data.data() + offset;
        zeff = volume_data_->z_effective_data.data() + offset;
        
        current_slice_++;
        return true;
    }

    bool is_streaming() const { return streaming_; }
    uint32_t current_slice() const { return current_slice_; }

private:
    std::shared_ptr<VolumeData> volume_data_;
    uint32_t current_slice_;
    bool streaming_;
};

} // namespace cargo_xray

#endif // WEBSOCKET_STREAM_SERVER_H
