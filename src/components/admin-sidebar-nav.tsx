"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  BookMarked,
  Key,
  Users,
  UserCog,
  Settings,
  Database,
} from "lucide-react";

const navItems = [
  { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/courses", label: "Courses", icon: BookMarked, exact: false },
  { href: "/admin/tokens", label: "Access Tokens", icon: Key, exact: false },
  { href: "/admin/users", label: "User Directory", icon: Users, exact: false },
  { href: "/admin/import", label: "Auto Course Importer", icon: Database, exact: true },
  { href: "/admin/admins", label: "Admin Accounts", icon: UserCog, exact: false },
  { href: "/admin/settings", label: "Settings", icon: Settings, exact: true },
];

interface AdminSidebarNavProps {
  onNavClick?: () => void;
}

export default function AdminSidebarNav({ onNavClick }: AdminSidebarNavProps) {
  const pathname = usePathname();

  function isActive(item: (typeof navItems)[number]) {
    if (item.exact) {
      return pathname === item.href;
    }
    return pathname === item.href || pathname.startsWith(item.href + "/");
  }

  return (
    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
      {navItems.map((item) => {
        const active = isActive(item);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavClick}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 px-3 py-2 min-h-[44px] rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar ${
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            }`}
          >
            <Icon
              className={`w-4 h-4 shrink-0 ${
                active ? "text-sidebar-foreground" : "text-sidebar-foreground/60"
              }`}
            />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}