import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { startOfMonth, endOfMonth, format } from "date-fns";
import { useEffect, useRef } from "react";

export type Bill = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category: string;
  due_date: string;
  paid_at: string | null;
  notes: string | null;
  installment_number: number | null;
  installment_total: number | null;
  installment_group: string | null;
  fixed_bill_id: string | null;
  is_one_off: boolean;
  status: "pending" | "paid";
};

export type FixedBill = {
  id: string;
  user_id: string;
  name: string;
  amount: number;
  category: string;
  day_of_month: number;
  notes: string | null;
  active: boolean;
};

export function useMonthBills(year: number, month: number) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Auto-generate this month's fixed bills (once per mount per month)
  const generatedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!user) return;
    const key = `${user.id}-${year}-${month}`;
    if (generatedRef.current === key) return;
    generatedRef.current = key;
    (async () => {
      const { data: fixed } = await supabase
        .from("fixed_bills").select("*").eq("active", true);
      if (!fixed?.length) return;
      const { data: existing } = await supabase
        .from("bills").select("fixed_bill_id")
        .gte("due_date", format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd"))
        .lte("due_date", format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd"))
        .not("fixed_bill_id", "is", null);
      const have = new Set((existing ?? []).map((b) => b.fixed_bill_id));
      const toInsert = fixed.filter((f) => !have.has(f.id)).map((f) => {
        const lastDay = endOfMonth(new Date(year, month - 1)).getDate();
        const day = Math.min(f.day_of_month, lastDay);
        return {
          user_id: user.id,
          name: f.name,
          amount: f.amount,
          category: f.category,
          due_date: format(new Date(year, month - 1, day), "yyyy-MM-dd"),
          notes: f.notes,
          fixed_bill_id: f.id,
        };
      });
      if (toInsert.length) {
        await supabase.from("bills").insert(toInsert);
        qc.invalidateQueries({ queryKey: ["bills"] });
      }
    })();
  }, [user, year, month, qc]);

  return useQuery({
    queryKey: ["bills", year, month, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = format(startOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
      const end = format(endOfMonth(new Date(year, month - 1)), "yyyy-MM-dd");
      const { data, error } = await supabase
        .from("bills").select("*")
        .gte("due_date", start).lte("due_date", end)
        .order("due_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Bill[];
    },
  });
}

export async function togglePaid(bill: Bill) {
  if (bill.status === "paid") {
    return supabase.from("bills").update({ status: "pending", paid_at: null }).eq("id", bill.id);
  }
  return supabase.from("bills").update({ status: "paid", paid_at: new Date().toISOString() }).eq("id", bill.id);
}
