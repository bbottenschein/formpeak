# FormPeak – Spezifikation

Stand: 26.11.2026 · Arbeitstitel **FormPeak** (Markenprüfung offen, siehe „Offene Punkte“).

FormPeak macht aus zwei kurzen Check-ins pro Tag und dem Feedback nach jeder Einheit einen
Wochenplan. Gym, Mobilität, Regeneration und Ruhe werden so um das feste Teamtraining gelegt,
dass der Nutzer an seinem Ziel arbeitet, ohne sich zu überlasten – und am Spieltag in Form ist.

**Zielnutzer:** zuerst Benedikt (Dogfooding), danach ambitionierte Amateur- und Vereinsfußballer,
die neben dem Teamtraining selbstständig trainieren.

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

### 4.3 Readiness-Score (0–100)

Gewichteter Mittelwert aus dem Morgen-Check-in. Jeder Faktor wird auf 0–100 normiert:

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

Ergebnis auf ganze Zahlen runden. Ohne Morgen-Check-in gibt es keinen Readiness-Score.

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
| `goals`, `goal_tests` | Phase 2 |
| `ai_plans` | Phase 2: Kontext-JSON, Antwort-JSON, Prompt-Version, Modell, Validierungsergebnis |

`daily_metrics` wird nach jedem Check-in und jedem Feedback für die betroffenen Tage neu berechnet
(Berechnung in TypeScript mit `src/core/load`, nicht in SQL).

---

## 6. Screens

Navigation mit drei Tabs: **Übersicht** (Hauptseite) · **Plan** · **Profil**. Check-ins sind kein
eigener Tab, sondern werden aus der Übersicht gestartet (und per Push-Erinnerung verlinkt).

- **Übersicht** (Hauptseite): Readiness-Ring mit Ampel, Empfehlung und ACWR; Check-in starten bzw.
  bearbeiten; „Deine Woche“ als Leiste Mo–So mit MD-Labels und festen Terminen (TR/SP) plus
  Zähler für Zusatzeinheiten; heutige Einheiten mit Hinweisen; aktive Schmerzstellen;
  Readiness-Verlauf (Linie, 14 Tage, Schwellen 50/70) und Tageslast (Balken, 14 Tage);
  Abend-Check-in.
- **Plan:** Woche Mo–So mit allen Einheiten, Hinweisen und Wochenhinweisen, Einheiten planen,
  Einzeltermine; Detailseite je Einheit mit Feedback, Gym-Log, Absagen/Verschieben.
- **Profil:** Fixe Termine (Serien), Benachrichtigungen und Erinnerungszeiten, Name, Zeitzone,
  Admin (Einladungen), Abmelden.
- **Check-ins:** Morgen (`/checkin`) und Abend (`/checkin/evening`) als eigene Seiten.
- **Ziele** (Phase 2): aktives Ziel, nächster Testtermin, Fortschrittskurve.

Täglicher Ablauf (ca. 2 Minuten Eingabe): Morgen-Check-in → Readiness & Ampel → Tagesplan
anpassen → Einheit trainieren → Feedback → Abend-Check-in → Last neu berechnen.

---

## 7. Phase 2: KI-Coach (zur Orientierung, noch nicht bauen)

### 7.1 Ziele

Typ (Kondition, Schnelligkeit, Kraft, Prävention, Comeback), Test mit Ausgangs- und Zielwert
(z. B. Yo-Yo-Test, 3-km-Lauf, 30-m-Sprint), Zieldatum, Priorität 1–3. Mehrere Ziele möglich.

### 7.2 Wochenplanung (Sonntagabend oder nach dem Spiel)

1. Code berechnet Kennzahlen, Ampel und Sperren (MD-Regeln, Schmerz-Sperren).
2. KI erhält JSON-Kontext: Fußballtermine der nächsten 7 Tage, Kennzahlen, Feedback der letzten
   14 Tage, Ziele, Zeitbudget, Trainingsmittel, Sperren. **Ohne Namen.**
3. KI antwortet in festem JSON-Schema: pro Tag Einheitstyp, Dauer, Ziel-RPE, Übungen mit
   Zielgewicht und Wiederholungen (aus dem Gym-Log), ein Satz Begründung.
4. Code prüft gegen die Leitplanken (Wochenlast, MD-Regeln, Sperren); bei Verstoß Neuanfrage mit Fehlermeldung.
5. Jeden Morgen passt die KI nur den heutigen Tag an Ampel und Check-in an.

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
