/**
 * Wortmarke „FormPeak.“ – kursiv, kondensiert, Punkt in Signal-Orange.
 * Der Punkt gehört zum Namen; Name ohne Punkt nicht als Logo verwenden.
 */
export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span
      className={`font-display font-bold italic tracking-tight ${className}`}
      aria-label="FormPeak."
    >
      FormPeak<span className="text-primary">.</span>
    </span>
  );
}
