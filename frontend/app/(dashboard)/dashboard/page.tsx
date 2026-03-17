"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import api from "@/lib/api";
import { User, Player } from "@/lib/types";

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null);
  const [playerCount, setPlayerCount] = useState(0);

  useEffect(() => {
    api.get<User>("/api/auth/me").then((r) => setUser(r.data)).catch(() => {});
    api.get<Player[]>("/api/players/").then((r) => setPlayerCount(r.data.length)).catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
          Dashboard
        </h1>
        <p className="text-muted-foreground text-sm mt-1 font-medium">
          ⚽ Bienvenido de vuelta{user ? `, ${user.name}` : ""}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="border-2 border-green-300 hover:border-green-500 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 bg-gradient-to-br from-white to-green-50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-gradient-to-r from-green-500 to-green-600 rounded-t-lg">
            <CardTitle className="text-sm font-bold text-white">
              Total jugadores
            </CardTitle>
            <span className="text-3xl">⚽</span>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-bold bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent">{playerCount}</p>
            <p className="text-xs text-gray-600 mt-2 font-medium">Jugadores registrados</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-yellow-300 hover:border-yellow-500 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 bg-gradient-to-br from-white to-yellow-50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-gradient-to-r from-yellow-500 to-yellow-600 rounded-t-lg">
            <CardTitle className="text-sm font-bold text-white">
              Equipos activos
            </CardTitle>
            <span className="text-3xl">🏆</span>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-bold bg-gradient-to-r from-yellow-600 to-yellow-700 bg-clip-text text-transparent">1</p>
            <p className="text-xs text-gray-600 mt-2 font-medium">Equipos en el sistema</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-blue-300 hover:border-blue-500 transition-all shadow-lg hover:shadow-xl transform hover:scale-105 bg-gradient-to-br from-white to-blue-50">
          <CardHeader className="flex flex-row items-center justify-between pb-2 bg-gradient-to-r from-blue-500 to-blue-600 rounded-t-lg">
            <CardTitle className="text-sm font-bold text-white">
              Convocatorias
            </CardTitle>
            <span className="text-3xl">📋</span>
          </CardHeader>
          <CardContent>
            <p className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 bg-clip-text text-transparent">0</p>
            <p className="text-xs text-gray-600 mt-2 font-medium">Convocatorias activas</p>
          </CardContent>
        </Card>
      </div>

      {/* Info */}
      <Card>
        <CardHeader>
          <CardTitle>Sistema de gestión</CardTitle>
          <CardDescription>
            Smart Gol te permite gestionar tu equipo de fútbol de manera
            eficiente. Administra jugadores, posiciones y mucho más.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Separator className="mb-4" />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            API conectada y funcionando
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
