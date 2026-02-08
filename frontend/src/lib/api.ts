import { supabase } from "@/lib/supabase";
import { AppError, ErrorCode, resolveError } from "@/lib/errors";
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
  fund_goal: number | null;
  collection_frequency: "daily" | "weekly";
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

export interface CreateClassInput {
  name: string;
  dailyAmount?: number;
  fundGoal?: number | null;
  collectionFrequency?: "daily" | "weekly";
}

export async function createClass(input: CreateClassInput) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AppError(ErrorCode.AUTH_NOT_AUTHENTICATED);

  const { data, error } = await supabase
    .from("classes")
    .insert({
      name: input.name,
      daily_amount: input.dailyAmount ?? 10,
      fund_goal: input.fundGoal ?? null,
      collection_frequency: input.collectionFrequency ?? "daily",
      president_id: user.id,
    })
    .select()
    .single();
  if (error) throw new AppError(ErrorCode.CLASS_CREATE_FAILED, error.message);

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
  if (error) throw new AppError(ErrorCode.CLASS_NOT_FOUND, error.message);
  return data as ClassData;
}

export async function joinClass(inviteCode: string) {
  const { data: classData, error: findError } = await supabase
    .from("classes")
    .select("*")
    .eq("invite_code", inviteCode.toUpperCase())
    .single();
  if (findError || !classData) throw new AppError(ErrorCode.CLASS_INVITE_INVALID);

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new AppError(ErrorCode.AUTH_NOT_AUTHENTICATED);

  const { error } = await supabase
    .from("profiles")
    .update({ class_id: classData.id })
    .eq("id", user.id);
  if (error) throw resolveError(error);

  return classData as ClassData;
}

// --- Students ---

export async function getClassMembers(classId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("class_id", classId)
    .order("name");
  if (error) throw resolveError(error);
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
  if (error) throw resolveError(error);
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
  if (fetchErr || !student)
    throw new AppError(ErrorCode.PAYMENT_STUDENT_NOT_FOUND);

  if (amount <= 0) throw new AppError(ErrorCode.PAYMENT_INVALID_AMOUNT);

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
  if (txnErr)
    throw new AppError(ErrorCode.PAYMENT_RECORD_FAILED, txnErr.message);

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ balance: balanceAfter })
    .eq("id", studentId);
  if (updateErr)
    throw new AppError(ErrorCode.PAYMENT_RECORD_FAILED, updateErr.message);

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
  if (error) throw resolveError(error);
  return data as Transaction[];
}

export async function getClassTransactions(classId: string, limit = 100) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*, profiles:profile_id(name)")
    .eq("class_id", classId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw resolveError(error);
  return data;
}

// --- Calendar ---

export async function getNoClassDates(classId: string) {
  const { data, error } = await supabase
    .from("no_class_dates")
    .select("*")
    .eq("class_id", classId)
    .order("date");
  if (error) throw resolveError(error);
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
  if (error) throw resolveError(error);
  return data as NoClassDate;
}

export async function removeNoClassDate(dateId: string) {
  const { error } = await supabase
    .from("no_class_dates")
    .delete()
    .eq("id", dateId);
  if (error) throw resolveError(error);
}

// --- Audit ---

export async function getClassFundSummary(classId: string) {
  const { data: members, error } = await supabase
    .from("profiles")
    .select("balance, is_active")
    .eq("class_id", classId);
  if (error) throw resolveError(error);

  const totalBalance = members.reduce((sum, m) => sum + m.balance, 0);
  const activeCount = members.filter((m) => m.is_active).length;
  const totalMembers = members.length;
  const inDebt = members.filter((m) => m.balance < 0).length;

  return { totalBalance, activeCount, totalMembers, inDebt };
}

// --- CSV Export ---

/** Build a CSV string of all class transactions and trigger download */
export async function exportTransactionsCsv(classId: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*, profiles:profile_id(name, email)")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
  if (error) throw resolveError(error);

  const header = "Date,Student,Email,Type,Amount,Balance Before,Balance After,Note";
  const rows = (data as Array<{
    created_at: string;
    profiles: { name: string; email: string } | null;
    type: string;
    amount: number;
    balance_before: number;
    balance_after: number;
    note: string | null;
  }>).map((t) => {
    const date = new Date(t.created_at).toLocaleString("en-PH");
    const name = t.profiles?.name ?? "Unknown";
    const email = t.profiles?.email ?? "";
    const escapeCsv = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [
      escapeCsv(date),
      escapeCsv(name),
      escapeCsv(email),
      t.type,
      t.amount.toFixed(2),
      t.balance_before.toFixed(2),
      t.balance_after.toFixed(2),
      escapeCsv(t.note ?? ""),
    ].join(",");
  });

  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `decembrrr-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
