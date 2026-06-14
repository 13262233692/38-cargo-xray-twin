import React, { useState, useEffect, useCallback } from 'react';
import VolumeViewer from './components/VolumeViewer';
import ControlPanel from './components/ControlPanel';
import TomographySliceViewer from './components/TomographySliceViewer';
import AnalysisResultPanel from './components/AnalysisResultPanel';
import ContrabandAlertPanel from './components/ContrabandAlertPanel';
import {
  VolumeData,
  VolumeRenderingSettings,
  TransferFunction,
  DEFAULT_RENDERING_SETTINGS,
  DEFAULT_TRANSFER_FUNCTION,
  ROIBoundingBox,
  TomographySliceData,
  QuantitativeAnalysisResult,
  ContrabandAlert,
  SuspiciousRegion
} from './types/volume';
import { generateMockVolumeData } from './utils/volumeUtils';
import { VolumeDataStreamService } from './services/websocketClient';
import { tomographyService } from './services/tomographyService';

const App: React.FC = () => {
  const [volumeData, setVolumeData] = useState<VolumeData | null>(null);
  const [settings, setSettings] = useState<VolumeRenderingSettings>(DEFAULT_RENDERING_SETTINGS);
  const [transferFunction, setTransferFunction] = useState<TransferFunction>(DEFAULT_TRANSFER_FUNCTION);
  const [status, setStatus] = useState<string>('等待连接后端网关...');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [performanceWarning, setPerformanceWarning] = useState<string | null>(null);
  const [webglError, setWebglError] = useState<string | null>(null);
  
  const [tomographMode, setTomographMode] = useState(false);
  const [roiSelection, setRoiSelection] = useState<ROIBoundingBox | null>(null);
  const [slicePosition, setSlicePosition] = useState(0.5);
  const [viewMode, setViewMode] = useState<'density' | 'zeff' | 'pseudocolor'>('pseudocolor');
  const [sliceData, setSliceData] = useState<TomographySliceData | null>(null);
  const [analysisResult, setAnalysisResult] = useState<QuantitativeAnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisTime, setAnalysisTime] = useState<number | undefined>(undefined);
  const [alerts, setAlerts] = useState<ContrabandAlert[]>([]);
  const [highlightRegion, setHighlightRegion] = useState<SuspiciousRegion | null>(null);
  const [showAnalysisPanel, setShowAnalysisPanel] = useState(false);

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
    setSliceData(null);
    setAnalysisResult(null);
    setRoiSelection(null);
    setAlerts([]);
    
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

  const handleTomographModeChange = useCallback((enabled: boolean) => {
    setTomographMode(enabled);
    if (!enabled) {
      setRoiSelection(null);
      setSliceData(null);
      setShowAnalysisPanel(false);
    }
  }, []);

  const handleROISelectionChange = useCallback((roi: ROIBoundingBox | null) => {
    setRoiSelection(roi);
  }, []);

  const handleROISelectionComplete = useCallback((roi: ROIBoundingBox) => {
    console.log('[Tomography] ROI selected:', roi);
    setRoiSelection(roi);
  }, []);

  const handleAnalyzeROI = useCallback(async () => {
    if (!volumeData || !roiSelection) return;

    setIsAnalyzing(true);
    setShowAnalysisPanel(true);
    
    try {
      const startTime = performance.now();
      
      const slicePlane = {
        origin: [0.5, 0.5, slicePosition] as [number, number, number],
        normal: [0, 0, 1] as [number, number, number],
        up: [0, 1, 0] as [number, number, number]
      };

      const [slice, analysis] = await Promise.all([
        tomographyService.extractSlice(volumeData, slicePlane, 256),
        tomographyService.analyzeRegion(volumeData, roiSelection)
      ]);

      setSliceData(slice);
      setAnalysisResult(analysis);
      setAnalysisTime(performance.now() - startTime);

      const newAlerts = tomographyService.generateAlerts(analysis);
      if (newAlerts.length > 0) {
        setAlerts(prev => [...newAlerts, ...prev]);
        
        if (Notification.permission === 'granted') {
          new Notification('🚨 走私警报', {
            body: `检测到 ${newAlerts.length} 个可疑物品`,
            icon: '⚠️'
          });
        }
      }

      console.log('[Tomography] Analysis complete:', analysis);
    } catch (error) {
      console.error('[Tomography] Analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [volumeData, roiSelection, slicePosition]);

  const handleSlicePositionChange = useCallback(async (pos: number) => {
    setSlicePosition(pos);
    
    if (volumeData && tomographMode) {
      try {
        const slicePlane = {
          origin: [0.5, 0.5, pos] as [number, number, number],
          normal: [0, 0, 1] as [number, number, number],
          up: [0, 1, 0] as [number, number, number]
        };
        const slice = await tomographyService.extractSlice(volumeData, slicePlane, 256);
        setSliceData(slice);
      } catch (error) {
        console.error('[Tomography] Slice extraction failed:', error);
      }
    }
  }, [volumeData, tomographMode]);

  const handleAcknowledgeAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(a => 
      a.id === alertId ? { ...a, acknowledged: true } : a
    ));
  }, []);

  const handleViewAlert = useCallback((alert: ContrabandAlert) => {
    const region: SuspiciousRegion = {
      center: alert.location,
      size: alert.size,
      avgDensity: alert.avgDensity,
      avgZeff: alert.avgZeff,
      maxDensity: alert.avgDensity * 1.2,
      maxZeff: alert.avgZeff * 1.2,
      volumeVoxels: 0,
      type: alert.type
    };
    setHighlightRegion(region);
  }, []);

  const handleViewRegion = useCallback((region: SuspiciousRegion) => {
    setHighlightRegion(region);
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
      tomographyService.dispose();
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
        tomographMode={tomographMode}
        roiSelection={roiSelection}
        onROISelectionChange={handleROISelectionChange}
        onROISelectionComplete={handleROISelectionComplete}
        slicePlanePosition={slicePosition}
        highlightRegion={highlightRegion}
      />
      
      <ControlPanel
        settings={settings}
        onSettingsChange={setSettings}
        transferFunction={transferFunction}
        onTransferFunctionChange={setTransferFunction}
        status={status}
        isConnected={isConnected}
        onLoadDemo={loadDemoData}
        tomographMode={tomographMode}
        onTomographModeChange={handleTomographModeChange}
        slicePosition={slicePosition}
        onSlicePositionChange={handleSlicePositionChange}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAnalyzeROI={handleAnalyzeROI}
        isAnalyzing={isAnalyzing}
        hasROI={!!roiSelection}
      />

      {tomographMode && showAnalysisPanel && (
        <div style={{
          position: 'absolute',
          left: '0',
          top: '0',
          width: '300px',
          height: '100%',
          background: 'rgba(15, 15, 25, 0.95)',
          borderRight: '1px solid #333355',
          padding: '16px',
          overflowY: 'auto',
          backdropFilter: 'blur(10px)',
          zIndex: 90
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px'
          }}>
            <h3 style={{
              color: '#ffaa33',
              fontSize: '14px',
              fontWeight: 600,
              margin: 0
            }}>
              🔬 断层分析结果
            </h3>
            <button
              onClick={() => setShowAnalysisPanel(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#667788',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '4px'
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <div style={{
              fontSize: '11px',
              color: '#88aacc',
              marginBottom: '8px',
              fontWeight: 600
            }}>
              断层切片预览
            </div>
            <TomographySliceViewer
              sliceData={sliceData}
              analysis={analysisResult}
              isAnalyzing={isAnalyzing}
              viewMode={viewMode}
              slicePosition={slicePosition}
              onSlicePositionChange={setSlicePosition}
              analysisTime={analysisTime}
            />
          </div>

          <div>
            <div style={{
              fontSize: '11px',
              color: '#88aacc',
              marginBottom: '8px',
              fontWeight: 600
            }}>
              定量分析
            </div>
            <AnalysisResultPanel
              analysis={analysisResult}
              isAnalyzing={isAnalyzing}
              onViewRegion={handleViewRegion}
            />
          </div>
        </div>
      )}

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

      <ContrabandAlertPanel
        alerts={alerts}
        onAcknowledge={handleAcknowledgeAlert}
        onViewAlert={handleViewAlert}
      />

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
