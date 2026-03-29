"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Team } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Plus, Eye, Shield, UserRound, Users } from "lucide-react";
import { toast } from "sonner";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Team[]>("/api/teams/")
      .then((r) => setTeams(r.data))
      .catch(() => toast.error("Error al cargar equipos"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
            Equipos
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Gestiona los equipos del club
          </p>
        </div>
        <Button onClick={() => router.push("/teams/new")} className="gap-2 bg-gradient-to-r from-green-500 via-green-600 to-green-700 hover:from-green-600 hover:via-green-700 hover:to-green-800 text-white font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
          <Plus className="h-4 w-4" />
          Nuevo equipo
        </Button>
      </div>

      {/* Table Card */}
      <Card className="shadow-xl border-2 border-green-200 bg-white overflow-hidden pt-0 gap-0">
        {loading ? (
          <CardContent className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando equipos...
          </CardContent>
        ) : teams.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <span className="text-5xl">⚽</span>
            <p className="font-medium">No hay equipos registrados</p>
            <p className="text-sm">
              Haz clic en &quot;Nuevo equipo&quot; para agregar el primero
            </p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-green-50 to-green-100">
                <TableHead className="w-16 font-bold text-gray-900 py-2 px-2"></TableHead>
                <TableHead className="font-bold text-gray-900 py-2 px-2">Nombre</TableHead>
                <TableHead className="font-bold text-gray-900 py-2 px-2">Formador</TableHead>
                <TableHead className="font-bold text-gray-900 py-2 px-2">Lider</TableHead>
                <TableHead className="text-center font-bold text-gray-900 py-2 px-2">Jugadores</TableHead>
                <TableHead className="text-right font-bold text-gray-900 py-2 px-2">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id} className="hover:bg-green-50/50 transition-colors h-[34px]">
                  <TableCell className="py-2 px-2">
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-gradient-to-br from-green-50 to-green-100 flex items-center justify-center border-2 border-green-200 shadow-sm">
                      {team.shield_url ? (
                        <img
                          src={`${BACKEND}${team.shield_url}`}
                          alt={team.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Shield className="h-5 w-5 text-green-400" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-bold text-gray-900 py-2 px-2">{team.name}</TableCell>
                  <TableCell className="font-medium text-gray-700 py-2 px-2">{team.coach_name}</TableCell>
                  <TableCell className="py-2 px-2">
                    {team.leader ? (
                      <Badge className="gap-1 bg-gradient-to-r from-amber-400 to-amber-500 text-white border-0 font-semibold shadow-md">
                        <UserRound className="h-3 w-3" />
                        {team.leader.first_name} {team.leader.first_surname}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center py-2 px-2">
                    <Badge variant="secondary" className="gap-1 bg-gradient-to-r from-blue-400 to-blue-500 text-white border-0 font-bold shadow-md px-3 py-1">
                      <Users className="h-3 w-3" />
                      {team.players?.length || 0}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right py-2 px-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 border-2 border-green-500 text-green-700 hover:bg-green-500 hover:text-white font-semibold shadow-sm hover:shadow-md transition-all"
                      onClick={() => router.push(`/teams/${team.id}`)}
                    >
                      <Eye className="h-3 w-3" />
                      Ver
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
