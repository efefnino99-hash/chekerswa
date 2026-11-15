import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

const supabase = createClient(config.supabaseUrl, config.supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

export async function getProfile(user) {
  const { error: upsertError } = await supabase
    .from("profiles")
    .upsert({
      telegram_id: user.id,
      username: user.username || null
    }, {
      onConflict: "telegram_id",
      ignoreDuplicates: true
    });

  if (upsertError) throw upsertError;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("telegram_id", user.id)
    .single();

  if (error) throw error;
  return data;
}

export async function getUsage(userId, date) {
  const { data, error } = await supabase
    .from("usage_daily")
    .select("used")
    .eq("telegram_id", userId)
    .eq("usage_date", date)
    .maybeSingle();

  if (error) throw error;
  return data?.used || 0;
}

export async function consumeQuota(userId, date, limit) {
  const { data, error } = await supabase.rpc("consume_quota", {
    p_telegram_id: userId,
    p_usage_date: date,
    p_limit: limit
  });

  if (error) throw error;
  return data === true;
}

export async function grantPremium(userId, days) {
  const profile = await getProfile({ id: userId });
  const currentExpiry = profile.premium_until
    ? new Date(profile.premium_until)
    : new Date();
  const start = currentExpiry > new Date() ? currentExpiry : new Date();
  start.setDate(start.getDate() + days);

  const { error } = await supabase
    .from("profiles")
    .update({ premium_until: start.toISOString() })
    .eq("telegram_id", userId);

  if (error) throw error;
  return start;
}

export async function revokePremium(userId) {
  const { error } = await supabase
    .from("profiles")
    .update({ premium_until: null })
    .eq("telegram_id", userId);

  if (error) throw error;
}
