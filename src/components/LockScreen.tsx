import { useEffect, useState } from "react";
import { Fingerprint, Delete, Lock, LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  type SecurityRow,
  verifyPin, verifyBiometric,
  lockAttempts, unlockSession,
} from "@/lib/security";

function fmt(ms: number) {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}m ${r.toString().padStart(2, "0")}s`;
}

export function LockScreen({ sec, onUnlock }: { sec: SecurityRow; onUnlock: () => void }) {
  const { user } = useAuth();
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [lockedFor, setLockedFor] = useState(0);
  const [tried, setTried] = useState(false);

  // Lock timer tick
  useEffect(() => {
    const tick = () => {
      const s = lockAttempts.get();
      const left = s.lockedUntil - Date.now();
      setLockedFor(left > 0 ? left : 0);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [tried]);

  // Auto-trigger biometria
  useEffect(() => {
    if (sec.biometric_enabled && sec.biometric_credential_id && lockedFor === 0) {
      tryBiometric();
    }
     
  }, []);

  const tryBiometric = async () => {
    if (!sec.biometric_credential_id || busy || lockedFor > 0) return;
    setBusy(true);
    try {
      const ok = await verifyBiometric(sec.biometric_credential_id);
      if (ok) {
        lockAttempts.reset();
        unlockSession.set();
        onUnlock();
        return;
      }
      toast.error("Biometria não reconhecida");
    } catch (e: any) {
      if (e?.name !== "NotAllowedError") {
        toast.error("Falha na biometria. Use o PIN.");
      }
    } finally {
      setBusy(false);
    }
  };

  const press = (d: string) => {
    if (lockedFor > 0 || busy) return;
    if (pin.length >= 6) return;
    const next = pin + d;
    setPin(next);
    if (next.length >= 4) maybeSubmit(next);
  };

  const back = () => setPin((p) => p.slice(0, -1));

  const maybeSubmit = async (val: string) => {
    setBusy(true);
    try {
      const ok = await verifyPin(val, sec.pin_hash, sec.pin_salt);
      if (ok) {
        lockAttempts.reset();
        unlockSession.set();
        onUnlock();
      } else {
        // try longer PIN — only fail when user reaches 6 digits or hits OK
        if (val.length >= 6) {
          const s = lockAttempts.fail();
          setPin("");
          setTried((x) => !x);
          if (s.lockedUntil > 0) {
            toast.error("Muitas tentativas. Tente novamente em instantes.");
          } else {
            toast.error("PIN incorreto");
          }
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const confirm = () => { if (pin.length >= 4) maybeSubmit(pin); };

  const signOut = async () => {
    unlockSession.clear();
    await supabase.auth.signOut();
  };

  const disabled = lockedFor > 0 || busy;

  return (
    <div className="app-shell flex min-h-dvh flex-col items-center justify-between px-6 py-10">
      <div className="mt-8 text-center">
        <div className="brand-gradient mx-auto flex h-16 w-16 items-center justify-center rounded-3xl shadow-lg shadow-primary/30">
          <Lock className="h-8 w-8 text-primary-foreground" />
        </div>
        <h1 className="mt-6 font-display text-2xl font-bold">App bloqueado</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user?.email ?? "Saldo"}
        </p>
      </div>

      {/* PIN dots */}
      <div className="flex items-center gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i}
            className={`h-3 w-3 rounded-full transition-all ${
              i < pin.length ? "bg-primary scale-110" : "bg-muted"
            }`}
          />
        ))}
      </div>

      {lockedFor > 0 && (
        <div className="rounded-xl bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
          Bloqueado por {fmt(lockedFor)}
        </div>
      )}

      {/* Keypad */}
      <div className="grid w-full max-w-[300px] grid-cols-3 gap-3">
        {["1","2","3","4","5","6","7","8","9"].map((d) => (
          <button key={d} disabled={disabled}
            onClick={() => press(d)}
            className="h-16 rounded-2xl bg-surface text-2xl font-semibold transition active:scale-95 disabled:opacity-40"
          >{d}</button>
        ))}
        <button disabled={disabled || !sec.biometric_enabled || !sec.biometric_credential_id}
          onClick={tryBiometric}
          className="flex h-16 items-center justify-center rounded-2xl bg-surface transition active:scale-95 disabled:opacity-40"
        >
          <Fingerprint className="h-6 w-6 text-primary" />
        </button>
        <button disabled={disabled} onClick={() => press("0")}
          className="h-16 rounded-2xl bg-surface text-2xl font-semibold transition active:scale-95 disabled:opacity-40"
        >0</button>
        <button disabled={disabled || !pin} onClick={back}
          className="flex h-16 items-center justify-center rounded-2xl bg-surface transition active:scale-95 disabled:opacity-40"
        >
          <Delete className="h-6 w-6" />
        </button>
      </div>

      <div className="flex w-full max-w-[300px] flex-col gap-2">
        {pin.length >= 4 && pin.length < 6 && (
          <Button onClick={confirm} disabled={disabled} className="h-12">OK</Button>
        )}
        <button onClick={signOut} className="flex items-center justify-center gap-2 py-3 text-xs text-muted-foreground">
          <LogOut className="h-3.5 w-3.5" /> Sair da conta
        </button>
      </div>
    </div>
  );
}
