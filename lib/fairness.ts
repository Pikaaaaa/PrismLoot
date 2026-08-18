/**
 * Provably-fair *architecture* helpers.
 *
 * Demo rolls happen on the server, then the UI animates to that result.
 * Hashes below are commit-reveal copy so a later backend can publish
 * serverSeed after the round. This file does not claim a live crypto casino.
 */
const encoder = new TextEncoder();

export type FairnessTicket = {
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  revealed: boolean;
};

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function demoFairnessTicket(): FairnessTicket {
  return {
    serverSeedHash: "hash published after the backend is wired",
    clientSeed: "browser-session",
    nonce: 0,
    revealed: false,
  };
}
