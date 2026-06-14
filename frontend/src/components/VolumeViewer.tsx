import React, { useRef, useEffect, useCallback, useState } from 'react';
import * as THREE from 'three';
import { VolumeData, VolumeRenderingSettings, TransferFunction } from '../types/volume';
import { buildTransferFunctionTextureData } from '../utils/volumeUtils';

import vertShader from '../shaders/raymarch.vert?raw';
import fragShader from '../shaders/raymarch.frag?raw';

interface VolumeViewerProps {
  volumeData: VolumeData | null;
  settings: VolumeRenderingSettings;
  transferFunction: TransferFunction;
  className?: string;
  onPerformanceWarning?: (message: string) => void;
  onWebGLError?: (error: string) => void;
}

const VolumeViewer: React.FC<VolumeViewerProps> = ({
  volumeData,
  settings,
  transferFunction,
  className,
  onPerformanceWarning,
  onWebGLError
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const volumeMeshRef = useRef<THREE.Mesh | null>(null);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const animationIdRef = useRef<number>(0);
  const isDraggingRef = useRef(false);
  const previousMouseRef = useRef({ x: 0, y: 0 });
  const rotationRef = useRef({ x: 0.5, y: 0.5 });
  const zoomRef = useRef(2.5);
  const densityTextureRef = useRef<THREE.Texture | null>(null);
  const zeffTextureRef = useRef<THREE.Texture | null>(null);
  const tfDensityTextureRef = useRef<THREE.DataTexture | null>(null);
  const tfZeffTextureRef = useRef<THREE.DataTexture | null>(null);

  const frameTimeRef = useRef<number[]>([]);
  const lastQualityReductionRef = useRef<number>(0);
  const webglContextLostRef = useRef(false);

  const [isContextLost, setIsContextLost] = useState(false);

  const getCameraDistance = useCallback(() => {
    if (!cameraRef.current) return 3.0;
    return cameraRef.current.position.length();
  }, []);

  const reduceRenderQuality = useCallback((reason: string) => {
    const now = Date.now();
    if (now - lastQualityReductionRef.current < 1000) return;
    lastQualityReductionRef.current = now;

    if (onPerformanceWarning) {
      onPerformanceWarning(reason);
    }
  }, [onPerformanceWarning]);

  const monitorPerformance = useCallback(() => {
    const now = performance.now();
    frameTimeRef.current.push(now);
    
    if (frameTimeRef.current.length > 30) {
      frameTimeRef.current.shift();
      
      const avgFrameTime = (now - frameTimeRef.current[0]) / frameTimeRef.current.length;
      const fps = 1000 / avgFrameTime;
      
      if (fps < 15 && !isDraggingRef.current) {
        reduceRenderQuality(`帧率过低 (${fps.toFixed(1)} FPS)，已启用性能保护模式`);
      }
    }
  }, [reduceRenderQuality]);

  const initScene = useCallback(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a12);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      45,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 3);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: false
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    renderer.domElement.addEventListener('webglcontextlost', (event) => {
      event.preventDefault();
      webglContextLostRef.current = true;
      setIsContextLost(true);
      if (onWebGLError) {
        onWebGLError('WebGL 上下文丢失，这通常是由于 GPU 负载过高导致。请刷新页面重试。');
      }
      console.error('[VolumeViewer] WebGL context lost');
    });

    renderer.domElement.addEventListener('webglcontextrestored', () => {
      webglContextLostRef.current = false;
      setIsContextLost(false);
      console.log('[VolumeViewer] WebGL context restored');
    });

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const gridHelper = new THREE.GridHelper(2, 20, 0x333344, 0x222233);
    gridHelper.position.y = -0.8;
    scene.add(gridHelper);

    const animate = () => {
      if (webglContextLostRef.current) {
        animationIdRef.current = requestAnimationFrame(animate);
        return;
      }
      
      animationIdRef.current = requestAnimationFrame(animate);
      updateCamera();
      
      if (materialRef.current && cameraRef.current) {
        materialRef.current.uniforms.uCameraDistance.value = getCameraDistance();
      }
      
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        try {
          renderer.render(scene, camera);
          monitorPerformance();
        } catch (e) {
          console.error('[VolumeViewer] Render error:', e);
        }
      }
    };
    animate();
  }, [getCameraDistance, monitorPerformance, onWebGLError]);

  const updateCamera = useCallback(() => {
    if (!cameraRef.current) return;

    const camera = cameraRef.current;
    const radius = zoomRef.current;
    const x = radius * Math.sin(rotationRef.current.y) * Math.cos(rotationRef.current.x);
    const y = radius * Math.sin(rotationRef.current.x);
    const z = radius * Math.cos(rotationRef.current.y) * Math.cos(rotationRef.current.x);

    camera.position.set(x, y, z);
    camera.lookAt(0, 0, 0);
  }, []);

  const createVolumeTexture = useCallback((data: Uint8Array, width: number, height: number, depth: number): THREE.Texture => {
    const texture = new (THREE as any).Data3DTexture(
      new Uint8Array(data),
      width,
      height,
      depth
    );
    texture.format = THREE.RedFormat;
    texture.type = THREE.UnsignedByteType;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.wrapR = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture as THREE.Texture;
  }, []);

  const createTransferTexture = useCallback((data: Uint8Array): THREE.DataTexture => {
    const texture = new THREE.DataTexture(
      new Uint8Array(data),
      data.length / 4,
      1,
      THREE.RGBAFormat,
      THREE.UnsignedByteType
    );
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
    return texture;
  }, []);

  const createVolumeMesh = useCallback(() => {
    if (!sceneRef.current || !volumeData) return;

    if (volumeMeshRef.current) {
      sceneRef.current.remove(volumeMeshRef.current);
      volumeMeshRef.current.geometry.dispose();
      if (volumeMeshRef.current.material) {
        (volumeMeshRef.current.material as THREE.Material).dispose();
      }
    }

    const { width, height, depth } = volumeData.dimensions;

    if (densityTextureRef.current) densityTextureRef.current.dispose();
    if (zeffTextureRef.current) zeffTextureRef.current.dispose();

    densityTextureRef.current = createVolumeTexture(
      volumeData.densityData,
      width, height, depth
    );
    zeffTextureRef.current = createVolumeTexture(
      volumeData.zEffectiveData,
      width, height, depth
    );

    const tfData = buildTransferFunctionTextureData(transferFunction);
    if (tfDensityTextureRef.current) tfDensityTextureRef.current.dispose();
    if (tfZeffTextureRef.current) tfZeffTextureRef.current.dispose();
    
    tfDensityTextureRef.current = createTransferTexture(tfData.densityData);
    tfZeffTextureRef.current = createTransferTexture(tfData.zeffData);

    const adaptiveStepEnabled = settings.adaptiveStepEnabled ?? true;
    const maxStepFactor = settings.maxStepFactor ?? 3.0;
    const minStepFactor = settings.minStepFactor ?? 0.5;

    const material = new THREE.ShaderMaterial({
      vertexShader: vertShader,
      fragmentShader: fragShader,
      uniforms: {
        uDensityTexture: { value: densityTextureRef.current },
        uZEffectiveTexture: { value: zeffTextureRef.current },
        uTransferFunctionDensity: { value: tfDensityTextureRef.current },
        uTransferFunctionZeff: { value: tfZeffTextureRef.current },
        uVolumeSize: { value: new THREE.Vector3(width, height, depth) },
        uSampleRate: { value: settings.sampleRate },
        uBrightness: { value: settings.brightness },
        uContrast: { value: settings.contrast },
        uSlicePlane: { value: new THREE.Vector3(
          settings.slicePlane.x,
          settings.slicePlane.y,
          settings.slicePlane.z
        )},
        uSliceEnabled: { value: new THREE.Vector3(
          settings.sliceEnabled.x ? 1.0 : 0.0,
          settings.sliceEnabled.y ? 1.0 : 0.0,
          settings.sliceEnabled.z ? 1.0 : 0.0
        )},
        uHighlightHeavyMetals: { value: settings.highlightHeavyMetals ? 1.0 : 0.0 },
        uHighlightContraband: { value: settings.highlightContraband ? 1.0 : 0.0 },
        uCameraPos: { value: new THREE.Vector3() },
        uInverseModelMatrix: { value: new THREE.Matrix4() },
        uCameraDistance: { value: getCameraDistance() },
        uAdaptiveStepEnabled: { value: adaptiveStepEnabled ? 1.0 : 0.0 },
        uMaxStepFactor: { value: maxStepFactor },
        uMinStepFactor: { value: minStepFactor }
      },
      transparent: true,
      side: THREE.BackSide,
      depthWrite: false
    });

    materialRef.current = material;

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const mesh = new THREE.Mesh(geometry, material);
    sceneRef.current.add(mesh);
    volumeMeshRef.current = mesh;

    const edges = new THREE.EdgesGeometry(geometry);
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x4488ff, transparent: true, opacity: 0.3 });
    const edgeLines = new THREE.LineSegments(edges, edgeMaterial);
    mesh.add(edgeLines);
  }, [volumeData, settings, transferFunction, createVolumeTexture, createTransferTexture, getCameraDistance]);

  useEffect(() => {
    if (!materialRef.current) return;

    const material = materialRef.current;
    material.uniforms.uSampleRate.value = settings.sampleRate;
    material.uniforms.uBrightness.value = settings.brightness;
    material.uniforms.uContrast.value = settings.contrast;
    material.uniforms.uSlicePlane.value.set(
      settings.slicePlane.x,
      settings.slicePlane.y,
      settings.slicePlane.z
    );
    material.uniforms.uSliceEnabled.value.set(
      settings.sliceEnabled.x ? 1.0 : 0.0,
      settings.sliceEnabled.y ? 1.0 : 0.0,
      settings.sliceEnabled.z ? 1.0 : 0.0
    );
    material.uniforms.uHighlightHeavyMetals.value = settings.highlightHeavyMetals ? 1.0 : 0.0;
    material.uniforms.uHighlightContraband.value = settings.highlightContraband ? 1.0 : 0.0;
    material.uniforms.uAdaptiveStepEnabled.value = (settings.adaptiveStepEnabled ?? true) ? 1.0 : 0.0;
    material.uniforms.uMaxStepFactor.value = settings.maxStepFactor ?? 3.0;
    material.uniforms.uMinStepFactor.value = settings.minStepFactor ?? 0.5;
  }, [settings]);

  useEffect(() => {
    if (!materialRef.current) return;

    const tfData = buildTransferFunctionTextureData(transferFunction);
    
    if (tfDensityTextureRef.current) {
      tfDensityTextureRef.current.image.data.set(tfData.densityData);
      tfDensityTextureRef.current.needsUpdate = true;
    }
    if (tfZeffTextureRef.current) {
      tfZeffTextureRef.current.image.data.set(tfData.zeffData);
      tfZeffTextureRef.current.needsUpdate = true;
    }
  }, [transferFunction]);

  useEffect(() => {
    if (volumeData && sceneRef.current && !webglContextLostRef.current) {
      createVolumeMesh();
    }
  }, [volumeData, createVolumeMesh]);

  useEffect(() => {
    initScene();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (rendererRef.current && containerRef.current) {
        containerRef.current.removeChild(rendererRef.current.domElement);
        rendererRef.current.dispose();
      }
      if (densityTextureRef.current) densityTextureRef.current.dispose();
      if (zeffTextureRef.current) zeffTextureRef.current.dispose();
      if (tfDensityTextureRef.current) tfDensityTextureRef.current.dispose();
      if (tfZeffTextureRef.current) tfZeffTextureRef.current.dispose();
    };
  }, [initScene]);

  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;
      
      const width = containerRef.current.clientWidth;
      const height = containerRef.current.clientHeight;
      
      cameraRef.current.aspect = width / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;

    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      previousMouseRef.current = { x: e.clientX, y: e.clientY };
      frameTimeRef.current = [];
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;

      const deltaX = e.clientX - previousMouseRef.current.x;
      const deltaY = e.clientY - previousMouseRef.current.y;

      rotationRef.current.y += deltaX * 0.005;
      rotationRef.current.x += deltaY * 0.005;
      rotationRef.current.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, rotationRef.current.x));

      previousMouseRef.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      frameTimeRef.current = [];
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomSpeed = 0.001;
      const oldZoom = zoomRef.current;
      zoomRef.current += e.deltaY * zoomSpeed;
      zoomRef.current = Math.max(1.2, Math.min(10, zoomRef.current));
      
      const zoomChange = Math.abs(zoomRef.current - oldZoom) / oldZoom;
      if (zoomChange > 0.1) {
        frameTimeRef.current = [];
      }
    };

    container.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    container.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      container.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      container.removeEventListener('wheel', handleWheel);
    };
  }, []);

  useEffect(() => {
    const updateUniforms = () => {
      if (materialRef.current && cameraRef.current && volumeMeshRef.current) {
        const material = materialRef.current;
        const camera = cameraRef.current;
        const mesh = volumeMeshRef.current;

        material.uniforms.uCameraPos.value.copy(camera.position);
        
        const inverseMatrix = mesh.matrixWorld.clone().invert();
        material.uniforms.uInverseModelMatrix.value.copy(inverseMatrix);
      }
      requestAnimationFrame(updateUniforms);
    };
    const id = requestAnimationFrame(updateUniforms);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ width: '100%', height: '100%', position: 'relative', cursor: 'grab' }}
    >
      {isContextLost && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(20, 20, 40, 0.95)',
          padding: '24px 32px',
          borderRadius: '8px',
          textAlign: 'center',
          border: '1px solid #ff4444',
          zIndex: 1000
        }}>
          <h3 style={{ color: '#ff6666', marginBottom: '12px' }}>⚠️ GPU 过载保护</h3>
          <p style={{ color: '#ccccdd', fontSize: '14px', marginBottom: '16px' }}>
            WebGL 上下文因 GPU 负载过高而丢失
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '8px 16px',
              background: '#ff6633',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            刷新页面
          </button>
        </div>
      )}
    </div>
  );
};

export default VolumeViewer;
