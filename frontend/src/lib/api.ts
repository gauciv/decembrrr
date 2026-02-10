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
  date_initiated: string;
  collection_days: number[];
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
  dateInitiated?: string;
  collectionDays?: number[];
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
      date_initiated: input.dateInitiated ?? new Date().toISOString().slice(0, 10),
      collection_days: input.collectionDays ?? [1, 2, 3, 4, 5],
      president_id: user.id,
    })
    .select()
    .single();
  if (error) throw new AppError(ErrorCode.CLASS_CREATE_FAILED, error.message);

  await supabase
    .from("profiles")
    .update({ class_id: data.id, is_president: true })
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

export interface UpdateClassInput {
  name?: string;
  dailyAmount?: number;
  fundGoal?: number | null;
  dateInitiated?: string;
  collectionDays?: number[];
}

export async function updateClass(classId: string, input: UpdateClassInput) {
  const updates: Record<string, unknown> = {};
  if (input.name !== undefined) updates.name = input.name;
  if (input.dailyAmount !== undefined) updates.daily_amount = input.dailyAmount;
  if (input.fundGoal !== undefined) updates.fund_goal = input.fundGoal;
  if (input.dateInitiated !== undefined) updates.date_initiated = input.dateInitiated;
  if (input.collectionDays !== undefined) updates.collection_days = input.collectionDays;

  const { data, error } = await supabase
    .from("classes")
    .update(updates)
    .eq("id", classId)
    .select()
    .single();
  if (error) throw new AppError(ErrorCode.CLASS_CREATE_FAILED, error.message);
  return data as ClassData;
}

export async function deleteClass(classId: string) {
  // Remove all member references first
  const { error: profileErr } = await supabase
    .from("profiles")
    .update({ class_id: null, is_president: false })
    .eq("class_id", classId);
  if (profileErr) throw resolveError(profileErr);

  const { error } = await supabase
    .from("classes")
    .delete()
    .eq("id", classId);
  if (error) throw resolveError(error);
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

export async function removeStudentFromClass(studentId: string) {
  const { error } = await supabase
    .from("profiles")
    .update({ class_id: null, is_president: false, balance: 0 })
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

/** Paginated transaction query for the student Transactions tab */
export async function getMyTransactionsPaginated(
  profileId: string,
  page: number,
  pageSize = 20
) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, error, count } = await supabase
    .from("transactions")
    .select("*", { count: "exact" })
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw resolveError(error);
  return {
    transactions: data as Transaction[],
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.ceil((count ?? 0) / pageSize),
  };
}

/** Fetch recent deductions only (for the student Home tab) */
export async function getMyRecentDeductions(profileId: string, limit = 10) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("profile_id", profileId)
    .eq("type", "deduction")
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

/** Rollback a no-class date: reverses deductions and marks the date as no-class */
export async function rollbackNoClassDate(classId: string, date: string) {
  const { data, error } = await supabase.rpc("rollback_no_class_date", {
    p_class_id: classId,
    p_date: date,
  });
  if (error) throw resolveError(error);
  return data as { status: string; date: string; rolled_back: number };
}

/** Check if a given date is a collection day for the class */
export function isCollectionDay(
  date: Date,
  collectionDays: number[],
  dateInitiated: string,
  noClassDates: Set<string>,
): boolean {
  const initiated = new Date(dateInitiated + "T00:00:00");
  if (date < initiated) return false;
  // ISO weekday: 1=Mon … 7=Sun (JS getDay: 0=Sun … 6=Sat)
  const jsDay = date.getDay();
  const isoDay = jsDay === 0 ? 7 : jsDay;
  if (!collectionDays.includes(isoDay)) return false;
  const dateStr = date.toISOString().slice(0, 10);
  if (noClassDates.has(dateStr)) return false;
  return true;
}

// --- Audit ---

export async function getClassFundSummary(classId: string) {
  const [membersResult, deductionsResult, depositsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("balance, is_active")
      .eq("class_id", classId),
    supabase
      .from("transactions")
      .select("amount")
      .eq("class_id", classId)
      .eq("type", "deduction"),
    supabase
      .from("transactions")
      .select("amount")
      .eq("class_id", classId)
      .eq("type", "deposit"),
  ]);
  if (membersResult.error) throw resolveError(membersResult.error);
  if (deductionsResult.error) throw resolveError(deductionsResult.error);
  if (depositsResult.error) throw resolveError(depositsResult.error);

  const members = membersResult.data as Array<{ balance: number; is_active: boolean }>;
  const totalDeductions = (deductionsResult.data as Array<{ amount: number }>).reduce((s, t) => s + t.amount, 0);
  const totalDeposits = (depositsResult.data as Array<{ amount: number }>).reduce((s, t) => s + t.amount, 0);

  // Class fund = deposits received minus refunds. Net collected amount.
  // Since deductions reduce member balance and deposits increase it,
  // the fund collected is deductions - deposits (deposits go back to student).
  const totalCollected = totalDeductions - totalDeposits;
  const activeCount = members.filter((m) => m.is_active).length;
  const totalMembers = members.length;

  return { totalBalance: Math.max(0, totalCollected), activeCount, totalMembers };
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

// --- Student CSV Export ---

/** Export a single student's transactions as CSV (for student Transactions tab) */
export async function exportMyTransactionsCsv(profileId: string, studentName: string) {
  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("profile_id", profileId)
    .order("created_at", { ascending: false });
  if (error) throw resolveError(error);

  const header = "Date,Type,Amount,Balance Before,Balance After,Note";
  const rows = (data as Transaction[]).map((t) => {
    const date = new Date(t.created_at).toLocaleString("en-PH");
    const escapeCsv = (s: string) => `"${s.replace(/"/g, '""')}"`;
    return [
      escapeCsv(date),
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
  a.download = `${studentName.replace(/\s+/g, "-").toLowerCase()}-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Class Status ---

/** Get today's payment status for all class members (for student Class tab) */
export async function getClassTodayStatus(classId: string) {
  const today = new Date().toISOString().slice(0, 10);

  const [membersResult, todayTxnsResult] = await Promise.all([
    supabase.from("profiles").select("id, name, avatar_url").eq("class_id", classId).order("name"),
    supabase
      .from("transactions")
      .select("profile_id")
      .eq("class_id", classId)
      .eq("type", "deposit")
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`),
  ]);

  if (membersResult.error) throw resolveError(membersResult.error);
  if (todayTxnsResult.error) throw resolveError(todayTxnsResult.error);

  const paidIds = new Set(
    (todayTxnsResult.data as Array<{ profile_id: string }>).map((t) => t.profile_id)
  );

  return (membersResult.data as Array<{ id: string; name: string; avatar_url: string | null }>).map(
    (m) => ({ ...m, paidToday: paidIds.has(m.id) })
  );
}

/** Get today's deduction status for all class members (president Home tab) */
export async function getClassDeductionStatus(classId: string) {
  const today = new Date().toISOString().slice(0, 10);

  const [membersResult, deductionResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, avatar_url, balance")
      .eq("class_id", classId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("transactions")
      .select("profile_id")
      .eq("class_id", classId)
      .eq("type", "deduction")
      .gte("created_at", `${today}T00:00:00`)
      .lte("created_at", `${today}T23:59:59`),
  ]);

  if (membersResult.error) throw resolveError(membersResult.error);
  if (deductionResult.error) throw resolveError(deductionResult.error);

  const deductedIds = new Set(
    (deductionResult.data as Array<{ profile_id: string }>).map((t) => t.profile_id)
  );

  type Member = { id: string; name: string; avatar_url: string | null; balance: number };
  return (membersResult.data as Member[]).map((m) => ({
    ...m,
    deductedToday: deductedIds.has(m.id),
  }));
}

/** Weekly deposit analytics for a class (current week vs last week) */
export async function getWeeklyAnalytics(classId: string) {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + mondayOffset);
  thisMonday.setHours(0, 0, 0, 0);

  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);

  const thisMondayStr = thisMonday.toISOString().slice(0, 10);
  const lastMondayStr = lastMonday.toISOString().slice(0, 10);
  const todayStr = now.toISOString().slice(0, 10);

  const [thisWeekResult, lastWeekResult, membersResult] = await Promise.all([
    supabase
      .from("transactions")
      .select("amount, created_at")
      .eq("class_id", classId)
      .eq("type", "deposit")
      .gte("created_at", `${thisMondayStr}T00:00:00`)
      .lte("created_at", `${todayStr}T23:59:59`),
    supabase
      .from("transactions")
      .select("amount, created_at")
      .eq("class_id", classId)
      .eq("type", "deposit")
      .gte("created_at", `${lastMondayStr}T00:00:00`)
      .lt("created_at", `${thisMondayStr}T00:00:00`),
    supabase
      .from("profiles")
      .select("id")
      .eq("class_id", classId)
      .eq("is_active", true),
  ]);

  if (thisWeekResult.error) throw resolveError(thisWeekResult.error);
  if (lastWeekResult.error) throw resolveError(lastWeekResult.error);
  if (membersResult.error) throw resolveError(membersResult.error);

  type TxnRow = { amount: number; created_at: string };
  const thisWeekTotal = (thisWeekResult.data as TxnRow[]).reduce((s, t) => s + t.amount, 0);
  const lastWeekTotal = (lastWeekResult.data as TxnRow[]).reduce((s, t) => s + t.amount, 0);
  const thisWeekCount = thisWeekResult.data.length;
  const lastWeekCount = lastWeekResult.data.length;
  const activeMembers = membersResult.data.length;

  return {
    thisWeekTotal,
    lastWeekTotal,
    thisWeekCount,
    lastWeekCount,
    activeMembers,
    weekStartDate: thisMondayStr,
  };
}

/** Calendar heatmap data: daily deposit percentage for a given month */
export async function getMonthlyHeatmap(classId: string, year: number, month: number) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const [txnsResult, membersResult] = await Promise.all([
    supabase
      .from("transactions")
      .select("profile_id, created_at")
      .eq("class_id", classId)
      .eq("type", "deposit")
      .gte("created_at", startDate)
      .lt("created_at", endDate),
    supabase
      .from("profiles")
      .select("id")
      .eq("class_id", classId)
      .eq("is_active", true),
  ]);

  if (txnsResult.error) throw resolveError(txnsResult.error);
  if (membersResult.error) throw resolveError(membersResult.error);

  const totalMembers = membersResult.data.length;
  const dailyPayers = new Map<string, Set<string>>();

  for (const txn of txnsResult.data as Array<{ profile_id: string; created_at: string }>) {
    const dateKey = txn.created_at.slice(0, 10);
    if (!dailyPayers.has(dateKey)) dailyPayers.set(dateKey, new Set());
    dailyPayers.get(dateKey)!.add(txn.profile_id);
  }

  const heatmap = new Map<string, number>();
  for (const [date, payers] of dailyPayers) {
    heatmap.set(date, totalMembers > 0 ? Math.round((payers.size / totalMembers) * 100) : 0);
  }

  return { heatmap, totalMembers };
}

/** Personal student calendar: returns the set of dates the student has a deposit */
export async function getStudentMonthlyCalendar(
  profileId: string,
  classId: string,
  year: number,
  month: number
) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("transactions")
    .select("created_at")
    .eq("profile_id", profileId)
    .eq("class_id", classId)
    .eq("type", "deposit")
    .gte("created_at", startDate)
    .lt("created_at", endDate);

  if (error) throw resolveError(error);

  const paidDates = new Set<string>();
  for (const txn of data as Array<{ created_at: string }>) {
    paidDates.add(txn.created_at.slice(0, 10));
  }
  return paidDates;
}

/** Look up a student by their profile ID (for QR scan) */
export async function getStudentById(studentId: string) {
  const { data, error } = await supabase.rpc("lookup_student", {
    student_id: studentId,
  });
  if (error || !data) throw new AppError(ErrorCode.PAYMENT_STUDENT_NOT_FOUND);

  const result = data as {
    found: boolean;
    id?: string;
    name?: string;
    avatar_url?: string | null;
    balance?: number;
    is_active?: boolean;
    in_class?: boolean;
  };

  if (!result.found) throw new AppError(ErrorCode.PAYMENT_STUDENT_NOT_FOUND);
  if (!result.in_class) throw new AppError(ErrorCode.PAYMENT_STUDENT_NOT_IN_CLASS, result.name ?? undefined);

  return {
    id: result.id!,
    name: result.name!,
    avatar_url: result.avatar_url ?? null,
    balance: result.balance!,
    is_active: result.is_active!,
  } as { id: string; name: string; avatar_url: string | null; balance: number; is_active: boolean };
}

// --- Wallet / Fund Details ---

export interface WalletSummary {
  totalBalance: number;
  totalDeposits: number;
  totalDeductions: number;
  activeMembers: number;
  totalMembers: number;
  memberBalances: Array<{
    id: string;
    name: string;
    avatar_url: string | null;
    email: string;
    balance: number;
    is_active: boolean;
  }>;
}

/** Full wallet summary for the president Wallet tab */
export async function getWalletSummary(classId: string): Promise<WalletSummary> {
  const [membersResult, depositsResult, deductionsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, name, avatar_url, email, balance, is_active")
      .eq("class_id", classId)
      .order("name"),
    supabase
      .from("transactions")
      .select("amount")
      .eq("class_id", classId)
      .eq("type", "deposit"),
    supabase
      .from("transactions")
      .select("amount")
      .eq("class_id", classId)
      .eq("type", "deduction"),
  ]);

  if (membersResult.error) throw resolveError(membersResult.error);
  if (depositsResult.error) throw resolveError(depositsResult.error);
  if (deductionsResult.error) throw resolveError(deductionsResult.error);

  type MemberRow = { id: string; name: string; avatar_url: string | null; email: string; balance: number; is_active: boolean };
  const members = membersResult.data as MemberRow[];
  const totalDeposits = (depositsResult.data as Array<{ amount: number }>).reduce((s, t) => s + t.amount, 0);
  const totalDeductions = (deductionsResult.data as Array<{ amount: number }>).reduce((s, t) => s + t.amount, 0);

  return {
    totalBalance: totalDeductions - totalDeposits,
    totalDeposits,
    totalDeductions,
    activeMembers: members.filter((m) => m.is_active).length,
    totalMembers: members.length,
    memberBalances: members,
  };
}

// --- Student Payment Stats (for email) ---

export interface StudentPaymentStats {
  studentName: string;
  studentEmail: string;
  totalExpectedDays: number;
  totalDeposits: number;
  totalDeductions: number;
  missedDays: number;
  completionPercent: number;
  currentBalance: number;
  transactions: Transaction[];
}

/** Calculate a student's full payment stats for email summary */
export async function getStudentPaymentStats(
  profileId: string,
  classId: string,
): Promise<StudentPaymentStats> {
  const [studentResult, classResult, txnsResult, noClassResult] = await Promise.all([
    supabase.from("profiles").select("name, email, balance").eq("id", profileId).single(),
    supabase.from("classes").select("created_at, daily_amount, date_initiated, collection_days").eq("id", classId).single(),
    supabase
      .from("transactions")
      .select("*")
      .eq("profile_id", profileId)
      .eq("class_id", classId)
      .order("created_at", { ascending: false }),
    supabase.from("no_class_dates").select("date").eq("class_id", classId),
  ]);

  if (studentResult.error) throw resolveError(studentResult.error);
  if (classResult.error) throw resolveError(classResult.error);
  if (txnsResult.error) throw resolveError(txnsResult.error);
  if (noClassResult.error) throw resolveError(noClassResult.error);

  const student = studentResult.data as { name: string; email: string; balance: number };
  const classInfo = classResult.data as { created_at: string; daily_amount: number; date_initiated: string; collection_days: number[] };
  const txns = txnsResult.data as Transaction[];
  const noClassDates = new Set(
    (noClassResult.data as Array<{ date: string }>).map((d) => d.date)
  );

  // Count collection days from date_initiated to today
  const startDate = new Date(classInfo.date_initiated + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let totalExpectedDays = 0;
  const cursor = new Date(startDate);
  while (cursor <= today) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const jsDay = cursor.getDay();
    const isoDay = jsDay === 0 ? 7 : jsDay;
    if (classInfo.collection_days.includes(isoDay) && !noClassDates.has(dateStr)) {
      totalExpectedDays++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  const totalDeposits = txns.filter((t) => t.type === "deposit").length;
  const totalDeductions = txns.filter((t) => t.type === "deduction").length;
  const missedDays = Math.max(0, totalExpectedDays - totalDeposits);
  const completionPercent =
    totalExpectedDays > 0 ? Math.round((totalDeposits / totalExpectedDays) * 100) : 100;

  return {
    studentName: student.name,
    studentEmail: student.email,
    totalExpectedDays,
    totalDeposits,
    totalDeductions,
    missedDays,
    completionPercent,
    currentBalance: student.balance,
    transactions: txns,
  };
}

/** Build a mailto: URI with pre-filled payment stats email */
export function buildStudentEmailUri(stats: StudentPaymentStats, className: string): string {
  const subject = `Decembrrr – Payment Summary for ${className}`;

  const depositAmt = stats.transactions
    .filter((t) => t.type === "deposit")
    .reduce((s, t) => s + t.amount, 0);
  const deductionAmt = stats.transactions
    .filter((t) => t.type === "deduction")
    .reduce((s, t) => s + t.amount, 0);

  let body = `Hi ${stats.studentName},\n\n`;
  body += `Here's your payment summary for ${className}:\n\n`;
  body += `────────────────────────\n`;
  body += `📊 PAYMENT STATS\n`;
  body += `────────────────────────\n`;
  body += `Total expected payment days: ${stats.totalExpectedDays}\n`;
  body += `Payments completed: ${stats.totalDeposits}/${stats.totalExpectedDays} (${stats.completionPercent}%)\n`;
  body += `Days missed: ${stats.missedDays}\n`;
  body += `Current balance: ₱${stats.currentBalance.toFixed(2)}\n`;
  body += `Total deposited: ₱${depositAmt.toFixed(2)}\n`;
  body += `Total deducted: ₱${deductionAmt.toFixed(2)}\n\n`;
  body += `────────────────────────\n`;
  body += `📝 TRANSACTION LOG\n`;
  body += `────────────────────────\n`;

  const recentTxns = stats.transactions.slice(0, 50);
  for (const txn of recentTxns) {
    const date = new Date(txn.created_at).toLocaleDateString("en-PH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const sign = txn.type === "deposit" ? "+" : "-";
    body += `${date}  ${sign}₱${txn.amount.toFixed(2)}  ${txn.note || txn.type}  (bal: ₱${txn.balance_after.toFixed(2)})\n`;
  }
  if (stats.transactions.length > 50) {
    body += `… and ${stats.transactions.length - 50} more\n`;
  }

  body += `\n— Sent via Decembrrr 🎄`;

  return `mailto:${encodeURIComponent(stats.studentEmail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Get a student's transaction dates for the payment calendar view */
export async function getMyTransactionDates(
  profileId: string,
  year: number,
  month: number
) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate =
    month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("transactions")
    .select("type, created_at")
    .eq("profile_id", profileId)
    .gte("created_at", startDate)
    .lt("created_at", endDate)
    .order("created_at");
  if (error) throw resolveError(error);

  // Build a map of date → { hasDeposit, hasDeduction }
  const dateMap = new Map<string, { hasDeposit: boolean; hasDeduction: boolean }>();
  for (const txn of data as Array<{ type: string; created_at: string }>) {
    const dateKey = txn.created_at.slice(0, 10);
    const existing = dateMap.get(dateKey) ?? { hasDeposit: false, hasDeduction: false };
    if (txn.type === "deposit") existing.hasDeposit = true;
    if (txn.type === "deduction") existing.hasDeduction = true;
    dateMap.set(dateKey, existing);
  }

  return dateMap;
}
