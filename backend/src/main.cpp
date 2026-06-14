#include "websocket_stream_server.h"
#include "simulated_data_generator.h"
#include <iostream>
#include <signal.h>
#include <atomic>
#include <thread>
#include <chrono>

std::atomic<bool> g_running(true);

void signal_handler(int sig) {
    (void)sig;
    g_running = false;
}

int main(int argc, char* argv[]) {
    uint16_t port = 8080;
    
    for (int i = 1; i < argc; ++i) {
        std::string arg = argv[i];
        if (arg == "--port" && i + 1 < argc) {
            port = static_cast<uint16_t>(std::stoi(argv[++i]));
        }
    }

    signal(SIGINT, signal_handler);
    signal(SIGTERM, signal_handler);

    std::cout << "==========================================" << std::endl;
    std::cout << "  Cargo X-Ray 3D - Volume Streaming Server" << std::endl;
    std::cout << "  海关安检 3D 体积渲染流式服务" << std::endl;
    std::cout << "==========================================" << std::endl;
    std::cout << std::endl;

    cargo_xray::WebSocketStreamServer server(port);

    if (!server.start()) {
        std::cerr << "Failed to start server" << std::endl;
        return 1;
    }

    std::cout << "Server started on port " << port << std::endl;
    std::cout << "WebSocket endpoint: ws://localhost:" << port << "/volume-stream" << std::endl;
    std::cout << "Press Ctrl+C to stop server" << std::endl;
    std::cout << std::endl;

    while (g_running && server.is_running()) {
        std::this_thread::sleep_for(std::chrono::milliseconds(100));
    }

    std::cout << std::endl << "Stopping server..." << std::endl;
    server.stop();
    std::cout << "Server stopped" << std::endl;

    return 0;
}
