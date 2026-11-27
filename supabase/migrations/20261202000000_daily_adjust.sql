-- FormPeak – Tägliche Anpassung (SPEC 7.2 Schritt 5): Vorschläge nach dem Morgen-Check-in
-- an Ampel und Schmerz anpassen. Markiert, warum eine Einheit heute geändert wurde.

alter table public.sessions
  add column adjustment text check (adjustment in ('light_red', 'light_yellow', 'pain', 'rules')),
  add column adjusted_on date;
