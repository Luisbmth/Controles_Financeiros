import { supabase } from "@/integrations/supabase/client";

// ---------- helpers ----------
const enc = new TextEncoder();

function bufToB64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlToBuf(s: string): Uint8Array {
  const pad = "=".repeat((4 - (s.length % 4)) % 4);
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomBytes(len: number) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return a;
}

// ---------- PIN hashing (PBKDF2-SHA256, 100k iterations) ----------
export async function hashPin(pin: string, saltB64?: string) {
  const salt = saltB64 ? b64urlToBuf(saltB64) : randomBytes(16);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return { hash: bufToB64url(bits), salt: bufToB64url(salt) };
}

export async function verifyPin(pin: string, hashB64: string, saltB64: string) {
  const { hash } = await hashPin(pin, saltB64);
  // constant-time-ish compare
  if (hash.length !== hashB64.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ hashB64.charCodeAt(i);
  return diff === 0;
}

// ---------- Supabase row ----------
export type SecurityRow = {
  user_id: string;
  pin_hash: string;
  pin_salt: string;
  biometric_enabled: boolean;
  biometric_credential_id: string | null;
  biometric_public_key: string | null;
};

export async function getSecurity(userId: string) {
  const { data, error } = await supabase
    .from("app_security").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return (data ?? null) as SecurityRow | null;
}

export async function setupPin(userId: string, pin: string) {
  const { hash, salt } = await hashPin(pin);
  const { error } = await supabase.from("app_security").upsert({
    user_id: userId,
    pin_hash: hash,
    pin_salt: salt,
  });
  if (error) throw error;
}

export async function updatePin(userId: string, pin: string) {
  return setupPin(userId, pin);
}

// ---------- WebAuthn / Biometria ----------
export function biometricSupported() {
  return typeof window !== "undefined"
    && typeof window.PublicKeyCredential !== "undefined";
}

export async function platformAuthenticatorAvailable() {
  if (!biometricSupported()) return false;
  try {
    // @ts-ignore
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

export async function registerBiometric(userId: string, userEmail: string) {
  const challenge = randomBytes(32);
  const cred = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Saldo", id: window.location.hostname },
      user: {
        id: enc.encode(userId),
        name: userEmail,
        displayName: userEmail,
      },
      pubKeyCredParams: [
        { type: "public-key", alg: -7 },   // ES256
        { type: "public-key", alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
      attestation: "none",
    },
  })) as PublicKeyCredential;

  const credId = bufToB64url(cred.rawId);
  // We store credential id only; the assertion later proves possession + UV.
  const { error } = await supabase.from("app_security").update({
    biometric_enabled: true,
    biometric_credential_id: credId,
    biometric_public_key: null,
  }).eq("user_id", userId);
  if (error) throw error;
  return credId;
}

export async function disableBiometric(userId: string) {
  const { error } = await supabase.from("app_security").update({
    biometric_enabled: false,
    biometric_credential_id: null,
    biometric_public_key: null,
  }).eq("user_id", userId);
  if (error) throw error;
}

export async function verifyBiometric(credentialId: string) {
  const challenge = randomBytes(32);
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge,
      timeout: 60_000,
      userVerification: "required",
      rpId: window.location.hostname,
      allowCredentials: [{
        id: b64urlToBuf(credentialId),
        type: "public-key",
        transports: ["internal"],
      }],
    },
  })) as PublicKeyCredential | null;
  return !!assertion;
}

// ---------- Tentativas / bloqueio progressivo ----------
const LOCK_KEY = "saldo.lock.attempts";
const LOGIN_KEY = "saldo.login.attempts";

type AttemptState = { count: number; lockedUntil: number };

function readAttempts(key: string, scope = ""): AttemptState {
  try {
    const raw = localStorage.getItem(key + ":" + scope);
    if (!raw) return { count: 0, lockedUntil: 0 };
    return JSON.parse(raw);
  } catch { return { count: 0, lockedUntil: 0 }; }
}

function writeAttempts(key: string, scope: string, s: AttemptState) {
  localStorage.setItem(key + ":" + scope, JSON.stringify(s));
}

function tierDelayMs(count: number, tiers: Array<[number, number]>) {
  // tiers: [thresholdCount, delayMs] sorted ascending by threshold
  let delay = 0;
  for (const [t, d] of tiers) if (count >= t) delay = d;
  return delay;
}

const LOCK_TIERS: Array<[number, number]> = [
  [3, 30_000],
  [5, 2 * 60_000],
  [7, 10 * 60_000],
];

const LOGIN_TIERS: Array<[number, number]> = [
  [5, 30_000],
  [7, 2 * 60_000],
  [9, 10 * 60_000],
];

export const lockAttempts = {
  get: () => readAttempts(LOCK_KEY),
  fail() {
    const s = readAttempts(LOCK_KEY);
    s.count += 1;
    const d = tierDelayMs(s.count, LOCK_TIERS);
    s.lockedUntil = d ? Date.now() + d : 0;
    writeAttempts(LOCK_KEY, "", s);
    return s;
  },
  reset() { writeAttempts(LOCK_KEY, "", { count: 0, lockedUntil: 0 }); },
};

export const loginAttempts = {
  get: (email: string) => readAttempts(LOGIN_KEY, email.toLowerCase()),
  fail(email: string) {
    const s = readAttempts(LOGIN_KEY, email.toLowerCase());
    s.count += 1;
    const d = tierDelayMs(s.count, LOGIN_TIERS);
    s.lockedUntil = d ? Date.now() + d : 0;
    writeAttempts(LOGIN_KEY, email.toLowerCase(), s);
    return s;
  },
  reset(email: string) {
    writeAttempts(LOGIN_KEY, email.toLowerCase(), { count: 0, lockedUntil: 0 });
  },
};

// ---------- Session-level "unlocked" flag ----------
const UNLOCK_KEY = "saldo.unlocked";
export const unlockSession = {
  is: () => typeof sessionStorage !== "undefined" && sessionStorage.getItem(UNLOCK_KEY) === "1",
  set: () => sessionStorage.setItem(UNLOCK_KEY, "1"),
  clear: () => sessionStorage.removeItem(UNLOCK_KEY),
};
