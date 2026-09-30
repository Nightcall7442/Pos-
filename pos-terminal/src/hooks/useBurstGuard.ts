import { useRef } from "react";

/**
 * A barcode scanner types a whole code in a few milliseconds. If one lands in a
 * number field by mistake it must not become a price — and the Enter that ends
 * it must not save that price either. A burst of seven or more characters
 * within 300 ms is refused and the field is locked for a moment, long enough
 * for the scanner's closing Enter to pass.
 */
export function useBurstGuard(onBlocked: () => void) {
  const started = useRef(0);
  const lockedUntil = useRef(0);
  return {
    /** True while the tail of a refused burst (its Enter) may still arrive. */
    locked: () => performance.now() < lockedUntil.current,
    /** The value to keep for a change from `prev` to `next`; null to ignore the change. */
    accept(prev: string, next: string): string | null {
      const now = performance.now();
      if (now < lockedUntil.current) return null;
      if (prev === "" || next.length < prev.length) started.current = now;
      if (next.length >= 7 && now - started.current < 300) {
        lockedUntil.current = now + 700;
        onBlocked();
        return "";
      }
      return next;
    },
  };
}
