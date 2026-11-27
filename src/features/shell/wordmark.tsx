/** Berggipfel des Logos (spitz zulaufendes Band mit zwei Gipfeln). */
export const PEAK_POINTS = "0,160 198,0 290,88 330,60 435,155 328,95 288,128 196,55";

export function PeakMark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 435 160" preserveAspectRatio="none" className={className} aria-hidden>
      <polygon fill="currentColor" points={PEAK_POINTS} />
    </svg>
  );
}

/**
 * Logo „FormPeak.“: „Form“ in gebrochenem Weiß, „Peak.“ in Limette mit Berggipfel darüber
 * (Barlow ExtraBold kursiv). Größe über die Schriftgröße (`className`, z. B. text-2xl).
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-block font-sans font-extrabold italic leading-none tracking-[-0.02em] ${className}`}
      aria-label="FormPeak."
      role="img"
    >
      Form
      <span className="relative inline-block text-primary">
        Peak
        <PeakMark className="absolute bottom-[0.6em] left-[-0.2em] h-[0.72em] w-[1.95em] overflow-visible" />
      </span>
      <span className="text-primary">.</span>
    </span>
  );
}
