import React, { useState, useEffect } from 'react';
import { ContrabandAlert } from '../types/volume';

interface ContrabandAlertPanelProps {
  alerts: ContrabandAlert[];
  onAcknowledge: (alertId: string) => void;
  onViewAlert: (alert: ContrabandAlert) => void;
}

const ContrabandAlertPanel: React.FC<ContrabandAlertPanelProps> = ({
  alerts,
  onAcknowledge,
  onViewAlert
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [flash, setFlash] = useState(false);

  const unacknowledgedAlerts = alerts.filter(a => !a.acknowledged);
  const criticalAlerts = unacknowledgedAlerts.filter(a => a.severity === 'critical' || a.severity === 'high');

  useEffect(() => {
    if (criticalAlerts.length > 0) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [alerts]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#ff1100';
      case 'high': return '#ff6600';
      case 'medium': return '#ffcc00';
      case 'low': return '#88cc88';
      default: return '#888888';
    }
  };

  const getSeverityBg = (severity: string) => {
    switch (severity) {
      case 'critical': return 'rgba(255, 17, 0, 0.15)';
      case 'high': return 'rgba(255, 102, 0, 0.12)';
      case 'medium': return 'rgba(255, 204, 0, 0.1)';
      case 'low': return 'rgba(136, 204, 136, 0.1)';
      default: return 'rgba(136, 136, 136, 0.1)';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'critical': return '紧急';
      case 'high': return '高危';
      case 'medium': return '中危';
      case 'low': return '低危';
      default: return '未知';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'heavy_metal': return '重金属';
      case 'contraband': return '违禁品';
      case 'suspicious': return '可疑物品';
      default: return '未知';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'heavy_metal': return '⚙️';
      case 'contraband': return '💀';
      case 'suspicious': return '⚠️';
      default: return '❓';
    }
  };

  if (unacknowledgedAlerts.length === 0) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 1000,
      maxWidth: '360px'
    }}>
      {!isExpanded ? (
        <div
          onClick={() => setIsExpanded(true)}
          style={{
            padding: '12px 16px',
            background: criticalAlerts.length > 0 
              ? `linear-gradient(135deg, ${getSeverityBg('critical')}, rgba(255, 50, 0, 0.2))`
              : getSeverityBg('medium'),
            borderRadius: '8px',
            border: `2px solid ${getSeverityColor(criticalAlerts.length > 0 ? 'critical' : 'medium')}`,
            cursor: 'pointer',
            boxShadow: flash 
              ? `0 0 30px ${getSeverityColor('critical')}` 
              : `0 4px 12px rgba(0, 0, 0, 0.3)`,
            transition: 'box-shadow 0.3s',
            animation: flash ? 'pulse 0.5s ease-in-out' : undefined
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '24px' }}>
              {criticalAlerts.length > 0 ? '🚨' : '⚠️'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{
                color: getSeverityColor(criticalAlerts.length > 0 ? 'critical' : 'medium'),
                fontWeight: 700,
                fontSize: '14px',
                marginBottom: '2px'
              }}>
                {unacknowledgedAlerts.length} 条走私警报
              </div>
              <div style={{ color: '#aabbcc', fontSize: '11px' }}>
                点击查看详情
              </div>
            </div>
            <div style={{
              color: '#8899aa',
              fontSize: '18px'
            }}>
              ▼
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          background: 'rgba(10, 15, 25, 0.98)',
          borderRadius: '8px',
          border: `2px solid ${getSeverityColor(criticalAlerts.length > 0 ? 'critical' : 'medium')}`,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(10px)',
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '12px 16px',
            background: `linear-gradient(90deg, ${getSeverityBg('critical')}, transparent)`,
            borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{
              color: getSeverityColor(criticalAlerts.length > 0 ? 'critical' : 'medium'),
              fontWeight: 700,
              fontSize: '14px'
            }}>
              🚨 走私警报
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              style={{
                background: 'none',
                border: 'none',
                color: '#8899aa',
                cursor: 'pointer',
                fontSize: '16px',
                padding: '0 4px'
              }}
            >
              ✕
            </button>
          </div>

          <div style={{
            maxHeight: '400px',
            overflowY: 'auto',
            padding: '8px'
          }}>
            {unacknowledgedAlerts.map((alert) => (
              <div
                key={alert.id}
                style={{
                  padding: '12px',
                  marginBottom: '8px',
                  background: getSeverityBg(alert.severity),
                  borderRadius: '6px',
                  border: `1px solid ${getSeverityColor(alert.severity)}55`,
                  borderLeft: `3px solid ${getSeverityColor(alert.severity)}`
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '10px',
                  marginBottom: '8px'
                }}>
                  <div style={{ fontSize: '20px' }}>{getTypeIcon(alert.type)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '4px'
                    }}>
                      <span style={{
                        color: getSeverityColor(alert.severity),
                        fontWeight: 700,
                        fontSize: '12px'
                      }}>
                        {getSeverityLabel(alert.severity)} · {getTypeLabel(alert.type)}
                      </span>
                      <span style={{ fontSize: '10px', color: '#667788' }}>
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ color: '#ccddee', fontSize: '12px', lineHeight: 1.5 }}>
                      {alert.description}
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr',
                  gap: '8px',
                  marginBottom: '10px',
                  fontSize: '10px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#6688aa' }}>体积</div>
                    <div style={{ color: '#aaccff', fontWeight: 600 }}>{alert.volumeCm3.toFixed(1)} cm³</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#6688aa' }}>质量</div>
                    <div style={{ color: '#aaccff', fontWeight: 600 }}>{alert.estimatedMassKg.toFixed(3)} kg</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ color: '#6688aa' }}>Z值</div>
                    <div style={{ color: '#ffaa66', fontWeight: 600 }}>{(alert.avgZeff * 92).toFixed(1)}</div>
                  </div>
                </div>

                <div style={{
                  height: '4px',
                  background: 'rgba(0, 0, 0, 0.3)',
                  borderRadius: '2px',
                  marginBottom: '10px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${alert.probability * 100}%`,
                    height: '100%',
                    background: `linear-gradient(90deg, #66cc88, #ffcc00, ${getSeverityColor(alert.severity)})`
                  }} />
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => onViewAlert(alert)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      background: 'rgba(60, 100, 180, 0.4)',
                      border: '1px solid rgba(100, 150, 255, 0.4)',
                      borderRadius: '4px',
                      color: '#aaccff',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    📍 定位
                  </button>
                  <button
                    onClick={() => onAcknowledge(alert.id)}
                    style={{
                      flex: 1,
                      padding: '6px 10px',
                      background: 'rgba(100, 100, 100, 0.3)',
                      border: '1px solid rgba(150, 150, 150, 0.3)',
                      borderRadius: '4px',
                      color: '#aaaabb',
                      cursor: 'pointer',
                      fontSize: '11px'
                    }}
                  >
                    ✓ 确认
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.02); }
        }
      `}</style>
    </div>
  );
};

export default ContrabandAlertPanel;
