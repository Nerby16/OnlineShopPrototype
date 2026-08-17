"use client";

import { useCallback } from "react";
import { apiRequest } from "../lib/api";

export type ApiRequest = typeof apiRequest;

export function useApi(): ApiRequest {
  const request = useCallback((path: string, options: RequestInit = {}) => apiRequest(path, options), []);
  return request as ApiRequest;
}
