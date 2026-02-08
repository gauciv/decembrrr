const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async () => {
  const today = new Date()
    .toLocaleDateString("en-CA", { timeZone: "Asia/Manila" });

  console.log(`Running daily deduction for ${today}`);

  const { data, error } = await supabase.rpc("run_daily_deduction", {
    target_date: today,
  });

  if (error) {
    console.error("Deduction failed:", error);
    throw error;
  }

  console.log("Deduction result:", JSON.stringify(data));
  return data;
};
