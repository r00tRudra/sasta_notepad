param(
    [string]$EnvFile = "$PSScriptRoot\.env",
    [string]$AppDir = "$PSScriptRoot",
    [string]$BindHost = "0.0.0.0",
    [int]$Port = 8000,
    [switch]$Reload
)

$envFilePath = $EnvFile
if (-not (Test-Path $envFilePath)) {
    $altEnv = Join-Path $PSScriptRoot "app\.env"
    if (Test-Path $altEnv) {
        $envFilePath = $altEnv
    } else {
        throw "Env file not found. Expected $EnvFile or $altEnv"
    }
}

Get-Content $envFilePath | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#")) {
        $parts = $line -split "=", 2
        if ($parts.Count -eq 2) {
            $name = $parts[0].Trim()
            $value = $parts[1].Trim()
            if ($name) {
                Set-Item -Path ("Env:\" + $name) -Value $value
            }
        }
    }
}

if (-not $env:ENV) {
    $env:ENV = "production"
}

if ($env:DATABASE_URL) {
    $url = $env:DATABASE_URL
    $sslmode = $null

    if ($url -match '(?i)[?&]sslmode=([^&]+)') {
        $sslmode = $matches[1]
    }

    $url = $url -replace '(?i)([?&])sslmode=[^&]*&?', '$1'
    $url = $url -replace '(?i)([?&])channel_binding=[^&]*&?', '$1'
    $url = $url -replace '\?&', '?' -replace '[?&]$', ''

    if ($sslmode -and $sslmode.ToLower() -ne 'disable' -and ($url -notmatch '(?i)[?&]ssl=')) {
        if ($url -match '\?') {
            $url += '&ssl=true'
        } else {
            $url += '?ssl=true'
        }
    }

    $env:DATABASE_URL = $url
}

$python = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
if (-not (Test-Path $python)) {
    $python = "python"
}

$args = @(
    "-m", "uvicorn",
    "app.main:app",
    "--host", $BindHost,
    "--port", $Port.ToString(),
    "--app-dir", $AppDir
)

if ($Reload) {
    $args += "--reload"
}

& $python @args
