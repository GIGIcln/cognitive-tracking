# Cognitive Tracking

Piattaforma full-stack per il monitoraggio cognitivo.

## Stack

| Layer    | Tecnologie |
|----------|-----------|
| Frontend | React 18 · Vite · Tailwind CSS |
| Backend  | FastAPI · SQLAlchemy · Alembic |
| Database | PostgreSQL |

---

## Setup rapido

### Prerequisiti

- Node.js ≥ 20
- Python ≥ 3.11
- PostgreSQL ≥ 15

---

### 1. Backend

```bash
cd backend

# Crea e attiva l'ambiente virtuale
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# Installa dipendenze
pip install -r requirements.txt

# Configura le variabili d'ambiente
cp .env.example .env
# → modifica .env con le credenziali del tuo database

# Esegui le migrazioni
alembic upgrade head

# Avvia il server di sviluppo
uvicorn app.main:app --reload --port 8000
```

API docs disponibili su: http://localhost:8000/api/docs

---

### 2. Frontend

```bash
cd frontend

# Installa dipendenze
npm install

# Avvia il server di sviluppo
npm run dev
```

App disponibile su: http://localhost:5173

---

## Struttura del progetto

```
cognitivetracking2/
├── frontend/
│   ├── src/
│   │   ├── layouts/        # Layout condivisi (MainLayout)
│   │   ├── pages/          # Pagine (da creare)
│   │   ├── components/     # Componenti riutilizzabili (da creare)
│   │   ├── hooks/          # Custom hooks (da creare)
│   │   ├── services/       # Client API / IndexedDB (da creare)
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── tailwind.config.js
│
└── backend/
    ├── app/
    │   ├── models/         # Modelli SQLAlchemy
    │   ├── routers/        # Route FastAPI
    │   ├── schemas/        # Schemi Pydantic
    │   ├── services/       # Business logic
    │   ├── config.py       # Impostazioni (pydantic-settings)
    │   ├── database.py     # Engine + SessionLocal
    │   └── main.py         # Entry point FastAPI
    ├── alembic.ini
    ├── requirements.txt
    └── .env.example
```

## Colori brand

| Nome    | Hex       |
|---------|-----------|
| Granata | `#8B1A2E` |
| Oro     | `#C9A227` |
