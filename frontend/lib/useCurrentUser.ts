"use client";

import { useEffect, useState } from "react";
import api from "@/lib/api";
import type { User, UserRole } from "@/lib/types";

let cachedUser: User | null = null;
const listeners = new Set<(u: User | null) => void>();

function notify(user: User | null) {
  cachedUser = user;
  listeners.forEach((fn) => fn(user));
}

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(!cachedUser);

  useEffect(() => {
    listeners.add(setUser);
    if (!cachedUser) {
      api
        .get<User>("/api/auth/me")
        .then((res) => notify(res.data))
        .catch(() => notify(null))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
    return () => {
      listeners.delete(setUser);
    };
  }, []);

  return { user, loading };
}

export function clearCurrentUserCache() {
  notify(null);
}

export function canWrite(role?: UserRole | null) {
  return role === "admin" || role === "organizer";
}

export function isAdmin(role?: UserRole | null) {
  return role === "admin";
}
