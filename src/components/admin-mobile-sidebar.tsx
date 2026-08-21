"use client";

import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu, ShieldCheck } from "lucide-react";
import AdminSidebarNav from "./admin-sidebar-nav";
import Logo from "@/components/logo";

interface AdminMobileSidebarProps {
  displayName: string;
  siteName: string;
}

export default function AdminMobileSidebar({ displayName, siteName }: AdminMobileSidebarProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9 -ml-1"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </Button>
        }
      />
      <SheetContent
        side="left"
        className="w-72 p-0 bg-sidebar text-sidebar-foreground [&>button]:text-sidebar-foreground flex flex-col"
      >
        {/* Brand Header */}
        <div className="h-16 border-b border-sidebar-border px-6 flex items-center gap-3 shrink-0">
          <Logo className="w-7 h-7 text-primary shrink-0" />
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight leading-none text-sidebar-foreground">
              {siteName}
            </span>
            </div>
        </div>

        {/* Navigation */}
        <AdminSidebarNav onNavClick={() => setOpen(false)} />

        {/* Footer User Info */}
        <div className="p-4 border-t border-sidebar-border mt-auto shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center shrink-0 border border-sidebar-border">
              <ShieldCheck className="w-4 h-4 text-sidebar-primary" />
            </div>
            <div className="flex flex-col truncate">
              <span className="font-semibold text-sidebar-foreground truncate">
                {displayName}
              </span>
              <span className="text-[10px] text-sidebar-foreground/50">Administrator</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}