import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const IBMsans = IBM_Plex_Sans({
  variable: "--font-ibm-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const IBMmono = IBM_Plex_Mono({
  variable: "--font-ibm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "TelVision",
  description: "Telugu NLP",
  keywords: ["Telugu", "NLP", "Tokenizer", "Language Model", "AI", "Spell Checker", "Telugu OCR", "Telugu Text Analysis"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${IBMsans.variable} ${IBMmono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
