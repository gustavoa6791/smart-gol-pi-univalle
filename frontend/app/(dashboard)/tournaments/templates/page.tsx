"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2 } from "lucide-react";
import api from "@/lib/api";
import {
  TournamentTemplate,
  TournamentTemplateCreate,
} from "@/lib/types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

import {
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from "@/components/ui/table";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<TournamentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<TournamentTemplateCreate>({
    name: "",
    is_home_away: false,
  });

  function loadTemplates() {
    setLoading(true);
    api.get<TournamentTemplate[]>("/api/templates/")
      .then((r) => setTemplates(r.data))
      .catch(() => toast.error("Error al cargar plantillas"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTemplates();
  }, []);

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Nombre requerido");
      return;
    }

    setSaving(true);

    try {
      await api.post("/api/templates/", form);
      toast.success("Plantilla creada");
      setOpen(false);
      setForm({ name: "", is_home_away: false });
      loadTemplates();
    } catch {
      toast.error("Error al crear plantilla");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">
          Plantillas de Torneos
        </h1>

        <Button onClick={() => setOpen(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Nueva plantilla
        </Button>
      </div>

      {/* Table */}
      <Card>
        {loading ? (
          <CardContent className="py-10 text-center">
            <Loader2 className="animate-spin mx-auto" />
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead>Formato</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>{t.id}</TableCell>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>
                    {t.is_home_away
                      ? "Ida y vuelta"
                      : "Solo ida"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva plantilla</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) =>
                  setForm({ ...form, name: e.target.value })
                }
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={form.is_home_away}
                onChange={(e) =>
                  setForm({
                    ...form,
                    is_home_away: e.target.checked,
                  })
                }
              />
              <span>Ida y vuelta</span>
            </div>
          </div>

          <DialogFooter>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="animate-spin mr-2" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}