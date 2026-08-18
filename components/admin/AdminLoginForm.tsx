"use client";

import { Button } from "@/components/ui/Button";
import { useAdminPath } from "@/components/admin/admin-path";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function AdminLoginForm() {
  const router = useRouter();
  const basePath = useAdminPath();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (!data.ok) {
        setError("Invalid credentials");
        return;
      }
      router.replace(basePath);
      router.refresh();
    } catch {
      setError("Invalid credentials");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void onSubmit(e)} className="surface surface-pad mx-auto mt-24 max-w-sm">
      <h1 className="mt-1">Sign in</h1>
      <p className="mt-2 text-sm text-mute">Enter your password to continue.</p>
      <input
        type="password"
        className="field mt-5"
        autoComplete="current-password"
        aria-label="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      {error ? <p className="mt-2 text-sm text-danger">{error}</p> : null}
      <Button type="submit" className="mt-4" fullWidth loading={busy}>
        Continue
      </Button>
    </form>
  );
}
