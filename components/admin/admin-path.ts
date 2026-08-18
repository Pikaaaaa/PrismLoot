"use client";

import { createContext, useContext } from "react";
import { consoleHref } from "@/lib/admin/path";

export const AdminPathContext = createContext("");

export function useAdminPath() {
  return useContext(AdminPathContext);
}

export function useConsoleHref(subpath = "") {
  const base = useAdminPath();
  return consoleHref(base, subpath);
}

export { consoleHref };
