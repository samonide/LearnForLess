import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Literata } from "next/font/google";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getSiteSettings } from "@/lib/site-settings";
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

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  const siteName = settings.site_name;

  return {
    title: {
      default: `${siteName} – Online Course Platform`,
      template: `%s | ${siteName}`,
    },
    description: `Access your courses with a secure token. ${siteName} is a professional online learning platform.`,
    icons: {
      icon: "/icon.svg",
      shortcut: "/favicon.ico",
    },
    robots: { index: false, follow: false }, // Private platform
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
            closeButton
            duration={4000}
            toastOptions={{
              style: {
                background: "var(--card)",
                color: "var(--foreground)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-lg)",
                fontSize: "0.875rem",
                boxShadow: "var(--shadow-elevated)",
              },
            }}
            icons={{
              success: undefined,
              info: undefined,
              warning: undefined,
              error: undefined,
            }}
          />
        </TooltipProvider>
      </body>
    </html>
  );
}
