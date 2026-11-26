# FormPeak

Trainings- und Belastungssteuerung für Amateurfußballer: Check-ins, Feedback und Gym-Log
werden zu Ampel, Hinweisen und (ab Phase 2) einem Wochenplan um das feste Teamtraining.

- Spezifikation: [`SPEC.md`](SPEC.md)
- Projektregeln: [`CLAUDE.md`](CLAUDE.md)

## Lokal starten

```bash
npm install
cp .env.example .env.local   # Werte eintragen
npx supabase start           # lokale Datenbank (Docker), wendet die Migrationen an
npm run dev
```

## Prüfen

```bash
npm test && npm run typecheck && npm run lint && npm run build
```

Die Belastungslogik liegt in `src/core/load/` (reines TypeScript, vollständig getestet).
