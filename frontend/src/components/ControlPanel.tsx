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
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  settings,
  onSettingsChange,
  transferFunction,
  onTransferFunctionChange,
  status,
  isConnected,
  onLoadDemo
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
