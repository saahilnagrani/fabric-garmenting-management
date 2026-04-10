import type { Metadata } from "next";
import {
  Inter,
  Roboto,
  Open_Sans,
  Lato,
  Poppins,
  Source_Sans_3,
  Work_Sans,
  Manrope,
  Nunito,
  DM_Sans,
  IBM_Plex_Sans,
  Montserrat,
  Roboto_Mono,
} from "next/font/google";
import "./globals.css";
import { AppearanceProvider } from "@/components/theme/appearance-provider";

// Load every user-selectable font up front so the picker can swap instantly.
// Only the default (Inter) preloads; the rest are fetched on first use. This
// keeps the initial payload lean while still making every option a one-click
// swap with no visible re-request delay after it's been used once.

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
  preload: false,
});

const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const lato = Lato({
  variable: "--font-lato",
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  display: "swap",
  preload: false,
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
  preload: false,
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
  display: "swap",
});

const fontVariables = [
  inter.variable,
  roboto.variable,
  openSans.variable,
  lato.variable,
  poppins.variable,
  sourceSans.variable,
  workSans.variable,
  manrope.variable,
  nunito.variable,
  dmSans.variable,
  ibmPlexSans.variable,
  montserrat.variable,
  robotoMono.variable,
].join(" ");

export const metadata: Metadata = {
  title: "Hyperballik",
  description: "Inventory, garmenting management, and supplier sourcing platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Font CSS variables are applied to <html> rather than <body> so the
  // AppearanceProvider can set `--font-sans: var(--font-xyz)` on the root
  // and have var() resolution find the per-font variable at the same scope.
  // Setting them on <body> would break resolution because <html> would try to
  // evaluate var(--font-xyz) against a scope that doesn't define it.
  return (
    <html lang="en" suppressHydrationWarning className={`${fontVariables} antialiased`}>
      <body>
        <AppearanceProvider>{children}</AppearanceProvider>
      </body>
    </html>
  );
}
