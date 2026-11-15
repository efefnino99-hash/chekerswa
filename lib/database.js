
import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

// ==========================================
// SUPABASE CLIENT
// ==========================================

if (!config.supabaseUrl || !config.supabaseKey) {
  throw new Error(
    "SUPABASE_URL atau SUPABASE_SERVICE_ROLE_KEY belum diatur."
  );
}

const supabase = createClient(
  config.supabaseUrl,
  config.supabaseKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    global: {
      headers: {
        "X-Client-Info": "whatsapp-number-health-checker"
      }
    }
  }
);

// ==========================================
// HELPER
// ==========================================

function normalizeTelegramId(userId) {
  const telegramId = Number(userId);

  if (!Number.isSafeInteger(telegramId) || telegramId <= 0) {
    throw new Error("Telegram user ID tidak valid.");
  }

  return telegramId;
}

function normalizeProfile(data) {
  if (!data) return null;

  return {
    ...data,
    premium_until: data.vip_expires_at || null,
    is_vip: Boolean(data.is_vip)
  };
}

function validateDate(date) {
  if (
    typeof date !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(date)
  ) {
    throw new Error("Format tanggal harus YYYY-MM-DD.");
  }

  const parsed = new Date(`${date}T00:00:00.000Z`);

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new Error("Tanggal tidak valid.");
  }

  return date;
}

// ==========================================
// GET OR CREATE TELEGRAM PROFILE
// TABLE: bot_users
// ==========================================

export async function getProfile(user) {
  if (!user?.id) {
    throw new Error("Telegram user ID tidak valid.");
  }

  const telegramId = normalizeTelegramId(user.id);

  // Periksa profil yang sudah ada.
  const { data: existing, error: selectError } = await supabase
    .from("bot_users")
    .select("*")
    .eq("telegram_id", telegramId)
    .maybeSingle();

  if (selectError) {
    console.error("Profile lookup error:", selectError.message);
    throw selectError;
  }

  // Data dasar.
  const profileData = {
    telegram_id: telegramId,
    updated_at: new Date().toISOString()
  };

  // Jangan menghapus data lama jika properti tidak dikirim.
  if (user.username !== undefined) {
    profileData.username = user.username || null;
  }

  if (user.first_name !== undefined) {
    profileData.first_name = user.first_name || null;
  }

  // Buat profil baru atau perbarui data yang dikirim.
  const { error: upsertError } = await supabase
    .from("bot_users")
    .upsert(profileData, {
      onConflict: "telegram_id"
    });

  if (upsertError) {
    console.error("Profile upsert error:", upsertError.message);
    throw upsertError;
  }

  // Ambil data profil terbaru.
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
  const telegramId = normalizeTelegramId(userId);
  const usageDate = validateDate(date);

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

  if (data.last_check_date !== usageDate) {
    return 0;
  }

  return Number(data.daily_checks || 0);
}

// ==========================================
// CONSUME DAILY QUOTA
// RPC: consume_quota
// ==========================================

export async function consumeQuota(userId, date, limit) {
  const telegramId = normalizeTelegramId(userId);
  const usageDate = validateDate(date);
  const dailyLimit = Number(limit);

  if (
    !Number.isSafeInteger(dailyLimit) ||
    dailyLimit < 1
  ) {
    throw new Error("Daily quota limit tidak valid.");
  }

  const { data, error } = await supabase.rpc(
    "consume_quota",
    {
      p_telegram_id: telegramId,
      p_usage_date: usageDate,
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
  const telegramId = normalizeTelegramId(userId);
  const duration = Number(days);

  if (
    !Number.isSafeInteger(duration) ||
    duration < 1 ||
    duration > 3650
  ) {
    throw new Error(
      "Durasi premium harus antara 1 sampai 3650 hari."
    );
  }

  // Pastikan profil pengguna tersedia.
  const profile = await getProfile({
    id: telegramId
  });

  const now = new Date();

  const currentExpiry = profile.vip_expires_at
    ? new Date(profile.vip_expires_at)
    : now;

  const start = currentExpiry > now
    ? new Date(currentExpiry)
    : new Date(now);

  start.setDate(start.getDate() + duration);

  const expiry = start.toISOString();

  const { data, error } = await supabase
    .from("bot_users")
    .update({
      is_vip: true,
      vip_expires_at: expiry,
      updated_at: new Date().toISOString()
    })
    .eq("telegram_id", telegramId)
    .select("*")
    .single();

  if (error) {
    console.error("Grant premium error:", error.message);
    throw error;
  }

  return normalizeProfile(data);
}

// ==========================================
// REVOKE PREMIUM
// TABLE: bot_users
// ==========================================

export async function revokePremium(userId) {
  const telegramId = normalizeTelegramId(userId);

  const { data, error } = await supabase
    .from("bot_users")
    .update({
      is_vip: false,
      vip_expires_at: null,
      updated_at: new Date().toISOString()
    })
    .eq("telegram_id", telegramId)
    .select("telegram_id,is_vip,vip_expires_at")
    .maybeSingle();

  if (error) {
    console.error("Revoke premium error:", error.message);
    throw error;
  }

  if (!data) {
    throw new Error("Pengguna tidak ditemukan.");
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
    console.error(
      "Supabase connection failed:",
      error.message
    );

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
