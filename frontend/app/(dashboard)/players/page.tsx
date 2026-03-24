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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Jugadores</h1>
        <Button onClick={() => router.push("/players/new")} className="gap-2">
          <Plus className="h-4 w-4" />
          Nuevo jugador
        </Button>
      </div>

      <Card>
        {loading ? (
          <CardContent className="py-10 flex justify-center">
            <Loader2 className="animate-spin h-8 w-8" />
          </CardContent>
        ) : players.length === 0 ? (
          <CardContent className="py-10 text-center text-muted-foreground">
            No hay jugadores registrados. ¡Crea el primero!
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre completo</TableHead>
                <TableHead>Posición</TableHead>
                <TableHead className="text-center">Edad</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Documento</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {players.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{fullName(p)}</TableCell>
                  <TableCell>
                    {p.position ? (
                      <Badge className={POSITION_COLORS[p.position]}>
                        {POSITION_LABELS[p.position]}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-sm">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {calcAge(p.birth_date)}
                  </TableCell>
                  <TableCell>{p.phone || "-"}</TableCell>
                  <TableCell>
                    {p.document_type && p.document_number
                      ? `${p.document_type} ${p.document_number}`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => router.push(`/players/${p.id}`)}
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
