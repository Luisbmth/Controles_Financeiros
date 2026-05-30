
-- Enum for status
CREATE TYPE public.bill_status AS ENUM ('pending', 'paid');

-- Bills table (covers single, recurring instances, and installments)
CREATE TABLE public.bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  category TEXT NOT NULL DEFAULT 'Outros',
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  -- installment metadata
  installment_number INT,
  installment_total INT,
  installment_group UUID,
  -- recurring metadata (instance generated from a fixed bill)
  fixed_bill_id UUID,
  status public.bill_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX bills_user_due_idx ON public.bills (user_id, due_date);
CREATE INDEX bills_user_status_idx ON public.bills (user_id, status);

-- Fixed bills (templates that auto-generate monthly)
CREATE TABLE public.fixed_bills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  category TEXT NOT NULL DEFAULT 'Outros',
  day_of_month INT NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  notes TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Monthly income (visão do mês)
CREATE TABLE public.monthly_income (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  year INT NOT NULL,
  month INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, year, month)
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills TO authenticated;
GRANT ALL ON public.bills TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_bills TO authenticated;
GRANT ALL ON public.fixed_bills TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.monthly_income TO authenticated;
GRANT ALL ON public.monthly_income TO service_role;

-- RLS
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own bills select" ON public.bills FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own bills insert" ON public.bills FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own bills update" ON public.bills FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own bills delete" ON public.bills FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "own fixed select" ON public.fixed_bills FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own fixed insert" ON public.fixed_bills FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own fixed update" ON public.fixed_bills FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own fixed delete" ON public.fixed_bills FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "own income select" ON public.monthly_income FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own income insert" ON public.monthly_income FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own income update" ON public.monthly_income FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own income delete" ON public.monthly_income FOR DELETE TO authenticated USING (user_id = auth.uid());

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

CREATE TRIGGER trg_bills_updated BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_fixed_updated BEFORE UPDATE ON public.fixed_bills FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_income_updated BEFORE UPDATE ON public.monthly_income FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
