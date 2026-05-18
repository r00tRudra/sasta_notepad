param(
    [string]$EnvFile = "$PSScriptRoot\.env",
    [string]$OutFile = "$PSScriptRoot\config.js"
)

if (-not (Test-Path $EnvFile)) {
    throw "Env file not found: $EnvFile"
}

$line = Get-Content $EnvFile | Where-Object { $_ -match '^API_BASE_URL=' } | Select-Object -First 1
if (-not $line) {
    throw "API_BASE_URL not found in $EnvFile"
}

$api = $line -replace '^API_BASE_URL=', ''

@" | Set-Content $OutFile -Encoding UTF8
window.APP_CONFIG = window.APP_CONFIG || {};
window.APP_CONFIG.API_BASE_URL = window.APP_CONFIG.API_BASE_URL || "${api}";
"@
