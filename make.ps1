#Requires -Version 5.1
<#
.SYNOPSIS
    Cognitive Tracking - Make (Windows 11)
.DESCRIPTION
    Equivalente Windows del Makefile Unix.
    Uso: .\make.ps1 <target> [-MSG "descrizione"]
.EXAMPLE
    .\make.ps1 setup
    .\make.ps1 dev
    .\make.ps1 migrate
    .\make.ps1 seed
    .\make.ps1 migration-new -MSG "aggiunge tabella X"
    .\make.ps1 stop
    .\make.ps1 clean
    .\make.ps1 clean-all
#>

param(
    [Parameter(Position = 0)]
    [string]$Target = "help",
    [string]$MSG    = ""
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# -- Path --------------------------------------------------------------------
$ProjectRoot = $PSScriptRoot
$BackendDir  = Join-Path $ProjectRoot "backend"
$FrontendDir = Join-Path $ProjectRoot "frontend"
$VenvDir     = Join-Path $BackendDir ".venv"
$PythonExe   = Join-Path $VenvDir "Scripts\python.exe"
$PipExe      = Join-Path $VenvDir "Scripts\pip.exe"
$AlembicExe  = Join-Path $VenvDir "Scripts\alembic.exe"

# -- Helpers -----------------------------------------------------------------
function Write-Step { param([string]$M) Write-Host "[....] $M" -ForegroundColor Yellow }
function Write-Done { param([string]$M) Write-Host "[ OK] $M"  -ForegroundColor Green  }
function Write-Fail { param([string]$M) Write-Host "[ERR] $M"  -ForegroundColor Red    }
function Write-Info { param([string]$M) Write-Host "      $M" }

function Get-PythonCmd {
    return (@("python", "python3", "py") |
        Where-Object { Get-Command $_ -ErrorAction SilentlyContinue } |
        Select-Object -First 1)
}

function Assert-Venv {
    if (-not (Test-Path $VenvDir)) {
        Write-Fail "Virtual environment non trovato. Esegui prima: .\make.ps1 setup"
        exit 1
    }
}

function Assert-Env {
    if (-not (Test-Path (Join-Path $BackendDir ".env"))) {
        Write-Fail "backend\.env non trovato. Esegui prima: .\make.ps1 setup"
        exit 1
    }
}

function Stop-PortProcess {
    param([int]$Port, [string]$Label)
    $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($conns) {
        $pids = $conns.OwningProcess | Sort-Object -Unique | Where-Object { $_ -gt 4 }
        foreach ($p in $pids) { Stop-Process -Id $p -Force -ErrorAction SilentlyContinue }
        Write-Done "Porta $Port liberata ($Label)"
    } else {
        Write-Info "Nessun processo su porta $Port ($Label)"
    }
}

# ============================================================================
switch ($Target.ToLower()) {

    # -- help -----------------------------------------------------------------
    "help" {
        Write-Host ""
        Write-Host "Cognitive Tracking - Comandi Windows" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "  .\make.ps1 dev                          Avvia frontend e backend" -ForegroundColor Yellow
        Write-Host "  .\make.ps1 setup                        Prima configurazione" -ForegroundColor Yellow
        Write-Host "  .\make.ps1 migrate                      Applica migrazioni DB" -ForegroundColor Yellow
        Write-Host "  .\make.ps1 seed                         Popola dati iniziali" -ForegroundColor Yellow
        Write-Host "  .\make.ps1 migration-new -MSG '...'     Crea nuova migrazione" -ForegroundColor Yellow
        Write-Host "  .\make.ps1 stop                         Ferma processi su 8000/5173" -ForegroundColor Yellow
        Write-Host "  .\make.ps1 clean                        Rimuove cache Python" -ForegroundColor Yellow
        Write-Host "  .\make.ps1 clean-all                    Rimuove anche venv e node_modules" -ForegroundColor Yellow
        Write-Host "  .\make.ps1 help                         Mostra questo messaggio" -ForegroundColor Yellow
        Write-Host ""
    }

    # -- dev ------------------------------------------------------------------
    "dev" {
        & (Join-Path $ProjectRoot "scripts\dev.ps1")
    }

    # -- setup ----------------------------------------------------------------
    "setup" {
        Write-Host ""
        Write-Step "Verifica prerequisiti..."
        $anyMissing = $false

        $pyCmd = Get-PythonCmd
        if ($pyCmd) {
            Write-Done "Python trovato ($pyCmd)"
        } else {
            Write-Fail "Python non trovato. Installa: winget install Python.Python.3"
            $anyMissing = $true
        }

        $prereqs = @(
            @{ Cmd = "node"; Label = "Node.js"; Hint = "winget install OpenJS.NodeJS" },
            @{ Cmd = "npm";  Label = "npm";     Hint = "installato con Node.js" },
            @{ Cmd = "psql"; Label = "psql";    Hint = "winget install PostgreSQL.PostgreSQL" }
        )
        foreach ($p in $prereqs) {
            if (Get-Command $p.Cmd -ErrorAction SilentlyContinue) {
                Write-Done "$($p.Label) trovato"
            } else {
                Write-Fail "$($p.Label) non trovato. $($p.Hint)"
                $anyMissing = $true
            }
        }

        if ($anyMissing) { Write-Fail "Risolvi i prerequisiti e riprova."; exit 1 }
        Write-Done "Tutti i prerequisiti presenti"

        Write-Step "Creazione virtual environment Python..."
        if (-not (Test-Path $VenvDir)) {
            & $pyCmd -m venv $VenvDir
            if ($LASTEXITCODE -ne 0) { Write-Fail "Creazione venv fallita"; exit 1 }
            Write-Done "Virtual environment creato in $VenvDir"
        } else {
            Write-Done "Virtual environment gia' presente"
        }

        Write-Step "Installazione dipendenze Python..."
        $reqFile = Join-Path $BackendDir "requirements.txt"
        & $PipExe install -r $reqFile -q
        if ($LASTEXITCODE -ne 0) { Write-Fail "pip install fallito"; exit 1 }
        Write-Done "Dipendenze Python installate"

        Write-Step "Configurazione file .env..."
        $envFile    = Join-Path $BackendDir ".env"
        $envExample = Join-Path $BackendDir ".env.example"
        if (-not (Test-Path $envFile)) {
            if (Test-Path $envExample) {
                Copy-Item $envExample $envFile
                Write-Done "Creato backend\.env da .env.example"
                Write-Host "  ATTENZIONE: modifica DATABASE_URL e SECRET_KEY!" -ForegroundColor Red
            } else {
                Write-Fail ".env.example non trovato - crea manualmente backend\.env"
            }
        } else {
            Write-Done "backend\.env gia' presente"
        }

        Write-Step "Installazione npm packages..."
        $nodeModules = Join-Path $FrontendDir "node_modules"
        if (-not (Test-Path $nodeModules)) {
            & npm --prefix $FrontendDir install --silent
            if ($LASTEXITCODE -ne 0) { Write-Fail "npm install fallito"; exit 1 }
            Write-Done "npm packages installati"
        } else {
            Write-Done "node_modules gia' presente"
        }

        Write-Host ""
        Write-Host "--------------------------------------------" -ForegroundColor Green
        Write-Done "Setup completato!"
        Write-Host ""
        Write-Info "Prossimi passi:"
        Write-Host "  1. Modifica backend\.env con DATABASE_URL e SECRET_KEY" -ForegroundColor Yellow
        Write-Host "  2. .\make.ps1 migrate    per creare le tabelle" -ForegroundColor Yellow
        Write-Host "  3. .\make.ps1 seed       per popolare dati iniziali" -ForegroundColor Yellow
        Write-Host "  4. .\make.ps1 dev        per avviare l'app" -ForegroundColor Yellow
        Write-Host "--------------------------------------------" -ForegroundColor Green
        Write-Host ""
    }

    # -- migrate --------------------------------------------------------------
    "migrate" {
        Assert-Env; Assert-Venv
        Write-Step "Esecuzione alembic upgrade head..."
        Push-Location $BackendDir
        & $AlembicExe upgrade head 2>&1 | ForEach-Object { "$_" } | Write-Host
        $ec = $LASTEXITCODE
        Pop-Location
        if ($ec -ne 0) { Write-Fail "Migrazione fallita (exit code $ec)"; exit 1 }
        Write-Done "Migrazioni completate"
    }

    # -- seed -----------------------------------------------------------------
    "seed" {
        Assert-Env; Assert-Venv
        Write-Step "Esecuzione seed.py..."
        $seedFile = Join-Path $BackendDir "seed.py"
        & $PythonExe $seedFile
        if ($LASTEXITCODE -ne 0) { Write-Fail "Seed fallito"; exit 1 }
        Write-Done "Seed completato"
    }

    # -- migration-new --------------------------------------------------------
    "migration-new" {
        if (-not $MSG) {
            Write-Fail "Specifica -MSG. Esempio: .\make.ps1 migration-new -MSG 'aggiunge tabella X'"
            exit 1
        }
        Assert-Env; Assert-Venv
        Write-Step "Creazione migrazione: $MSG"
        Push-Location $BackendDir
        & $AlembicExe revision --autogenerate -m $MSG
        $ec = $LASTEXITCODE
        Pop-Location
        if ($ec -ne 0) { Write-Fail "Creazione migrazione fallita"; exit 1 }
        Write-Done "Migrazione creata"
    }

    # -- stop -----------------------------------------------------------------
    "stop" {
        Write-Step "Arresto processi su porte 8000 e 5173..."
        Stop-PortProcess -Port 8000 -Label "Backend"
        Stop-PortProcess -Port 5173 -Label "Frontend"
    }

    # -- clean ----------------------------------------------------------------
    "clean" {
        Write-Step "Rimozione cache Python..."
        Get-ChildItem -Path $ProjectRoot -Filter "__pycache__" -Recurse -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notlike "*\.git\*" } |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        Get-ChildItem -Path $ProjectRoot -Include "*.pyc", "*.pyo" -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notlike "*\.git\*" } |
            Remove-Item -Force -ErrorAction SilentlyContinue
        Remove-Item (Join-Path $env:TEMP "ct_alembic.txt") -Force -ErrorAction SilentlyContinue
        Write-Done "Cache Python rimossa"
    }

    # -- clean-all ------------------------------------------------------------
    "clean-all" {
        Write-Step "Rimozione cache Python..."
        Get-ChildItem -Path $ProjectRoot -Filter "__pycache__" -Recurse -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notlike "*\.git\*" } |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        Get-ChildItem -Path $ProjectRoot -Include "*.pyc", "*.pyo" -Recurse -File -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notlike "*\.git\*" } |
            Remove-Item -Force -ErrorAction SilentlyContinue

        Write-Step "Rimozione venv e node_modules..."
        Remove-Item $VenvDir -Recurse -Force -ErrorAction SilentlyContinue
        $nodeModules = Join-Path $FrontendDir "node_modules"
        Remove-Item $nodeModules -Recurse -Force -ErrorAction SilentlyContinue
        Write-Done "Pulizia completa. Esegui '.\make.ps1 setup' per reinstallare."
    }

    # -- default --------------------------------------------------------------
    default {
        Write-Fail "Target '$Target' non riconosciuto."
        Write-Host "  Esegui '.\make.ps1 help' per i comandi disponibili." -ForegroundColor Yellow
        exit 1
    }
}
