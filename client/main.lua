local catalog = {}
local isDownloading = false
local cancelRequested = false
local isPlayerAdmin = false
local cursorActive = false

-- ====================================================================
-- HELPER: PROCESS CATALOG WITH LOCAL KVP STATUS
-- ====================================================================
local function ProcessCatalogWithKvp(rawCatalog)
    local totalModels = 0
    local needDownloadCount = 0

    for _, res in ipairs(rawCatalog) do
        totalModels = totalModels + (res.modelCount or 0)
        
        -- Cek status KVP lokal client
        local kvpStatus = GetResourceKvpInt('nr_cache_' .. res.resource)
        if kvpStatus == 1 then
            res.isFullyCached = true
            res.cachedCount = res.modelCount
        else
            res.isFullyCached = false
            res.cachedCount = 0
            if (res.modelCount or 0) > 0 then
                needDownloadCount = needDownloadCount + 1
            end
        end
    end

    return {
        totalResources = #rawCatalog,
        totalModels = totalModels,
        needDownloadCount = needDownloadCount,
        warningText = Config.WarningText,
        isAdmin = isPlayerAdmin
    }
end

-- ====================================================================
-- THREAD: TOGGLE KURSOR & HOTKEY SAAT DOWNLOADING
-- ====================================================================
CreateThread(function()
    while true do
        if isDownloading then
            -- Tombol Left ALT (Control 19): Toggle Kursor Mouse
            if IsControlJustPressed(0, 19) then
                cursorActive = not cursorActive
                SetNuiFocus(cursorActive, cursorActive)
                if cursorActive then
                    SetNuiFocusKeepInput(true)
                end
            end

            -- Jika kursor aktif, tahan kamera agar tidak muter liar saat klik tombol
            if cursorActive then
                DisableControlAction(0, 1, true) -- LookLeftRight
                DisableControlAction(0, 2, true) -- LookUpDown
                DisablePlayerFiring(PlayerId(), true) -- Cegah menembak
            end

            Wait(0)
        else
            if cursorActive then
                cursorActive = false
                SetNuiFocus(false, false)
            end
            Wait(300)
        end
    end
end)

-- ====================================================================
-- ENGINE: ASYNCHRONOUS ASSET DOWNLOADER & PRELOADER (FULLY OPTIMIZED)
-- ====================================================================
local function RunDownloadEngine(targetAssets, batchLabel)
    if isDownloading then
        Config.Notify("Proses download cache sedang berjalan!", "warning")
        return
    end

    if not targetAssets or #targetAssets == 0 then
        Config.Notify("Tidak ada asset yang perlu didownload.", "info")
        return
    end

    isDownloading = true
    cancelRequested = false
    cursorActive = false

    CreateThread(function()
        local totalModels = #targetAssets
        local totalBytes = 0
        for _, a in ipairs(targetAssets) do
            totalBytes = totalBytes + (a.size or a.sizeBytes or 0)
        end

        local downloadedBytes = 0
        local downloadedCount = 0
        local startTime = GetGameTimer()

        -- Identifikasi jumlah resource unik dalam antrean
        local resMap = {}
        for _, a in ipairs(targetAssets) do
            local rName = a.resource or a.res or "General"
            resMap[rName] = true
        end
        local totalResInBatch = 0
        for _ in pairs(resMap) do
            totalResInBatch = totalResInBatch + 1
        end

        local currentResProcessedMap = {}
        local currentResIndex = 0

        for index, asset in ipairs(targetAssets) do
            if cancelRequested then
                Config.Notify("Download cache dibatalkan.", "warning")
                break
            end

            local resName = asset.resource or asset.res or "Asset"

            -- Update index resource
            if not currentResProcessedMap[resName] then
                currentResProcessedMap[resName] = true
                currentResIndex = currentResIndex + 1
            end

            -- Preload asset jika preloadable (bukan child _hi, +hi, ymap, ybn)
            local isPreloadable = (asset.pre ~= 0 and asset.preloadable ~= false)
            local ext = (asset.ext or asset.extension or ''):lower()
            local assetSize = (asset.size or asset.sizeBytes or 0)

            if isPreloadable then
                if ext == '.ytd' then
                    RequestStreamedTextureDict(asset.name, false)
                    local timeout = GetGameTimer() + (Config.ModelLoadTimeoutMs or 2500)
                    while not HasStreamedTextureDictLoaded(asset.name) and GetGameTimer() < timeout and not cancelRequested do
                        Wait(20)
                    end
                    SetStreamedTextureDictAsNoLongerNeeded(asset.name)
                else
                    local hash = GetHashKey(asset.name)
                    if IsModelInCdimage(hash) and IsModelValid(hash) then
                        RequestModel(hash)
                        local timeout = GetGameTimer() + (Config.ModelLoadTimeoutMs or 2500)
                        while not HasModelLoaded(hash) and GetGameTimer() < timeout and not cancelRequested do
                            Wait(20)
                        end
                        SetModelAsNoLongerNeeded(hash)
                    end
                end
            end

            downloadedCount = downloadedCount + 1
            downloadedBytes = downloadedBytes + assetSize

            local elapsedSec = math.max(0.5, (GetGameTimer() - startTime) / 1000)
            local speedBps = downloadedBytes / elapsedSec
            local remainBytes = math.max(0, totalBytes - downloadedBytes)
            local etaSec = (speedBps > 0) and math.ceil(remainBytes / speedBps) or 0

            -- Single Unified NUI Message (Memotong beban CEF IPC hingga 50%)
            SendNUIMessage({
                action = "progressUpdate",
                percent = math.floor((downloadedCount / totalModels) * 100),
                currentCount = downloadedCount,
                totalCount = totalModels,
                currentMB = string.format("%.2f", downloadedBytes / (1024 * 1024)),
                totalMB = string.format("%.2f", totalBytes / (1024 * 1024)),
                speedMBs = string.format("%.2f", speedBps / (1024 * 1024)),
                etaSec = etaSec,
                resourceName = resName,
                resIndex = currentResIndex,
                totalRes = totalResInBatch,
                currentModel = asset.name
            })

            -- Pencegahan lag spike & memory leak: flush memory secara teratur
            if downloadedCount % (Config.MemoryFlushInterval or 15) == 0 then
                Wait(40)
                collectgarbage()
            else
                Wait(Config.BatchDelayMs or 20)
            end
        end

        -- Simpan status ke KVP lokal client
        for rName, _ in pairs(currentResProcessedMap) do
            SetResourceKvpInt('nr_cache_' .. rName, 1)
        end

        isDownloading = false
        cursorActive = false
        SetNuiFocus(false, false)
        SendNUIMessage({ action = "downloadFinished" })

        if not cancelRequested then
            Config.Notify("Download cache selesai! Semua asset tersimpan di penyimpanan lokal.", "success")
        end
    end)
end

-- ====================================================================
-- EVENT RECEIVE CATALOG FROM SERVER
-- ====================================================================
RegisterNetEvent('nr_cachedownload:client:receiveCatalog', function(serverCatalog, serverBuild, intent, isAdmin)
    catalog = serverCatalog or {}
    isPlayerAdmin = (isAdmin == true)
    local summary = ProcessCatalogWithKvp(catalog)

    if intent == "downloadAll" then
        local allAssets = {}
        for _, res in ipairs(catalog) do
            if res.assets then
                for _, asset in ipairs(res.assets) do
                    asset.resource = res.resource
                    table.insert(allAssets, asset)
                end
            end
        end

        if #allAssets == 0 then
            Config.Notify("Tidak ada asset stream yang terdaftar di server.", "warning")
            return
        end

        Config.Notify(string.format("Memulai download semua asset cache (%d file)...", #allAssets), "info")
        RunDownloadEngine(allAssets, "All Assets")

    else
        SetNuiFocus(true, true)
        SendNUIMessage({
            action = "openPanel",
            catalog = catalog,
            serverBuild = serverBuild,
            summary = summary
        })
    end
end)

-- ====================================================================
-- COMMAND 1: /downloadcache (Download SEMUA Asset Langsung)
-- ====================================================================
RegisterCommand(Config.DownloadCacheCommand or "downloadcache", function()
    if isDownloading then
        Config.Notify("Proses download cache sedang berjalan!", "warning")
        return
    end

    if #catalog > 0 then
        local allAssets = {}
        for _, res in ipairs(catalog) do
            if res.assets then
                for _, asset in ipairs(res.assets) do
                    asset.resource = res.resource
                    table.insert(allAssets, asset)
                end
            end
        end

        if #allAssets > 0 then
            Config.Notify(string.format("Memulai download semua asset cache (%d file)...", #allAssets), "info")
            RunDownloadEngine(allAssets, "All Assets")
            return
        end
    end

    Config.Notify("Mengambil daftar asset langsung dari server...", "info")
    TriggerServerEvent('nr_cachedownload:server:requestCatalog', "downloadAll", false)
end, false)

-- ====================================================================
-- COMMAND 2: /cachepanel (Buka UI Panel Scan & Download Selected)
-- ====================================================================
local function OpenCachePanel(forceScan)
    if isDownloading then
        Config.Notify("Proses download cache sedang berlangsung di background.", "info")
        return
    end

    SetNuiFocus(true, true)
    SendNUIMessage({ action = "showScanOverlay" })
    TriggerServerEvent('nr_cachedownload:server:requestCatalog', "openPanel", forceScan or false)
end

RegisterCommand(Config.CachePanelCommand or "cachepanel", function()
    OpenCachePanel(false)
end, false)

if Config.CacheAliasCommand and Config.CacheAliasCommand ~= "" then
    RegisterCommand(Config.CacheAliasCommand, function()
        OpenCachePanel(false)
    end, false)
end

RegisterCommand('cancelcache', function()
    if isDownloading then
        cancelRequested = true
        cursorActive = false
        SetNuiFocus(false, false)
        Config.Notify("Membatalkan proses download cache...", "warning")
    else
        Config.Notify("Tidak ada proses download yang sedang berjalan.", "info")
    end
end, false)

-- ====================================================================
-- NUI CALLBACKS
-- ====================================================================
RegisterNUICallback('closePanel', function(data, cb)
    SetNuiFocus(false, false)
    cb({ status = "ok" })
end)

RegisterNUICallback('startDownload', function(data, cb)
    local selectedResNames = data.selectedResources or {}
    local selectedLookup = {}
    for _, name in ipairs(selectedResNames) do
        selectedLookup[name] = true
    end

    local assetsToDownload = {}
    for _, res in ipairs(catalog) do
        if selectedLookup[res.resource] and res.assets then
            for _, asset in ipairs(res.assets) do
                asset.resource = res.resource
                table.insert(assetsToDownload, asset)
            end
        end
    end

    SetNuiFocus(false, false)
    RunDownloadEngine(assetsToDownload, "Selected Resources")
    cb({ status = "started", count = #assetsToDownload })
end)

RegisterNUICallback('rescanCatalog', function(data, cb)
    TriggerServerEvent('nr_cachedownload:server:requestCatalog', "openPanel", true)
    cb({ status = "rescanning" })
end)

RegisterNUICallback('cancelDownload', function(data, cb)
    cancelRequested = true
    cursorActive = false
    SetNuiFocus(false, false)
    cb({ status = "cancelling" })
end)
