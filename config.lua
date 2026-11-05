Config = {}

-- ====================================================================
-- SERVER PERFORMANCE & PROTECTION (ANTI-LAG)
-- ====================================================================
-- Hanya ADMIN yang boleh memicu Full Deep Disk Scan ke file server.
-- Player biasa akan membaca snapshot dari RAM server (0% CPU, 0% Disk I/O, Instant!)
Config.AdminOnlyFullScan = true

-- Permission ACE untuk admin yang berhak melakukan deep scan
-- Bisa ditambahkan di server.cfg: add_ace group.admin command.scancache allow
Config.AdminAcePermission = "command.scancache"

-- Cooldown antar Full Deep Disk Scan (detik) untuk mencegah spam I/O di server
Config.FullScanCooldown = 60

-- Jalankan scan 1x saat server pertama kali start, lalu simpan hasilnya di RAM
Config.InitialScanOnBoot = true

-- Otomatis simpan katalog hasil scan ke assets.json agar server bisa langsung memuatnya instan saat restart
Config.SaveScannedToJson = true

-- Nama file JSON katalog
Config.AssetsJsonFile = "assets.json"

-- ====================================================================
-- COMMAND SETTINGS
-- ====================================================================
-- Command untuk download semua asset langsung tanpa buka panel (Bisa digunakan semua player)
Config.DownloadCacheCommand = "downloadcache"

-- Command untuk buka UI Cache Panel (Bisa digunakan semua player)
Config.CachePanelCommand = "cachepanel"

-- Command alternatif tambahan (bisa digunakan pemain di chat / console)
Config.CacheAliasCommand = "cache"

-- ====================================================================
-- DOWNLOAD ENGINE SETTINGS (ANTI-STUCK OPTIMIZATIONS)
-- ====================================================================
-- Timeout maksimal (ms) menunggu 1 model/texture load sebelum otomatis di-skip jika gagal
Config.ModelLoadTimeoutMs = 2500

-- Delay (ms) jeda antar model saat downloading agar thread FiveM lancar & CPU tidak throttle
Config.BatchDelayMs = 20

-- Interval pembersihan memori (setiap X model, lakukan GC & flush memory untuk cegah crash)
Config.MemoryFlushInterval = 15

-- Peringatan footer yang ditampilkan pada HUD bar downloading
Config.WarningText = "*Kalau download cache berulang-ulang, segera hubungi admin*"

-- ====================================================================
-- NOTIFICATIONS (STANDALONE)
-- ====================================================================
Config.Notify = function(msg, msgType)
    TriggerEvent('chat:addMessage', {
        color = { 56, 189, 248 },
        multiline = true,
        args = { "Nusa Raya Cache", msg }
    })
end
