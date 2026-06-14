import React from 'react';
import { VolumeRenderingSettings, TransferFunction, TransferFunctionPoint } from '../types/volume';

interface ControlPanelProps {
  settings: VolumeRenderingSettings;
  onSettingsChange: (settings: VolumeRenderingSettings) => void;
  transferFunction: TransferFunction;
  onTransferFunctionChange: (tf: TransferFunction) => void;
  status: string;
  isConnected: boolean;
  onLoadDemo: () => void;
  tomographMode?: boolean;
  onTomographModeChange?: (enabled: boolean) => void;
  slicePosition?: number;
  onSlicePositionChange?: (pos: number) => void;
  viewMode?: 'density' | 'zeff' | 'pseudocolor';
  onViewModeChange?: (mode: 'density' | 'zeff' | 'pseudocolor') => void;
  onAnalyzeROI?: () => void;
  isAnalyzing?: boolean;
  hasROI?: boolean;
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  settings,
  onSettingsChange,
  transferFunction,
  onTransferFunctionChange,
  status,
  isConnected,
  onLoadDemo,
  tomographMode = false,
  onTomographModeChange,
  slicePosition = 0.5,
  onSlicePositionChange,
  viewMode = 'pseudocolor',
  onViewModeChange,
  onAnalyzeROI,
  isAnalyzing = false,
  hasROI = false
}) => {
  const updateSetting = <K extends keyof VolumeRenderingSettings>(
    key: K,
    value: VolumeRenderingSettings[K]
  ) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  const updateSlicePlane = (axis: 'x' | 'y' | 'z', value: number) => {
    updateSetting('slicePlane', {
      ...settings.slicePlane,
      [axis]: value
    });
  };

  const toggleSlice = (axis: 'x' | 'y' | 'z') => {
    updateSetting('sliceEnabled', {
      ...settings.sliceEnabled,
      [axis]: !settings.sliceEnabled[axis]
    });
  };

  const updateTFPoint = (
    type: 'density' | 'zEffective',
    index: number,
    field: keyof TransferFunctionPoint,
    value: number
  ) => {
    const key = type === 'density' ? 'densityPoints' : 'zEffectivePoints';
    const points = [...transferFunction[key]];
    const point = { ...points[index] };
    
    if (field === 'color') {
      point.color = [...point.color] as [number, number, number];
    }
    
    (point as any)[field] = value;
    points[index] = point;
    
    onTransferFunctionChange({
      ...transferFunction,
      [key]: points
    });
  };

  const sliderStyle = {
    width: '100%',
    height: '4px',
    background: '#2a2a3a',
    borderRadius: '2px',
    outline: 'none',
    cursor: 'pointer',
    appearance: 'none' as const
  };

  return (
    <div style={{
      position: 'absolute',
      right: 0,
      top: 0,
      width: '320px',
      height: '100%',
      background: 'rgba(15, 15, 25, 0.95)',
      borderLeft: '1px solid #333355',
      padding: '16px',
      overflowY: 'auto',
      backdropFilter: 'blur(10px)',
      zIndex: 100
    }}>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{
          color: '#ff8844',
          fontSize: '18px',
          marginBottom: '8px',
          fontWeight: 600
        }}>
          Cargo X-Ray 3D
        </h2>
        <p style={{ color: '#8888aa', fontSize: '12px', marginBottom: '12px' }}>
          海关安检体积渲染系统
        </p>
        
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          background: isConnected ? 'rgba(0, 200, 100, 0.15)' : 'rgba(255, 100, 100, 0.15)',
          borderRadius: '6px',
          fontSize: '12px'
        }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isConnected ? '#00cc66' : '#ff4444',
            animation: isConnected ? 'pulse 2s infinite' : 'none'
          }} />
          <span style={{ color: isConnected ? '#66ff99' : '#ff8888' }}>{status}</span>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <button
          onClick={onLoadDemo}
          style={{
            width: '100%',
            padding: '10px 16px',
            background: 'linear-gradient(135deg, #ff6633 0%, #ff9944 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            boxShadow: '0 2px 8px rgba(255, 102, 51, 0.3)'
          }}
        >
          加载演示数据
        </button>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{
          color: '#aaaacc',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid #333355',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          渲染参数
        </h3>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ color: '#ccccdd', fontSize: '12px' }}>采样率</label>
            <span style={{ color: '#ffaa66', fontSize: '12px', fontFamily: 'monospace' }}>
              {settings.sampleRate}
            </span>
          </div>
          <input
            type="range"
            min="64"
            max="1024"
            step="32"
            value={settings.sampleRate}
            onChange={(e) => updateSetting('sampleRate', parseInt(e.target.value))}
            style={sliderStyle}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ color: '#ccccdd', fontSize: '12px' }}>亮度</label>
            <span style={{ color: '#ffaa66', fontSize: '12px', fontFamily: 'monospace' }}>
              {settings.brightness.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.05"
            value={settings.brightness}
            onChange={(e) => updateSetting('brightness', parseFloat(e.target.value))}
            style={sliderStyle}
          />
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ color: '#ccccdd', fontSize: '12px' }}>对比度</label>
            <span style={{ color: '#ffaa66', fontSize: '12px', fontFamily: 'monospace' }}>
              {settings.contrast.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0.1"
            max="3"
            step="0.05"
            value={settings.contrast}
            onChange={(e) => updateSetting('contrast', parseFloat(e.target.value))}
            style={sliderStyle}
          />
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{
          color: '#aaaacc',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid #333355',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          切片平面
        </h3>

        {(['x', 'y', 'z'] as const).map((axis) => (
          <div key={axis} style={{ marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <input
                type="checkbox"
                checked={settings.sliceEnabled[axis]}
                onChange={() => toggleSlice(axis)}
                style={{ cursor: 'pointer' }}
              />
              <label style={{ color: '#ccccdd', fontSize: '12px', textTransform: 'uppercase' }}>
                {axis}轴切片
              </label>
              <span style={{
                marginLeft: 'auto',
                color: '#66aaff',
                fontSize: '11px',
                fontFamily: 'monospace'
              }}>
                {(settings.slicePlane[axis] * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.slicePlane[axis]}
              onChange={(e) => updateSlicePlane(axis, parseFloat(e.target.value))}
              disabled={!settings.sliceEnabled[axis]}
              style={{ ...sliderStyle, opacity: settings.sliceEnabled[axis] ? 1 : 0.3 }}
            />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{
          color: '#aaaacc',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid #333355',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          智能检测
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
          <input
            type="checkbox"
            checked={settings.highlightHeavyMetals}
            onChange={(e) => updateSetting('highlightHeavyMetals', e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <label style={{ color: '#ccccdd', fontSize: '12px', cursor: 'pointer' }}>
            重金属高亮 <span style={{ color: '#ff6600' }}>(橙红色)</span>
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <input
            type="checkbox"
            checked={settings.highlightContraband}
            onChange={(e) => updateSetting('highlightContraband', e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <label style={{ color: '#ccccdd', fontSize: '12px', cursor: 'pointer' }}>
            违禁品高亮 <span style={{ color: '#ffcc00' }}>(金黄色)</span>
          </label>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{
          color: '#aaaacc',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid #333355',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          性能保护
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <input
            type="checkbox"
            checked={settings.adaptiveStepEnabled}
            onChange={(e) => updateSetting('adaptiveStepEnabled', e.target.checked)}
            style={{ cursor: 'pointer' }}
          />
          <label style={{ color: '#ccccdd', fontSize: '12px', cursor: 'pointer' }}>
            自适应步长控制
          </label>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ color: '#ccccdd', fontSize: '12px' }}>最大步长系数</label>
            <span style={{ color: '#66ff99', fontSize: '12px', fontFamily: 'monospace' }}>
              {settings.maxStepFactor.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min="1.5"
            max="6.0"
            step="0.1"
            value={settings.maxStepFactor}
            onChange={(e) => updateSetting('maxStepFactor', parseFloat(e.target.value))}
            disabled={!settings.adaptiveStepEnabled}
            style={{ ...sliderStyle, opacity: settings.adaptiveStepEnabled ? 1 : 0.3 }}
          />
          <p style={{ color: '#667788', fontSize: '10px', marginTop: '4px' }}>
            空体素区域可加速的最大倍数
          </p>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ color: '#ccccdd', fontSize: '12px' }}>最小步长系数</label>
            <span style={{ color: '#ffaa66', fontSize: '12px', fontFamily: 'monospace' }}>
              {settings.minStepFactor.toFixed(2)}x
            </span>
          </div>
          <input
            type="range"
            min="0.2"
            max="1.0"
            step="0.05"
            value={settings.minStepFactor}
            onChange={(e) => updateSetting('minStepFactor', parseFloat(e.target.value))}
            disabled={!settings.adaptiveStepEnabled}
            style={{ ...sliderStyle, opacity: settings.adaptiveStepEnabled ? 1 : 0.3 }}
          />
          <p style={{ color: '#667788', fontSize: '10px', marginTop: '4px' }}>
            高密度区域最小步长（细节保留）
          </p>
        </div>

        <div style={{
          padding: '10px',
          background: 'rgba(50, 100, 200, 0.1)',
          borderRadius: '6px',
          border: '1px solid rgba(50, 100, 200, 0.2)'
        }}>
          <p style={{ color: '#66aaff', fontSize: '11px', lineHeight: 1.5 }}>
            <strong>🛡️ 安全机制已启用:</strong><br/>
            • 384 步硬限制防 TDR<br/>
            • 95% 不透明度提前终止<br/>
            • 距离归一化步长调整<br/>
            • 空体素跳跃加速
          </p>
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{
          color: '#ffaa33',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid #333355',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          🔬 断层扫描分析
        </h3>

        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px', 
          marginBottom: '14px',
          padding: '10px',
          background: tomographMode ? 'rgba(255, 170, 50, 0.1)' : 'rgba(0, 0, 0, 0.2)',
          borderRadius: '6px',
          border: `1px solid ${tomographMode ? 'rgba(255, 170, 50, 0.4)' : 'rgba(50, 50, 80, 0.3)'}`
        }}>
          <input
            type="checkbox"
            checked={tomographMode}
            onChange={(e) => onTomographModeChange && onTomographModeChange(e.target.checked)}
            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            id="tomograph-toggle"
          />
          <label htmlFor="tomograph-toggle" style={{ 
            color: tomographMode ? '#ffaa33' : '#ccccdd', 
            fontSize: '12px', 
            cursor: 'pointer',
            fontWeight: tomographMode ? 600 : 400
          }}>
            启用断层扫描模式
          </label>
        </div>

        {tomographMode && (
          <>
            <div style={{ marginBottom: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <label style={{ color: '#ccccdd', fontSize: '12px' }}>切片位置</label>
                <span style={{ color: '#66ddff', fontSize: '11px', fontFamily: 'monospace' }}>
                  {(slicePosition * 100).toFixed(1)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={slicePosition}
                onChange={(e) => onSlicePositionChange && onSlicePositionChange(parseFloat(e.target.value))}
                style={sliderStyle}
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ color: '#ccccdd', fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                视图模式
              </label>
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['density', 'zeff', 'pseudocolor'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => onViewModeChange && onViewModeChange(mode)}
                    style={{
                      flex: 1,
                      padding: '6px 8px',
                      background: viewMode === mode ? 'rgba(255, 170, 50, 0.3)' : 'rgba(30, 30, 50, 0.5)',
                      border: `1px solid ${viewMode === mode ? '#ffaa33' : 'rgba(100, 100, 150, 0.3)'}`,
                      borderRadius: '4px',
                      color: viewMode === mode ? '#ffcc66' : '#8899aa',
                      cursor: 'pointer',
                      fontSize: '10px'
                    }}
                  >
                    {mode === 'density' ? '密度' : mode === 'zeff' ? 'Z值' : '伪彩'}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={onAnalyzeROI}
              disabled={!hasROI || isAnalyzing}
              style={{
                width: '100%',
                padding: '10px',
                background: hasROI && !isAnalyzing 
                  ? 'linear-gradient(135deg, #ff8800, #ff4400)' 
                  : 'rgba(80, 80, 100, 0.3)',
                border: 'none',
                borderRadius: '6px',
                color: hasROI && !isAnalyzing ? '#ffffff' : '#666677',
                fontWeight: 600,
                fontSize: '13px',
                cursor: hasROI && !isAnalyzing ? 'pointer' : 'not-allowed',
                boxShadow: hasROI && !isAnalyzing 
                  ? '0 2px 8px rgba(255, 100, 0, 0.3)' 
                  : 'none'
              }}
            >
              {isAnalyzing ? '⏳ 分析中...' : hasROI ? '🔬 执行定量分析' : '请先选择 ROI 区域'}
            </button>

            {!hasROI && (
              <p style={{ 
                color: '#667788', 
                fontSize: '10px', 
                marginTop: '8px',
                textAlign: 'center' 
              }}>
                在 3D 视图中拖动鼠标框选感兴趣区域
              </p>
            )}

            <div style={{
              marginTop: '12px',
              padding: '8px 10px',
              background: 'rgba(0, 150, 255, 0.08)',
              borderRadius: '4px',
              border: '1px solid rgba(0, 150, 255, 0.2)'
            }}>
              <p style={{ color: '#66bbee', fontSize: '10px', lineHeight: 1.5 }}>
                <strong>💡 技术原理:</strong><br/>
                三维 Radon 变换逆运算 + FBP 滤波反投影<br/>
                3D-FFT 斜坡滤波器 + 定量层析诊断
              </p>
            </div>
          </>
        )}
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3 style={{
          color: '#aaaacc',
          fontSize: '13px',
          fontWeight: 600,
          marginBottom: '12px',
          paddingBottom: '8px',
          borderBottom: '1px solid #333355',
          textTransform: 'uppercase',
          letterSpacing: '0.5px'
        }}>
          密度传递函数
        </h3>

        <div style={{
          height: '40px',
          borderRadius: '4px',
          marginBottom: '12px',
          background: `linear-gradient(to right, 
            rgb(${transferFunction.densityPoints[0].color.map(c => Math.floor(c * 255)).join(',')}),
            rgb(${transferFunction.densityPoints[2].color.map(c => Math.floor(c * 255)).join(',')}),
            rgb(${transferFunction.densityPoints[4].color.map(c => Math.floor(c * 255)).join(',')}),
            rgb(${transferFunction.densityPoints[5].color.map(c => Math.floor(c * 255)).join(',')})
          )`
        }} />

        {transferFunction.densityPoints.slice(1, -1).map((point, idx) => (
          <div key={idx} style={{ marginBottom: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#9999bb', fontSize: '11px' }}>
                节点 {idx + 1}: {point.value.toFixed(2)}
              </span>
              <span style={{ color: '#88aacc', fontSize: '11px' }}>
                不透明度: {(point.opacity * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={point.opacity}
              onChange={(e) => updateTFPoint('density', idx + 1, 'opacity', parseFloat(e.target.value))}
              style={sliderStyle}
            />
          </div>
        ))}
      </div>

      <div style={{
        padding: '12px',
        background: 'rgba(255, 150, 50, 0.1)',
        borderRadius: '6px',
        border: '1px solid rgba(255, 150, 50, 0.2)'
      }}>
        <p style={{ color: '#ffaa66', fontSize: '11px', lineHeight: 1.5 }}>
          <strong>操作提示:</strong><br/>
          • 鼠标拖拽旋转视角<br/>
          • 滚轮缩放<br/>
          • 调节切片平面观察内部结构
        </p>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        input[type=range]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #ff8844;
          cursor: pointer;
          box-shadow: 0 0 6px rgba(255, 136, 68, 0.5);
        }
      `}</style>
    </div>
  );
};

export default ControlPanel;
