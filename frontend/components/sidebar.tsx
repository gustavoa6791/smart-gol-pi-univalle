"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Users,
  LogOut,
  ChevronFirst,
  ChevronLast,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/players", label: "Jugadores", icon: Users },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    localStorage.removeItem("access_token");
    document.cookie = "access_token=; path=/; max-age=0";
    toast.success("Sesión cerrada");
    router.push("/login");
  }

  return (
    <aside
      className={cn(
        "flex flex-col h-full bg-card border-r border-border transition-all duration-300 ease-in-out",
        collapsed ? "w-16" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 min-h-[60px] border-b border-border">
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground text-base">
          ⚽
        </span>
        {!collapsed && (
          <span className="font-semibold text-sm tracking-tight whitespace-nowrap overflow-hidden">
            Smart Gol
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 flex flex-col gap-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-2.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors",
                active && "bg-accent text-accent-foreground font-medium"
              )}
            >
              <Icon className="flex-shrink-0 h-5 w-5" />
              {!collapsed && (
                <span className="whitespace-nowrap">{label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      <Separator />

      {/* Footer */}
      <div className="py-3 px-2 flex flex-col gap-1">
        {/* Logout */}
        <button
          onClick={logout}
          title={collapsed ? "Cerrar sesión" : undefined}
          className="flex items-center gap-3 w-full rounded-md px-2 py-2.5 text-sm text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut className="flex-shrink-0 h-5 w-5" />
          {!collapsed && <span className="whitespace-nowrap">Cerrar sesión</span>}
        </button>

        {/* Toggle collapse */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? "Expandir menú" : "Contraer menú"}
          className="flex items-center gap-3 justify-start px-2 text-muted-foreground"
        >
          {collapsed ? (
            <ChevronLast className="h-5 w-5 flex-shrink-0" />
          ) : (
            <>
              <ChevronFirst className="h-5 w-5 flex-shrink-0" />
              <span className="text-xs">Contraer</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
