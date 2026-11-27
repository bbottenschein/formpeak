# FormPeak – Projektregeln

Trainings- und Belastungs-App für ambitionierte Amateurfußballer (Landesliga bis Regionalliga)
ohne Profi-Umfeld. **Versprechen:** Jeden Morgen wissen, was heute dran ist – und alle paar Wochen
schwarz auf weiß sehen, dass es wirkt. Produktkonzept: `docs/KONZEPT.md`, Änderungen:
`docs/AENDERUNGEN.md`, technische Spezifikation: `SPEC.md` – vor größeren Änderungen lesen.

@AGENTS.md

Erst eigener Gebrauch (Dogfooding, Admin: Benedikt), später für andere Spieler. Deshalb von
Anfang an mehrnutzerfähig. Mit NinAI hat dieses Projekt nichts zu tun.

## Stack

- Next.js (App Router, TypeScript, Tailwind v4) als PWA, gehostet auf Vercel.
  `cacheComponents` ist bewusst **aus**: Jede Seite hängt vom Login ab und wird pro Request gerendert.
  Nach dem Setup gilt: Vor dem Schreiben von Next.js-Code die Doku in `node_modules/next/dist/docs/`
  lesen – die Version kann von deinem Trainingswissen abweichen.
- Supabase (EU-Region): Postgres mit Row Level Security, Auth (E-Mail + Passwort, Magic Link,
  Registrierung nur per Einladung).
- Claude API ab Phase 2, nur serverseitig.
- Geplante Jobs (Erinnerungen, Neuberechnung): Supabase `pg_cron` + `pg_net` ruft geschützte
  Routen unter `/api/jobs/*` auf (`Authorization: Bearer $JOBS_SECRET`). Jobs laufen stündlich,
  sind idempotent und prüfen die Uhrzeit in der Zeitzone jedes Nutzers.
- Diagramme mit Recharts. Später nativ mit Expo (Apple Health / Health Connect).

## Grundprinzip

Regeln im Code entscheiden, **ob** belastet werden darf. Die KI entscheidet nur, **was** trainiert
wird. Die Ampel wird nie von der KI überstimmt. Die App stellt keine Diagnosen und plant keine
Ernährung.

**Jeder Bereich beantwortet genau eine Frage** (Home: Wie geht es mir? · Heute: Was mache ich heute?
· Ziel: Komme ich voran? · Kalender: Wann ist was? · +: Schnell eintragen). Nichts überfrachten;
Neues gehört in den Bereich, dessen Frage es beantwortet.

**Transparenz:** Der Score ist erklärbar (Aufschlüsselung pro Baustein mit Beitrag und Quelle).
Quellen nur verlinken, wenn sie geprüft sind; Grenzen (ACWR umstritten, Gewichte sind Startwerte)
offen benennen.

## Design (CI)

- **Name und Logo:** Als Logo nur die Komponente `Wordmark` (`src/features/shell/wordmark.tsx`):
  „Form“ in gebrochenem Weiß, „Peak.“ in Limettengrün (mit Punkt) und Berggipfel darüber, Barlow
  ExtraBold kursiv. App-Symbole (Gipfel über „FP“) erzeugt `scripts/generate-icons.mjs`. Im Fließtext lieber
  „die App“; Seitentitel und Manifest heißen „FormPeak.“.
- **Dunkel als Standard** (`color-scheme: dark`). Warmes Graphit statt Schwarz, gebrochenes Weiß
  statt Reinweiß. Farben nur über die Tokens in `src/app/globals.css`, keine Hex-Werte in Komponenten.
- **Limettengrün `#BFFF00` (`primary`) ist der einzige Signalton:** Aktionen, Marke, Fokus,
  aktiver Tab. Nie für Status oder Warnungen. Text auf Limette immer dunkel (`primary-foreground`).
- **Ampelfarben** (`light-green`, `light-yellow`, `light-red`, `light-grey`) nur für den
  Belastungsstatus, gedämpft und meist als Tönung (Hintergrund ca. 18 %, Rand ca. 45 %).
  Das Ampel-Grün ist kühl (Richtung Türkis), damit es sich klar vom Limettengrün abhebt.
- **Schrift:** Barlow für Text, Barlow Condensed für Überschriften, Zahlen und Buttons
  (Buttons und Kleinüberschriften in Großbuchstaben, `.eyebrow`).
- **iPhone-Homescreen:** Die App läuft unter die Statusleiste (`black-translucent`). Oben und unten
  immer `env(safe-area-inset-top/bottom)` als Abstand einrechnen, sonst sind Bedienelemente verdeckt.
- **Selbsterklärend mit wenig Text:** pro Karte ein Titel, eine Zeile Eckdaten, ein Knopf.
  Erklärungen (warum, wie, Quelle) gehören hinter das Info-Symbol (`Info` aus `src/features/ui`),
  nicht als Fließtext auf die Seite. Abläufe mit mehreren Eingaben als Klick-Through.
- **Kein „KI-Look“:** keine Verläufe, kein Glow, keine Glas-Effekte, keine Emojis als Icons,
  keine bunten Karten. Flache Flächen, feine Linien, klare Hierarchie über Größe und Gewicht.

## Ordnerstruktur

- `src/core/load/` – Belastungslogik (sRPE, ACWR, EWMA, Readiness, Ampel, Schmerzregeln,
  Spieltagslogik). **Reines TypeScript ohne Next.js- oder Supabase-Abhängigkeiten**, damit es
  später auch in Expo läuft. Alle Schwellen in einer Konfiguration.
- `src/app/` – nur Routing, dünne Seiten.
  - `(app)/` – alles hinter dem Login, mit Tab-Leiste (Home · Heute · + · Ziel · Kalender),
    Profil oben rechts.
  - `login/`, `invite/` – öffentlich.
- `src/features/<modul>/` – ein Ordner pro Feature (`overview`, `today`, `plan`, `training`, `offseason`, `review`, `goals`, `week`, `log`, `checkin`,
  `bodymap`, `gym`, `calendar`, `history`, `settings`, `notifications`, `auth`, `admin`, `shell`, `ui`).
  Komponenten, Server Actions, Queries und reine Logik des Moduls liegen dort.
- `src/lib/` – modulübergreifende Helfer (Supabase-Clients, Datum/Zeitzone, Env, i18n).
- `messages/` – UI-Texte (i18n), zuerst `de`.
- `supabase/migrations/` – Schema. Änderungen immer als **neue** Migration, deployte Migrationen nie bearbeiten.
- `scripts/` – Admin-Skripte (z. B. Einladungen erzeugen).

## Regeln

- **Belastungsmodul zuerst und vollständig getestet** (Vitest, `*.test.ts` neben der Datei).
  Jede Regel aus `SPEC.md` Abschnitt 4 braucht Tests inkl. Grenzwerten (z. B. ACWR genau 1,3 / 1,5,
  Readiness genau 50 / 70) und den Referenz-Testfall (Training Di + Do, Spiel Sa).
  Fehler in der Logik sind teurer als Fehler im Design.
- **Zeitzone pro Nutzer** (`profiles.timezone`, Standard `Europe/Berlin`). Tagesgrenzen immer
  über die Datumshelfer in `src/lib/date.ts` bilden, nie `new Date().toISOString().slice(0, 10)`.
- **Gesundheitsdaten:** Jede Nutzertabelle hat `user_id` und RLS nur für den Besitzer. Der Admin
  sieht keine Gesundheitsdaten anderer Nutzer. KI-Anfragen enthalten keine Namen.
- API-Schlüssel nur serverseitig. Im Browser nur `NEXT_PUBLIC_SUPABASE_URL` und
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Der Secret Key nur in Jobs und Skripten.
- Rollen stehen in `profiles.role` und werden nur über `app_metadata` gesetzt, nie aus dem Client.
- Schmerz: nie zum Weitertrainieren raten; bei Rot-Regeln immer der Hinweis auf Ärztin oder Physio.
- UI-Texte auf Deutsch, aber immer über i18n (keine hartcodierten Strings in Komponenten).
  Code, Tabellen und Spalten auf Englisch. Mobile first, Check-ins unter 30 Sekunden.

## Befehle (nach dem Setup)

- `npm run dev` – Entwicklungsserver
- `npm test` – Unit-Tests (Vitest)
- `npm run typecheck` / `npm run lint` / `npm run build`
- `npx supabase start` – lokale Supabase (Docker), wendet die Migrationen an
- `npx supabase db reset` – lokale DB neu aufsetzen
