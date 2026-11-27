# Änderungen am Konzept (26.–27.11.2026)

Änderungen seit dem ersten exportierten Konzept (Stand mit Gym-Log). Eingearbeitet in
`docs/KONZEPT.md`, `SPEC.md` und `CLAUDE.md`.

## 1. Zielgruppe und Value Proposition

- **Zielgruppe:** die Lücke zwischen Breiten- und Leistungssport. Spieler aus Landesliga,
  Bayernliga und Regionalliga, die viel Zeit investieren, aber kein Profi-Umfeld mit
  Athletiktrainer, Physio und Sportwissenschaft haben.
- **Value Proposition:** Jeden Morgen wissen, was heute dran ist – und alle paar Wochen schwarz
  auf weiß sehen, dass es wirkt.
- **Leitprinzip fürs Design:** kundenorientiert und nicht überfrachtet. Jeder Bereich beantwortet
  genau eine Frage des Nutzers.

## 2. Navigation: fünf Bereiche

| Bereich | Frage des Nutzers | Inhalt |
| --- | --- | --- |
| Home (Startseite) | Wie geht es mir gerade? | Performance-Ring, akutes Stress- und Belastungslevel, Verlauf, Wochenleiste |
| Heute | Was mache ich heute? | Termine des Tages mit Uhrzeit, passende Zusatzeinheit |
| Ziel | Komme ich voran? | Ziel-Übersicht, Referenztest, Fortschritt |
| Kalender | Wann ist was? | Feste Termine und geplante Einheiten |
| + (Erfassen) | Schnell eintragen | Check-ins, Feedback, Gym-Log |

Entscheidung: Profil (Einstellungen, Erinnerungen, Datenschutz, Abmelden) als Symbol oben rechts.

## 3. Home

- Performance-Score 0–100 als Ring in Ampelfarbe, mit einem Satz Erklärung („72 – gut erholt“).
- Akutes Stress- und Belastungslevel im Vergleich zum persönlichen Normalwert
  („Belastung 20 % über deinem Schnitt“). Entscheidung: zwei Kacheln –
  **Belastung** (Last 7 Tage vs. Wochenschnitt der 3 Wochen davor) und
  **Stress** (Mittel aus Morgen- und Abend-Stress 7 Tage vs. die 3 Wochen davor).
- Verlauf: Score und Belastung über 4 Wochen. Wochenleiste Mo–So. Schmerzstellen, falls aktiv.

## 4. Transparenz des Scores

Tipp auf den Ring öffnet die Aufschlüsselung: jeder Baustein mit Anteil, heutigem Beitrag in
Klartext und wissenschaftlicher Grundlage; eigene Quellenseite; Grenzen offen benennen.

| Baustein | Anteil | Grundlage |
| --- | --- | --- |
| Schlaf (Dauer + Qualität) | 30 % | Wellness-Fragebögen (Hooper & Mackinnon 1995; McLean et al. 2010; Saw et al. 2016) |
| Energie | 25 % | ebenda |
| Muskelkater | 20 % | ebenda |
| Stress | 15 % | ebenda |
| Ruhepuls-Abweichung | 10 % | Buchheit 2014 |
| Belastung 7 vs. 28 Tage | Korrektur | sRPE (Foster et al. 2001); ACWR (Gabbett 2016), kritisch (Impellizzeri et al. 2020) |

Entscheidungen:
- **Korrektur durch die Belastung:** ACWR 1,3–1,5 → −10 Punkte, über 1,5 → −20 Punkte, als eigene
  Zeile in der Aufschlüsselung.
- **Ehrlichkeit:** Die Studien begründen, *welche* Fragen gestellt werden. Die Gewichte sind
  Startwerte der App und werden später an die eigenen Daten angepasst – so steht es auch in der App.
- Alle Quellen wurden einzeln geprüft (siehe `SPEC.md` › Quellen).

## 5. Heute

- Konkreter Tagesplan mit Uhrzeit („18:30 Teamtraining“).
- Eine passende Ergänzung zum Ziel mit Start-Button und Übungen. Entscheidung: vorerst aus einer
  kuratierten Bibliothek, später von der KI.
- Ohne Check-in steht zuerst „Check-in starten“. Maximal ein Tipp pro Tag.

## 6. Ziel

- Onboarding als Click-Through: Ziel, Zieldatum, Trainingstage pro Woche, bevorzugte Tage,
  Zeit pro Einheit, Equipment.
- Ziel-Übersicht („Du willst bis X schneller werden, du hast 3 × 45 min pro Woche.“).
- Referenztest auf wissenschaftlicher Basis je Ziel, mit Anleitung.
- Erster Test zum Start, Wiederholung automatisch nach 5 Wochen im Kalender, mit Countdown.
- Fortschritt als Vorher-nachher-Vergleich der Testwerte.
- **Ergänzt (27.11.):** Ziele **Muskelaufbau** und **Gewichtsabnahme**. Die App plant nur
  Training, keine Ernährung. Gewichtsabnahme: Richtwert höchstens 0,5–1 % des Körpergewichts pro
  Woche. Comeback bleibt als Ziel erhalten.

## 7. Kalender

- Feste Fußballtermine als Serie, Ausfälle oder Zusatzspiele mit einem Tipp.
- Geplante Einheiten daneben, verschiebbar; die App prüft, ob das zur Belastung passt.

## 8. Ausblick: Trainer- und Spieler-Modus (nach dem MVP)

- Jeder Spieler hat ein eigenes Profil. Team-Overview für den Trainer, sortiert nach
  Handlungsbedarf. Empfehlungen vor dem Training. Teamtermine trägt der Trainer einmal ein.
- **Der Spieler entscheidet, was geteilt wird:** Ampel und Verfügbarkeit immer, Schmerzdetails und
  Notizen nur mit Zustimmung (ausdrückliche Einwilligung für Gesundheitsdaten).
- Möglicher Bezahlweg: Spieler-App günstig, Trainer- oder Vereinszugang kostenpflichtig.

## 9. Auswirkungen auf den Code

- Datenmodell: `teams`, `team_members` mit Rolle (Spieler, Trainer), Freigabe-Einstellungen pro
  Spieler. Trainer-Modus selbst wird noch nicht gebaut.
- Ziele: Onboarding-Antworten und Referenztests mit Termin und Ergebnis speichern.
- Score-Modul: pro Baustein Anteil und Beitrag zurückgeben.
- Navigation auf die fünf Bereiche, Startseite = Home.
