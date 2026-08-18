"use client";

import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/lib/store";
import { LogIn } from "lucide-react";
import { useState } from "react";

export function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const { beginSteamLogin } = useAppStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  return (
    <form
      className="flex flex-col gap-3.5 text-left"
      onSubmit={(e) => {
        e.preventDefault();
        if (username.trim().length < 3 || password.length < 3) {
          setError("Enter a login and password (min 3 characters).");
          return;
        }
        setError("");
        onSuccess();
      }}
    >
      <p className="text-sm text-mute">Login + password. Steam sign-in is coming soon.</p>

      <label className="flex flex-col gap-1.5">
        <span className="label">Login</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="field"
          autoComplete="username"
          aria-invalid={Boolean(error) || undefined}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label">Password</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field"
          autoComplete="current-password"
          aria-invalid={Boolean(error) || undefined}
        />
      </label>

      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" fullWidth size="lg" icon={<LogIn className="h-4 w-4" />}>
        Sign in
      </Button>

      <Button type="button" variant="ghost" fullWidth onClick={beginSteamLogin}>
        Sign in with Steam
      </Button>

      <p className="text-xs leading-relaxed text-mute">
        Steam login is on the way. We never collect Steam passwords.
      </p>
    </form>
  );
}
