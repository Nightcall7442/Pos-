// A scanner-first register has to answer without being looked at: a short
// rising tone for "added", a low double tone for "not found", so a cashier
// facing the customer knows every item registered. Web Audio, no assets.

const KEY = "pos-sound";
let ctx: AudioContext | null = null;

export function soundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // private mode — the choice just does not persist
  }
}

function tone(frequency: number, start: number, duration: number, volume = 0.09): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, ctx.currentTime + start);
  gain.gain.exponentialRampToValueAtTime(volume, ctx.currentTime + start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + start);
  osc.stop(ctx.currentTime + start + duration + 0.02);
}

export type BeepKind = "ok" | "error" | "done";

export function beep(kind: BeepKind): void {
  if (!soundEnabled()) return;
  try {
    ctx ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === "suspended") void ctx.resume();
    if (kind === "ok") {
      tone(1320, 0, 0.07);
    } else if (kind === "done") {
      tone(880, 0, 0.09);
      tone(1320, 0.1, 0.16);
    } else {
      tone(220, 0, 0.16, 0.12);
      tone(190, 0.19, 0.22, 0.12);
    }
  } catch {
    // no audio device — silence is fine
  }
}
