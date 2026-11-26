-- FormPeak – Ziel-Assistent: gewählter Selbsttest und KI-Zusammenfassung des Ziels.

alter table public.goals
  add column test_key text check (
    test_key in ('yoyo_ir1', 'cooper12', 'sprint30', 'cmj', 'single_leg_hop', 'y_balance')
  ),
  -- Von der KI aus dem Freitext formulierte Zielbeschreibung (Grundlage für die Planung).
  add column ai_summary text check (char_length(ai_summary) <= 1000);
