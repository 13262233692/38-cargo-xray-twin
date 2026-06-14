#!/usr/bin/env python3
"""
Cargo X-Ray - 体积渲染流式服务器 (Python 版本)
用于快速演示和开发测试，生产环境请使用 C++ 版本
"""

import asyncio
import websockets
import json
import struct
import numpy as np
import math
from pathlib import Path

HOST = "0.0.0.0"
PORT = 8080
VOLUME_SIZE = 128


def generate_container_scan(width, height, depth):
    """生成模拟的集装箱扫描数据（双能 X 射线）"""
    print(f"[CargoX-Ray] 生成模拟体积数据: {width}x{height}x{depth}...")

    x = np.linspace(-1, 1, width)
    y = np.linspace(-1, 1, height)
    z = np.linspace(-1, 1, depth)
    X, Y, Z = np.meshgrid(x, y, z, indexing='ij')

    density = np.zeros((width, height, depth), dtype=np.float32)
    zeff = np.zeros((width, height, depth), dtype=np.float32)

    container_wall_x = np.abs(np.abs(X) - 0.85) < 0.04
    container_wall_y = np.abs(np.abs(Y) - 0.80) < 0.04
    container_wall_z = np.abs(np.abs(Z) - 0.90) < 0.04
    container_wall = container_wall_x | container_wall_y | container_wall_z
    density[container_wall] = 0.65
    zeff[container_wall] = 0.68

    cargo_dist = np.sqrt(X**2 * 0.7 + Y**2 + Z**2 * 0.6)
    cargo_mask = cargo_dist < 0.65
    noise = np.random.randn(width, height, depth) * 0.05
    cargo_density = 0.2 + (1 - cargo_dist / 0.65) * 0.15 + noise
    density = np.where(cargo_mask, np.maximum(density, cargo_density), density)
    cargo_zeff = 0.3 + (1 - cargo_dist / 0.65) * 0.1 + noise * 0.5
    zeff = np.where(cargo_mask, np.maximum(zeff, cargo_zeff), zeff)

    sphere1_dist = np.sqrt((X - 0.22)**2 + (Y + 0.12)**2 + (Z - 0.18)**2)
    sphere1_mask = sphere1_dist < 0.13
    sphere1_density = 0.9 + (1 - sphere1_dist / 0.13) * 0.1
    density = np.where(sphere1_mask, np.maximum(density, sphere1_density), density)
    sphere1_zeff = 0.92 + (1 - sphere1_dist / 0.13) * 0.06
    zeff = np.where(sphere1_mask, np.maximum(zeff, sphere1_zeff), zeff)

    sphere2_dist = np.sqrt((X + 0.28)**2 + (Y - 0.18)**2 + (Z + 0.12)**2)
    sphere2_mask = sphere2_dist < 0.16
    sphere2_density = 0.70 + (1 - sphere2_dist / 0.16) * 0.08
    density = np.where(sphere2_mask, np.maximum(density, sphere2_density), density)
    sphere2_zeff = 0.52 + (1 - sphere2_dist / 0.16) * 0.1
    zeff = np.where(sphere2_mask, np.maximum(zeff, sphere2_zeff), zeff)

    box_mask = (np.abs(X - 0.08) < 0.20) & (np.abs(Y + 0.28) < 0.20) & (np.abs(Z + 0.22) < 0.20)
    box_surface = (
        (np.abs(np.abs(X - 0.08) - 0.18) < 0.02) |
        (np.abs(np.abs(Y + 0.28) - 0.18) < 0.02) |
        (np.abs(np.abs(Z + 0.22) - 0.18) < 0.02)
    )
    box_full = box_mask & box_surface
    density = np.where(box_full, np.maximum(density, 0.85), density)
    zeff = np.where(box_full, np.maximum(zeff, 0.78), zeff)

    cyl_r = np.sqrt((X + 0.15)**2 + (Z - 0.05)**2)
    cyl_h = np.abs(Y - 0.05)
    cyl_mask = (cyl_r < 0.08) & (cyl_h < 0.35)
    cyl_density = 0.35 + (1 - cyl_r / 0.08) * 0.3
    density = np.where(cyl_mask, np.maximum(density, cyl_density), density)
    cyl_zeff = 0.4 + (1 - cyl_r / 0.08) * 0.25
    zeff = np.where(cyl_mask, np.maximum(zeff, cyl_zeff), zeff)

    density = np.clip(density, 0, 1)
    zeff = np.clip(zeff, 0, 1)

    density_uint8 = (density * 255).astype(np.uint8)
    zeff_uint8 = (zeff * 255).astype(np.uint8)

    print(f"[CargoX-Ray] 数据生成完成")
    return density_uint8, zeff_uint8


async def send_volume_info(websocket, width, height, depth):
    """发送体数据信息头"""
    info = {
        "type": "volume_info",
        "width": width,
        "height": height,
        "depth": depth,
        "container_id": "CRG-DEMO-001",
        "scan_time": "2026-06-14T21:30:00",
        "energy_low_kev": 60,
        "energy_high_kev": 150
    }
    await websocket.send(json.dumps(info))
    print(f"[CargoX-Ray] 已发送体积信息: {width}x{height}x{depth}")


async def stream_slices(websocket, density_data, zeff_data, width, height, depth):
    """流式发送切片数据（零拷贝二进制）"""
    slice_size = width * height

    print(f"[CargoX-Ray] 开始流式传输 {depth} 个切片...")

    for i in range(depth):
        density_slice = density_data[:, :, i].tobytes()
        zeff_slice = zeff_data[:, :, i].tobytes()

        slice_index_bytes = struct.pack('<I', i)

        packet = slice_index_bytes + density_slice + zeff_slice
        await websocket.send(packet)

        if i % max(1, depth // 10) == 0 or i == depth - 1:
            progress = int((i + 1) / depth * 100)
            print(f"[CargoX-Ray] 传输进度: {progress}% ({i+1}/{depth})")

        await asyncio.sleep(0.005)

    print(f"[CargoX-Ray] 流式传输完成")


async def handle_client(websocket, path):
    """处理客户端连接"""
    client_addr = websocket.remote_address
    print(f"[CargoX-Ray] 新客户端连接: {client_addr[0]}:{client_addr[1]}")

    try:
        width = height = depth = VOLUME_SIZE
        density_data, zeff_data = generate_container_scan(width, height, depth)

        await send_volume_info(websocket, width, height, depth)
        await asyncio.sleep(0.1)
        await stream_slices(websocket, density_data, zeff_data, width, height, depth)

        async for message in websocket:
            if isinstance(message, str):
                try:
                    data = json.loads(message)
                    if data.get("type") == "request_volume":
                        print(f"[CargoX-Ray] 收到体数据请求")
                        density_data, zeff_data = generate_container_scan(width, height, depth)
                        await send_volume_info(websocket, width, height, depth)
                        await asyncio.sleep(0.1)
                        await stream_slices(websocket, density_data, zeff_data, width, height, depth)
                except json.JSONDecodeError:
                    pass
            elif isinstance(message, bytes):
                pass

    except websockets.exceptions.ConnectionClosed:
        print(f"[CargoX-Ray] 客户端断开: {client_addr[0]}:{client_addr[1]}")
    except Exception as e:
        print(f"[CargoX-Ray] 错误: {e}")


async def main():
    print("=" * 50)
    print("  Cargo X-Ray 3D - Volume Streaming Server")
    print("  海关安检 3D 体积渲染流式服务 (Python版)")
    print("=" * 50)
    print()
    print(f"  监听地址: ws://{HOST}:{PORT}")
    print(f"  体数据大小: {VOLUME_SIZE}x{VOLUME_SIZE}x{VOLUME_SIZE}")
    print(f"  数据通道: 密度 + 有效原子序数 (Z-effective)")
    print()
    print("  按 Ctrl+C 停止服务")
    print("=" * 50)
    print()

    async with websockets.serve(handle_client, HOST, PORT):
        await asyncio.Future()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print()
        print("[CargoX-Ray] 服务已停止")
