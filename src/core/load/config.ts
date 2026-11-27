/**
 * Alle Schwellen der Belastungslogik an einer Stelle (SPEC.md Abschnitt 4).
 * Später pro Nutzer anpassbar; Funktionen bekommen die Konfiguration als Parameter.
 */
export const LOAD_CONFIG = {
  acwr: {
    acuteDays: 7,
    chronicDays: 28,
    /** ACWR ≤ green → Grün möglich, ≤ yellow → Gelb, darüber Rot. */
    green: 1.3,
    yellow: 1.5,
    /** Unter diesem Wert: Hinweis auf Unterlast. */
    underload: 0.8,
    ewmaAcuteDays: 7,
    ewmaChronicDays: 28,
  },
  readiness: {
    green: 70,
    yellow: 50,
    weights: {
      sleepDuration: 15,
      sleepQuality: 15,
      energy: 25,
      soreness: 20,
      stress: 15,
      restingHr: 10,
    },
    sleepZeroHours: 5,
    sleepFullHours: 8,
    restingHr: {
      baselineSize: 7,
      minMeasurements: 3,
      /** Abweichung (Schläge/min) ab der Punkte abgezogen werden – Messauflösung 10 s × 6. */
      toleranceBpm: 8,
      /** Ab dieser Abweichung zählt der Faktor 0. */
      zeroAtBpm: 20,
    },
  },
  score: {
    /** Abzug vom Performance-Score bei erhöhter Belastung (1,3 < ACWR ≤ 1,5). */
    elevatedCorrection: 10,
    /** Abzug bei Belastungsspitze (ACWR > 1,5). */
    spikeCorrection: 20,
  },
  pain: {
    restrictIntensity: 4,
    restrictSeriesDays: 2,
    redIntensity: 6,
    /** Serie länger als so viele Tage → Rot. */
    redSeriesLongerThanDays: 5,
    lookbackDays: 60,
  },
  planning: {
    /** RPE ab dem eine Einheit als intensiv gilt. */
    intenseRpe: 7,
    /** Erlaubte Steigerung der Wochenlast gegenüber der Vorwoche. */
    maxWeeklyIncrease: 0.15,
    /** Unterkörperkraft frühestens MD+n … spätestens MD−n. */
    lowerBodyEarliestAfterMatch: 2,
    lowerBodyLatestBeforeMatch: 3,
    yellowReduction: 0.3,
  },
  /** Leitplanken für den Wochenplan (KI oder Regeln), SPEC 4.6 / 7.2. */
  guardrails: {
    /** Kurze Zusatzeinheit (Mobilität/Regeneration) an Tagen ohne Haupteinheit. */
    shortExtraMinutes: 15,
    /** MD−1: nur kurz aktivieren. */
    activationMaxMinutes: 20,
    activationMaxRpe: 4,
    /** MD+1 oder Ampel rot: nur Regeneration. */
    recoveryMaxMinutes: 30,
    recoveryMaxRpe: 3,
    /** RPE-Obergrenze für leichte Einheiten an Tagen ohne Haupteinheit. */
    extraMaxRpe: 4,
    /** Höchstens so viele Einheiten pro Tag (Fußball nicht mitgezählt). */
    maxUnitsPerDay: 2,
    /** Kürzer wird eine Haupteinheit beim Kürzen der Wochenlast nicht – sonst fällt sie weg. */
    minMainMinutes: 20,
  },
} as const;

export type LoadConfig = typeof LOAD_CONFIG;
