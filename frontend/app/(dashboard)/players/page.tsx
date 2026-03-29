"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/api";
import { Player } from "@/lib/types";
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
import { Loader2, Plus, Eye } from "lucide-react";
import { toast } from "sonner";

const POSITION_LABELS: Record<string, string> = {
  goalkeeper: "Portero",
  defender: "Defensa",
  midfielder: "Mediocampista",
  forward: "Delantero",
};

const POSITION_COLORS: Record<string, string> = {
  goalkeeper: "bg-yellow-100 text-yellow-800",
  defender: "bg-blue-100 text-blue-800",
  midfielder: "bg-green-100 text-green-800",
  forward: "bg-red-100 text-red-800",
};

function fullName(p: Player) {
  return [p.first_name, p.second_name, p.first_surname, p.second_surname]
    .filter(Boolean)
    .join(" ");
}

function calcAge(birth_date?: string) {
  if (!birth_date) return "-";
  const diff = Date.now() - new Date(birth_date).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

export default function PlayersPage() {
  const router = useRouter();
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Player[]>("/api/players/")
      .then((r) => setPlayers(r.data))
      .catch(() => toast.error("Error al cargar jugadores"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
            Jugadores
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Gestiona los jugadores del club
          </p>
        </div>
        <Button onClick={() => router.push("/players/new")} className="gap-2 bg-gradient-to-r from-green-500 via-green-600 to-green-700 hover:from-green-600 hover:via-green-700 hover:to-green-800 text-white font-bold shadow-lg hover:shadow-xl transition-all transform hover:scale-105">
          <Plus className="h-4 w-4" />
          Nuevo jugador
        </Button>
      </div>

      {/* Table Card */}
      <Card className="shadow-xl border-2 border-green-200 bg-white overflow-hidden pt-0 gap-0">
        {loading ? (
          <CardContent className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando jugadores...
          </CardContent>
        ) : players.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 gap-2 text-muted-foreground">
            <span className="text-5xl">⚽</span>
            <p className="font-medium">No hay jugadores registrados</p>
            <p className="text-sm">
              Haz clic en &quot;Nuevo jugador&quot; para agregar el primero
            </p>
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-green-50 to-green-100">
                <TableHead className="font-bold text-gray-900 py-2 px-2">Nombre completo</TableHead>
                <TableHead className="font-bold text-gray-900 py-2 px-2">Posicion</TableHead>
                <TableHead className="text-center font-bold text-gray-900 py-2 px-2">Edad</TableHead>
                <TableHead className="font-bold text-gray-900 py-2 px-2">Telefono</TableHead>
                <TableHead className="font-bold text-gray-900 py-2 px-2">Documento</TableHead>
                <TableHead className="text-right font-bold text-gray-900 py-2 px-2">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((p) => (
                <TableRow key={p.id} className="hover:bg-green-50/50 transition-colors h-[34px]">
                  <TableCell className="font-bold text-gray-900 py-2 px-2">{fullName(p)}</TableCell>
                  <TableCell className="py-2 px-2">
                    {p.position ? (
                      <Badge className={POSITION_COLORS[p.position]}>
                        {POSITION_LABELS[p.position]}
                      </Badge>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center py-2 px-2">
                    {calcAge(p.birth_date)}
                  </TableCell>
                  <TableCell className="font-medium text-gray-700 py-2 px-2">{p.phone || "-"}</TableCell>
                  <TableCell className="font-medium text-gray-700 py-2 px-2">
                    {p.document_type && p.document_number
                      ? `${p.document_type} ${p.document_number}`
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right py-2 px-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 border-2 border-green-500 text-green-700 hover:bg-green-500 hover:text-white font-semibold shadow-sm hover:shadow-md transition-all"
                      onClick={() => router.push(`/players/${p.id}`)}
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
