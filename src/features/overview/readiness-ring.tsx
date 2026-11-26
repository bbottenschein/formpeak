import type { TrafficLight } from "@/core/load";

const STROKE: Record<TrafficLight, string> = {
  green: "stroke-light-green",
  yellow: "stroke-light-yellow",
  red: "stroke-light-red",
  grey: "stroke-light-grey",
};

/**
 * Readiness als Ring (0–100). Die Farbe zeigt den Status (Ampel); die Zahl in der Mitte
 * trägt die Information, damit sie nie nur über Farbe läuft.
 */
export function ReadinessRing({
  value,
  light,
  label,
  emptyLabel,
}: {
  value: number | null;
  light: TrafficLight;
  label: string;
  emptyLabel: string;
}) {
  const size = 152;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const filled = value == null ? 0 : (Math.max(0, Math.min(100, value)) / 100) * c;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={value == null ? emptyLabel : `${label} ${value}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-line" />
        {value != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${c}`}
            className={STROKE[light]}
          />
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {value != null ? (
          <>
            <span className="font-display text-5xl font-bold leading-none tabular-nums">{value}</span>
            <span className="eyebrow mt-1 text-xs">{label}</span>
          </>
        ) : (
          <span className="max-w-[6.5rem] text-sm text-muted">{emptyLabel}</span>
        )}
      </div>
    </div>
  );
}
