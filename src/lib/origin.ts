import "server-only";
import { headers } from "next/headers";

/** Ursprung der aktuellen Anfrage, z. B. https://formpeak.de (für Links in E-Mails). */
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
