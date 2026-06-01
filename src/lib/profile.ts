import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export type Profile = {
  user_id: string;
  full_name: string;
  cpf: string | null;
  birth_date: string | null;
  phone: string | null;
  alert_threshold: number;
};

export function useProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Profile | null> => {
      const { data, error } = await supabase
        .from("profiles").select("*").eq("user_id", user!.id).maybeSingle();
      if (error) throw error;
      return (data as Profile | null) ?? null;
    },
  });
}

export function useCustomCategories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["custom-categories", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("custom_categories").select("name").order("name");
      if (error) throw error;
      return (data ?? []).map((c) => c.name);
    },
  });
}

export async function useMonthlyIncome(userId: string, year: number, month: number) {
  const { data } = await supabase
    .from("monthly_income").select("amount")
    .eq("year", year).eq("month", month).maybeSingle();
  return data?.amount ? Number(data.amount) : 0;
}
