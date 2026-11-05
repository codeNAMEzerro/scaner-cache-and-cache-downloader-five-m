import React from 'react';

export default function ScanModal({ logoSrc }) {
  return (
    <div className="scan-overlay-container">
      <div className="glass-panel scan-modal">
        <img
          src={logoSrc || 'assets/logoorbit.png'}
          alt="Loading Orbit"
          className="scan-logo-spinner"
          onError={(e) => { e.target.style.display = 'none'; }}
        />
        <div>
          <h3>Membuka Cache Panel...</h3>
          <p style={{ marginTop: '6px' }}>
            Mohon tunggu sebentar, sedang menyusun daftar resource dan memeriksa status cache.
          </p>
        </div>
        <div className="scan-progress-bar">
          <div className="scan-progress-fill"></div>
        </div>
      </div>
    </div>
  );
}
