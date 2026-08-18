/** Subtle WebAudio ticks for the case reel. Off until the user enables sound. */

let ctx: AudioContext | null = null;
let lastTickAt = 0;

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  return ctx;
}

/** Call from a click so the context is allowed to start. */
export function unlockReelAudio() {
  const audio = audioContext();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume();
}

export function playReelTick(intensity = 1) {
  const audio = ctx;
  if (!audio || audio.state !== "running") return;
  const now = audio.currentTime;
  if (now - lastTickAt < 0.016) return;
  lastTickAt = now;

  const osc = audio.createOscillator();
  const gain = audio.createGain();
  const amount = 0.018 * Math.min(1, Math.max(0.35, intensity));
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1180 + 220 * intensity, now);
  gain.gain.setValueAtTime(amount, now);
  gain.gain.exponentialRampToValueAtTime(0.0004, now + 0.03);
  osc.connect(gain);
  gain.connect(audio.destination);
  osc.start(now);
  osc.stop(now + 0.034);
}
