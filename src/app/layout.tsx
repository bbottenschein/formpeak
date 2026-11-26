import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { I18nProvider } from "@/lib/i18n/client";
import { DEFAULT_LOCALE, messagesFor } from "@/lib/i18n/translate";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "FormPeak", template: "%s · FormPeak" },
  description: "Belastungssteuerung für Amateurfußballer – in Form zum Spieltag.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1512" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Sprache pro Nutzer folgt mit der englischen Übersetzung; bis dahin Deutsch.
  return (
    <html lang={DEFAULT_LOCALE} className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider messages={messagesFor(DEFAULT_LOCALE)}>{children}</I18nProvider>
      </body>
    </html>
  );
}
