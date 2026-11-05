# Nusa Raya Cache Downloader & Preloader (Standalone)

Resource FiveM standalone untuk melakukan pre-caching/pre-loading asset stream (.ydr, .yft, .ydd, .ytd) sebelum pemain bermain untuk mencegah stuttering, texture loss, dan FPS drop saat in-game.

---

## ✨ Fitur & Optimasi Anti-Beban Server (Zero Server Lag)
- **Snapshot Memory Cache**: Hasil scan disimpan di RAM server (`MasterCatalog`) dan disinkronkan ke `assets.json`.
- **0% Beban untuk Player Biasa**: Ketika player biasa membuka `/cachepanel` atau klik **Refresh**, server langsung merespons dari memori RAM (0ms, 0% CPU, 0% Disk I/O). Server tidak membaca disk sama sekali!
- **Admin-Only Deep Scan**: Hanya Admin (via ACE permission `command.scancache`, `admin`, atau framework ESX/QBCore) dan Server Console (txAdmin) yang diizinkan memicu Full Deep Disk Scan ke file server.
- **Anti-Spam Cooldown**: Terdapat jeda cooldown (default: 60 detik) untuk mencegah spam scan ke disk server.
- **Anti-Stuck Download**: File child mesh (`_hi.yft`, `+hi.ytd`, `_lod`) dan map/collision (`.ymap`, `.ybn`) di-filter otomatis sehingga tidak membuat antrean download freeze/hang. Timeout diperpendek ke 2.5 detik dengan pembersihan memori otomatis (`collectgarbage()`).

---

## 🎮 Command In-Game

| Command | Akses | Fungsi |
| :--- | :--- | :--- |
| `/downloadcache` | Semua Player | Langsung mengunduh semua asset stream server. |
| `/cachepanel` | Semua Player | Membuka UI Cache Panel (Player biasa refresh dari RAM server, Admin bisa Deep Scan). |
| `/cancelcache` | Semua Player | Membatalkan proses download cache darurat. |
| `/scancache` | **Khusus Admin & Console** | Memaksa server memindai ulang seluruh harddisk server dan memperbarui snapshot katalog untuk semua pemain. |

---

## ⚙️ Izin Admin (server.cfg)
Untuk memberikan izin deep scan kepada admin di FiveM:
```cfg
add_ace group.admin command.scancache allow
```

---

## 🛠️ Tools Asset Collector (Offline Scan)

### 1. Metode Python:
```bash
python tools/collect_assets.py
```

### 2. Metode Node.js:
```bash
node tools/collect_assets.js
```

---

## 💻 UI React Source Code & Build

Source code React terletak di folder `web/`:
```bash
cd web
npm.cmd run build
```
Hasil build otomatis tersimpan ke `html/` dan siap digunakan di FiveM.
