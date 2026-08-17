"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { Dispatch, SetStateAction, useCallback, useEffect, useState } from "react";

export type CartLine = { id: number; quantity: number };

const CART_STORAGE_KEY = "nexo-animal-cart";

function normalizeCart(value: unknown): CartLine[] {
  if (!Array.isArray(value)) return [];
  const quantities = new Map<number, number>();
  for (const item of value) {
    const id = Number(item?.id);
    const quantity = Number(item?.quantity);
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(quantity) || quantity < 1) continue;
    quantities.set(id, Math.min(99, (quantities.get(id) ?? 0) + quantity));
  }
  return [...quantities].map(([id, quantity]) => ({ id, quantity }));
}

function readStoredCart() {
  try {
    return normalizeCart(JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]"));
  } catch {
    return [];
  }
}

export function useCart() {
  const [cart, setCart] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setCart(readStoredCart());
    setReady(true);
    const syncAcrossTabs = (event: StorageEvent) => {
      if (event.key === CART_STORAGE_KEY) setCart(readStoredCart());
    };
    window.addEventListener("storage", syncAcrossTabs);
    return () => window.removeEventListener("storage", syncAcrossTabs);
  }, []);

  useEffect(() => {
    if (ready) window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  }, [cart, ready]);

  const setSafeCart: Dispatch<SetStateAction<CartLine[]>> = useCallback((next) => {
    if (typeof next !== "function") {
      const normalized = normalizeCart(next);
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalized));
      setCart(normalized);
      return;
    }
    setCart((current) => {
      const normalized = normalizeCart(next(current));
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(normalized));
      return normalized;
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart([]);
    window.localStorage.removeItem(CART_STORAGE_KEY);
  }, []);

  return { cart, setCart: setSafeCart, clearCart, ready };
}
