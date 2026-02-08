import { supabase } from "@/lib/supabase";
import type { Profile } from "@/context/auth";

export interface Transaction {
  id: string;
  class_id: string;
  profile_id: string;
  type: "deposit" | "deduction";
  amount: number;
  balance_before: number;
  balance_after: number;
  note: string | null;
  created_at: string;
}

export interface ClassData {
  id: string;
  name: string;
  daily_amount: number;
  invite_code: string;
  president_id: string;
  created_at: string;
}

export interface NoClassDate {
  id: string;
  class_id: string;
  date: string;
  reason: string;
  created_at: string;
}

// --- Classes ---

export async function createClass(name: string, dailyAmount = 10) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("classes")
    .insert({ name, daily_amount: dailyAmount, president_id: user.id })
    .select()
    .single();
  if (error) throw error;

  await supabase
    .from("profiles")
    .update({ class_id: data.id, role: "president" })
    .eq("id", user.id);

  return data as ClassData;
}

export async function getMyClass(classId: string) {
  const { data, error } = await supabase
    .from("classes")
    .select("*")
    .eq("id", classId)
    .single();
  if (error) throw error;
  return data as ClassData;
}

export async function joinClass(inviteCode: string) {
  const { data: classData, error: findError } = await supabase
    .from("classes")
    .select("*")
    .eq("invite_code", inviteCode.toUpperCase())
    .single();
  if (findError || !classData) throw new Error("Invalid invite code");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("profiles")
    .update({ class_id: classData.id })
    .eq("id", user.id);
  if (error) throw error;

  return classData as ClassData;
}

// --- Students ---

export async function getClassMembers(classId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("class_id", classId)
    .order("name");
  if (error) throw error;
  return data as Profile[];
}

export async function toggleStudentActive(
  studentId: string,
  isActive: boolean
) {
  const { error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", studentId);
  if (error) throw error;
}

// --- Payments ---

export async function recordDeposit(
  studentId: string,
  classId: string,
  amount: number,
  note?: string
) {
  const { data: student, error: fetchErr } = await supabase
    .from("profiles")
    .select("balance")
    .eq("id", studentId)
    .single();
  if (fetchErr || !student) throw new Error("Student not found");

  const balanceBefore = student.balance;
  const balanceAfter = balanceBefore + amount;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: txnErr } = await supabase.from("transactions").insert({
    class_id: classId,
    profile_id: studentId,
    type: "deposit",
    amount,
    balance_before: balanceBefore,
    balance_after: balanceAfter,
    note: note || "Cash payment",
    created_by: user?.id,
  });
  if (txnErr) throw txnErr;

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ balance: balanceAfter })
    .eq("id", studentId);
  if (updateErr) throw updateErr;

  return { balanceBefore, balanceAfter };
}

// --- Transactions ---

export async function getMyTransactions(profileId: string, limit = 50) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data as Transaction[];
}

export async function getClassTransactions(classId: string, limit = 100) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*, profiles:profile_id(name)")
    .eq("class_id", classId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

// --- Calendar ---

export async function getNoClassDates(classId: string) {
  const { data, error } = await supabase
    .from("no_class_dates")
    .select("*")
    .eq("class_id", classId)
    .order("date");
  if (error) throw error;
  return data as NoClassDate[];
}

export async function addNoClassDate(
  classId: string,
  date: string,
  reason: string
) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("no_class_dates")
    .insert({ class_id: classId, date, reason, created_by: user?.id })
    .select()
    .single();
  if (error) throw error;
  return data as NoClassDate;
}

export async function removeNoClassDate(dateId: string) {
  const { error } = await supabase
    .from("no_class_dates")
    .delete()
    .eq("id", dateId);
  if (error) throw error;
}

// --- Audit ---

export async function getClassFundSummary(classId: string) {
  const { data: members, error } = await supabase
    .from("profiles")
    .select("balance, is_active")
    .eq("class_id", classId);
  if (error) throw error;

  const totalBalance = members.reduce((sum, m) => sum + m.balance, 0);
  const activeCount = members.filter((m) => m.is_active).length;
  const totalMembers = members.length;
  const inDebt = members.filter((m) => m.balance < 0).length;

  return { totalBalance, activeCount, totalMembers, inDebt };
}
