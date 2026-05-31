CREATE TABLE public.app_security (
  user_id UUID PRIMARY KEY,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  biometric_enabled BOOLEAN NOT NULL DEFAULT false,
  biometric_credential_id TEXT,
  biometric_public_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_security TO authenticated;
GRANT ALL ON public.app_security TO service_role;

ALTER TABLE public.app_security ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own security select" ON public.app_security FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own security insert" ON public.app_security FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own security update" ON public.app_security FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own security delete" ON public.app_security FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE TRIGGER app_security_set_updated_at
BEFORE UPDATE ON public.app_security
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();