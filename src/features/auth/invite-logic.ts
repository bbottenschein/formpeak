/** Reine Logik rund um Einladungen (ohne Datenbank), getestet in invite-logic.test.ts. */

export const CONSENT_VERSION = "2026-11-26";
export const MIN_PASSWORD_LENGTH = 8;

export interface InvitationRow {
  code: string;
  email: string | null;
  expires_at: string;
  redeemed_at: string | null;
}

export type InvitationStatus = "open" | "redeemed" | "expired";

export function invitationStatus(inv: InvitationRow, now: Date = new Date()): InvitationStatus {
  if (inv.redeemed_at) return "redeemed";
  if (Date.parse(inv.expires_at) <= now.getTime()) return "expired";
  return "open";
}

export type InviteFormError = "missing" | "password" | "emailMismatch";

export interface InviteForm {
  name: string;
  email: string;
  password: string;
  consent: boolean;
}

/** Prüft die Eingaben beim Einlösen einer Einladung. */
export function validateInviteForm(form: InviteForm, inv: InvitationRow): InviteFormError | null {
  if (!form.name.trim() || !form.email.trim() || !form.password || !form.consent) return "missing";
  if (form.password.length < MIN_PASSWORD_LENGTH) return "password";
  if (inv.email && inv.email.trim().toLowerCase() !== form.email.trim().toLowerCase()) {
    return "emailMismatch";
  }
  return null;
}

/** Zufälliger, URL-tauglicher Einladungscode (128 Bit). */
export function generateInviteCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
