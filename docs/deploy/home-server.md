# Guida: Deploy su PC fisso Windows + Cloudflare Tunnel

> Obiettivo: rendere l'app accessibile da smartphone in campo via HTTPS, gratuitamente, usando il PC fisso come server.
> Il PC deve essere acceso e connesso a internet. Quando si spegne, gli smartphone salvano i dati in locale e sincronizzano alla riaccensione.

---

## Prerequisiti

- PC fisso con Windows 10/11
- Connessione internet (fibra o ADSL — funziona anche con IP dinamico o CGNAT)
- Account Cloudflare gratuito su [cloudflare.com](https://cloudflare.com)
- Un dominio collegato a Cloudflare (es. `example.com`) — puoi acquistarlo su Cloudflare ~10 €/anno

---

## Fase 1 — Installare Docker Desktop

1. Scarica **Docker Desktop per Windows** da [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop)
2. Durante l'installazione, scegli il backend **WSL 2** (consigliato)
3. Riavvia il PC quando richiesto
4. Apri Docker Desktop e attendi che il motore sia verde ("Running")

---

## Fase 2 — Clonare il repo e configurare l'ambiente

Apri **PowerShell** (o Windows Terminal) e lancia:

```powershell
cd C:\Users\<utente>
git clone https://github.com/GIGIcln/cognitive-tracking.git
cd cognitive-tracking
```

Crea il file `.env.production` a partire dal template:

```powershell
copy .env.production.example .env.production
notepad .env.production
```

Compila i tre valori nel file che si apre:

| Variabile | Come ottenerla |
|---|---|
| `SECRET_KEY` | Apri PowerShell ed esegui: `python -c "import secrets; print(secrets.token_hex(32))"` |
| `POSTGRES_PASSWORD` | Scegli una password robusta (min 16 caratteri) |
| `ALLOWED_ORIGINS` | Inserisci il tuo dominio — lo conoscerai dopo la Fase 4 (lascia un placeholder per ora) |

---

## Fase 3 — Avviare lo stack Docker

Sempre in PowerShell dalla cartella `cognitive-tracking`:

```powershell
docker compose -f docker-compose.prod.yml up -d
```

Docker scaricherà le immagini (~5 minuti al primo avvio), costruirà il frontend e avvierà tutto.

Verifica che i container siano in esecuzione:

```powershell
docker compose -f docker-compose.prod.yml ps
```

Dovresti vedere `db`, `backend` e `frontend` tutti con stato `running`.

Testa in locale aprendo il browser su `http://localhost` — dovrebbe apparire la pagina di login.

---

## Fase 4 — Configurare Cloudflare Tunnel

### 4a. Installare cloudflared

Scarica il file `.msi` dalla pagina ufficiale:
[github.com/cloudflare/cloudflared/releases](https://github.com/cloudflare/cloudflared/releases)

Cerca `cloudflared-windows-amd64.msi`, scaricalo e installalo. Dopo l'installazione, verifica:

```powershell
cloudflared --version
```

### 4b. Autenticarsi con Cloudflare

```powershell
cloudflared login
```

Si aprirà il browser. Accedi al tuo account Cloudflare e seleziona il dominio che vuoi usare. Il comando salva automaticamente un certificato in `C:\Users\<utente>\.cloudflared\cert.pem`.

### 4c. Creare il tunnel

```powershell
cloudflared tunnel create gestionale
```

L'output mostrerà l'UUID del tunnel (es. `a1b2c3d4-...`). **Prendine nota.**

Viene creato automaticamente il file di credenziali in:
`C:\Users\<utente>\.cloudflared\a1b2c3d4-....json`

### 4d. Configurare il tunnel

Copia il template di configurazione:

```powershell
copy cloudflared\config.yml.example C:\Users\<utente>\.cloudflared\config.yml
notepad C:\Users\<utente>\.cloudflared\config.yml
```

Sostituisci i placeholder nel file:

```yaml
tunnel: a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx   # ← il tuo UUID
credentials-file: C:\Users\TUO-UTENTE\.cloudflared\a1b2c3d4-xxxx-xxxx-xxxx-xxxxxxxxxxxx.json

ingress:
  - hostname: gestionale.example.com            # ← il tuo sottodominio
    service: http://localhost:80
  - service: http_status:404
```

### 4e. Aggiungere il DNS su Cloudflare

```powershell
cloudflared tunnel route dns gestionale gestionale.example.com
```

Questo crea automaticamente un record CNAME su Cloudflare che punta al tuo tunnel.

### 4f. Testare il tunnel manualmente

```powershell
cloudflared tunnel run gestionale
```

Apri `https://gestionale.example.com` dal browser del telefono. Se funziona, interrompi con `Ctrl+C` e passa al passo successivo.

---

## Fase 5 — Avvio automatico al boot di Windows

Installa cloudflared come **Windows Service** — si avvia automaticamente con il PC:

```powershell
cloudflared service install
```

Avvia subito il servizio:

```powershell
Start-Service cloudflared
```

Verifica lo stato:

```powershell
Get-Service cloudflared
```

Dovresti vedere `Status: Running`.

---

## Fase 6 — Aggiornare ALLOWED_ORIGINS

Ora che conosci il dominio, aggiorna `.env.production`:

```powershell
notepad .env.production
```

Modifica la riga:
```
ALLOWED_ORIGINS=https://gestionale.example.com
```

Riavvia il backend per applicare la modifica:

```powershell
docker compose -f docker-compose.prod.yml restart backend
```

---

## Comandi utili

| Operazione | Comando |
|---|---|
| Avviare lo stack | `docker compose -f docker-compose.prod.yml up -d` |
| Fermare lo stack | `docker compose -f docker-compose.prod.yml down` |
| Vedere i log | `docker compose -f docker-compose.prod.yml logs -f` |
| Aggiornare dopo un git pull | `docker compose -f docker-compose.prod.yml up -d --build` |
| Stato tunnel | `Get-Service cloudflared` |
| Riavviare tunnel | `Restart-Service cloudflared` |

---

## Comportamento quando il PC è spento

- Gli smartphone mostrano il banner **"Server non raggiungibile"** (arancione)
- I dati inseriti vengono salvati in locale (IndexedDB, max 7 giorni)
- Alla riaccensione del PC, Docker e cloudflared partono automaticamente
- Gli smartphone rilevano il ritorno del server entro 30 secondi e sincronizzano in automatico
