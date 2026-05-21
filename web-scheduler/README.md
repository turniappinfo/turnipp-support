# TurniPP Web Scheduler

Web app statica per creare un programmato dal browser e generare file `.turniPP` compatibili con l'import del Programmatore in TurniPP.

## Cosa fa

- Inserisce mittente, ufficio e coordinatore.
- Gestisce uno o piu colleghi con turni per ogni giorno del mese.
- Esporta un file `.turniPP` con lo stesso formato usato dall'app iOS.
- Prova a condividere il file dal browser; se il browser non supporta la condivisione file, lo scarica.

## Come usarla

1. Apri `index.html` nel browser oppure servi la cartella con un server statico.
2. Compila i dati del mittente e dell'ufficio.
3. Aggiungi i colleghi e assegna i turni.
4. Usa `Scarica file .turniPP` o `Condividi al coordinatore`.
5. Il coordinatore importa il file in TurniPP e puo usare `Aggiungi al mio team`.

## Note tecniche

- I dati restano in `localStorage` sul browser usato.
- Il file esportato contiene: `version`, `exportDate`, `year`, `month`, `monthName`, `senderName`, `serviceLocation`, `members`.
- Nessun backend richiesto: e una soluzione statica pensata per utenti Android, Windows e browser desktop.
