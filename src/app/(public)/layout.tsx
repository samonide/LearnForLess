import Logo from "@/components/logo";
import { getSiteSettings } from "@/lib/site-settings";

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const settings = await getSiteSettings();

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card px-6 py-4 flex items-center">
        <div className="flex items-center gap-2">
          <Logo className="w-7 h-7 text-primary" />
          <span className="font-semibold text-lg tracking-tight text-foreground">
            {settings.site_name}
          </span>
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-card px-6 py-4 text-center text-xs text-muted-foreground">
        {settings.footer_text || `© ${new Date().getFullYear()} ${settings.site_name}. All rights reserved.`}
        {settings.support_email && (
          <span className="block mt-0.5">
            Support:{" "}
            <a
              href={`mailto:${settings.support_email}`}
              className="text-primary hover:underline"
            >
              {settings.support_email}
            </a>
          </span>
        )}
      </footer>
    </div>
  );
}
