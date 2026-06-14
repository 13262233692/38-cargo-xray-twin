import React from 'react';
import { QuantitativeAnalysisResult, SuspiciousRegion } from '../types/volume';

interface AnalysisResultPanelProps {
  analysis: QuantitativeAnalysisResult | null;
  isAnalyzing: boolean;
  onViewRegion?: (region: SuspiciousRegion) => void;
}

const AnalysisResultPanel: React.FC<AnalysisResultPanelProps> = ({
  analysis,
  isAnalyzing,
  onViewRegion
}) => {
  if (isAnalyzing) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#6688aa',
        fontSize: '13px'
      }}>
        <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔬</div>
        <div>正在执行定量分析...</div>
        <div style={{ fontSize: '11px', marginTop: '8px', opacity: 0.7 }}>
          计算体积、密度分布、Z-effective 直方图
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: '#556677',
        fontSize: '12px'
      }}>
        <div style={{ fontSize: '28px', marginBottom: '10px' }}>📊</div>
        <div>选择 ROI 区域后</div>
        <div>自动执行定量层析分析</div>
      </div>
    );
  }

  const getSeverityColor = (prob: number) => {
    if (prob > 0.8) return '#ff3322';
    if (prob > 0.5) return '#ff8822';
    if (prob > 0.3) return '#ffcc00';
    return '#66cc88';
  };

  const getSeverityLabel = (prob: number) => {
    if (prob > 0.8) return '高危';
    if (prob > 0.5) return '可疑';
    if (prob > 0.3) return '注意';
    return '安全';
  };

  const getRegionTypeLabel = (type: string) => {
    switch (type) {
      case 'heavy_metal': return '重金属';
      case 'contraband': return '违禁品';
      case 'high_density': return '高密度';
      default: return '未知';
    }
  };

  const getRegionTypeColor = (type: string) => {
    switch (type) {
      case 'heavy_metal': return '#ff4400';
      case 'contraband': return '#ff2222';
      case 'high_density': return '#ff8800';
      case 'suspicious': return '#ffcc00';
      default: return '#888888';
    }
  };

  return (
    <div style={{ fontSize: '12px' }}>
      <div style={{
        padding: '12px',
        background: analysis.contrabandProbability > 0.5 
          ? 'rgba(255, 50, 50, 0.15)' 
          : 'rgba(0, 255, 100, 0.08)',
        borderRadius: '6px',
        border: `1px solid ${getSeverityColor(analysis.contrabandProbability)}`,
        marginBottom: '12px'
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '8px'
        }}>
          <span style={{ color: '#aabbcc', fontWeight: 600 }}>违禁品风险</span>
          <span style={{
            color: getSeverityColor(analysis.contrabandProbability),
            fontWeight: 700,
            fontSize: '14px'
          }}>
            {getSeverityLabel(analysis.contrabandProbability)}
          </span>
        </div>
        <div style={{
          height: '6px',
          background: 'rgba(0, 0, 0, 0.3)',
          borderRadius: '3px',
          overflow: 'hidden'
        }}>
          <div style={{
            width: `${analysis.contrabandProbability * 100}%`,
            height: '100%',
            background: `linear-gradient(90deg, #66cc88, #ffcc00, #ff4422)`,
            transition: 'width 0.3s'
          }} />
        </div>
        <div style={{
          textAlign: 'right',
          fontSize: '10px',
          color: '#8899aa',
          marginTop: '4px'
        }}>
          概率: {(analysis.contrabandProbability * 100).toFixed(1)}%
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        marginBottom: '12px'
      }}>
        <div style={metricCardStyle}>
          <div style={metricLabelStyle}>体积</div>
          <div style={metricValueStyle}>{analysis.volumeCm3.toFixed(2)} cm³</div>
        </div>
        <div style={metricCardStyle}>
          <div style={metricLabelStyle}>预估质量</div>
          <div style={metricValueStyle}>{analysis.estimatedMassKg.toFixed(3)} kg</div>
        </div>
        <div style={metricCardStyle}>
          <div style={metricLabelStyle}>平均密度</div>
          <div style={metricValueStyle}>{(analysis.avgDensity * 100).toFixed(1)}%</div>
        </div>
        <div style={metricCardStyle}>
          <div style={metricLabelStyle}>平均Z值</div>
          <div style={metricValueStyle}>{(analysis.avgZEffective * 92).toFixed(1)}</div>
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#88aacc', marginBottom: '6px', fontWeight: 600 }}>
          密度分布直方图
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          height: '40px',
          gap: '1px',
          background: 'rgba(0, 0, 0, 0.2)',
          padding: '4px',
          borderRadius: '4px'
        }}>
          {analysis.densityHistogram.map((val, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: `hsl(${200 - i * 5}, 70%, ${50 + val * 50}%)`,
                height: `${Math.max(2, val * 100)}%`,
                minHeight: '2px',
                borderRadius: '1px'
              }}
            />
          ))}
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '9px',
          color: '#556677',
          marginTop: '2px'
        }}>
          <span>低</span>
          <span>高</span>
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '11px', color: '#88aacc', marginBottom: '6px', fontWeight: 600 }}>
          Z-effective 分布
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          height: '40px',
          gap: '1px',
          background: 'rgba(0, 0, 0, 0.2)',
          padding: '4px',
          borderRadius: '4px'
        }}>
          {analysis.zeffHistogram.map((val, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: `hsl(${40 + i * 3}, 80%, ${40 + val * 50}%)`,
                height: `${Math.max(2, val * 100)}%`,
                minHeight: '2px',
                borderRadius: '1px'
              }}
            />
          ))}
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '9px',
          color: '#556677',
          marginTop: '2px'
        }}>
          <span>轻元素</span>
          <span>重金属</span>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '8px',
        marginBottom: '12px'
      }}>
        <div style={{
          padding: '8px',
          background: 'rgba(255, 100, 50, 0.1)',
          borderRadius: '4px',
          border: '1px solid rgba(255, 100, 50, 0.2)'
        }}>
          <div style={{ fontSize: '10px', color: '#ff8866', marginBottom: '2px' }}>重金属占比</div>
          <div style={{ fontSize: '14px', color: '#ff6633', fontWeight: 700 }}>
            {(analysis.heavyMetalContent * 100).toFixed(1)}%
          </div>
        </div>
        <div style={{
          padding: '8px',
          background: 'rgba(100, 200, 100, 0.1)',
          borderRadius: '4px',
          border: '1px solid rgba(100, 200, 100, 0.2)'
        }}>
          <div style={{ fontSize: '10px', color: '#88cc88', marginBottom: '2px' }}>有机物占比</div>
          <div style={{ fontSize: '14px', color: '#66cc66', fontWeight: 700 }}>
            {(analysis.organicContent * 100).toFixed(1)}%
          </div>
        </div>
      </div>

      {analysis.suspiciousRegions.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', color: '#ff8866', marginBottom: '6px', fontWeight: 600 }}>
            ⚠️ 可疑区域 ({analysis.suspiciousRegions.length})
          </div>
          <div style={{ maxHeight: '150px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {analysis.suspiciousRegions.map((region, idx) => (
              <div
                key={idx}
                onClick={() => onViewRegion && onViewRegion(region)}
                style={{
                  padding: '8px 10px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '4px',
                  borderLeft: `3px solid ${getRegionTypeColor(region.type)}`,
                  cursor: onViewRegion ? 'pointer' : 'default',
                  transition: 'background 0.2s'
                }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px'
                }}>
                  <span style={{
                    fontSize: '10px',
                    color: getRegionTypeColor(region.type),
                    fontWeight: 600
                  }}>
                    {getRegionTypeLabel(region.type)}
                  </span>
                  <span style={{ fontSize: '9px', color: '#667788' }}>
                    最大密度: {(region.maxDensity * 100).toFixed(0)}%
                  </span>
                </div>
                <div style={{ fontSize: '10px', color: '#8899aa' }}>
                  位置: ({(region.center[0] * 100).toFixed(0)}%, {(region.center[1] * 100).toFixed(0)}%, {(region.center[2] * 100).toFixed(0)}%)
                </div>
                <div style={{ fontSize: '9px', color: '#556677' }}>
                  体素: {region.volumeVoxels.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const metricCardStyle: React.CSSProperties = {
  padding: '8px',
  background: 'rgba(30, 50, 80, 0.4)',
  borderRadius: '4px',
  border: '1px solid rgba(100, 150, 255, 0.15)'
};

const metricLabelStyle: React.CSSProperties = {
  fontSize: '10px',
  color: '#6688aa',
  marginBottom: '2px'
};

const metricValueStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#aaccff',
  fontWeight: 700
};

export default AnalysisResultPanel;
