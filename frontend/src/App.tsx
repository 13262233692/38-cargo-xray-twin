import React, { useState, useEffect, useCallback } from 'react';
import VolumeViewer from './components/VolumeViewer';
import ControlPanel from './components/ControlPanel';
import {
  VolumeData,
  VolumeRenderingSettings,
  TransferFunction,
  DEFAULT_RENDERING_SETTINGS,
  DEFAULT_TRANSFER_FUNCTION
} from './types/volume';
import { generateMockVolumeData } from './utils/volumeUtils';
import { VolumeDataStreamService } from './services/websocketClient';

const App: React.FC = () => {
  const [volumeData, setVolumeData] = useState<VolumeData | null>(null);
  const [settings, setSettings] = useState<VolumeRenderingSettings>(DEFAULT_RENDERING_SETTINGS);
  const [transferFunction, setTransferFunction] = useState<TransferFunction>(DEFAULT_TRANSFER_FUNCTION);
  const [status, setStatus] = useState<string>('等待连接后端网关...');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [performanceWarning, setPerformanceWarning] = useState<string | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);

  const handlePerformanceWarning = useCallback((message: string) => {
    console.warn('[Performance]', message);
    setPerformanceWarning(message);
    
    setSettings(prev => {
      const newSampleRate = Math.max(64, Math.floor(prev.sampleRate * 0.7));
      if (newSampleRate === prev.sampleRate) return prev;
      
      console.log(`[Performance] 自动降低采样率: ${prev.sampleRate} -> ${newSampleRate}`);
      return {
        ...prev,
        sampleRate: newSampleRate
      };
    });
    
    setTimeout(() => setPerformanceWarning(null), 5000);
  }, []);

  const handleWebGLError = useCallback((error: string) => {
    console.error('[WebGL]', error);
    setWebglError(error);
  }, []);

  const loadDemoData = useCallback(() => {
    setStatus('生成演示体数据...');
    setPerformanceWarning(null);
    setWebglError(null);
    
    const width = 128;
    const height = 128;
    const depth = 128;
    
    setTimeout(() => {
      const { densityData, zEffectiveData } = generateMockVolumeData(width, height, depth);
      
      setVolumeData({
        dimensions: { width, height, depth },
        densityData,
        zEffectiveData,
        spacing: { x: 1, y: 1, z: 1 }
      });
      
      setStatus('演示数据已加载');
      setIsConnected(true);
    }, 100);
  }, []);

  useEffect(() => {
    const wsService = new VolumeDataStreamService();
    
    wsService.onStatus((newStatus, connected) => {
      setStatus(newStatus);
      setIsConnected(connected);
    });

    wsService.onData((data) => {
      setVolumeData(data);
    });

    wsService.connect();

    return () => {
      wsService.disconnect();
    };
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <VolumeViewer
        volumeData={volumeData}
        settings={settings}
        transferFunction={transferFunction}
        onPerformanceWarning={handlePerformanceWarning}
        onWebGLError={handleWebGLError}
      />
      
      <ControlPanel
        settings={settings}
        onSettingsChange={setSettings}
        transferFunction={transferFunction}
        onTransferFunctionChange={setTransferFunction}
        status={status}
        isConnected={isConnected}
        onLoadDemo={loadDemoData}
      />

      {performanceWarning && (
        <div style={{
          position: 'absolute',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          background: 'rgba(255, 150, 50, 0.95)',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '6px',
          fontSize: '14px',
          fontWeight: 600,
          zIndex: 200,
          boxShadow: '0 4px 12px rgba(255, 150, 50, 0.4)',
          animation: 'slideDown 0.3s ease-out'
        }}>
          ⚠️ {performanceWarning}
        </div>
      )}

      {webglError && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(200, 50, 50, 0.95)',
          color: '#fff',
          padding: '24px 32px',
          borderRadius: '8px',
          fontSize: '14px',
          zIndex: 1000,
          textAlign: 'center',
          maxWidth: '400px'
        }}>
          <h3 style={{ marginBottom: '12px' }}>🚨 GPU 过载保护</h3>
          <p style={{ marginBottom: '16px', lineHeight: 1.5 }}>{webglError}</p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              background: '#fff',
              color: '#c83232',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            刷新页面
          </button>
        </div>
      )}

      <div style={{
        position: 'absolute',
        left: '20px',
        top: '20px',
        pointerEvents: 'none',
        zIndex: 50
      }}>
        <div style={{
          background: 'rgba(0, 0, 0, 0.6)',
          padding: '12px 16px',
          borderRadius: '8px',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(100, 150, 255, 0.2)'
        }}>
          <div style={{ color: '#66aaff', fontSize: '11px', marginBottom: '4px' }}>
            双能 X 射线扫描
          </div>
          <div style={{ color: '#ffffff', fontSize: '20px', fontWeight: 700 }}>
            集装箱 #CRG-2847
          </div>
          <div style={{ color: '#88aacc', fontSize: '11px', marginTop: '4px' }}>
            扫描时间: 2026-06-14 21:30:00
          </div>
        </div>
      </div>

      <div style={{
        position: 'absolute',
        left: '20px',
        bottom: '20px',
        pointerEvents: 'none',
        zIndex: 50
      }}>
        <div style={{
          background: 'rgba(0, 0, 0, 0.6)',
          padding: '10px 14px',
          borderRadius: '8px',
          backdropFilter: 'blur(4px)',
          fontSize: '11px'
        }}>
          <div style={{ color: '#ff8844', marginBottom: '6px', fontWeight: 600 }}>
            图例
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ width: '12px', height: '12px', background: '#ff4400', borderRadius: '2px' }} />
            <span style={{ color: '#ccccdd' }}>高密度 / 重金属</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{ width: '12px', height: '12px', background: '#ffcc00', borderRadius: '2px' }} />
            <span style={{ color: '#ccccdd' }}>违禁品 / 可疑物品</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '12px', height: '12px', background: '#6699cc', borderRadius: '2px' }} />
            <span style={{ color: '#ccccdd' }}>普通货物 / 低密度</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default App;
