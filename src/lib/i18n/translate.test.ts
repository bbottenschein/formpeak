import { describe, expect, it } from "vitest";
import { createTranslator, messagesFor } from "./translate";

describe("createTranslator", () => {
  const t = createTranslator(messagesFor("de"));

  it("liefert den Text zu einem Schlüssel", () => {
    expect(t("app.name")).toBe("FormPeak");
  });

  it("ersetzt Platzhalter und lässt unbekannte stehen", () => {
    expect(t("today.greeting", { name: "Bene" })).toBe("Hallo Bene");
    expect(t("today.greeting")).toBe("Hallo {name}");
  });

  it("unbekannter Schlüssel → Schlüssel selbst", () => {
    // @ts-expect-error absichtlich ungültiger Schlüssel
    expect(t("gibt.es.nicht")).toBe("gibt.es.nicht");
  });

  it("unbekannte Sprache → Deutsch", () => {
    expect(createTranslator(messagesFor("fr"))("auth.loginTitle")).toBe("Anmelden");
    expect(createTranslator(messagesFor(null))("auth.loginTitle")).toBe("Anmelden");
  });
});
