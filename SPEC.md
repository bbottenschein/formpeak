# FormPeak – Spezifikation

Stand: 27.11.2026 · **FormPeak.** · Produktkonzept und Value Proposition: `docs/KONZEPT.md`,
Änderungshistorie: `docs/AENDERUNGEN.md`.

FormPeak macht aus zwei kurzen Check-ins pro Tag und dem Feedback nach jeder Einheit einen
Wochenplan. Gym, Mobilität, Regeneration und Ruhe werden so um das feste Teamtraining gelegt,
dass der Nutzer an seinem Ziel arbeitet, ohne sich zu überlasten – und am Spieltag in Form ist.

**Zielnutzer:** zuerst Benedikt (Dogfooding), danach Spieler zwischen Breiten- und Leistungssport
(Landesliga, Bayernliga, Regionalliga), die viel investieren, aber kein Profi-Umfeld haben.

**Versprechen:** Jeden Morgen wissen, was heute dran ist – und alle paar Wochen schwarz auf weiß
sehen, dass es wirkt.

**Kernnutzen**

- Jeden Morgen eine klare Ansage: was heute sinnvoll ist und warum.
- Ein Ziel wie „Kondition verbessern“ wird in konkrete Einheiten übersetzt, die zur Fußballwoche passen.
- Frühwarnung bei Überlastung und wiederkehrenden Schmerzstellen.

**Grundprinzip:** Regeln im Code entscheiden, **ob** belastet werden darf. Die KI (ab Phase 2)
entscheidet, **was** konkret trainiert wird, und erklärt es. Die Ampel kann von der KI nie
überstimmt werden.

---

## 1. Roadmap

| Phase | Inhalt | Gate danach |
| --- | --- | --- |
| **1 – MVP** | Login (Einladung), Morgen- und Abend-Check-in, Fußballkalender + Feedback, Körperkarte, Gym-Log, Last/ACWR/Readiness, Tagesampel nach Regeln, manuelles Planen mit Ampel-Hinweisen, PWA, Push | **Gate 1:** 2 Wochen täglich selbst genutzt |
| **2 – KI-Coach** | Ziele mit Testwerten, KI-Wochenplan + Leitplanken, tägliche KI-Anpassung, Tipps-Feed, Verlauf & Diagramme | **Gate 2:** KI-Plan 4 Wochen befolgt und sinnvoll |
| **3 – Ausbau** | Health-Daten automatisch (Apple Health / Health Connect, Expo), Readiness-Gewichte am Nutzer lernen, Monatsrückblick der KI, Trainer-Modus fürs Team | – |

**Build-Reihenfolge Phase 1**

1. Supabase-Projekt (EU), Login per Einladung, Tabellen + RLS.
2. Belastungsmodul (`src/core/load`) mit vollständigen Unit-Tests: Last, ACWR, Readiness, Ampel, Schmerzregeln, MD-Logik.
3. Screens: Check-ins, Feedback inkl. Körperkarte, Gym-Log.
4. Fußballkalender mit Serien, Einzeländerungen und Saisonphasen.
5. Heute-Screen mit Ampel, Begründung und Hinweisen.
6. PWA installierbar, Push-Erinnerungen morgens und abends.

---

## 2. Nutzer, Sprache, Zeit

- **Mehrnutzer ab Tag 1:** Jede Tabelle mit Nutzerdaten hat `user_id`, RLS nur für den Besitzer.
  Registrierung nur per **Einladungslink** (Admin erzeugt Einladungen). Später einfach zu öffnen.
- **Login:** E-Mail + Passwort, zusätzlich Magic Link.
- **Rollen:** `profiles.role` (`user` | `admin`), nur über `app_metadata` gesetzt, nie aus dem Client.
- **Sprache:** UI auf Deutsch, alle Texte von Anfang an über i18n (Englisch später ergänzbar).
  Code, Tabellen und Spalten auf Englisch.
- **Einheiten:** kg (0,5er-Schritte), Minuten, Stunden.
- **Zeitzone pro Nutzer** (`profiles.timezone`, Standard `Europe/Berlin`). Alle Tagesgrenzen
  (Check-in-Tag, 7-/28-Tage-Fenster, MD-Logik) gelten in der Zeitzone des Nutzers.
  Immer die Datumshelfer verwenden, nie `toISOString().slice(0, 10)`.
- **Teams:** Tabellen `teams` / `team_members` werden angelegt, aber in Phase 1–2 nicht genutzt
  (Vorbereitung Trainer-Modus).

---

## 3. Module (Phase 1)

### 3.1 Morgen-Check-in (Ziel: unter 30 Sekunden)

| Feld | Eingabe |
| --- | --- |
| Schlafdauer | Stunden, Schieberegler (0,5er-Schritte) |
| Schlafqualität, Energie, Muskelkater, Stress | je 1–5 |
| Ruhepuls | optional, über **10-Sekunden-Timer**: Nutzer zählt seinen Puls 10 s lang, gibt die Zahl ein, App speichert `count × 6` |
| Schmerzstellen | Körperkarte, je Stelle Stärke 0–10, Art, „geschwollen“ |

Vorbelegung mit den Werten vom Vortag, damit ein unveränderter Tag nur Bestätigen braucht.

### 3.2 Abend-Check-in

| Feld | Eingabe |
| --- | --- |
| Belastung Alltag (Uni, Job, Wege) | 1–5 |
| Stress, Energie am Abend | je 1–5 |
| Schritte, Notiz | optional |

Fließt in **keine** Formel ein, nur in Insights und (ab Phase 2) in den KI-Kontext.

### 3.3 Fußballkalender

- **Serien:** z. B. „Teamtraining Di + Do 19:00, 90 min“, „Spiel Sa 15:00“. Pro Serie:
  Typ (`training` | `match`), Wochentage, Uhrzeit, erwartete Dauer, **erwartete Intensität**
  (`low` | `medium` | `high`) und **Standard-RPE**.
- **Einzeländerungen:** Jeder Termin einer Serie ist verschiebbar oder absagbar, zusätzliche
  Einzeltermine (Pokal, Nachholspiel, Turnier) sind möglich. Englische Wochen = mehrere Spiele.
- **Saisonphasen:** Zeiträume mit Typ `preseason` | `season` | `break`. Serien können an eine
  Phase gebunden sein (z. B. in der Winterpause keine Trainings).
- Fußballtermine sind **fix**; alles andere wird darum herum geplant.
- Erwartete Intensität und Standard-RPE werden nach ein paar Wochen aus dem Feedback-Schnitt
  der Serie korrigiert (Vorschlag an den Nutzer, nicht stillschweigend).

### 3.4 Feedback nach jeder Einheit

Gilt für Fußball und alle selbst geplanten Einheiten.

| Feld | Eingabe |
| --- | --- |
| Status | geplant, absolviert, ausgefallen |
| Dauer | Minuten (vorbelegt mit geplanter Dauer) |
| Intensität (RPE) | 0–10 (Borg CR10) |
| Müdigkeit danach | 1–5 |
| Spielminuten | nur bei Spiel |
| Schmerzstellen | Körperkarte wie im Morgen-Check-in |

### 3.5 Gym-Log

Jede Gym-Einheit besteht aus Übungen, jede Übung aus Sätzen. Gewicht und Wiederholungen sind
pro Satz **immer** eintragbar, auch bei geplanten Einheiten.

| Objekt | Feld | Eingabe |
| --- | --- | --- |
| Übung (Bibliothek) | Name, Muskelgruppe, Equipment | Auswahl oder eigene Übung |
| Übung in Einheit | Reihenfolge, Notiz | automatisch, optional |
| Satz | Gewicht | kg in 0,5er-Schritten; Körpergewicht = 0 oder Zusatzgewicht |
| Satz | Wiederholungen | Zahl |
| Satz | RIR | 0–4, optional |
| Satz | Satztyp | Aufwärmsatz oder Arbeitssatz |

- **Schnelle Eingabe:** Gewicht und Wiederholungen sind mit den Werten der letzten Einheit dieser
  Übung vorbelegt; „+ Satz“ kopiert den vorherigen Satz.
- **Auswertung:** Verlauf pro Übung, Bestwerte, geschätztes 1RM nach Epley
  (`Gewicht × (1 + Wdh / 30)`, nur Arbeitssätze), Volumen pro Muskelgruppe und Woche.
- **Progression (regelbasiert, Phase 1 als Vorschlag):** +2,5 kg, wenn in der letzten Einheit alle
  Arbeitssätze mit RIR ≥ 2 geschafft wurden. Bei gelber Ampel: Hinweis, Gewicht oder Sätze zu reduzieren.
- **Startbibliothek:** ca. 40 Übungen, darunter fußballtypische (Nordic Curl, Copenhagen Plank,
  Bulgarian Split Squat, Single-Leg RDL, Hip Thrust, Calf Raise, Pallof Press …). Eigene Übungen
  sind pro Nutzer.

### 3.6 Einstellungen (vom Nutzer frei einzugeben)

- Verfügbare Tage für Zusatzeinheiten
- Zeitbudget pro Zusatzeinheit (Minuten)
- Verfügbare Trainingsmittel (Mehrfachauswahl, erweiterbar): Fitnessstudio, Kurzhanteln/Bänder
  zuhause, Laufen/Rad draußen, Platz/Sprintstrecke …
- Uhrzeiten für Morgen- und Abend-Erinnerung
- Zeitzone, Sprache

Ziel(e) folgen in Phase 2 (siehe 7.1).

---

## 4. Belastungslogik (`src/core/load`)

Fest im Code, pure Funktionen, vollständig getestet. Keine Abhängigkeit zu Next.js oder Supabase,
damit das Modul später auch in einer Expo-App läuft. Alle Schwellen stehen in einer Konfiguration
und sind später anpassbar.

### 4.1 Session-Last (sRPE nach Foster)

```
Last (AU) = RPE (0–10) × Dauer (min)
```

Beispiel: 90 min Training mit RPE 7 = 630 AU.

- **Fehlender RPE:** Wird eine absolvierte Einheit ohne RPE gespeichert, gilt der Standard-RPE
  der Serie bzw. des Einheitstyps. Die Last wird als `estimated` markiert und in der UI so angezeigt.
- **Ausgefallene** Einheiten zählen 0.
- **Tageslast** = Summe aller Einheiten des Tages.

### 4.2 ACWR (Akut-zu-chronisch-Verhältnis), „uncoupled“

Für Tag `d`:

```
akut     = Σ Tageslast(d−6 … d)                  // letzte 7 Tage
chronisch = Σ Tageslast(d−27 … d−7) / 3          // Wochenschnitt der 3 Wochen davor
ACWR     = akut / chronisch
```

- Die akute Woche ist **nicht** in der chronischen Last enthalten.
- **Kalibrierung:** Liegen weniger als 28 Tage seit dem ersten Datentag vor oder ist
  `chronisch = 0`, gilt ACWR als „nicht verfügbar“. Die Ampel nutzt dann nur Readiness und
  Schmerz, der Heute-Screen zeigt „Kalibrierung läuft (noch X Tage)“.
- **EWMA zum Vergleich:** Zusätzlich wird täglich ein EWMA-Verhältnis berechnet und in
  `daily_metrics` gespeichert, aber nicht für die Ampel genutzt
  (`λ_akut = 2 / (7 + 1)`, `λ_chronisch = 2 / (28 + 1)`).
- **Unterlast:** ACWR < 0,8 → nur Hinweis („Last länger niedrig – langsam steigern“), keine Ampeländerung.
- ACWR ist wissenschaftlich umstritten und wird in der UI als **Richtwert** kommuniziert.

### 4.3 Performance-Score (0–100)

Zwei Stufen: **Erholung** (Readiness, gewichteter Mittelwert aus dem Morgen-Check-in) und
**Performance-Score** = Erholung minus Belastungskorrektur (4.3a). Die Ampel (4.4) nutzt die
Erholung und den ACWR getrennt, damit die Belastung nicht doppelt zählt. Der Ring zeigt die Zahl
des Performance-Scores in der Ampelfarbe.

Erholung = gewichteter Mittelwert aus dem Morgen-Check-in. Jeder Faktor wird auf 0–100 normiert:

| Faktor | Gewicht | Normierung |
| --- | --- | --- |
| Schlafdauer | 15 % | `clamp((h − 5) / 3, 0, 1) × 100` → ≤ 5 h = 0, ≥ 8 h = 100 |
| Schlafqualität | 15 % | `(v − 1) / 4 × 100` |
| Energie | 25 % | `(v − 1) / 4 × 100` |
| Muskelkater | 20 % | `(5 − v) / 4 × 100` (umgekehrt: 5 = stark) |
| Stress | 15 % | `(5 − v) / 4 × 100` (umgekehrt) |
| Ruhepuls-Abweichung | 10 % | siehe unten |

**Ruhepuls:**

- Basis = Mittelwert der letzten 7 Messungen **vor** heute. Aktiv erst ab 3 Messungen.
- Abweichung `Δ = heute − Basis`.
- Wegen der Messauflösung (10 s × 6 = ±6 Schläge) zählt erst eine Abweichung ab +8:
  `Δ < 8 → 100`, linear fallend bis `Δ ≥ 20 → 0`. Ein niedrigerer Puls als die Basis ist kein Abzug.
- **Fehlt der Ruhepuls** (nicht gemessen oder noch keine Basis), werden die übrigen Gewichte
  anteilig hochskaliert (Summe wieder 100 %).

Ergebnis auf ganze Zahlen runden. Ohne Morgen-Check-in gibt es keinen Score.

#### 4.3a Belastungskorrektur und Aufschlüsselung

- ACWR ≤ 1,3 oder nicht verfügbar → 0; 1,3 < ACWR ≤ 1,5 → −10; ACWR > 1,5 → −20 Punkte
  (Score nie unter 0).
- Das Score-Modul liefert pro Baustein: Gewicht (nach Umverteilung), Teilwert, **Beitrag in Punkten**
  und **Abweichung vom Bestwert** in Punkten (`Gewicht × (100 − Teilwert)`), damit die App sagen
  kann: „Dein Schlaf zieht den Score heute um 5 Punkte runter.“
- Ein Satz zum Score je Ampel: grün „gut erholt“, gelb „etwas angeschlagen“, rot „Erholung zuerst“.
- Die Gewichte sind Startwerte der App (nicht aus den Studien abgeleitet) und sollen später an die
  eigenen Daten angepasst werden. Das steht so auch in der Aufschlüsselung.

### 4.3b Akutes Belastungs- und Stresslevel

- **Belastung:** Last der letzten 7 Tage im Vergleich zum Wochenschnitt der 3 Wochen davor,
  in Prozent (`akut / chronisch − 1`, = ACWR − 1). Ohne chronische Last kein Wert.
- **Stress:** Mittel aus Morgen-Stress und Abend-Stress der letzten 7 Tage im Vergleich zum Mittel
  der 3 Wochen davor, in Prozent. Mindestens 3 Werte in jedem Zeitraum, sonst kein Wert.
- Anzeige als zwei Kacheln unter dem Ring, z. B. „Belastung +20 % über deinem Schnitt“.

### 4.4 Tagesampel

| Ampel | Bedingung (erste zutreffende von oben) | Folge |
| --- | --- | --- |
| **Grau** | Kein Morgen-Check-in heute | Hinweis „Check-in machen“ |
| **Rot** | Readiness < 50 **oder** ACWR > 1,5 **oder** eine Schmerz-Rot-Regel greift (4.5) | Nur Mobilität, Regeneration oder Ruhe |
| **Gelb** | Readiness 50–69 **oder** 1,3 < ACWR ≤ 1,5 | Umfang oder Intensität um ca. 30 % senken, keine Maximaleinheiten |
| **Grün** | sonst (Readiness ≥ 70 und ACWR ≤ 1,3 oder nicht verfügbar) | Plan wie vorgesehen, intensive Einheiten erlaubt |

Grenzen exakt: ACWR 1,3 = Grün, 1,5 = Gelb, Readiness 70 = Grün, 50 = Gelb.

**Gegen die Empfehlung trainieren:** Der Nutzer darf bei Rot trotzdem eine intensive Einheit
eintragen und absolvieren. Die App rät klar ab („nie ‚trotzdem trainieren‘“ als Empfehlung),
die Einheit wird mit `against_recommendation = true` gespeichert und in den Insights ausgewertet.

### 4.5 Schmerzregeln

Schmerzeinträge kommen aus Morgen-Check-in und Einheiten-Feedback. Pro Tag und Stelle
(Region + Seite) zählt der höchste Wert.

**Serie:** Ein Tag mit Eintrag ≥ 1 an einer Stelle zählt zur Serie. Tage **ohne** Check-in
unterbrechen die Serie nicht. Erst ein Morgen-Check-in ohne Eintrag an dieser Stelle beendet sie.
Länge = Anzahl der Tage mit Eintrag.

| Bedingung | Folge |
| --- | --- |
| Stärke 1–3 | notieren, Einheit normal |
| Stärke ≥ 4 **oder** Serie ≥ 2 Tage | Sperre: betroffene Region in Zusatzeinheiten aussparen, Hinweis anzeigen |
| Stärke ≥ 6 **oder** (Art Gelenk/Sehne **und** geschwollen) **oder** Serie > 5 Tage | **Ampel Rot** + klarer Hinweis, eine Ärztin oder einen Physio aufzusuchen |

Die App gibt **keine Diagnose** und rät nie, trotz Schmerz zu trainieren.

**Körperkarte (20 Regionen, Seite links/rechts bzw. mittig):** Kopf/Nacken, Schulter, Brust,
Bauch/Rumpf, oberer Rücken, unterer Rücken, Ellbogen/Oberarm, Handgelenk/Hand, Hüfte, Leiste,
Adduktoren, Gesäß, Oberschenkel vorne, Oberschenkel hinten, Knie, Schienbein, Wade,
Achillessehne, Sprunggelenk, Fuß/Ferse. Darstellung vorne/hinten.

### 4.6 Spieltagslogik (MD = Matchday)

- Jeder Tag bekommt relativ zum **nächsten** Spiel `MD−n` und zum **letzten** Spiel `MD+n`.
  Bei mehreren Spielen pro Woche gelten die Regeln für jedes Spiel.
- **Regeln** (Phase 1 als Hinweise/Warnungen beim manuellen Planen, ab Phase 2 als Leitplanken für die KI):
  - MD+1: Regeneration oder lockere Mobilität, keine Intensität.
  - MD−1: nur kurz und aktivierend oder Ruhe.
  - Krafttraining Unterkörper frühestens MD+2, spätestens MD−3 (kein schweres Beintraining 48 h vor dem Spiel).
  - Harte Intervalle nicht am Tag direkt vor oder nach einem Teamtraining mit erwarteter Intensität `high`.
  - Wochenlast (geplant) steigt höchstens um ca. 15 % gegenüber der Vorwoche.
  - Mindestens ein kompletter Ruhetag pro Woche.

**Referenz-Testfall (Dogfooding-Woche):** Training Di + Do, Spiel Sa.
→ So = MD+1, Mo = MD+2, Di = Training (MD−4), Mi = MD−3, Do = Training (MD−2), Fr = MD−1.
Unterkörperkraft ist nur Mo oder Mi erlaubt; Mi liegt direkt vor dem Donnerstagstraining
(Warnung, wenn Do `high` ist und Mi harte Intervalle geplant sind).

### 4.7 Phase 1: Heute-Screen ohne KI

- Ampel, Readiness-Score, ACWR (oder „Kalibrierung läuft“), aktive Schmerz-Sperren.
- Heutige Einheiten: Fußballtermine + vom Nutzer selbst geplante Zusatzeinheiten.
- Zu jeder Zusatzeinheit ein **konkreter Hinweis** aus Ampel und Regeln, z. B.
  „Gelb: Umfang um ca. 30 % senken“, „Rot: heute nur Mobilität“, „MD−1: nur kurz aktivieren“,
  „Unterkörper 2 Tage vor dem Spiel – lieber verschieben“. Die App ändert den Plan nicht selbst.
- Ein Satz Begründung, warum die Ampel so steht.

---

## 5. Datenmodell (Supabase / Postgres)

Alle Nutzertabellen mit `user_id uuid references auth.users`, RLS: nur der Besitzer liest und
schreibt. Zeitstempel `created_at`/`updated_at`. Tagesbezug als `date` in der Nutzer-Zeitzone.

| Tabelle | Inhalt |
| --- | --- |
| `profiles` | Anzeigename, `role`, `timezone`, `locale`, Erinnerungszeiten, Einstellungen (verfügbare Tage, Zeitbudget, Trainingsmittel) |
| `invitations` | Einladungscode, erstellt von, eingelöst von/am, Ablauf |
| `consents` | Einwilligung Gesundheitsdaten (Art. 9 DSGVO): Version, Zeitpunkt, Widerruf |
| `teams`, `team_members` | Vorbereitung Trainer-Modus (Phase 3), vorerst ungenutzt |
| `season_phases` | Zeitraum, Typ (`preseason` / `season` / `break`) |
| `fixture_series` | Typ (`training` / `match`), Wochentage, Uhrzeit, Dauer, erwartete Intensität, Standard-RPE, gültig von/bis, Saisonphase |
| `sessions` | Einheiten (fix und geplant): Datum, Uhrzeit, Typ (`training`, `match`, `gym`, `run_intervals`, `mobility`, `recovery`), Status (`planned`, `done`, `cancelled`), `series_id` (bei Fußball), Dauer, RPE, `rpe_estimated`, Müdigkeit, Spielminuten, `planned_by` (`user` / `rules` / `ai`), Begründung, `against_recommendation`, Notiz |
| `checkins` | `kind` (`morning` / `evening`), Datum; Morgen: Schlafdauer, Schlafqualität, Energie, Muskelkater, Stress, Ruhepuls; Abend: Alltagsbelastung, Stress, Energie, Schritte, Notiz. Eindeutig pro Nutzer + Datum + kind |
| `pain_entries` | Datum, Quelle (`checkin_id` oder `session_id`), Region, Seite, Stärke 0–10, Art (`muscle` / `joint` / `tendon` / `unclear`), `swollen` |
| `exercises` | Bibliothek: global (`user_id null`) oder eigene; Name, Muskelgruppe, Equipment |
| `session_exercises` | Übung in Einheit: Reihenfolge, Notiz |
| `exercise_sets` | Gewicht (kg), Wiederholungen, RIR, Satztyp (`warmup` / `working`), Reihenfolge |
| `daily_metrics` | Pro Nutzer + Tag berechnet: Tageslast, akut, chronisch, ACWR, EWMA-Verhältnis, Readiness, Ampel, aktive Sperren, Begründung |
| `push_subscriptions` | Web-Push-Endpunkte pro Gerät |
| `goals` | Aktives Ziel: Typ, Freitext, KI-Zusammenfassung, Referenztest (`test_key`), Ausgangs-/Zielwert, Zieldatum |
| `goal_tests` | Referenztests mit Termin und Ergebnis: `scheduled_for`, `status` (`planned`/`done`/`skipped`), `value` |
| `body_measurements` | Körpergewicht und Taillenumfang (für Muskelaufbau und Gewichtsabnahme) |
| `team_members` | Rolle `player` / `coach` (Trainer); Vorbereitung Trainer-Modus |
| `sharing_settings` | Freigaben pro Spieler und Team: Ampel und Verfügbarkeit immer, Schmerzdetails und Notizen nur mit Zustimmung |
| `ai_plans` | Jede KI-Anfrage: Kontext-JSON, Antwort-JSON, Prompt-Version, Modell, Validierungsergebnis |
| `week_plans` | Wochenplan pro Nutzer und Montag: Status (`pending`/`ready`/`failed`), Quelle (`ai`/`rules`), Wochenfokus, `adjusted` |
| `planned_exercises` | Übungen einer vorgeschlagenen Einheit: Name, Vorgabe, ein Satz Ausführung, optional Bibliotheks-Übung. Vorgeschlagene Einheiten selbst sind `sessions` mit `planned_by` = `ai`/`rules` und `title` |

`daily_metrics` wird nach jedem Check-in und jedem Feedback für die betroffenen Tage neu berechnet
(Berechnung in TypeScript mit `src/core/load`, nicht in SQL).

---

## 6. Screens

**Leitprinzip:** Jeder Bereich beantwortet genau eine Frage. Navigation unten mit fünf Bereichen,
Profil als Symbol oben rechts.

| Bereich | Frage | Inhalt |
| --- | --- | --- |
| **Home** (`/`) | Wie geht es mir gerade? | Performance-Ring mit Satz, Tipp → Aufschlüsselung (`/score`); Kacheln Belastung und Stress vs. Normalwert; Wochenleiste Mo–So mit festen Terminen; aktive Schmerzstellen; Verlauf von Score und Belastung über 4 Wochen |
| **Heute** (`/today`) | Was mache ich heute? | Ohne Check-in zuerst „Check-in starten“. Termine mit Uhrzeit, der Plan für heute (Einheit mit „Training starten“), höchstens ein Tipp, offenes Feedback |
| **Ziel** (`/goals`) | Komme ich voran? | Zeitraum oben; **Ziel** (bis zu 3 Schwerpunkte, Enddatum und Beschreibung sofort änderbar) → **Trainingsvolumen** (Umschalter Season / Off-Season + Rahmen) → **Progress** (ein Referenztest pro Schwerpunkt) → **Archiv** früherer Ziele mit Ergebnis. Abschlusstest als feste Einheit in der letzten Woche (nicht an Fußballtagen, nicht direkt vor/nach Spielen); am Zieldatum automatisch bewertet (geschafft/teilweise/nicht geschafft/offen) und archiviert. Bisher: Ohne Ziel: Onboarding (Click-Through). Mit Ziel: ein Ziel (ändern: `?part=goal`), darunter der Trainingsrahmen des aktuellen Modus (Saison: `?part=frame`; Off-Season: eigener Rahmen mit Abschnitten, `/offseason`), Referenztest mit Countdown, Ergebnis eintragen, Vorher-nachher |
| **Kalender** (`/week`) | Wann ist was? | Wochenleiste: 7 Spalten mit Balken je Einheit (Höhe = Dauer, Fußball gefüllt, eigene umrandet, Tests gestrichelt), Antippen zeigt den Tag; unten Wochenlast vs. Vorwoche. Bisher: Woche mit festen Terminen und geplanten Einheiten, Hinweisen zur Belastung, Einheit planen, Einzeltermin, Serien verwalten, Referenztest-Termine |
| **+ Erfassen** (`/log`) | Schnell eintragen | Morgen-Check-in, Abend-Check-in, offenes Feedback, Gym-Einheit, Körpermaße |
| Profil (oben rechts, `/settings`) | – | Erinnerungen, Name, Zeitzone, Datenschutz, Admin, Abmelden, Quellen |

**Training** (`/sessions/[id]/train`): Klick-Through Start → Übung 1 → Übung 2 → … → Feedback.
Jede Übung mit Vorgabe und einem Satz Ausführung, Timer bei Zeitvorgaben, Satz-Felder (kg × Wdh) bei
Gym-Übungen, am Ende Anstrengung, Müdigkeit, Schmerz, Dauer – alles in einem Schritt gespeichert.

**Wenig Text:** Erklärungen stehen hinter einem Info-Symbol (Blatt von unten), nicht dauerhaft im Bild.

Weitere Seiten: `/score` (Aufschlüsselung), `/sources` (Quellen), `/history` (alle Verläufe),
`/checkin`, `/checkin/evening`, `/sessions/*`, `/calendar` (Serien).

---

## 7. Phase 2: KI-Coach (7.1 und 7.2 umgesetzt)

### 7.1 Ziele und Referenztests (umgesetzt, siehe Bereich Ziel)

Typen: Kondition, Schnelligkeit, Kraft, Muskelaufbau, Gewichtsabnahme, Prävention, Comeback.
Ein aktives Ziel. Erster Referenztest zum Start, Wiederholung automatisch nach 5 Wochen
(Termin im Kalender, Countdown im Bereich Ziel), Fortschritt als Vorher-nachher.

| Ziel | Referenztests |
| --- | --- |
| Kondition | Yo-Yo IR1 (Platz), 3-km-Lauf |
| Schnelligkeit | 10-m- und 20-m-Sprint |
| Kraft | 5-Wiederholungs-Maximum Kniebeuge (geschätztes 1RM nach Epley) |
| Muskelaufbau | 5RM Kniebeuge und Bankdrücken, Körpergewicht |
| Gewichtsabnahme | Körpergewicht (Wochenschnitt), Taillenumfang; Richtwert ≤ 0,5–1 % pro Woche |
| Prävention / Comeback | Einbeiniger Weitsprung (Seitenvergleich), Y-Balance-Test |

Die App plant Training, keine Ernährung und keine Therapie.

### 7.2 Wochenplanung (umgesetzt, `src/features/plan`, Leitplanken in `src/core/load/guardrails.ts`)

Ausgelöst automatisch beim Öffnen von Heute oder Kalender für eine Woche ohne Plan (also auch
Sonntagabend für die neue Woche) und per „Woche neu planen“. Ein neues Ziel verwirft die Pläne ab
dieser Woche. Ersetzt werden nur offene Vorschläge ab heute; Erledigtes und Selbstgeplantes bleibt.
Ohne API-Schlüssel oder bei Ausfall plant die App nach Regeln aus der Routinen-Bibliothek.

**Leitplanken pro Tag** (`dayAllowances`): Spieltag nichts · MD+1 oder Ampel rot nur Regeneration
(≤ 30 min, RPE ≤ 3) · MD−1 nur Aktivierung (≤ 20 min, RPE ≤ 4) · Teamtraining nur Mobilität
(≤ 15 min) · gewählte freie Tage Haupteinheit bis zum Zeitbudget · andere freie Tage nur leichte
Einheit (≤ 15 min, RPE ≤ 4) · Unterkörperkraft MD+2 bis MD−3 · nicht intensiv (RPE ≥ 7) am Tag vor
oder nach intensivem Training · Ampel gelb −30 % Umfang. **Für die Woche:** höchstens die gewählte
Zahl Haupteinheiten (Gym, Lauf oder RPE > 4), höchstens 2 Einheiten pro Tag, ein Ruhetag, Wochenlast
ohne leichte Einheiten höchstens +15 % gegenüber Vorwoche bzw. Vierwochenschnitt (kommende Termine
der Vorwoche zählen geplant). Verstöße → eine Rückfrage an die KI, danach korrigiert der Code
(`enforcePlan`: Einheit streichen, Dauer/RPE kappen, Wochenlast kürzen, unter 20 min streichen).

1. Code berechnet Kennzahlen, Ampel und Sperren (MD-Regeln, Schmerz-Sperren).
2. KI erhält JSON-Kontext: Fußballtermine der nächsten 7 Tage, Kennzahlen, Feedback der letzten
   14 Tage, Ziele, Zeitbudget, Trainingsmittel, Sperren. **Ohne Namen.**
3. KI antwortet in festem JSON-Schema: pro Tag Einheitstyp, Dauer, Ziel-RPE, Übungen mit
   Zielgewicht und Wiederholungen (aus dem Gym-Log), ein Satz Begründung. Jede Übung mit Vorgabe und
   genau einem Satz zur Ausführung; Gym-Übungen aus der Bibliothek landen direkt im Gym-Log.
4. Code prüft gegen die Leitplanken (Wochenlast, MD-Regeln, Sperren); bei Verstoß Neuanfrage mit Fehlermeldung.
5. **Tägliche Anpassung** (umgesetzt, `adjustToday` in `src/core/load/daily-adjust.ts`): Nach dem
   Morgen-Check-in prüft der Code die heutigen Vorschläge gegen den Rahmen von heute. Ampel rot →
   Haupteinheit wird Regeneration (25 min) oder fällt weg, wenn schon eine leichte Einheit bleibt;
   Ampel gelb → kürzer (−30 %), RPE gekappt, weniger Sätze; Schmerz mit Einschränkung → die KI stellt
   die Übungen so um, dass die Region ausgespart wird (im Hintergrund, protokolliert in `ai_plans`
   mit `kind = 'day'`). Markiert in `sessions.adjustment` / `adjusted_on`, sichtbar als „Heute angepasst“.

### 7.3 Off-Season (umgesetzt, `src/core/load/offseason.ts`, `src/features/offseason`)

Umschalter **Season / Off-Season** im Bereich Ziel (ein Ziel, zwei Rahmen). Off-Season = Pause ohne Teamtraining und Spiele
(Saisonphase `break`). Der Nutzer legt im Klick-Through selbst fest: Start der Vorbereitung (oder
offen), Erholungswochen (0–2), Einheiten pro Woche (1–6), Tage, Dauer, Trainingsmittel. Dieser Rahmen
ersetzt während der Pause den Saison-Rahmen. Feste Termine pausieren im Zeitraum; nach der Pause
(oder beim Beenden) entstehen sie wieder. Referenztests: zum Start des Aufbaus und in der letzten
Woche vor der Vorbereitung.

**Abschnitte:** Erholen (RPE ≤ 4, keine Pflichtinhalte) → Aufbauen (Entlastungswoche jede 4.
Aufbauwoche: Wochenlast ≤ 70 % der Vergleichswoche) → Zurück zum Fußball (letzte 3/2/1 Wochen bei
≥ 6/4/2 Wochen nach der Erholung; Last nähert sich einer typischen Fußballwoche). **Regeln:** keine
Spieltag-Regeln, 2 Ruhetage (bei 6 Einheiten 1), ab dem Aufbau jede Woche Sprint und Prävention
(`focus` der Einheiten), sonst Wochenlast +15 %. Unterlast-Hinweis im Abschnitt Erholen aus.

**Wissenschaftliche Grundlage:** Die KI plant nach festen Grundsätzen im System-Prompt (Kraft,
Ausdauer, Sprint, Prävention, Reihenfolge, Progression) und begründet jede Einheit nur mit Schlüsseln
aus einer festen Liste geprüfter Quellen (`src/features/plan/basis.ts`, Texte unter `basis.*`) –
sie kann keine Studien erfinden. Sichtbar im Info-Symbol der Einheit.

### 7.4 Alltag mit dem Plan (umgesetzt)

- **Morgen-Push mit Plan:** „Heute: Kraft Unterkörper · 50 min“ statt allgemeiner Erinnerung; ohne
  Einheit „Heute ist frei“. Nach dem Check-in zeigt Home einen Hinweis, wenn der Plan angepasst wurde.
- **Heute keine Zeit:** Haupteinheiten wandern auf den nächsten Tag der Woche, an dem sie in alle
  Leitplanken passen (`findMoveDate`); sonst „Streichen“. Kurze, leichte Einheiten entfallen einfach.
- **Lieber etwas anderes:** Alternative im gleichen Tagesrahmen (KI, sonst Routinen-Bibliothek),
  Pflichtinhalte (Sprint, Prävention) bleiben; Inhalte stehen in `sessions.focus`.
- **Training:** Satz abhaken → Pause (≤ 6 Wdh 2:30, ≤ 12 Wdh 1:30, sonst 1:00); Gewicht vom letzten
  Mal, +2,5 kg wenn alle Ziel-Wiederholungen geschafft; neuer Bestwert (geschätztes 1RM) markiert.
- **Rückblick:** sonntags/montags die Woche, am 1.–3. der Vormonat als Karte auf Home (erledigt/
  geplant, Last vs. davor, Bestwerte, ein KI-Satz bzw. Regel-Hinweis; Tabelle `reviews`), Details
  unter `/review`. **Dranbleiben:** Check-in-Serie und Anteil erledigter Vorschläge (4 Wochen).
- **Quellen:** Alle Grundlagen der Trainingsplanung gegen die Originalstudien geprüft und auf der
  Quellenseite verlinkt.

### 7.5 Training im Gym und KI-Chat (umgesetzt)

- **Training:** Bildschirm bleibt an (Wake Lock), der Stand liegt auf dem Gerät (localStorage) und
  übersteht Bildschirm aus, App-Wechsel und Neuladen. Satzpause 3 min, −30 s / +30 s. In der Übersicht
  Reihenfolge ändern und Übungen tauschen (ähnliche Übungen derselben Muskelgruppe, Suche, eigene);
  die tatsächliche Reihenfolge wird beim Speichern übernommen. Felder lassen sich frei leeren.
- **Eingabe pro Übung** (`planned_exercises.measure`): Gewicht × Wdh, nur Wdh (Körpergewicht), Zeit
  (Timer pro Satz) oder nur abhaken (Sprints, Strecken). Die KI liefert die Art mit; sonst
  `inferMeasure` aus Vorgabe und Bibliothek.
- **KI-Chat** (Knopf unten rechts, nur mit API-Schlüssel): beantwortet Fragen und ändert das heutige
  Training über Werkzeuge (Übung ersetzen, Reihenfolge, kürzen, Einheit tauschen/verschieben). Jede
  Änderung prüft der Code (Unterkörper-Sperre, nur kürzen, Leitplanken); keine Namen im Kontext.

Prompt: System-Prompt mit Rolle (Athletiktrainer für Amateurfußball), Regeln, Verboten (keine
Diagnosen, Ampel nie überstimmen) und Schema; Nutzer-Nachricht nur JSON-Kontext. Kleines Modell
für die tägliche Anpassung, stärkeres für Wochenplan und Monatsrückblick. Alle Anfragen und
Antworten in `ai_plans` speichern. Tipps-Feed: 1–2 kurze datenbasierte Hinweise pro Tag.

---

## 8. Datenschutz & Grenzen

- Gesundheitsdaten (Art. 9 DSGVO): ausdrückliche Einwilligung bei der Registrierung, EU-Hosting,
  Export und Löschen per Knopf, KI-Anfragen ohne Namen.
- Keine Diagnosen oder Therapien, nur Trainingsempfehlungen. Vor einem öffentlichen Start
  rechtlich prüfen lassen (Medizinprodukt-Einstufung).
- Größtes Risiko: Eingaben schlafen ein. Gegenmittel: Check-in unter 30 s, Push zur festen
  Uhrzeit, Vorbelegung vom Vortag, Streak.

---

## 9. Offene Punkte

- **Name:** Domain `formpeak.de` ist registriert (checkdomain, 26.11.2026). `.com` und `.app` gehören
  Dritten (ungenutzt); `getformpeak.com` war frei. Markenprüfung in TMview (Klassen 9, 41, 44, auch
  „PeakForm“) steht aus – Vorrecherche ohne Treffer für FORMPEAK.
- **Repo** heißt noch `beyond90` → auf GitHub in `formpeak` umbenennen.
- **Last fixer Fußballtermine ohne Feedback:** Annahme: Ein vergangener Fußballtermin ohne
  Statusänderung gilt als absolviert mit Standard-RPE (`estimated`), bis der Nutzer ihn korrigiert.
  Selbst geplante Einheiten zählen erst, wenn sie als absolviert markiert sind. Mit Gate 1 überprüfen.
- Push-Technik (Web Push auf iOS nur als installierte PWA) beim Bau von Schritt 6 testen.

---

## 10. Quellen (geprüft am 27.11.2026)

| Baustein | Quelle |
| --- | --- |
| Fragebogen (Schlaf, Energie, Muskelkater, Stress) | Hooper & Mackinnon (1995), *Sports Med* 20:321–327, [doi:10.2165/00007256-199520050-00003](https://doi.org/10.2165/00007256-199520050-00003); Hooper et al. (1995), *Med Sci Sports Exerc* 27:106–112, [PubMed 7898325](https://pubmed.ncbi.nlm.nih.gov/7898325/); McLean et al. (2010), *IJSPP* 5:367–383, [PubMed 20861526](https://pubmed.ncbi.nlm.nih.gov/20861526/); Saw, Main & Gastin (2016), *BJSM* 50:281–291, [bjsm.bmj.com](https://bjsm.bmj.com/content/50/5/281.short) |
| Ruhepuls | Buchheit (2014), *Front Physiol* 5:73, [PubMed 24578692](https://pubmed.ncbi.nlm.nih.gov/24578692/) |
| Session-Last (sRPE) | Foster et al. (2001), *J Strength Cond Res* 15:109–115, [PubMed 11708692](https://pubmed.ncbi.nlm.nih.gov/11708692/) |
| ACWR | Gabbett (2016), *BJSM* 50:273–280, [PMC4789704](https://pmc.ncbi.nlm.nih.gov/articles/PMC4789704); kritisch: Impellizzeri et al. (2020), *IJSPP* 15:907–913, [doi:10.1123/ijspp.2019-0864](https://doi.org/10.1123/ijspp.2019-0864) |
| Yo-Yo IR1 | Krustrup et al. (2003), *MSSE* 35:697–705, [PubMed 12673156](https://pubmed.ncbi.nlm.nih.gov/12673156/) |
| Sprunghöhe per App | Meta-Analyse My Jump, [PMC10656545](https://pmc.ncbi.nlm.nih.gov/articles/PMC10656545) |
| 10/20-m-Sprint | Reliabilität bei Teamsportlern, [PMC11991301](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11991301/) |
| Seitenvergleich / Y-Balance | [PMC7863609](https://pmc.ncbi.nlm.nih.gov/articles/PMC7863609); [PubMed 37875255](https://pubmed.ncbi.nlm.nih.gov/37875255/) |
