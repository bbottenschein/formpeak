import { describe, expect, it } from "vitest";
import { generateInviteCode, invitationStatus, validateInviteForm, type InvitationRow } from "./invite-logic";

const NOW = new Date("2026-11-26T12:00:00Z");
const inv = (extra: Partial<InvitationRow> = {}): InvitationRow => ({
  code: "abc",
  email: null,
  expires_at: "2026-12-10T12:00:00Z",
  redeemed_at: null,
  ...extra,
});

describe("invitationStatus", () => {
  it("offen, eingelöst, abgelaufen", () => {
    expect(invitationStatus(inv(), NOW)).toBe("open");
    expect(invitationStatus(inv({ redeemed_at: "2026-11-20T00:00:00Z" }), NOW)).toBe("redeemed");
    expect(invitationStatus(inv({ expires_at: "2026-11-26T12:00:00Z" }), NOW)).toBe("expired");
  });

  it("eingelöst hat Vorrang vor abgelaufen", () => {
    expect(
      invitationStatus(inv({ expires_at: "2026-11-01T00:00:00Z", redeemed_at: "2026-10-30T00:00:00Z" }), NOW),
    ).toBe("redeemed");
  });
});

describe("validateInviteForm", () => {
  const form = { name: "Bene", email: "b@x.de", password: "12345678", consent: true };

  it("gültige Eingaben", () => {
    expect(validateInviteForm(form, inv())).toBeNull();
  });

  it("Einwilligung und alle Felder sind Pflicht", () => {
    expect(validateInviteForm({ ...form, consent: false }, inv())).toBe("missing");
    expect(validateInviteForm({ ...form, name: "  " }, inv())).toBe("missing");
    expect(validateInviteForm({ ...form, email: "" }, inv())).toBe("missing");
  });

  it("Passwort mindestens 8 Zeichen", () => {
    expect(validateInviteForm({ ...form, password: "1234567" }, inv())).toBe("password");
  });

  it("an E-Mail gebundene Einladung, Groß-/Kleinschreibung egal", () => {
    expect(validateInviteForm({ ...form, email: "B@X.de" }, inv({ email: "b@x.de" }))).toBeNull();
    expect(validateInviteForm(form, inv({ email: "other@x.de" }))).toBe("emailMismatch");
  });
});

describe("generateInviteCode", () => {
  it("22 URL-taugliche Zeichen, jedes Mal anders", () => {
    const a = generateInviteCode();
    expect(a).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(generateInviteCode()).not.toBe(a);
  });
});
