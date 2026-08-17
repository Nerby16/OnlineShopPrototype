"use client";

import { useCallback, useEffect, useState } from "react";
import { useApi } from "./use-api";

export type SessionUser = {
  id: number;
  email: string;
  name: string;
  phone: string;
  marketingOptIn: boolean;
  role: "customer" | "admin";
};

export function useSession() {
  const request = useApi();
  const [user, setUser] = useState<SessionUser | null>(null);
  const [checking, setChecking] = useState(true);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const result = await request<{ user: SessionUser | null }>("/auth/me", { signal });
      setUser(result.user);
      return result.user;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return null;
      setUser(null);
      return null;
    } finally {
      if (!signal?.aborted) setChecking(false);
    }
  }, [request]);

  useEffect(() => {
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh(controller.signal);
    return () => controller.abort();
  }, [refresh]);

  const signOut = useCallback(async () => {
    try {
      await request("/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      setChecking(false);
    }
  }, [request]);

  return { user, setUser, checking, refresh, signOut };
}
