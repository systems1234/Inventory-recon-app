import type { Metadata } from "next";
import { Hanken_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const hankenGrotesk = Hanken_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hanken"
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains"
});

export const metadata: Metadata = {
  title: "Reconciliation Register",
  description: "Inventory reconciliation for the gemstone team"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${hankenGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="bg-paper text-ink font-sans min-h-screen">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
