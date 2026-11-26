import de from "../../../messages/de.json";

export type Messages = typeof de;
export type Locale = "de" | "en";

export const DEFAULT_LOCALE: Locale = "de";

/** Englisch folgt später; bis dahin fällt alles auf Deutsch zurück. */
const catalogs: Record<Locale, Messages> = { de, en: de };

export function messagesFor(locale: string | null | undefined): Messages {
  return catalogs[(locale as Locale) in catalogs ? (locale as Locale) : DEFAULT_LOCALE];
}

/** Alle Schlüsselpfade der Nachrichten, z. B. "auth.loginTitle". */
type Leaves<T, P extends string = ""> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

export type MessageKey = Leaves<Messages>;
export type TranslateParams = Record<string, string | number>;
export type Translate = (key: MessageKey, params?: TranslateParams) => string;

/** Übersetzer für einen Nachrichtenkatalog. Platzhalter: {name}. */
export function createTranslator(messages: Messages): Translate {
  return (key, params) => {
    let node: unknown = messages;
    for (const part of key.split(".")) {
      node = (node as Record<string, unknown> | undefined)?.[part];
    }
    if (typeof node !== "string") return key;
    if (!params) return node;
    return node.replace(/\{(\w+)\}/g, (match, name: string) =>
      name in params ? String(params[name]) : match,
    );
  };
}
