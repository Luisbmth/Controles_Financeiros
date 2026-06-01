-- 1. profiles table
CREATE TABLE public.profiles (
  user_id uuid NOT NULL PRIMARY KEY,
  full_name text NOT NULL,
  cpf text,
  birth_date date,
  phone text,
  alert_threshold numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own profile delete" ON public.profiles FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. custom_categories
CREATE TABLE public.custom_categories (
  id uuid NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_categories TO authenticated;
GRANT ALL ON public.custom_categories TO service_role;
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cat select" ON public.custom_categories FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own cat insert" ON public.custom_categories FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "own cat delete" ON public.custom_categories FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 3. bills: flag de gasto avulso
ALTER TABLE public.bills ADD COLUMN is_one_off boolean NOT NULL DEFAULT false;
CREATE INDEX bills_one_off_idx ON public.bills (user_id, due_date) WHERE is_one_off = true;