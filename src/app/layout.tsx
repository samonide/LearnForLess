import type { Metadata } from "next";
import { Geist, Geist_Mono, Literata } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const fontSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

const fontMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fontSerif = Literata({
  variable: "--font-serif",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "LearnForLess – Online Course Platform",
    template: "%s | LearnForLess",
  },
  description:
    "Access your courses with a secure token. LearnForLess is a professional online learning platform.",
  robots: { index: false, follow: false }, // Private platform
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${fontSans.variable} ${fontMono.variable} ${fontSerif.variable} antialiased`}
      >
        <TooltipProvider>
          {children}
          <Toaster
            position="top-right"
            richColors
            closeButton
            duration={4000}
          />
        </TooltipProvider>
      </body>
    </html>
  );
}
