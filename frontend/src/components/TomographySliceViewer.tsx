import React, { useEffect, useRef, useState } from 'react';
import { TomographySliceData, QuantitativeAnalysisResult } from '../types/volume';

interface TomographySliceViewerProps {
  sliceData: TomographySliceData | null;
  analysis: QuantitativeAnalysisResult | null;
  isAnalyzing: boolean;
  viewMode: 'density' | 'zeff' | 'pseudocolor';
  slicePosition: number;
  onSlicePositionChange: (pos: number) => void;
  analysisTime?: number;
}

const TomographySliceViewer: React.FC<TomographySliceViewerProps> = ({
  sliceData,
  isAnalyzing,
  viewMode,
  slicePosition,
  onSlicePositionChange,
  analysisTime
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(1);
  const [contrast, setContrast] = useState(1);
  const [brightness, setBrightness] = useState(0);

  useEffect(() => {
    if (!sliceData || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { density, zeff, width, height } = sliceData;
    const imageData = ctx.createImageData(width, height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        const pixelIdx = idx * 4;

        const dVal = Math.max(0, Math.min(1, (density[idx] + brightness) * contrast));
        const zVal = zeff[idx];

        let r = 0, g = 0, b = 0;

        if (viewMode === 'density') {
          const v = Math.floor(dVal * 255);
          r = g = b = v;
        } else if (viewMode === 'zeff') {
          const v = Math.floor(zVal * 255);
          r = Math.floor(v * 0.9);
          g = Math.floor(v * 0.7);
          b = Math.floor(v * 1.1);
        } else {
          if (dVal < 0.2) {
            r = 0; g = Math.floor(dVal * 255); b = Math.floor(dVal * 255 + 50);
          } else if (dVal < 0.5) {
            const t = (dVal - 0.2) / 0.3;
            r = Math.floor(t * 100);
            g = Math.floor(80 + t * 80);
            b = Math.floor(150 - t * 100);
          } else if (dVal < 0.8) {
            const t = (dVal - 0.5) / 0.3;
            r = Math.floor(100 + t * 155);
            g = Math.floor(160 - t * 60);
            b = Math.floor(50 - t * 50);
          } else {
            const t = (dVal - 0.8) / 0.2;
            r = 255;
            g = Math.floor(100 - t * 100);
            b = 0;
          }

          if (zVal > 0.7 && dVal > 0.4) {
            r = Math.min(255, r + 80);
            g = Math.max(0, g - 30);
          }
        }

        imageData.data[pixelIdx] = Math.min(255, Math.max(0, r));
        imageData.data[pixelIdx + 1] = Math.min(255, Math.max(0, g));
        imageData.data[pixelIdx + 2] = Math.min(255, Math.max(0, b));
        imageData.data[pixelIdx + 3] = 255;
      }
    }

    canvas.width = width;
    canvas.height = height;
    ctx.putImageData(imageData, 0, 0);
  }, [sliceData, viewMode, contrast, brightness]);

  if (!sliceData) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '300px',
        background: 'rgba(0, 0, 0, 0.3)',
        borderRadius: '8px',
        border: '2px dashed rgba(100, 150, 255, 0.3)',
        color: '#6688aa',
        fontSize: '13px'
      }}>
        {isAnalyzing ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>⚡</div>
            <div>正在执行断层扫描分析...</div>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>📐</div>
            <div>在 3D 视图上拉框选择区域</div>
            <div style={{ fontSize: '11px', marginTop: '6px', opacity: 0.7 }}>
              启用"断层扫描"模式后，拖动鼠标选择 ROI
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }}>
      <div style={{
        position: 'relative',
        width: '100%',
        paddingBottom: '100%',
        background: '#000',
        borderRadius: '6px',
        overflow: 'hidden',
        border: '1px solid rgba(100, 150, 255, 0.2)'
      }}>
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            imageRendering: 'pixelated'
          }}
        />
        
        {isAnalyzing && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'rgba(0, 0, 0, 0.8)',
            padding: '16px 24px',
            borderRadius: '8px',
            color: '#66ddff',
            fontSize: '13px'
          }}>
            🔄 处理中...
          </div>
        )}

        <div style={{
          position: 'absolute',
          bottom: '8px',
          right: '8px',
          background: 'rgba(0, 0, 0, 0.6)',
          padding: '4px 8px',
          borderRadius: '4px',
          color: '#88aacc',
          fontSize: '10px',
          fontFamily: 'monospace'
        }}>
          {sliceData.width} × {sliceData.height}
        </div>
      </div>

      <div style={{ marginTop: '12px' }}>
        <div style={{ fontSize: '11px', color: '#88aacc', marginBottom: '4px' }}>
          切片位置: {(slicePosition * 100).toFixed(1)}%
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={slicePosition}
          onChange={(e) => onSlicePositionChange(parseFloat(e.target.value))}
          style={{ width: '100%' }}
        />
      </div>

      <div style={{
        display: 'flex',
        gap: '8px',
        marginTop: '12px',
        flexWrap: 'wrap'
      }}>
        <button
          onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
          style={controlButtonStyle}
        >
          −
        </button>
        <button
          onClick={() => setZoom(z => Math.min(4, z + 0.25))}
          style={controlButtonStyle}
        >
          +
        </button>
        <span style={{ color: '#88aacc', fontSize: '11px', alignSelf: 'center' }}>
          {zoom.toFixed(1)}x
        </span>
      </div>

      <div style={{ marginTop: '12px', display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', color: '#6688aa', marginBottom: '4px' }}>对比度</div>
          <input
            type="range"
            min="0.5"
            max="3"
            step="0.1"
            value={contrast}
            onChange={(e) => setContrast(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '10px', color: '#6688aa', marginBottom: '4px' }}>亮度</div>
          <input
            type="range"
            min="-0.5"
            max="0.5"
            step="0.05"
            value={brightness}
            onChange={(e) => setBrightness(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {analysisTime !== undefined && (
        <div style={{
          marginTop: '12px',
          padding: '8px 12px',
          background: 'rgba(0, 255, 100, 0.1)',
          borderRadius: '4px',
          border: '1px solid rgba(0, 255, 100, 0.2)',
          fontSize: '11px',
          color: '#66ff88'
        }}>
          ⚡ 计算耗时: {analysisTime.toFixed(2)} ms
        </div>
      )}
    </div>
  );
};

const controlButtonStyle: React.CSSProperties = {
  padding: '4px 10px',
  background: 'rgba(60, 80, 120, 0.5)',
  border: '1px solid rgba(100, 150, 255, 0.3)',
  borderRadius: '4px',
  color: '#aaccff',
  cursor: 'pointer',
  fontSize: '14px',
  minWidth: '32px'
};

export default TomographySliceViewer;
