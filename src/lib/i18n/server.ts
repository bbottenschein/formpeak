import "server-only";
import { createTranslator, messagesFor, type Locale, type Translate } from "./translate";

/** Übersetzer für Server Components und Server Actions. */
export function getT(locale?: Locale | string | null): Translate {
  return createTranslator(messagesFor(locale));
}
