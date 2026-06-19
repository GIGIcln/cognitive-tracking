# Observation Events — Riferimento di sviluppo

> Documento vivo. Registra stato, decisioni prese (con il *perché*) e invarianti del sottosistema delle osservazioni cognitive. Aggiornalo a ogni decisione, così non si rilitiga.
> Definizioni delle metriche: `docs/codebook/codebook-v1.md`.

## Cosa fa
Misura 5 parametri (SR, DQI, AI, TRS, VCI) registrando EVENTI osservati da video, e ne deriva un punteggio 1–10 con un flag di affidabilità basato sulla dimensione campionaria.

## Architettura
- `observation_events`: **una riga = un evento** (append-only). Colonne chiave: `numerator`, `denominator`, `metric_type`, `video_ref`, `codebook_version`.
- POST batch (`/sessions/{sid}/events`): **idempotente** — in transazione, cancella le righe esistenti per le coppie (player, metric) del batch, poi inserisce. Ri-salvare NON duplica.
- GET grezzo: una response per riga (audit), con `video_ref` e `codebook_version`.
- Response aggregata (POST): una per (player, metric); `SUM(numerator)/SUM(denominator)` → derivazioni. `video_ref=None`; `codebook_version` = versione comune o `None` se mista.
- `normalized_score()` e `reliability_flag()` sono **funzioni pure su scalari**; l'aggregazione somma le righe e poi le chiama.
- Write-back del punteggio su `measurements` con get-or-create della riga (session, player).

## Reliability — `n` per metrica (non è uguale per tutte)
| metrica | `n` = | unità |
|---|---|---|
| SR | `COUNT(righe)` | ricezioni |
| DQI | `denominator` | n° decisioni |
| TRS | `denominator` | n° transizioni |
| VCI | `denominator` | minuti |
| AI | `numerator` | n° successi (count-only by design) |

Soglie (`_METRIC_MIN_N`, formula `half/min/2×`): SR=6, DQI=20, TRS=10, VCI=8; AI 3/6/10. Bande: `<half` insufficient · `<min` low · `<2×min` medium · `≥2×min` high. Gate di pubblicazione: **da "medium" in su**.

## Decisioni prese (non rilitigare senza fatti nuovi)
- **Per-evento, non riga aggregata** — l'aggregato risparmia solo quando si digita un numero a sensazione; il per-evento dà verificabilità (audit, `n` reale, `video_ref`).
- **TRS binario** (reset entro soglia sì/no), non tempo continuo — entra negli INTEGER ed è più fattibile da soli.
- **`n` di SR = ricezioni** (COUNT righe), non secondi.
- **Codebook v1 editato in place** (zero dati finora). Dal primo dato reale: definizioni congelate, ogni modifica = nuova versione.
- **Validazione di dominio in Pydantic, niente CHECK/ENUM nel DB** (convenzione di progetto).

## Invarianti da preservare
1. Una riga = un evento (disciplina di inserimento, non solo schema).
2. `normalized_score`/`reliability_flag` restano pure su scalari.
3. Aggrega (SUM) **poi** deriva — mai derivare per riga e sommare i punteggi.
4. Ogni dato porta il suo `codebook_version`.
5. Nessun commit dei `/events` con suite di test rossa.

## Fili aperti
- [ ] UI: mostrare il nuovo `n` di SR in ricezioni + gate "≥ medium".
- [ ] UI: interpretare `codebook_version=None` (aggregato) come "versioni miste/ignota", non `v1`.
- [ ] Reliability: la formula `half/min/2×` accoppia soglia bassa e alta → valutare bande esplicite per metrica.
- [ ] (Lontano, alto sforzo) rilevamento automatico delle scansioni SR da video ravvicinato.

## Come estendere
Ricognizione sola-lettura → decidi soglie/semantiche → scrivi con i test → un commit atomico per cambiamento logico. Cambi una definizione di metrica? Nuova versione del codebook.
