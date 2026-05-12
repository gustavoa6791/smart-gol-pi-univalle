"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Loader2, Trash2 } from "lucide-react";
import api from "@/lib/api";
import type { User, UserRole } from "@/lib/types";
import { useCurrentUser, isAdmin } from "@/lib/useCurrentUser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableHeader, TableRow, TableHead, TableBody, TableCell,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  organizer: "Organizador",
  viewer: "Consultor",
};

const ROLE_COLORS: Record<UserRole, string> = {
  admin: "bg-red-100 text-red-800",
  organizer: "bg-blue-100 text-blue-800",
  viewer: "bg-gray-100 text-gray-700",
};

export default function UsersPage() {
  const { user: me, loading: meLoading } = useCurrentUser();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState<{
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }>({ name: "", email: "", password: "", role: "viewer" });

  function loadUsers() {
    setLoading(true);
    api
      .get<User[]>("/api/auth/users")
      .then((res) => setUsers(res.data))
      .catch(() => toast.error("Error cargando usuarios"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!meLoading && isAdmin(me?.role)) loadUsers();
  }, [meLoading, me]);

  async function createUser() {
    if (!form.name || !form.email || !form.password) {
      toast.error("Completa todos los campos");
      return;
    }
    setSaving(true);
    try {
      await api.post("/api/auth/admin/users", form);
      toast.success("Usuario creado");
      setCreateOpen(false);
      setForm({ name: "", email: "", password: "", role: "viewer" });
      loadUsers();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Error al crear usuario";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function changeRole(userId: number, role: UserRole) {
    try {
      await api.patch(`/api/auth/users/${userId}/role`, { role });
      toast.success("Rol actualizado");
      loadUsers();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Error al actualizar rol";
      toast.error(msg);
    }
  }

  async function deleteUser(userId: number) {
    if (!confirm("¿Eliminar este usuario?")) return;
    try {
      await api.delete(`/api/auth/users/${userId}`);
      toast.success("Usuario eliminado");
      loadUsers();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Error al eliminar usuario";
      toast.error(msg);
    }
  }

  if (meLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="animate-spin h-8 w-8" />
      </div>
    );
  }

  if (!isAdmin(me?.role)) {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Usuarios</h1>
        <p className="text-muted-foreground">No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-green-600 to-green-800 bg-clip-text text-transparent">
            Usuarios
          </h1>
          <p className="text-muted-foreground text-sm font-medium">
            Administra los usuarios del sistema y sus roles
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2 bg-gradient-to-r from-green-500 via-green-600 to-green-700 text-white font-bold shadow-lg hover:shadow-xl transition-all">
          <Plus className="h-4 w-4" />
          Crear usuario
        </Button>
      </div>

      <Card className="shadow-xl border-2 border-green-200 bg-white overflow-hidden pt-0 gap-0">
        {loading ? (
          <CardContent className="flex items-center justify-center py-16 text-muted-foreground gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Cargando usuarios...
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-green-50 to-green-100">
                <TableHead className="font-bold text-gray-900 py-2 px-2">Nombre</TableHead>
                <TableHead className="font-bold text-gray-900 py-2 px-2">Email</TableHead>
                <TableHead className="font-bold text-gray-900 py-2 px-2">Rol</TableHead>
                <TableHead className="font-bold text-gray-900 py-2 px-2">Cambiar rol</TableHead>
                <TableHead className="text-right font-bold text-gray-900 py-2 px-2"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className="hover:bg-green-50/50 transition-colors h-[34px]">
                  <TableCell className="font-bold text-gray-900 py-2 px-2">{u.name}</TableCell>
                  <TableCell className="text-gray-700 py-2 px-2">{u.email}</TableCell>
                  <TableCell className="py-2 px-2">
                    <Badge className={ROLE_COLORS[u.role]}>{ROLE_LABELS[u.role]}</Badge>
                  </TableCell>
                  <TableCell className="py-2 px-2">
                    <select
                      className="border rounded-md p-1 text-sm"
                      value={u.role}
                      onChange={(e) => changeRole(u.id, e.target.value as UserRole)}
                      disabled={u.id === me?.id}
                    >
                      <option value="admin">Administrador</option>
                      <option value="organizer">Organizador</option>
                      <option value="viewer">Consultor</option>
                    </select>
                  </TableCell>
                  <TableCell className="text-right py-2 px-2">
                    {u.id !== me?.id && (
                      <Button size="icon" variant="ghost" className="text-destructive"
                        onClick={() => deleteUser(u.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear usuario</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Contraseña</Label>
              <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>Rol</Label>
              <select
                className="w-full border rounded-md p-2 text-sm"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
              >
                <option value="viewer">Consultor</option>
                <option value="organizer">Organizador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={createUser} disabled={saving}>
              {saving && <Loader2 className="animate-spin mr-2 h-4 w-4" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
