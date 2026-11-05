#!/usr/bin/env python3
"""
Asset Collector for FiveM Cache Downloader (Python)
Scans FiveM resources for streamable assets (.ydr, .yft, .ydd, .ytd, .ymap, .ytyp, .ybn)
and generates an optimized assets.json catalog.
"""

import os
import sys
import json
import argparse
from pathlib import Path

EXT_CATEGORIES = {
    '.yft': 'Vehicles',
    '.ydr': 'Props & Buildings',
    '.ydd': 'Ped & Clothing',
    '.ytd': 'Textures',
    '.ymap': 'Maps & Interiors',
    '.ytyp': 'Archetypes',
    '.ybn': 'Collisions'
}

def is_asset_preloadable(base_name, ext):
    lower = base_name.lower()
    if ext in ['.ymap', '.ytyp', '.ybn']:
        return False
    if lower.endswith('_hi') or lower.endswith('+hi') or lower.endswith('_lod'):
        return False
    if '^' in lower:
        return False
    return True

def determine_resource_category(res_name, counts):
    name_lower = res_name.lower()
    if any(k in name_lower for k in ['car', 'veh', 'auto', 'pack', 'handling', 'motor', 'bike']):
        return 'Vehicles'
    if any(k in name_lower for k in ['cloth', 'ped', 'skin', 'hair', 'shoe', 'eup', 'hat']):
        return 'Clothing'
    if any(k in name_lower for k in ['map', 'mlo', 'interior', 'props', 'bld', 'building', 'island']):
        return 'Maps & Props'
    
    if counts.get('Vehicles', 0) > counts.get('Props & Buildings', 0):
        return 'Vehicles'
    if counts.get('Clothing', 0) > 0:
        return 'Clothing'
    if counts.get('Maps & Interiors', 0) > 0 or counts.get('Props & Buildings', 0) > 0:
        return 'Maps & Props'
    return 'General'

def scan_resource_stream(resource_name, resource_dir):
    stream_dir = os.path.join(resource_dir, 'stream')
    if not os.path.exists(stream_dir) or not os.path.isdir(stream_dir):
        return None

    assets = []
    cat_counts = {}
    total_bytes = 0

    for root, _, files in os.walk(stream_dir):
        for file in files:
            ext = os.path.splitext(file)[1].lower()
            if ext in EXT_CATEGORIES:
                full_path = os.path.join(root, file)
                try:
                    size_bytes = os.path.getsize(full_path)
                except OSError:
                    continue

                category = EXT_CATEGORIES[ext]
                cat_counts[category] = cat_counts.get(category, 0) + 1
                total_bytes += size_bytes

                asset_name = os.path.splitext(file)[0].lower()
                rel_path = os.path.relpath(full_path, resource_dir).replace('\\', '/')
                preloadable = is_asset_preloadable(asset_name, ext)

                assets.append({
                    "name": asset_name,
                    "fileName": file,
                    "extension": ext,
                    "resource": resource_name,
                    "relPath": rel_path,
                    "category": category,
                    "sizeBytes": size_bytes,
                    "sizeKB": round(size_bytes / 1024, 2),
                    "preloadable": preloadable
                })

    if not assets:
        return None

    res_category = determine_resource_category(resource_name, cat_counts)
    formatted_label = resource_name.replace('_', ' ').replace('-', ' ').title()

    return {
        "resource": resource_name,
        "label": formatted_label,
        "category": res_category,
        "modelCount": len(assets),
        "totalSizeBytes": total_bytes,
        "totalSizeMB": round(total_bytes / (1024 * 1024), 2),
        "assets": assets
    }

def find_resources(root_scan_dir, current_res_names):
    found_resources = []

    for root, dirs, files in os.walk(root_scan_dir):
        if 'fxmanifest.lua' in files or '__resource.lua' in files:
            res_name = os.path.basename(root)
            if res_name not in current_res_names:
                found_resources.append((res_name, root))
            dirs.clear()
            continue
        
        if 'stream' in dirs:
            res_name = os.path.basename(root)
            if res_name not in current_res_names:
                found_resources.append((res_name, root))
            dirs.clear()
            continue

    return found_resources

def main():
    parser = argparse.ArgumentParser(description="Collect and index FiveM assets into assets.json")
    parser.add_argument("--path", "-p", help="Root directory containing FiveM resources to scan")
    parser.add_argument("--output", "-o", help="Output path for assets.json")
    args = parser.parse_args()

    script_dir = os.path.dirname(os.path.abspath(__file__))
    resource_root = os.path.abspath(os.path.join(script_dir, '..'))
    current_res_name = os.path.basename(resource_root)

    if args.path:
        scan_target = os.path.abspath(args.path)
    else:
        parent_dir = os.path.abspath(os.path.join(resource_root, '..'))
        scan_target = parent_dir

    if args.output:
        output_path = os.path.abspath(args.output)
    else:
        output_path = os.path.join(resource_root, 'assets.json')

    print("=" * 60)
    print(" [FiveM Cache] Asset Collector Tool (Python)")
    print("=" * 60)
    print(f"Scanning target directory : {scan_target}")
    print(f"Output JSON path          : {output_path}")
    print(f"Current resource excluded : {current_res_name}")
    print("-" * 60)

    if not os.path.exists(scan_target):
        print(f"[ERROR] Scan directory '{scan_target}' does not exist!")
        sys.exit(1)

    excluded = {current_res_name, 'ti_dcache', 'nr_cachedownload', '.git', 'node_modules'}
    detected_resources = find_resources(scan_target, excluded)
    print(f"Found {len(detected_resources)} potential resource folders. Analyzing stream assets...")

    catalog = []
    total_assets = 0
    total_bytes = 0

    for res_name, res_dir in detected_resources:
        res_data = scan_resource_stream(res_name, res_dir)
        if res_data:
            catalog.append(res_data)
            total_assets += res_data['modelCount']
            total_bytes += res_data['totalSizeBytes']
            print(f"  + [{res_name}] -> {res_data['modelCount']} assets ({res_data['totalSizeMB']} MB) [{res_data['category']}]")

    catalog.sort(key=lambda x: x['resource'].lower())

    output_data = {
        "generatedAt": os.path.basename(sys.argv[0]),
        "scanSource": "offline_tool",
        "totalResources": len(catalog),
        "totalAssets": total_assets,
        "totalSizeBytes": total_bytes,
        "totalSizeMB": round(total_bytes / (1024 * 1024), 2),
        "catalog": catalog
    }

    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, indent=2)

    print("=" * 60)
    print(" SCAN COMPLETE SUMMARY:")
    print(f"  - Total Stream Resources : {len(catalog)}")
    print(f"  - Total Assets Indexed   : {total_assets}")
    print(f"  - Total Size             : {round(total_bytes / (1024 * 1024), 2)} MB")
    print(f"  - Saved to               : {output_path}")
    print("=" * 60)

if __name__ == '__main__':
    main()
