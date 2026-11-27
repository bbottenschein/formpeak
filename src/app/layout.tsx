import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { ServiceWorkerRegistration } from "@/features/shell/service-worker-registration";
import { I18nProvider } from "@/lib/i18n/client";
import { DEFAULT_LOCALE, messagesFor } from "@/lib/i18n/translate";
import "./globals.css";

// Barlow für Text und Logo (ExtraBold kursiv), Barlow Condensed für Überschriften (sportlich, kompakt).
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  style: ["normal", "italic"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: { default: "FormPeak.", template: "%s · FormPeak." },
  description: "Belastungssteuerung für Amateurfußballer – in Form zum Spieltag.",
  appleWebApp: { capable: true, title: "FormPeak.", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/favicon-64.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#121110",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Sprache pro Nutzer folgt mit der englischen Übersetzung; bis dahin Deutsch.
  return (
    <html lang={DEFAULT_LOCALE} className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <I18nProvider messages={messagesFor(DEFAULT_LOCALE)}>{children}</I18nProvider>
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
