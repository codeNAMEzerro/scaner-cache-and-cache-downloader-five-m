#!/usr/bin/env node
/**
 * Asset Collector for FiveM Cache Downloader (Node.js)
 * Scans FiveM resources for streamable assets (.ydr, .yft, .ydd, .ytd, .ymap, .ytyp, .ybn)
 * and generates an optimized assets.json catalog.
 */

const fs = require('fs');
const path = require('path');

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

function isAssetPreloadable(baseName, ext) {
    const lower = baseName.toLowerCase();
    if (['.ymap', '.ytyp', '.ybn'].includes(ext)) return false;
    if (lower.endsWith('_hi') || lower.endsWith('+hi') || lower.endsWith('_lod')) return false;
    if (lower.includes('^')) return false;
    return true;
}

function determineCategory(resName, counts) {
    const lower = resName.toLowerCase();
    if (/car|veh|auto|pack|handling|motor|bike/.test(lower)) return 'Vehicles';
    if (/cloth|ped|skin|hair|shoe|eup|hat/.test(lower)) return 'Clothing';
    if (/map|mlo|interior|props|bld|building|island/.test(lower)) return 'Maps & Props';

    if ((counts['Vehicles'] || 0) > (counts['Props & Buildings'] || 0)) return 'Vehicles';
    if ((counts['Clothing'] || 0) > 0) return 'Clothing';
    if ((counts['Maps & Interiors'] || 0) > 0 || (counts['Props & Buildings'] || 0) > 0) return 'Maps & Props';
    return 'General';
}

function scanResourceStream(resName, resDir) {
    const streamDir = path.join(resDir, 'stream');
    if (!fs.existsSync(streamDir)) return null;

    try {
        const stat = fs.statSync(streamDir);
        if (!stat.isDirectory()) return null;
    } catch {
        return null;
    }

    const assets = [];
    const catCounts = {};
    let totalBytes = 0;

    function walk(currentDir) {
        let entries = [];
        try {
            entries = fs.readdirSync(currentDir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of entries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                walk(fullPath);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (EXT_CATEGORIES[ext]) {
                    try {
                        const fileStat = fs.statSync(fullPath);
                        const category = EXT_CATEGORIES[ext];
                        catCounts[category] = (catCounts[category] || 0) + 1;
                        totalBytes += fileStat.size;

                        const baseName = path.basename(entry.name, ext).toLowerCase();
                        const relPath = path.relative(resDir, fullPath).replace(/\\/g, '/');
                        const preloadable = isAssetPreloadable(baseName, ext);

                        assets.push({
                            name: baseName,
                            fileName: entry.name,
                            extension: ext,
                            resource: resName,
                            relPath: relPath,
                            category: category,
                            sizeBytes: fileStat.size,
                            sizeKB: Math.round((fileStat.size / 1024) * 100) / 100,
                            preloadable: preloadable
                        });
                    } catch (e) {
                        // ignore unreadable file
                    }
                }
            }
        }
    }

    walk(streamDir);

    if (assets.length === 0) return null;

    return {
        resource: resName,
        label: formatLabel(resName),
        category: determineCategory(resName, catCounts),
        modelCount: assets.length,
        totalSizeBytes: totalBytes,
        totalSizeMB: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
        assets: assets
    };
}

function findResources(targetDir, excluded) {
    const found = [];

    function walkDir(dir) {
        let entries = [];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }

        const files = new Set();
        const subdirs = [];

        for (const entry of entries) {
            if (entry.isDirectory()) {
                subdirs.push(entry.name);
            } else if (entry.isFile()) {
                files.add(entry.name.toLowerCase());
            }
        }

        const isResource = files.has('fxmanifest.lua') || files.has('__resource.lua') || subdirs.includes('stream');
        const dirName = path.basename(dir);

        if (isResource) {
            if (!excluded.has(dirName)) {
                found.push({ name: dirName, path: dir });
            }
            return;
        }

        for (const sub of subdirs) {
            if (excluded.has(sub)) continue;
            walkDir(path.join(dir, sub));
        }
    }

    walkDir(targetDir);
    return found;
}

const args = process.argv.slice(2);
let customPath = null;
let customOutput = null;

for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--path' || args[i] === '-p') && args[i + 1]) {
        customPath = args[++i];
    } else if ((args[i] === '--output' || args[i] === '-o') && args[i + 1]) {
        customOutput = args[++i];
    }
}

const scriptDir = __dirname;
const resourceRoot = path.resolve(scriptDir, '..');
const currentResName = path.basename(resourceRoot);

const scanTarget = customPath ? path.resolve(customPath) : path.resolve(resourceRoot, '..');
const outputPath = customOutput ? path.resolve(customOutput) : path.join(resourceRoot, 'assets.json');

console.log('='.repeat(60));
console.log(' [FiveM Cache] Asset Collector Tool (Node.js)');
console.log('='.repeat(60));

if (!fs.existsSync(scanTarget)) {
    console.error(`[ERROR] Scan directory '${scanTarget}' does not exist!`);
    process.exit(1);
}

const excluded = new Set([
    currentResName,
    'ti_dcache',
    'nr_cachedownload',
    '.git',
    'node_modules',
    'cache',
    '.vscode'
]);

const detectedResources = findResources(scanTarget, excluded);
const catalog = [];
let totalAssets = 0;
let totalBytes = 0;

for (const res of detectedResources) {
    const resData = scanResourceStream(res.name, res.path);
    if (resData) {
        catalog.push(resData);
        totalAssets += resData.modelCount;
        totalBytes += resData.totalSizeBytes;
    }
}

catalog.sort((a, b) => a.resource.localeCompare(b.resource));

const outputData = {
    generatedAt: new Date().toISOString(),
    scanSource: "offline_tool",
    totalResources: catalog.length,
    totalAssets: totalAssets,
    totalSizeBytes: totalBytes,
    totalSizeMB: Math.round((totalBytes / (1024 * 1024)) * 100) / 100,
    catalog: catalog
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), 'utf-8');

console.log(`Scan selesai! ${catalog.length} resources (${totalAssets} assets) tersimpan ke ${outputPath}`);
