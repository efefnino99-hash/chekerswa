const env = process.env;

const positiveInt = (value, fallback) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : fallback;
};

export const config = {
  botToken: env.BOT_TOKEN || "",
  webhookSecret: env.TELEGRAM_WEBHOOK_SECRET || "",
  supabaseUrl: env.SUPABASE_URL || "",
  supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY || "",
  admins: (env.BOT_OWNER_IDS || "")
    .split(",").map(x => x.trim()).filter(Boolean),
  freeLimit: positiveInt(env.FREE_DAILY_LIMIT, 5),
  premiumLimit: positiveInt(env.PREMIUM_DAILY_LIMIT, 100),
  maxBatchSize: Math.min(50, positiveInt(env.MAX_BATCH_SIZE, 50)),
  apiFallback: env.API_FALLBACK_ENABLED === "true",
  allowPaidLookups: env.ALLOW_PAID_LOOKUPS === "true",
  providers: {
    abstract: {
      enabled: env.ENABLE_ABSTRACT === "true",
      key: env.ABSTRACT_API_KEY || ""
    },
    numverify: {
      enabled: env.ENABLE_NUMVERIFY === "true",
      key: env.NUMVERIFY_API_KEY || ""
    },
    twilio: {
      enabled: env.ENABLE_TWILIO === "true",
      accountSid: env.TWILIO_ACCOUNT_SID || "",
      apiKey: env.TWILIO_API_KEY || "",
      apiSecret: env.TWILIO_API_SECRET || ""
    }
  }
};

export function validateConfig() {
  const required = [
    ["BOT_TOKEN", config.botToken],
    ["TELEGRAM_WEBHOOK_SECRET", config.webhookSecret],
    ["SUPABASE_URL", config.supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", config.supabaseKey]
  ];
  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  if (missing.length) throw new Error(`Environment belum diatur: ${missing.join(", ")}`);
  if (config.premiumLimit < config.freeLimit) {
    throw new Error("PREMIUM_DAILY_LIMIT harus >= FREE_DAILY_LIMIT");
  }
}
