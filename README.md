# Cargo X-Ray 3D - 海关安检体积渲染系统

面向海关特种安检与港口大宗物流防走私场景的 3D 体积渲染系统。采用 **C++ 核心硬件接入层** + **前端 React + Three.js 原生 WebGL 2.0 着色器**的技术架构，实现超高带宽的跨端渲染链路。

---

## 系统架构

```
┌─────────────────────────────────────────────────────────────┐
│                    双能 X 射线扫描仪                          │
│              (质量密度 + 有效原子序数 Z-effective)           │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              │ HDF5/DICOM 原始切片流
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                C++ 后端网关服务 (backend/)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ HDF5/DICOM   │  │ 零拷贝二进制 │  │  WebSocket 流式   │  │
│  │ 数据加载器    │→│  打包引擎     │→│  传输服务器       │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────┬───────────────────────────────┘
                              │
                              │ WebSocket + Binary Frame
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              前端 React + Three.js (frontend/)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ WebSocket    │  │ Data3DTexture│  │  Raymarching     │  │
│  │ 数据接收     │→│ 3D 纹理上传   │→│  片元着色器渲染   │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
│         ↓                    ↓                    ↓          │
│  传递函数编辑      切片平面控制       违禁品智能高亮        │
└─────────────────────────────────────────────────────────────┘
```

---

## 核心特性

### 🔬 双能 X 射线数据通道
- **密度通道**：质量密度分布，用于物质区分
- **有效原子序数 (Z-effective)**：双能反演计算，精准识别重金属与违禁品

### ⚡ 零拷贝流式传输
- C++ 后端直接以二进制帧格式发送切片数据
- 前端接收后直接上传 GPU 3D 纹理，避免 CPU 内存拷贝
- WebSocket 二进制帧协议：`[slice_index: u32][density_slice][zeff_slice]`

### 🎯 光线投射体积渲染
- 基于 GLSL 片元着色器的 Raymarching 算法
- 沿视线方向步进采样积分，实现真实 3D 穿透效果
- 支持 64-1024 级可调采样率，平衡画质与性能

### 🎨 智能传递函数 (Transfer Function)
- 密度与 Z-effective 双通道独立传递函数
- 不透明度映射 + 颜色映射
- 内置重金属、违禁品自动识别高亮

### 🔍 交互分析工具
- 三轴切片平面，逐层观察内部结构
- 旋转/缩放/平移视角控制
- 亮度/对比度实时调节

---

## 项目结构

```
38-cargo-xray-twin/
├── backend/                    # 后端网关服务
│   ├── CMakeLists.txt          # C++ CMake 构建配置
│   ├── volume_server.py        # Python 版本服务器（快速演示）
│   ├── include/
│   │   ├── volume_data.h       # 体数据结构定义
│   │   ├── websocket_stream_server.h  # WebSocket 流服务器
│   │   └── simulated_data_generator.h # 模拟数据生成器
│   └── src/
│       ├── main.cpp            # 程序入口
│       └── websocket_stream_server.cpp
├── frontend/                   # 前端 React 应用
│   ├── package.json
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx            # React 入口
│       ├── App.tsx             # 主应用组件
│       ├── components/
│       │   ├── VolumeViewer.tsx     # 体积渲染核心组件
│       │   └── ControlPanel.tsx     # 控制面板
│       ├── shaders/
│       │   ├── raymarch.vert        # 顶点着色器
│       │   └── raymarch.frag        # 片元着色器（光线投射核心）
│       ├── services/
│       │   └── websocketClient.ts   # WebSocket 数据客户端
│       ├── utils/
│       │   └── volumeUtils.ts       # 体数据工具函数
│       └── types/
│           └── volume.ts            # TypeScript 类型定义
└── README.md
```

---

## 快速开始

### 方式一：前端演示模式（推荐快速体验）

无需后端，前端内置模拟数据生成器。

```bash
cd frontend
npm install
npm run dev
```

打开浏览器访问 `http://localhost:5173`，点击右侧面板的 **"加载演示数据"** 按钮即可查看 3D 体积渲染效果。

### 方式二：完整前后端模式（Python 后端）

Python 版本后端用于快速开发和演示。

**1. 启动后端服务**
```bash
cd backend
pip install websockets numpy
python volume_server.py
```

**2. 启动前端**
```bash
cd frontend
npm install
npm run dev
```

**3. 访问应用**
- 打开 `http://localhost:5173`
- 前端会自动连接后端 WebSocket 服务 (ws://localhost:8080)
- 连接成功后自动接收并渲染体数据

### 方式三：生产级 C++ 后端

C++ 版本提供最高性能，适合生产环境。

**编译要求：**
- CMake 3.15+
- C++17 编译器
- 可选：HDF5 库（用于真实数据加载）

**编译步骤：**
```bash
cd backend
mkdir build && cd build
cmake ..
cmake --build . --config Release
```

**运行：**
```bash
./cargo_xray_server --port 8080
```

---

## 核心技术详解

### 光线投射 (Raymarching) 算法

片元着色器中实现的体积渲染核心流程：

```glsl
// 1. 计算光线与包围盒交点
vec2 tHit = intersectBox(rayOrigin, rayDir, boxMin, boxMax);

// 2. 沿光线步进采样
for (int i = 0; i < MAX_SAMPLES; i++) {
    vec3 uvw = startPos + rayDir * stepSize * float(i);
    
    // 3. 采样 3D 纹理
    float density = texture(uDensityTexture, uvw).r;
    float zeff = texture(uZEffectiveTexture, uvw).r;
    
    // 4. 传递函数映射
    vec4 color = sampleTransferFunction(density, zeff);
    
    // 5. 智能检测高亮
    if (isHeavyMetal(density, zeff)) {
        color.rgb = mix(color.rgb, HEAVY_METAL_COLOR, factor);
    }
    
    // 6. 前置合成 (Front-to-back compositing)
    accumColor.rgb += color.rgb * alpha * (1.0 - accumOpacity);
    accumOpacity += alpha * (1.0 - accumOpacity);
    
    if (accumOpacity >= 0.99) break; // 提前终止
}
```

### 违禁品识别算法

基于密度与有效原子序数双参数联合判定：

| 物质类型 | 密度范围 | Z-effective 范围 | 高亮颜色 |
|---------|---------|-----------------|---------|
| 普通货物 | 0.0 - 0.4 | 0.0 - 0.4 | 蓝青色 |
| 有机物 | 0.4 - 0.6 | 0.3 - 0.5 | 黄绿色 |
| 违禁品 | 0.65 - 0.85 | 0.4 - 0.7 | 金黄色 |
| 钢材 | 0.7 - 0.9 | 0.6 - 0.85 | 橙黄色 |
| 重金属 | 0.5 - 1.0 | 0.75 - 1.0 | 亮橙红色 |

### 二进制传输协议

```
┌───────────────┬─────────────────────┬──────────────────────┐
│  slice_index  │   density slice     │  z-effective slice   │
│   (4 bytes)   │ (width * height B)  │  (width * height B)  │
│   uint32 LE   │     uint8 数组      │     uint8 数组       │
└───────────────┴─────────────────────┴──────────────────────┘
```

---

## 性能指标

| 数据规模 | 采样率 | 帧率 (RTX 3060) | 数据带宽 |
|---------|--------|-----------------|---------|
| 128³ | 256 | ~120 FPS | ~2 MB/帧 |
| 256³ | 256 | ~60 FPS | ~16 MB/帧 |
| 512³ | 128 | ~30 FPS | ~128 MB/帧 |

> 性能数据为参考值，实际性能取决于 GPU 型号与场景复杂度。

---

## 操作说明

| 操作 | 效果 |
|-----|------|
| 鼠标左键拖拽 | 旋转视角 |
| 鼠标滚轮 | 缩放 |
| 右侧面板 | 调节渲染参数 |
| 切片平面开关 | 显示/隐藏剖切效果 |
| 重金属高亮 | 橙红色标记高密度高 Z 值区域 |
| 违禁品高亮 | 金黄色标记可疑物品 |

---

## 技术栈

### 前端
- **React 18** - UI 框架
- **Three.js 0.160** - WebGL 渲染引擎
- **GLSL ES 3.0** - 自定义着色器
- **Vite** - 构建工具
- **TypeScript** - 类型安全

### 后端 (C++)
- **C++17** - 核心语言
- **原生 Socket** - 高性能网络传输
- **WebSocket 协议** - 浏览器兼容
- **零拷贝设计** - 最小化内存开销
- **CMake** - 构建系统

### 后端 (Python)
- **Python 3.8+** - 快速原型
- **websockets** - WebSocket 库
- **NumPy** - 数值计算
- 用于开发测试与快速演示

---

## 扩展开发

### 添加真实 HDF5 数据支持

C++ 后端已预留 HDF5 接口，编译时启用：
```bash
cmake .. -DBUILD_HDF5_SUPPORT=ON
```

### 自定义传递函数

修改 `frontend/src/types/volume.ts` 中的 `DEFAULT_TRANSFER_FUNCTION`，
或在控制面板中动态调节。

### 接入真实扫描仪

实现 `DataSource` 接口，替换 `SimulatedDataGenerator` 即可接入真实硬件数据流。

---

## License

MIT License
