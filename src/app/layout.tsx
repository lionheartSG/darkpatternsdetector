import type { Metadata } from "next";
import { IBM_Plex_Sans } from "next/font/google";
import { Footer } from "@/components/landing/Footer";
import { Header } from "@/components/landing/Header";
import "./globals.css";

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DarkLens — Spot pressure tactics before you decide",
  description:
    "DarkLens scans public webpages for potential urgency, scarcity, pricing, and checkout design cues, then explains the evidence in plain English.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} h-full antialiased`}>
      <body className="flex min-h-dvh flex-col bg-background text-foreground">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
