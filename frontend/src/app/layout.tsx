import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Space_Grotesk, Space_Mono } from "next/font/google";

import "./globals.css";
import { ToastProvider } from "@/components/core";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--primary-font",
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--secondary-font",
  display: "swap",
});

const metadata: Metadata = {
  title: "Meeting memory explorer—Redis released 2026",
  description: "AI-powered meeting memory exploration demo powered by Redis Agent Memory Server",
};

const RootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${spaceMono.variable}`}>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
};

export { metadata };
export default RootLayout;
