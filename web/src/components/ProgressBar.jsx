import React from 'react';
import { DownloadCloud, XCircle, MousePointer } from 'lucide-react';

export default function ProgressBar({
  progress = {},
  warningText = "*Kalau download cache berulang-ulang, segera hubungi admin*",
  logoSrc = 'assets/logoorbit.png',
  onCancel
}) {
  const {
    percent = 0,
    currentCount = 0,
    totalCount = 0,
    currentMB = '0.00',
    totalMB = '0.00',
    speedMBs = '0.00',
    etaSec = 0,
    resourceName = 'Preparing...',
    resIndex = 1,
    totalRes = 1
  } = progress;

  return (
    <div className="glass-panel bottom-bar">
      <div className="bar-header">
        <div className="bar-title">
          <img
            src={logoSrc}
            alt="Logo Orbit"
            className="bar-logo scan-logo-spinner"
            style={{ width: '22px', height: '22px', animationDuration: '4s' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <DownloadCloud className="download-icon" size={20} />
          <h3>Download Cache</h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Badge Petunjuk Kursor */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              padding: '4px 8px',
              borderRadius: '8px',
              fontSize: '0.7rem',
              color: '#94a3b8'
            }}
            title="Tekan Left ALT untuk memunculkan/menyembunyikan kursor mouse"
          >
            <MousePointer size={12} color="#38bdf8" />
            <span>[L-ALT] Kursor</span>
          </div>

          <div className="bar-estimasi">
            Estimasi: {etaSec > 0 ? `${etaSec}s` : '--s'}
          </div>

          {onCancel && (
            <button
              onClick={onCancel}
              title="Batalkan Download"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                borderRadius: '8px',
                padding: '4px 8px',
                fontSize: '0.72rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                transition: 'all 0.15s'
              }}
            >
              <XCircle size={13} />
              <span>Batal</span>
            </button>
          )}
        </div>
      </div>

      <div className="bar-status-info">
        <span className="current-resource-name">
          {resourceName} ({resIndex}/{totalRes})
        </span>
        <span className="models-progress-inline">
          {currentCount}/{totalCount} model
        </span>
      </div>

      {/* Progress Track */}
      <div className="progress-track">
        <div
          className="progress-fill"
          style={{ width: `${Math.min(100, Math.max(0, percent))}%` }}
        />
      </div>

      {/* Details Row */}
      <div className="bar-details-row">
        <span>{currentCount}/{totalCount} model</span>
        <span className="divider">|</span>
        <span>{currentMB} / {totalMB} MB</span>
        {speedMBs && speedMBs !== '0.00' && (
          <>
            <span className="divider">|</span>
            <span style={{ color: '#38bdf8' }}>{speedMBs} MB/s</span>
          </>
        )}
      </div>

      {/* Warning text */}
      {warningText && (
        <div className="warning-footer">
          {warningText}
        </div>
      )}
    </div>
  );
}
