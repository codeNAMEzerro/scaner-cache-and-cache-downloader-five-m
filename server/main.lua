local MasterCatalog = {}
local ServerBuild = GetConvar('sv_build', 'v072e7e82fca2')
local ResourceName = GetCurrentResourceName()
local isScanning = false
local lastFullScanTime = 0

-- ====================================================================
-- HELPER: CEK STATUS ADMIN (STANDALONE + ESX / QBCORE FALLBACK)
-- ====================================================================
local function IsPlayerAdmin(src)
    if src == 0 then return true end -- Server Console / txAdmin

    -- 1. FiveM ACE Permissions (Standalone standard)
    if IsPlayerAceAllowed(src, Config.AdminAcePermission or 'command.scancache') then
        return true
    end
    if IsPlayerAceAllowed(src, 'admin') or IsPlayerAceAllowed(src, 'command') then
        return true
    end

    -- 2. Fallback jika server memakai ESX
    if GetResourceState('es_extended') == 'started' then
        local status, ESX = pcall(function() return exports['es_extended']:getSharedObject() end)
        if status and ESX and ESX.GetPlayerFromId then
            local xPlayer = ESX.GetPlayerFromId(src)
            if xPlayer and (xPlayer.getGroup() == 'admin' or xPlayer.getGroup() == 'superadmin') then
                return true
            end
        end
    end

    -- 3. Fallback jika server memakai QBCore / Qbox
    if GetResourceState('qb-core') == 'started' then
        local status, QBCore = pcall(function() return exports['qb-core']:GetCoreObject() end)
        if status and QBCore and QBCore.Functions then
            local Player = QBCore.Functions.GetPlayer(src)
            if Player and (QBCore.Functions.HasPermission(src, 'admin') or QBCore.Functions.HasPermission(src, 'god')) then
                return true
            end
        end
    end

    return false
end

-- ====================================================================
-- SCANNING LOGIC (IN-MEMORY SNAPSHOT + DISK PROTECTION)
-- ====================================================================
local function LoadCatalogFromJson()
    local jsonFile = Config.AssetsJsonFile or "assets.json"
    local rawContent = LoadResourceFile(ResourceName, jsonFile)

    if rawContent and rawContent ~= "" then
        local status, parsed = pcall(json.decode, rawContent)
        if status and parsed and parsed.catalog and #parsed.catalog > 0 then
            MasterCatalog = parsed.catalog
            print(("^2[%s] Memuat snapshot %d resources (%d assets, %.2f MB) dari %s (0ms, Zero I/O load!)^7"):format(
                ResourceName,
                #MasterCatalog,
                parsed.totalAssets or 0,
                parsed.totalSizeMB or 0.0,
                jsonFile
            ))
            return true
        end
    end
    return false
end

local function ScanLiveServer(forced, requesterSrc)
    if isScanning then
        return MasterCatalog
    end

    -- Rate limiting / Cooldown
    local now = os.time()
    if forced and (now - lastFullScanTime) < (Config.FullScanCooldown or 60) then
        local remaining = (Config.FullScanCooldown or 60) - (now - lastFullScanTime)
        if requesterSrc and requesterSrc ~= 0 then
            TriggerClientEvent('chat:addMessage', requesterSrc, {
                color = { 239, 68, 68 },
                args = { "Nusa Raya Cache", ("Mohon tunggu %d detik sebelum melakukan deep scan lagi!"):format(remaining) }
            })
        end
        return MasterCatalog
    end

    isScanning = true
    lastFullScanTime = now

    print(("^3[%s] [ADMIN SCAN] Memindai SEMUA file stream aktif di disk server...^7"):format(ResourceName))

    local scanJson = exports[ResourceName]:ScanAllServerResourcesJson()
    if scanJson and scanJson ~= "" then
        local status, result = pcall(json.decode, scanJson)
        if status and result and result.catalog then
            MasterCatalog = result.catalog
            print(("^2[%s] Scan Selesai: %d resources (%d assets, %.2f MB) berhasil di-index ke RAM server!^7"):format(
                ResourceName,
                result.totalResources or #MasterCatalog,
                result.totalAssets or 0,
                result.totalSizeMB or 0.0
            ))

            -- Simpan snapshot ke file assets.json untuk reboot instan
            if Config.SaveScannedToJson then
                exports[ResourceName]:SaveCatalogToJson(scanJson)
            end

            isScanning = false

            -- Notifikasi ke semua player bahwa katalog baru telah diperbarui
            TriggerClientEvent('chat:addMessage', -1, {
                color = { 56, 189, 248 },
                args = { "Nusa Raya Cache", "Katalog asset server telah diperbarui oleh Admin!" }
            })

            return MasterCatalog
        end
    end

    print(("^1[%s] Gagal memindai resource via live scanner!^7"):format(ResourceName))
    isScanning = false
    return MasterCatalog
end

-- ====================================================================
-- INISIALISASI SAAT SERVER START
-- ====================================================================
CreateThread(function()
    -- Prioritas 1: Baca snapshot JSON jika sudah ada (instan, 0 beban disk)
    if LoadCatalogFromJson() then
        return
    end

    -- Prioritas 2: Jika belum ada JSON, lakukan scan awal 1x di background setelah 3 detik
    if Config.InitialScanOnBoot then
        Wait(3000)
        ScanLiveServer(true, 0)
    end
end)

-- ====================================================================
-- COMMAND /scancache (KHUSUS ADMIN / CONSOLE)
-- ====================================================================
RegisterCommand('scancache', function(source, args)
    if IsPlayerAdmin(source) then
        local cat = ScanLiveServer(true, source)
        if source ~= 0 then
            TriggerClientEvent('chat:addMessage', source, {
                color = { 34, 197, 94 },
                args = { "Nusa Raya Cache", ("Deep scan selesai! %d resource berhasil di-index."):format(#cat) }
            })
        end
    else
        TriggerClientEvent('chat:addMessage', source, {
            color = { 239, 68, 68 },
            args = { "Nusa Raya Cache", "Anda tidak memiliki izin untuk melakukan deep scan server!" }
        })
    end
end, false)

-- ====================================================================
-- EVENT CLIENT REQUEST CATALOG (0% BEBAN UNTUK PLAYER BIASA)
-- ====================================================================
RegisterNetEvent('nr_cachedownload:server:requestCatalog', function(intent, forceScan)
    local src = source
    local isAdmin = IsPlayerAdmin(src)

    -- Jika katalog di RAM masih kosong, inisialisasi dulu
    if #MasterCatalog == 0 then
        if not LoadCatalogFromJson() then
            ScanLiveServer(true, 0)
        end
    end

    -- Proteksi Server: Hanya ADMIN yang diizinkan melakukan deep scan disk fisik
    if forceScan then
        if isAdmin then
            ScanLiveServer(true, src)
        else
            -- Player biasa hanya me-refresh dari RAM (0% disk I/O!)
            TriggerClientEvent('chat:addMessage', src, {
                color = { 251, 146, 60 },
                args = { "Nusa Raya Cache", "Status cache Anda telah di-refresh dari snapshot server." }
            })
        end
    end

    -- Kirim katalog dari RAM server (sangat cepat, < 1ms, tidak membebani server sama sekali)
    TriggerClientEvent('nr_cachedownload:client:receiveCatalog', src, MasterCatalog, ServerBuild, intent, isAdmin)
end)

-- Exports untuk resource FiveM lain
exports('GetCatalog', function()
    return MasterCatalog
end)

exports('ForceRescan', function()
    return ScanLiveServer(true, 0)
end)
