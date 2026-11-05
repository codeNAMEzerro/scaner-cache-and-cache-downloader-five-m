const fs = require('fs');
const path = require('path');

// Supported streamable asset extensions and their categories
const EXT_CATEGORIES = {
    '.yft': 'Vehicles',
    '.ydr': 'Props & Buildings',
    '.ydd': 'Ped & Clothing',
    '.ytd': 'Textures',
    '.ymap': 'Maps & Interiors',
    '.ytyp': 'Archetypes',
    '.ybn': 'Collisions'
};

function formatLabel(name) {
    return name
        .replace(/[_-]+/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
}

function determineCategory(resName, counts) {
    const lower = resName.toLowerCase();
    if (/car|veh|auto|pack|handling|motor|bike/.test(lower)) return 'Vehicles';
    if (/cloth|ped|skin|hair|shoe|eup|hat|glove/.test(lower)) return 'Clothing';
    if (/map|mlo|interior|props|bld|building|island|road/.test(lower)) return 'Maps & Props';

    if ((counts['Vehicles'] || 0) > (counts['Props & Buildings'] || 0)) return 'Vehicles';
    if ((counts['Clothing'] || 0) > 0) return 'Clothing';
    if ((counts['Maps & Interiors'] || 0) > 0 || (counts['Props & Buildings'] || 0) > 0) return 'Maps & Props';
    return 'General';
}

/**
 * Check if file is a non-standalone child asset (_hi, +hi, lod, ybn, ymap, ytyp)
 */
function isAssetPreloadable(baseName, ext) {
    const lowerName = baseName.toLowerCase();
    if (['.ymap', '.ytyp', '.ybn'].includes(ext)) return false;
    if (lowerName.endsWith('_hi') || lowerName.endsWith('+hi') || lowerName.endsWith('_lod')) return false;
    if (lowerName.includes('^')) return false;
    return true;
}

/**
 * Find stream directory inside resource (case-insensitive)
 */
function findStreamDir(resPath) {
    try {
        if (!fs.existsSync(resPath)) return null;
        const entries = fs.readdirSync(resPath);
        for (const entry of entries) {
            if (entry.toLowerCase() === 'stream') {
                const full = path.join(resPath, entry);
                if (fs.statSync(full).isDirectory()) {
                    return full;
                }
            }
        }
    } catch {
        // ignore
    }
    return null;
}

/**
 * Scan a single resource's stream directory
 * Highly optimized: only keeps essential fields to minimize network payload
 */
function getResourceAssets(resourceName) {
    const resPath = GetResourcePath(resourceName);
    if (!resPath) return [];

    const streamPath = findStreamDir(resPath);
    if (!streamPath) return [];

    const assets = [];

    function traverse(currentDir) {
        try {
            const files = fs.readdirSync(currentDir, { withFileTypes: true });
            for (const file of files) {
                const fullPath = path.join(currentDir, file.name);
                if (file.isDirectory()) {
                    traverse(fullPath);
                } else if (file.isFile()) {
                    const ext = path.extname(file.name).toLowerCase();
                    if (EXT_CATEGORIES[ext]) {
                        try {
                            const stat = fs.statSync(fullPath);
                            const baseName = path.basename(file.name, ext).toLowerCase();
                            const preloadable = isAssetPreloadable(baseName, ext);

                            // Minimalist payload object (75% smaller RAM & network footprint)
                            assets.push({
                                name: baseName,
                                ext: ext,
                                size: stat.size,
                                pre: preloadable ? 1 : 0
                            });
                        } catch {
                            // file access error ignored
                        }
                    }
                }
            }
        } catch (err) {
            console.error(`[nr_cachedownload] Error scanning directory ${currentDir}:`, err.message);
        }
    }

    traverse(streamPath);
    return assets;
}

/**
 * Live scan ALL active FiveM resources currently running in the server
 */
function scanAllServerResources() {
    const currentResName = GetCurrentResourceName();
    const numResources = GetNumResources();
    const catalog = [];
    let totalAssets = 0;
    let totalBytes = 0;

    const excluded = new Set([
        currentResName,
        '_cfx_internal',
        'fivem',
        'fivem-map-hipster',
        'fivem-map-skater',
        'yarn',
        'webpack',
        'screenshot-basic'
    ]);

    for (let i = 0; i < numResources; i++) {
        const resName = GetResourceByFindIndex(i);
        if (!resName || excluded.has(resName)) continue;

        const state = GetResourceState(resName);
        if (state !== 'started' && state !== 'starting') continue;

        const assets = getResourceAssets(resName);
        if (assets && assets.length > 0) {
            const catCounts = {};
            let resBytes = 0;

            for (const a of assets) {
                const cat = EXT_CATEGORIES[a.ext] || 'General';
                catCounts[cat] = (catCounts[cat] || 0) + 1;
                resBytes += a.size;
            }

            totalAssets += assets.length;
            totalBytes += resBytes;

            catalog.push({
                resource: resName,
                label: formatLabel(resName),
                category: determineCategory(resName, catCounts),
                modelCount: assets.length,
                totalSizeBytes: resBytes,
                totalSizeMB: Math.round((resBytes / (1024 * 1024)) * 100) / 100,
                assets: assets
            });
        }
    }

    // Sort alphabetically
    catalog.sort((a, b) => a.resource.localeCompare(b.resource));

    return {
        catalog: catalog,
        totalResources: catalog.length,
        totalAssets: totalAssets,
        totalSizeBytes: totalBytes,
        totalSizeMB: Math.round((totalBytes / (1024 * 1024)) * 100) / 100
    };
}

/**
 * Save catalog directly to assets.json on server disk
 */
function saveCatalogToJson(catalogData) {
    try {
        const currentRes = GetCurrentResourceName();
        const resPath = GetResourcePath(currentRes);
        if (!resPath) return false;

        const outputPath = path.join(resPath, 'assets.json');
        const payload = {
            generatedAt: new Date().toISOString(),
            scanSource: "live_server_runtime",
            totalResources: catalogData.totalResources || (catalogData.catalog ? catalogData.catalog.length : 0),
            totalAssets: catalogData.totalAssets || 0,
            totalSizeBytes: catalogData.totalSizeBytes || 0,
            totalSizeMB: catalogData.totalSizeMB || 0,
            catalog: catalogData.catalog || []
        };

        fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), 'utf-8');
        return true;
    } catch (e) {
        console.error('[nr_cachedownload] Gagal menyimpan assets.json:', e.message);
        return false;
    }
}

// Exports for Lua
exports('GetResourceAssets', getResourceAssets);

exports('ScanAllServerResourcesJson', () => {
    const result = scanAllServerResources();
    return JSON.stringify(result);
});

exports('SaveCatalogToJson', (jsonData) => {
    try {
        const parsed = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        return saveCatalogToJson(parsed);
    } catch {
        return false;
    }
});
