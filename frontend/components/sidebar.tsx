"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Users,
  LogOut,
  PanelLeftClose,
  Trophy,
  CalendarDays,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/players", label: "Jugadores", icon: Users },
  { href: "/teams", label: "Equipos", icon: Trophy },
  { href: "/tournaments/templates", label: "Plantillas", icon: CalendarDays },
  { href: "/tournaments/manage", label: "Torneos", icon: Trophy },
];

interface SidebarProps {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

export function Sidebar({ collapsed, setCollapsed }: SidebarProps) {
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
        collapsed ? "w-20" : "w-60"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 h-[60px] border-b-2 border-green-200 bg-gradient-to-r from-green-50 via-white to-green-50">
        <span className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 via-green-600 to-green-700 flex items-center justify-center text-white text-xl shadow-lg hover:shadow-xl transition-shadow leading-none">
          ⚽
        </span>
        {!collapsed && (
          <>
            <span className="font-bold text-lg tracking-tight whitespace-nowrap overflow-hidden text-gray-900 leading-tight flex-1">
              Smart Gol
            </span>
            <button
              onClick={() => setCollapsed(true)}
              title="Contraer menú"
              className="flex-shrink-0 flex items-center justify-center rounded-md text-gray-700 hover:text-green-700 hover:bg-green-100 transition-colors border border-green-300 p-1"
            >
              <PanelLeftClose style={{ width: 22, height: 22, strokeWidth: 1.5 }} />
            </button>
          </>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-all duration-200",
                active 
                  ? "bg-gradient-to-r from-green-500 to-green-600 text-white font-bold shadow-md border-l-4 border-green-700 transform scale-[1.02]" 
                  : "text-gray-700 hover:bg-green-100 hover:text-green-700 hover:shadow-sm"
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
      <div className="py-4 px-3 flex flex-col gap-2">
        {/* Logout */}
        <button
          onClick={logout}
          title={collapsed ? "Cerrar sesión" : undefined}
          className="flex items-center gap-3 w-full rounded-md px-2 py-2.5 text-sm text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors font-medium border border-red-300"
        >
          <LogOut className="flex-shrink-0 h-5 w-5" />
          {!collapsed && <span className="whitespace-nowrap">Cerrar sesión</span>}
        </button>

      </div>
    </aside>
  );
}
