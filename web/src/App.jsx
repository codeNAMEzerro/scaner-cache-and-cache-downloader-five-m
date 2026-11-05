import React, { useState, useEffect, useCallback } from 'react';
import { useNuiEvent } from './utils/useNuiEvent';
import { fetchNui } from './utils/fetchNui';
import ScanModal from './components/ScanModal';
import CachePanel from './components/CachePanel';
import ProgressBar from './components/ProgressBar';

export default function App() {
  const [showScan, setShowScan] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [showProgress, setShowProgress] = useState(false);

  const [catalog, setCatalog] = useState([]);
  const [serverBuild, setServerBuild] = useState('v1.0.0');
  const [summary, setSummary] = useState({});
  const [warningText, setWarningText] = useState('*Kalau download cache berulang-ulang, segera hubungi admin*');

  const [selectedResources, setSelectedResources] = useState(new Set());
  const [isDownloading, setIsDownloading] = useState(false);

  const [progressData, setProgressData] = useState({
    percent: 0,
    currentCount: 0,
    totalCount: 0,
    currentMB: '0.00',
    totalMB: '0.00',
    speedMBs: '0.00',
    etaSec: 0,
    resourceName: '',
    resIndex: 1,
    totalRes: 1
  });

  // Listen for NUI events
  useNuiEvent('showScanOverlay', () => {
    setShowScan(true);
    setShowPanel(false);
    setShowProgress(false);
  });

  useNuiEvent('openPanel', (data) => {
    setShowScan(false);
    setCatalog(data.catalog || []);
    setServerBuild(data.serverBuild || 'v1.0.0');
    setSummary(data.summary || {});
    if (data.summary?.warningText) {
      setWarningText(data.summary.warningText);
    }
    setSelectedResources(new Set());
    setShowPanel(true);
  });

  useNuiEvent('stepStart', (data) => {
    setShowProgress(true);
    setProgressData((prev) => ({
      ...prev,
      resourceName: data.resource || prev.resourceName,
      currentCount: data.index || prev.currentCount,
      totalCount: data.totalModels || prev.totalCount,
      resIndex: data.resIndex || prev.resIndex,
      totalRes: data.totalRes || prev.totalRes
    }));
  });

  useNuiEvent('progressUpdate', (data) => {
    setShowProgress(true);
    setProgressData({
      percent: data.percent ?? 0,
      currentCount: data.currentCount ?? 0,
      totalCount: data.totalCount ?? 0,
      currentMB: data.currentMB ?? '0.00',
      totalMB: data.totalMB ?? '0.00',
      speedMBs: data.speedMBs ?? '0.00',
      etaSec: data.etaSec ?? 0,
      resourceName: data.resourceName ?? '',
      resIndex: data.resIndex ?? 1,
      totalRes: data.totalRes ?? 1
    });
  });

  useNuiEvent('downloadFinished', () => {
    setTimeout(() => {
      setShowProgress(false);
      setIsDownloading(false);
      setShowPanel(false);
      fetchNui('closePanel');
    }, 1500);
  });

  useNuiEvent('closeAll', () => {
    setShowScan(false);
    setShowPanel(false);
    setShowProgress(false);
    setIsDownloading(false);
  });

  // Handle ESC key to close panel
  const handleClosePanel = useCallback(() => {
    setShowPanel(false);
    setShowScan(false);
    fetchNui('closePanel');
  }, []);

  const handleCancelDownload = useCallback(() => {
    fetchNui('cancelDownload');
    setShowProgress(false);
    setIsDownloading(false);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showPanel && !isDownloading) {
        handleClosePanel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showPanel, isDownloading, handleClosePanel]);

  // Selection handlers
  const handleToggleSelect = (resourceName) => {
    setSelectedResources((prev) => {
      const next = new Set(prev);
      if (next.has(resourceName)) {
        next.delete(resourceName);
      } else {
        next.add(resourceName);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const next = new Set();
    catalog.forEach((r) => next.add(r.resource));
    setSelectedResources(next);
  };

  const handleSelectNeeded = () => {
    const next = new Set();
    catalog.forEach((r) => {
      if (!r.isFullyCached) next.add(r.resource);
    });
    setSelectedResources(next);
  };

  const handleClearSelection = () => {
    setSelectedResources(new Set());
  };

  const handleStartDownload = () => {
    if (selectedResources.size === 0 || isDownloading) return;
    setIsDownloading(true);
    setShowPanel(false);
    setShowProgress(true);

    fetchNui('startDownload', {
      selectedResources: Array.from(selectedResources)
    });
  };

  const handleRescan = () => {
    setShowPanel(false);
    setShowScan(true);
    fetchNui('rescanCatalog');
  };

  return (
    <>
      {showScan && <ScanModal logoSrc="assets/logoorbit.png" />}

      {showPanel && (
        <CachePanel
          catalog={catalog}
          serverBuild={serverBuild}
          summary={summary}
          selected={selectedResources}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onSelectNeeded={handleSelectNeeded}
          onClearSelection={handleClearSelection}
          onClose={handleClosePanel}
          onStartDownload={handleStartDownload}
          onRescan={handleRescan}
          isDownloading={isDownloading}
          logoSrc="assets/logopure.png"
        />
      )}

      {showProgress && (
        <ProgressBar
          progress={progressData}
          warningText={warningText}
          logoSrc="assets/logoorbit.png"
          onCancel={handleCancelDownload}
        />
      )}
    </>
  );
}
