import React, { useState, useMemo } from 'react';
import { X, Search, RotateCw, Check, ShieldCheck } from 'lucide-react';

export default function CachePanel({
  catalog = [],
  serverBuild = 'v1.0.0',
  summary = {},
  selected = new Set(),
  onToggleSelect,
  onSelectAll,
  onSelectNeeded,
  onClearSelection,
  onClose,
  onStartDownload,
  onRescan,
  isDownloading = false,
  logoSrc = 'assets/logopure.png'
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const isAdmin = summary.isAdmin === true;

  const filteredCatalog = useMemo(() => {
    if (!searchQuery.trim()) return catalog;
    const q = searchQuery.toLowerCase();
    return catalog.filter(
      (res) =>
        (res.label && res.label.toLowerCase().includes(q)) ||
        (res.resource && res.resource.toLowerCase().includes(q)) ||
        (res.category && res.category.toLowerCase().includes(q))
    );
  }, [catalog, searchQuery]);

  const selectedModelsCount = useMemo(() => {
    let count = 0;
    for (const res of catalog) {
      if (selected.has(res.resource)) {
        count += res.modelCount || 0;
      }
    }
    return count;
  }, [catalog, selected]);

  return (
    <div className="glass-panel left-menu">
      {/* Header */}
      <div className="panel-header">
        <div className="header-title">
          <img
            src={logoSrc}
            alt="Logo"
            className="header-logo"
            onError={(e) => { e.target.style.display = 'none'; }}
          />
          <div className="title-text">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2>Cache Panel</h2>
              {isAdmin && (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                    fontSize: '0.65rem',
                    background: 'rgba(59, 130, 246, 0.2)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.4)',
                    padding: '2px 6px',
                    borderRadius: '6px',
                    fontWeight: 700
                  }}
                >
                  <ShieldCheck size={12} /> ADMIN
                </span>
              )}
            </div>
            <p className="subtitle">
              {summary.totalResources || catalog.length} resource | {summary.totalModels || 0} model | {serverBuild} | {summary.needDownloadCount || 0} need download
            </p>
          </div>
        </div>
        <button className="close-btn" onClick={onClose} title="Tutup Panel">
          <X size={18} />
        </button>
      </div>

      {/* Search & Scan */}
      <div className="search-bar-container">
        <div className="search-input-wrapper">
          <Search className="search-icon" size={16} />
          <input
            type="text"
            placeholder="Search resource..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button
          className="btn-scan"
          onClick={onRescan}
          title={isAdmin ? "Full Deep Disk Scan ke file server (Admin only)" : "Refresh status dari snapshot server"}
          style={isAdmin ? { borderColor: 'rgba(59, 130, 246, 0.5)' } : {}}
        >
          <RotateCw size={15} />
          <span>{isAdmin ? 'Deep Scan' : 'Refresh'}</span>
        </button>
      </div>

      {/* Selection Link Controls */}
      <div className="selection-controls">
        <span className="selected-count">{selected.size} selected</span>
        <div className="action-links">
          <button className="link-btn" onClick={onSelectAll}>
            Select All
          </button>
          <button className="link-btn" onClick={onSelectNeeded}>
            Select Needed
          </button>
          <button className="link-btn" onClick={onClearSelection}>
            Clear
          </button>
        </div>
      </div>

      {/* Resource List */}
      <div className="resource-list-scroll">
        {filteredCatalog.length === 0 ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
            Tidak ada resource yang cocok.
          </div>
        ) : (
          filteredCatalog.map((res) => {
            const isSelected = selected.has(res.resource);
            const isCached = res.isFullyCached;

            return (
              <div
                key={res.resource}
                className={`resource-item ${isSelected ? 'selected' : ''}`}
                onClick={() => !isDownloading && onToggleSelect(res.resource)}
              >
                <div className="item-left">
                  <div className="custom-checkbox">
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                  <div className="resource-info">
                    <span className="resource-name" title={res.resource}>
                      {res.label || res.resource}
                    </span>
                    <span className="resource-category">
                      {res.category || 'General'} • {res.totalSizeMB ? `${res.totalSizeMB} MB` : ''}
                    </span>
                  </div>
                </div>

                <div className="item-right">
                  <span className={`badge-status ${isCached ? 'cached' : 'need-dl'}`}>
                    {isCached ? 'CACHED' : 'NEED DL'}
                  </span>
                  <span className="model-count-num">{res.modelCount}</span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Panel Footer */}
      <div className="panel-footer">
        <div className="footer-stats">
          <span>Selected models</span>
          <span className="highlight-val">{selectedModelsCount}</span>
        </div>
        <button
          className="btn-download-primary"
          disabled={selected.size === 0 || isDownloading}
          onClick={onStartDownload}
        >
          {isDownloading ? 'Downloading...' : 'Download Selected Cache'}
        </button>
      </div>
    </div>
  );
}
