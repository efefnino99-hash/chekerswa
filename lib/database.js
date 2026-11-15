
import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

// ==========================================
// SUPABASE CLIENT
// ==========================================

if (!config.supabaseUrl || !config.supabaseKey) {
  throw new Error("SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diatur.");
}

const supabase = createClient(
  config.supabaseUrl,
  config.supabaseKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// ==========================================
// HELPER
// ==========================================

function normalizeProfile(data) {
  if (!data) return null;

  return {
    ...data,
    premium_until: data.vip_expires_at || null
  };
}

// ==========================================
// GET OR CREATE TELEGRAM PROFILE
// TABLE: bot_users
// ==========================================

export async function getProfile(user) {
  if (!user?.id) {
    throw new Error("Telegram user ID tidak valid.");
  }

  const telegramId = Number(user.id);

  if (!Number.isSafeInteger(telegramId)) {
    throw new Error("Telegram user ID harus berupa integer.");
  }

  const { error: upsertError } = await supabase
    .from("bot_users")
    .upsert(
      {
        telegram_id: telegramId,
        username: user.username || null,
        first_name: user.first_name || null,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "telegram_id",
        ignoreDuplicates: true
      }
    );

  if (upsertError) {
    console.error("Profile upsert error:", upsertError.message);
    throw upsertError;
  }

  const { data, error } = await supabase
    .from("bot_users")
    .select("*")
    .eq("telegram_id", telegramId)
    .single();

  if (error) {
    console.error("Get profile error:", error.message);
    throw error;
  }

  return normalizeProfile(data);
}

// ==========================================
// GET DAILY USAGE
// TABLE: bot_users
// ==========================================

export async function getUsage(userId, date) {
  const telegramId = Number(userId);

  const { data, error } = await supabase
    .from("bot_users")
    .select("daily_checks,last_check_date")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (error) {
    console.error("Get usage error:", error.message);
    throw error;
  }

  if (!data) return 0;

  if (data.last_check_date !== date) {
    return 0;
  }

  return Number(data.daily_checks || 0);
}

// ==========================================
// CONSUME DAILY QUOTA
// RPC: consume_quota
// ==========================================

export async function consumeQuota(userId, date, limit) {
  const telegramId = Number(userId);
  const dailyLimit = Number(limit);

  if (!Number.isSafeInteger(telegramId)) {
    throw new Error("Telegram user ID tidak valid.");
  }

  if (!Number.isInteger(dailyLimit) || dailyLimit < 1) {
    throw new Error("Daily quota limit tidak valid.");
  }

  const { data, error } = await supabase.rpc(
    "consume_quota",
    {
      p_telegram_id: telegramId,
      p_usage_date: date,
      p_limit: dailyLimit
    }
  );

  if (error) {
    console.error("Consume quota error:", error.message);
    throw error;
  }

  return data === true;
}

// ==========================================
// GRANT PREMIUM
// TABLE: bot_users
// ==========================================

export async function grantPremium(userId, days) {
  const telegramId = Number(userId);
  const duration = Number(days);

  if (!Number.isSafeInteger(telegramId)) {
    throw new Error("Telegram user ID tidak valid.");
  }

  if (!Number.isInteger(duration) || duration < 1 || duration > 3650) {
    throw new Error("Durasi premium harus antara 1 sampai 3650 hari.");
  }

  const profile = await getProfile({
    id: telegramId
  });

  const currentExpiry = profile.vip_expires_at
    ? new Date(profile.vip_expires_at)
    : new Date();

  const now = new Date();

  const start = currentExpiry > now
    ? new Date(currentExpiry)
    : new Date(now);

  start.setDate(start.getDate() + duration);

  const expiry = start.toISOString();

  const { error } = await supabase
    .from("bot_users")
    .update({
      is_vip: true,
      vip_expires_at: expiry,
      updated_at: new Date().toISOString()
    })
    .eq("telegram_id", telegramId);

  if (error) {
    console.error("Grant premium error:", error.message);
    throw error;
  }

  return start;
}

// ==========================================
// REVOKE PREMIUM
// TABLE: bot_users
// ==========================================

export async function revokePremium(userId) {
  const telegramId = Number(userId);

  if (!Number.isSafeInteger(telegramId)) {
    throw new Error("Telegram user ID tidak valid.");
  }

  const { error } = await supabase
    .from("bot_users")
    .update({
      is_vip: false,
      vip_expires_at: null,
      updated_at: new Date().toISOString()
    })
    .eq("telegram_id", telegramId);

  if (error) {
    console.error("Revoke premium error:", error.message);
    throw error;
  }

  return true;
}

// ==========================================
// DATABASE CONNECTION TEST
// ==========================================

export async function testDatabaseConnection() {
  const { data, error } = await supabase
    .from("bot_users")
    .select("telegram_id")
    .limit(1);

  if (error) {
    console.error("Supabase connection failed:", error.message);

    return {
      success: false,
      message: error.message
    };
  }

  return {
    success: true,
    message: "Supabase connected successfully.",
    data
  };
}
