"use client";

import { useState } from "react";
import { Sidebar } from "@/components/sidebar";
import { PanelLeftOpen } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar collapsed={collapsed} setCollapsed={setCollapsed} />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top navbar */}
        <header className="h-[60px] border-b-2 border-green-200 bg-gradient-to-r from-white via-green-50 to-white flex items-center justify-between px-8 flex-shrink-0 shadow-md">
          <div className="flex items-center gap-2">
            {collapsed && (
              <button
                onClick={() => setCollapsed(false)}
                title="Expandir menú"
                className="flex items-center justify-center rounded-md text-gray-700 hover:text-green-700 hover:bg-green-100 transition-colors border border-green-300 p-1"
              >
                <PanelLeftOpen style={{ width: 22, height: 22, strokeWidth: 1.5 }} />
              </button>
            )}
            <p className="text-sm text-gray-800 font-bold flex items-center gap-2 leading-none">
              <span className="text-green-600 text-base">⚽</span>
              <span className="leading-tight">Sistema de gestión de equipos</span>
            </p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 via-green-600 to-green-700 text-white flex items-center justify-center text-xs font-bold shadow-lg hover:shadow-xl transition-shadow cursor-pointer leading-none">
            SG
          </div>
        </header>
        {/* Page */}
        <main className="flex-1 overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
