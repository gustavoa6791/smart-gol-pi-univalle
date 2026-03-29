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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Equipos</h1>
        <Button onClick={() => router.push("/teams/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo equipo
        </Button>
      </div>

      <Card>
        {loading ? (
          <CardContent className="py-10 flex justify-center">
            <Loader2 className="animate-spin h-8 w-8" />
          </CardContent>
        ) : teams.length === 0 ? (
          <CardContent className="py-10 text-center text-muted-foreground">
            No hay equipos registrados. ¡Crea el primero!
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16"></TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Formador</TableHead>
                <TableHead>Lider</TableHead>
                <TableHead className="text-center">Jugadores</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {teams.map((team) => (
                <TableRow key={team.id}>
                  <TableCell>
                    <div className="w-10 h-10 rounded-lg overflow-hidden bg-muted flex items-center justify-center border">
                      {team.shield_url ? (
                        <img
                          src={`${BACKEND}${team.shield_url}`}
                          alt={team.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Shield className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{team.name}</TableCell>
                  <TableCell>{team.coach_name}</TableCell>
                  <TableCell>
                    {team.leader ? (
                      <div className="flex items-center gap-1.5">
                        <UserRound className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-sm">
                          {team.leader.first_name} {team.leader.first_surname}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="gap-1">
                      <Users className="h-3 w-3" />
                      {team.players?.length || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/teams/${team.id}`)}
                    >
                      <Eye className="h-4 w-4 mr-1" />
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
