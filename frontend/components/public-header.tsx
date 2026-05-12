import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PublicHeader() {
  return (
    <header className="border-b-2 border-green-200 bg-white/80 backdrop-blur sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 via-green-600 to-green-700 flex items-center justify-center text-white text-xl shadow-lg">⚽</span>
          <span className="font-bold text-lg tracking-tight text-gray-900">Smart Gol</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/login">
            <Button variant="outline" size="sm" className="border-green-500 text-green-700 hover:bg-green-50">
              Iniciar sesión
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm" className="bg-gradient-to-r from-green-500 via-green-600 to-green-700 text-white font-bold shadow-md">
              Registrarse
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
