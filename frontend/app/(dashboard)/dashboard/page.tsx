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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Bienvenido de vuelta{user ? `, ${user.name}` : ""} 👋
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total jugadores
            </CardTitle>
            <span className="text-2xl">⚽</span>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{playerCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Equipos activos
            </CardTitle>
            <span className="text-2xl">🏆</span>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">1</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Convocatorias
            </CardTitle>
            <span className="text-2xl">📋</span>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">0</p>
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
