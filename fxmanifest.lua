fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'nr_cachedownload'
author 'Project Nusa Raya'
description 'Standalone In-Game Asset Cache Downloader & Model Preloader'
version '2.0.0'

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/assets/**',
    'assets.json'
}

shared_scripts {
    'config.lua'
}

client_scripts {
    'client/main.lua'
}

server_scripts {
    'server/scanner.js',
    'server/main.lua'
}
