cmake_minimum_required(VERSION 3.15)
project(cargo_xray_backend CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

if(NOT CMAKE_BUILD_TYPE)
    set(CMAKE_BUILD_TYPE Release)
endif()

set(CMAKE_CXX_FLAGS_RELEASE "-O3")

include_directories(${CMAKE_SOURCE_DIR}/include)

set(SOURCES
    src/main.cpp
    src/websocket_stream_server.cpp
)

add_executable(cargo_xray_server ${SOURCES})

if(WIN32)
    target_link_libraries(cargo_xray_server ws2_32)
endif()

if(UNIX)
    find_package(Threads REQUIRED)
    target_link_libraries(cargo_xray_server Threads::Threads)
endif()

option(BUILD_HDF5_SUPPORT "Build with HDF5 support" OFF)
if(BUILD_HDF5_SUPPORT)
    find_package(HDF5 REQUIRED COMPONENTS CXX)
    include_directories(${HDF5_INCLUDE_DIRS})
    target_link_libraries(cargo_xray_server ${HDF5_LIBRARIES})
    target_compile_definitions(cargo_xray_server PRIVATE HAVE_HDF5)
endif()

install(TARGETS cargo_xray_server DESTINATION bin)
