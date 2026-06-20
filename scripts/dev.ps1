#Requires -Version 5.1
<#
.SYNOPSIS
    Cognitive Tracking - Dev Launcher (Windows 11)
.DESCRIPTION
    Avvia DB check -> Backend (FastAPI/Uvicorn) -> Frontend (Vite) con un comando.
    Equivalente Windows di scripts/dev.sh
    Uso: .\scripts\dev.ps1  oppure  .\make.ps1 dev
#>

param()

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# -- Path relativi alla root del progetto ------------------------------------
$ScriptDir   = Split-Path $MyInvocation.MyCommand.Path -Parent
$ProjectRoot = Split-Path $ScriptDir -Parent
$BackendDir  = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$VenvDir     = Join-Path $BackendDir ".venv"
$EnvFile     = Join-Path $BackendDir ".env"
$PythonExe   = Join-Path $VenvDir "Scripts\python.exe"
$PipExe      = Join-Path $VenvDir "Scripts\pip.exe"
$AlembicExe  = Join-Path $VenvDir "Scripts\alembic.exe"
$TempLog     = Join-Path $env:TEMP "ct_alembic.txt"
$TunnelLog   = Join-Path $env:TEMP "ct_tunnel.log"

# -- Log helpers -------------------------------------------------------------
function Log-Sys   { param([string]$M) Write-Host "[SYSTEM]   $M" -ForegroundColor Yellow }
function Log-Back  { param([string]$M) Write-Host "[BACKEND]  $M" -ForegroundColor Blue }
function Log-Front { param([string]$M) Write-Host "[FRONTEND] $M" -ForegroundColor Green }
function Log-Ok    { param([string]$M) Write-Host "[OK]       $M" -ForegroundColor Cyan }
function Log-Err   { param([string]$M) Write-Host "[ERROR]    $M" -ForegroundColor Red }

# -- Variabili processi (per cleanup) ----------------------------------------
$script:BackendJob  = $null
$script:FrontendJob = $null
$script:TunnelProc  = $null
$script:pythonCmd   = $null

# -- Libera tutti i processi in ascolto su una porta -------------------------
function Stop-PortProcess {
    param([int]$Port, [string]$Service, [switch]$Quiet)
    $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($conns) {
        $ownerPids = $conns |
            Select-Object -ExpandProperty OwningProcess |
            Sort-Object -Unique |
            Where-Object { $_ -gt 4 }
        foreach ($p in $ownerPids) {
            Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
        }
        Start-Sleep -Seconds 1
        if (-not $Quiet) { Log-Ok "Porta $Port liberata ($Service)" }
    } else {
        if (-not $Quiet) { Log-Ok "Porta $Port libera ($Service)" }
    }
}

# -- Cleanup su Ctrl+C / uscita ----------------------------------------------
function Invoke-Cleanup {
    Write-Host ""
    Log-Sys "Shutdown in corso..."
    if ($script:TunnelProc -and -not $script:TunnelProc.HasExited) {
        Stop-Process -Id $script:TunnelProc.Id -Force -ErrorAction SilentlyContinue
        Log-Sys "Tunnel fermato"
    }
    if ($script:BackendJob) {
        Stop-Job   -Job $script:BackendJob  -ErrorAction SilentlyContinue
        Remove-Job -Job $script:BackendJob  -Force -ErrorAction SilentlyContinue
        Log-Back "Uvicorn fermato"
    }
    if ($script:FrontendJob) {
        Stop-Job   -Job $script:FrontendJob -ErrorAction SilentlyContinue
        Remove-Job -Job $script:FrontendJob -Force -ErrorAction SilentlyContinue
        Log-Front "Vite fermato"
    }
    Stop-PortProcess -Port 8000 -Quiet
    Stop-PortProcess -Port 5173 -Quiet
    Log-Sys "Tutti i servizi fermati. Arrivederci!"
}

# ============================================================================
Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "|  Cognitive Tracking - Dev Launcher       |" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
#  1. CHECK PREREQUISITI
# ============================================================================
Log-Sys "Verifica prerequisiti..."
$missing = $false

$script:pythonCmd = @("python", "python3", "py") |
    Where-Object { Get-Command $_ -ErrorAction SilentlyContinue } |
    Select-Object -First 1

if ($script:pythonCmd) {
    Log-Ok "Python trovato: $((Get-Command $script:pythonCmd).Source)"
} else {
    Log-Err "Python non trovato. Installa: winget install Python.Python.3"
    $missing = $true
}

$checks = @(
    @{ Cmd = "node"; Label = "Node.js"; Hint = "winget install OpenJS.NodeJS" },
    @{ Cmd = "npm";  Label = "npm";     Hint = "installato con Node.js" },
    @{ Cmd = "psql"; Label = "psql";    Hint = "winget install PostgreSQL.PostgreSQL" }
)
foreach ($c in $checks) {
    if (Get-Command $c.Cmd -ErrorAction SilentlyContinue) {
        Log-Ok "$($c.Label) trovato"
    } else {
        Log-Err "$($c.Label) non trovato. $($c.Hint)"
        $missing = $true
    }
}

if ($missing) { Log-Err "Risolvi i prerequisiti mancanti e riprova."; exit 1 }

$pyVer   = & $script:pythonCmd --version 2>&1
$nodeVer = node --version 2>&1
Log-Sys "Versioni: $pyVer | Node $nodeVer"

# ============================================================================
#  2. CHECK FILE .env
# ============================================================================
Write-Host ""
Log-Sys "Verifica configurazione .env..."

if (-not (Test-Path $EnvFile)) {
    Log-Err "File '$EnvFile' non trovato!"
    Write-Host ""
    Write-Host "  Crea il file con:" -ForegroundColor Yellow
    $examplePath = Join-Path $BackendDir ".env.example"
    Write-Host "  copy `"$examplePath`" `"$EnvFile`""
    Write-Host "  # poi modifica DATABASE_URL e SECRET_KEY"
    Write-Host ""
    exit 1
}
Log-Ok ".env trovato"

$dbUrlLine = Get-Content $EnvFile | Where-Object { $_ -match '^DATABASE_URL=' }
if (-not $dbUrlLine) { Log-Err "DATABASE_URL non trovata nel .env"; exit 1 }
$dbUrl = ($dbUrlLine -split '=', 2)[1].Trim('"').Trim("'")

# ============================================================================
#  3. CHECK PORTE
# ============================================================================
Write-Host ""
Log-Sys "Verifica disponibilita' porte..."
Stop-PortProcess -Port 8000 -Service "Backend/Uvicorn"
Stop-PortProcess -Port 5173 -Service "Frontend/Vite"

# ============================================================================
#  4. CHECK CONNESSIONE DATABASE
# ============================================================================
Write-Host ""
Log-Sys "Verifica connessione database..."

$dbHost  = if ($dbUrl -match '@([^:/]+)') { $Matches[1] } else { "sconosciuto" }
$isLocal = ($dbHost -eq "localhost" -or $dbHost -eq "127.0.0.1")
$connected = $false

for ($i = 1; $i -le 15; $i++) {
    $null = & psql $dbUrl -c "SELECT 1" -q --no-psqlrc 2>&1
    if ($LASTEXITCODE -eq 0) { $connected = $true; break }
    Write-Host "`r  Attesa database... ${i}s" -NoNewline -ForegroundColor Yellow
    Start-Sleep -Seconds 1
}
Write-Host ""

if (-not $connected) {
    Log-Err "Impossibile connettersi al database dopo 15s."
    Write-Host ""
    if ($isLocal) {
        Write-Host "  Database locale - avvia PostgreSQL:" -ForegroundColor Yellow
        Write-Host "  net start postgresql-x64-15"
        Write-Host "  (oppure: Servizi Windows -> Win+R -> services.msc)"
    } else {
        Write-Host "  Database remoto ($dbHost) - verifica connessione e .env" -ForegroundColor Yellow
    }
    Write-Host ""
    exit 1
}

if ($isLocal) { Log-Ok "Database locale pronto ($dbHost)" }
else          { Log-Ok "Database remoto raggiungibile ($dbHost)" }

# ============================================================================
#  5. VIRTUAL ENV PYTHON
# ============================================================================
Write-Host ""
Log-Sys "Configurazione Python venv..."

if (-not (Test-Path $VenvDir)) {
    Log-Back "Creazione virtual environment in $VenvDir..."
    & $script:pythonCmd -m venv $VenvDir
    if ($LASTEXITCODE -ne 0) { Log-Err "Creazione venv fallita"; exit 1 }
    Log-Ok "Virtual environment creato"
} else {
    Log-Ok "Virtual environment gia' presente"
}

Log-Back "Aggiornamento dipendenze Python..."
$reqFile = Join-Path $BackendDir "requirements.txt"
& $PipExe install -r $reqFile -q
if ($LASTEXITCODE -ne 0) { Log-Err "pip install fallito"; exit 1 }
Log-Ok "Dipendenze Python aggiornate"

# ============================================================================
#  6. MIGRAZIONI ALEMBIC
# ============================================================================
Write-Host ""
Log-Sys "Esecuzione migrazioni database..."

Push-Location $BackendDir
$alembicOut      = & $AlembicExe upgrade head 2>&1 | ForEach-Object { "$_" }
$alembicExitCode = $LASTEXITCODE
Pop-Location

$alembicOut | Out-File $TempLog -Encoding UTF8 -Force
if ($alembicExitCode -ne 0 -or ($alembicOut | Where-Object { $_ -match "ERROR|FATAL" })) {
    Log-Err "Migrazione fallita:"
    $alembicOut | ForEach-Object { Write-Host "  $_" }
    exit 1
}
Log-Ok "Migrazioni completate"

# ============================================================================
#  7. NODE MODULES
# ============================================================================
Write-Host ""
Log-Sys "Verifica dipendenze frontend..."

$nodeModules = Join-Path $FrontendDir "node_modules"
if (-not (Test-Path $nodeModules)) {
    Log-Front "Installazione npm packages (prima esecuzione)..."
    & npm --prefix $FrontendDir install --silent
    if ($LASTEXITCODE -ne 0) { Log-Err "npm install fallito"; exit 1 }
    Log-Ok "npm packages installati"
} else {
    Log-Ok "node_modules presente"
}

# ============================================================================
#  8. AVVIO SERVIZI IN BACKGROUND
# ============================================================================
Write-Host ""
Write-Host "--------------------------------------------" -ForegroundColor Cyan
Log-Sys "Avvio servizi in parallelo..."
Write-Host "--------------------------------------------" -ForegroundColor Cyan
Write-Host ""

$script:BackendJob = Start-Job -Name "CTBackend" -ScriptBlock {
    param($Dir, $Exe)
    Set-Location $Dir
    & $Exe -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 2>&1
} -ArgumentList $BackendDir, $PythonExe

Log-Back "Uvicorn avviato -> http://localhost:8000  (docs: /docs)"
Start-Sleep -Seconds 4

$script:FrontendJob = Start-Job -Name "CTFrontend" -ScriptBlock {
    param($Dir)
    Set-Location $Dir
    & npm run dev 2>&1
} -ArgumentList $FrontendDir

Log-Front "Vite avviato -> http://localhost:5173"

# ============================================================================
#  9. CLOUDFLARE TUNNEL (opzionale)
# ============================================================================
Write-Host ""
$tunnelUrl = ""

if (Get-Command "cloudflared" -ErrorAction SilentlyContinue) {
    Log-Sys "Avvio Cloudflare Tunnel (accesso remoto)..."
    $TunnelLogOut = Join-Path $env:TEMP "ct_tunnel_out.log"
    $TunnelLogErr = Join-Path $env:TEMP "ct_tunnel_err.log"
    Remove-Item $TunnelLogOut, $TunnelLogErr -Force -ErrorAction SilentlyContinue

    $script:TunnelProc = Start-Process "cloudflared" `
        -ArgumentList "tunnel", "--url", "http://localhost:5173" `
        -RedirectStandardOutput $TunnelLogOut `
        -RedirectStandardError  $TunnelLogErr `
        -PassThru -NoNewWindow

    for ($w = 1; $w -le 25; $w++) {
        Start-Sleep -Seconds 1
        foreach ($logFile in @($TunnelLogOut, $TunnelLogErr)) {
            if (Test-Path $logFile) {
                $m = Select-String -Path $logFile -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue
                if ($m) { $tunnelUrl = $m.Matches[0].Value; break }
            }
        }
        if ($tunnelUrl) { break }
        Write-Host "`r  Attendo URL tunnel... ${w}s" -NoNewline -ForegroundColor Yellow
    }
    Write-Host ""

    if ($tunnelUrl) { Log-Ok "Tunnel pronto: $tunnelUrl" }
    else            { Log-Sys "Tunnel avviato - URL non ancora disponibile" }
} else {
    Log-Sys "cloudflared non trovato - solo rete locale."
    Log-Sys "Installa con: winget install Cloudflare.cloudflared"
}

# ============================================================================
#  10. RILEVAMENTO IP LOCALE
# ============================================================================
$localIP = ""
try {
    $localIP = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
        Where-Object {
            $_.IPAddress -notlike "127.*" -and
            $_.IPAddress -notlike "169.254.*" -and
            $_.PrefixOrigin -eq "Dhcp"
        } |
        Sort-Object InterfaceMetric |
        Select-Object -First 1 -ExpandProperty IPAddress
} catch {}

if (-not $localIP) {
    try {
        $localIP = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction Stop |
            Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254.*" } |
            Select-Object -First 1 -ExpandProperty IPAddress
    } catch {}
}

# ============================================================================
#  11. RIEPILOGO
# ============================================================================
Write-Host ""
Write-Host "--------------------------------------------" -ForegroundColor Cyan
Write-Host "  Tutti i servizi avviati!" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Backend API  -> http://localhost:8000" -ForegroundColor Blue
Write-Host "  API Docs     -> http://localhost:8000/docs" -ForegroundColor Blue
Write-Host "  Frontend App -> http://localhost:5173" -ForegroundColor Green

if ($localIP) {
    Write-Host ""
    Write-Host "  Smartphone (stessa rete WiFi):" -ForegroundColor Yellow
    Write-Host "  Frontend     -> http://${localIP}:5173" -ForegroundColor Green
}
if ($tunnelUrl) {
    Write-Host ""
    Write-Host "  Smartphone (qualsiasi rete):" -ForegroundColor Yellow
    Write-Host "  Tunnel       -> $tunnelUrl" -ForegroundColor Green
}
Write-Host ""
Write-Host "  Premi Ctrl+C per fermare tutti i servizi" -ForegroundColor Yellow
Write-Host "--------------------------------------------" -ForegroundColor Cyan
Write-Host ""

# ============================================================================
#  12. LOOP PRINCIPALE
# ============================================================================
try {
    while ($true) {
        Receive-Job -Job $script:BackendJob  2>$null |
            ForEach-Object { Write-Host "[BACKEND]  $_" -ForegroundColor Blue }
        Receive-Job -Job $script:FrontendJob 2>$null |
            ForEach-Object { Write-Host "[FRONTEND] $_" -ForegroundColor Green }

        if ($script:BackendJob.State  -in @("Failed", "Completed")) {
            Log-Err "Backend terminato inaspettatamente."; break
        }
        if ($script:FrontendJob.State -in @("Failed", "Completed")) {
            Log-Err "Frontend terminato inaspettatamente."; break
        }
        Start-Sleep -Milliseconds 500
    }
} finally {
    Invoke-Cleanup
}
