# CogTrack — Codebook delle metriche (v1)

> Regola d'oro: questo documento definisce COSA conta come evento.
> Un dato è oggettivo solo quanto è univoca la sua definizione.
> Ogni misurazione registra con quale VERSIONE del codebook è stata raccolta.

## Regole di codifica globali (valgono per tutte le metriche)
- **Da video, in pausa.** Mai dal vivo. Puoi riavvolgere e congelare il fotogramma.
- **Alla cieca.** Codifica per NUMERO di maglia, senza guardare il nome. Riduce l'effetto alone.
- **In dubbio, scarta.** Se un evento non è chiaramente classificabile, NON lo registri. Non indovinare mai.
- **Tracciabilità.** Ogni osservazione registra: chi ha codificato + riferimento video (file#timestamp).
- **n minimo.** Non pubblicare un voto sotto un numero minimo di eventi (default: 6). Sotto soglia, mostra solo "dati insufficienti".
- **Campionamento deciso prima.** Stabilisci quali giocatori e quale esercizio PRIMA di guardare il video. Niente cherry-picking.

---

## TRS — Transition Reset Score
*Stato: alta oggettività. Base: mia operazionalizzazione, ma fondata su una differenza di tempo (un fatto).*

**Cosa misura:** rapidità di riorganizzazione dopo un cambio di possesso.
**Fase misurata (v1):** solo transizione NEGATIVA (la tua squadra perde palla). È la più netta.
**Unità di osservazione:** una transizione negativa in cui il giocatore è in campo e coinvolto nell'azione.

- **t0 (istante zero):** il fotogramma in cui la palla cambia squadra.
- **t1 (reazione):** il primo fotogramma in cui il giocatore compie la PRIMA azione coerente con la nuova fase (cambia direzione, ripiega, scala, riaggredisce).
- **Conta:** il primo movimento *finalizzato* alla nuova fase.
- **NON conta:** movimento già in corso per inerzia che non cambia in risposta alla transizione.

**Registrazione:** una riga = una transizione. `count_value` = tempo di reazione (t1 − t0) in secondi; `opportunity_value` = 1.
**Derivato:** tempo medio di reazione = AVG(count_value).
⚠️ **Attenzione al verso:** qui PIÙ BASSO = MEGLIO (opposto a SR). Nel mapping a 1–10 il voto si inverte.

**Esempi:**
- *Conta:* palla persa; dopo 1,2s il giocatore inverte la corsa e ripiega → 1,2s.
- *Scarta:* il giocatore era già in ripiegamento e prosegue uguale → ambiguo, non registrare.

---

## SR — Scanning Rate
*Stato: alta oggettività. Base: NOTO (metodo di conteggio delle scansioni in letteratura). Soglie per età = da calibrare sui tuoi dati.*

**Cosa misura:** quanto il giocatore esplora il campo prima di ricevere palla.
**Unità di osservazione:** una ricezione di palla del giocatore osservato.
**Finestra:** i ~5 secondi prima del primo contatto con la palla (oppure: dall'ultimo passaggio precedente).

- **Conta come UNA scansione:** rotazione attiva della testa che porta lo sguardo via dalla palla (≥ ~45°) e ritorno.
- **NON conta:** micro-movimenti del capo (<45°); seguire la palla con lo sguardo; girarsi solo per correre; qualsiasi scansione dopo il primo contatto.

**Registrazione:** una riga = una ricezione. `count_value` = n° scansioni; `opportunity_value` = durata finestra in secondi.
**Derivato:** scansioni/sec = SUM(count)/SUM(opportunity); scansioni/ricezione = AVG(count).

**Esempi:**
- *Conta:* prima di ricevere gira la testa a destra, poi a sinistra → 2 scansioni.
- *Non conta:* fissa il portatore per tutta la finestra → 0 scansioni (anche se "attento").
- *Scarta:* il giocatore è di spalle / troppo lontano, non vedi la testa → non registrare la ricezione.

---

## AI — Anticipation Index
*Stato: media oggettività (il "sì/no" è un fatto; l'individuazione delle opportunità è tuo giudizio). Base: mia operazionalizzazione.*

**Cosa misura:** quanto il giocatore agisce PRIMA dell'evento invece di reagire dopo.
**Unità:** un'opportunità netta di anticipo (es. un passaggio sta per essere giocato in una zona).

- **t0:** fotogramma dell'evento (palla che parte).
- **Conta come anticipo:** al fotogramma t0 il giocatore è GIÀ in movimento verso la posizione/azione corretta.
- **NON conta:** si muove solo dopo t0 (reazione); si muove prima ma nella direzione sbagliata.
- **In dubbio sull'opportunità:** scarta. Conta solo le opportunità nette.

**Registrazione:** `count_value` = anticipi riusciti; `opportunity_value` = opportunità osservate.

---

## DQI — Decision Quality Index
*Stato: bassa oggettività (il criterio è tuo; "opzione disponibile" resta giudizio). Base: mia operazionalizzazione. Coda cieca obbligatoria.*

**Cosa misura:** qualità della SCELTA, indipendentemente dall'esito.
**Unità:** una decisione osservabile con palla (passaggio / dribbling / tiro / tenuta).
**Criterio (DA SCRIVERE per la tua squadra):** la scelta ha mantenuto o fatto avanzare il possesso verso l'obiettivo concordato, data la migliore opzione *disponibile e visibile*? → buona / non buona.

- **Valuta la lettura, NON il risultato.** Un passaggio fallito dopo una scelta giusta = decisione buona.
- **In dubbio (50/50):** scarta. Non forzare.

**Registrazione:** `count_value` = decisioni buone; `opportunity_value` = decisioni osservate.

---

## VCI — Verbal Communication Index
*Stato: bassa fattibilità da solo (serve isolare la voce del singolo). Base: mia operazionalizzazione. Misurala solo in esercizi piccoli dove senti davvero il bambino; altrimenti tienila soggettiva.*

**Cosa misura:** frequenza di comunicazioni utili.
**Unità:** un atto comunicativo udibile attribuibile al giocatore.
**Categorie:** informativa ("uomo!", "tempo!") / di guida ("gira!", "apri!") / incitamento.

- **NON conta:** rumore non comunicativo, lamentele, proteste.

**Registrazione:** `count_value` = atti utili; `opportunity_value` = minuti osservati.

---

## Versionamento
Ogni modifica a una definizione = nuova versione (v2, v3...). I dati raccolti restano legati alla versione con cui sono nati, così non confronti mele con pere.
