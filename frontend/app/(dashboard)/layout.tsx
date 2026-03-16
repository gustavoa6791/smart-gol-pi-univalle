import { Sidebar } from "@/components/sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top navbar */}
        <header className="h-[60px] border-b-2 border-green-200 bg-gradient-to-r from-white via-green-50 to-white flex items-center justify-between px-6 flex-shrink-0 shadow-md">
          <p className="text-sm text-gray-800 font-bold flex items-center gap-2">
            <span className="text-green-600">⚽</span>
            Sistema de gestión de equipos
          </p>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 via-green-600 to-green-700 text-white flex items-center justify-center text-xs font-bold shadow-lg hover:shadow-xl transition-shadow cursor-pointer">
            SG
          </div>
        </header>
        {/* Page */}
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
