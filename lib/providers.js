
import { config } from "./config.js";

// ======================================================
// REQUEST HELPER
// ======================================================

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(8000)
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data?.error?.info ||
      data?.message ||
      `HTTP ${response.status}`;

    throw new Error(message);
  }

  if (!data || typeof data !== "object") {
    throw new Error("Respons API bukan JSON yang valid");
  }

  return data;
}

// ======================================================
// DATA CLEANER
// ======================================================

function compact(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) =>
      value !== null &&
      value !== undefined &&
      value !== ""
    )
  );
}

// ======================================================
// NORMALIZE PROVIDER RESULT
// ======================================================

function normalizeResult(data, source) {
  if (typeof data.valid !== "boolean") {
    throw new Error("Provider tidak memberikan status valid");
  }

  return {
    valid: data.valid,

    status: data.valid
      ? "PHONE_VALID"
      : "PHONE_INVALID",

    carrier: data.carrier || null,
    lineType: data.lineType || null,

    country: data.country || null,
    countryCode: data.countryCode || null,
    callingCode: data.callingCode || null,

    location: data.location || null,
    nationalFormat: data.nationalFormat || null,

    source,

    // Provider nomor telepon bukan sumber status akun WhatsApp.
    whatsapp_status: "UNKNOWN_WHATSAPP",
    whatsapp_registered: null
  };
}

// ======================================================
// ABSTRACT API
// ======================================================

async function abstractLookup(number) {
  const key = config.providers.abstract.key;

  if (!key) {
    throw new Error("Abstract API key tidak tersedia");
  }

  const url = new URL(
    "https://phonevalidation.abstractapi.com/v1/"
  );

  url.searchParams.set("api_key", key);
  url.searchParams.set("phone", number);

  const data = await requestJson(url);

  if (data.error || typeof data.valid !== "boolean") {
    throw new Error("Respons Abstract tidak valid");
  }

  return normalizeResult({
    valid: data.valid,
    carrier: data.carrier,
    lineType: data.type,
    country: data.country?.name,
    countryCode: data.country?.code,
    location: data.location
  }, "ABSTRACT");
}

// ======================================================
// NUMVERIFY API
// ======================================================

async function numverifyLookup(number) {
  const key = config.providers.numverify.key;

  if (!key) {
    throw new Error("Numverify API key tidak tersedia");
  }

  const url = new URL(
    "https://apilayer.net/api/validate"
  );

  url.searchParams.set("access_key", key);
  url.searchParams.set("number", number);

  const data = await requestJson(url);

  if (data.error || typeof data.valid !== "boolean") {
    throw new Error("Respons Numverify tidak valid");
  }

  return normalizeResult({
    valid: data.valid,
    carrier: data.carrier,
    lineType: data.line_type,
    country: data.country_name,
    countryCode: data.country_code,
    callingCode: data.country_prefix,
    location: data.location
  }, "NUMVERIFY");
}

// ======================================================
// TWILIO LOOKUP API
// ======================================================

async function twilioLookup(number) {
  const {
    apiKey,
    apiSecret
  } = config.providers.twilio;

  if (!apiKey || !apiSecret) {
    throw new Error("Kredensial Twilio tidak lengkap");
  }

  const endpoint =
    `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(number)}`;

  const auth = Buffer.from(
    `${apiKey}:${apiSecret}`
  ).toString("base64");

  const data = await requestJson(endpoint, {
    headers: {
      Authorization: `Basic ${auth}`,
      Accept: "application/json"
    }
  });

  if (typeof data.valid !== "boolean") {
    throw new Error("Respons Twilio tidak valid");
  }

  return normalizeResult({
    valid: data.valid,
    countryCode: data.country_code,
    callingCode: data.calling_country_code,
    nationalFormat: data.national_format
  }, "TWILIO_BASIC");
}

// ======================================================
// PROVIDER CONFIGURATION
// ======================================================

function getProviders() {
  return [
    {
      name: "ABSTRACT",
      enabled: config.providers.abstract.enabled,
      requiresApproval: true,
      run: abstractLookup
    },
    {
      name: "NUMVERIFY",
      enabled: config.providers.numverify.enabled,
      requiresApproval: true,
      run: numverifyLookup
    },
    {
      name: "TWILIO",
      enabled: config.providers.twilio.enabled,
      requiresApproval: false,
      run: twilioLookup
    }
  ];
}

// ======================================================
// EXTERNAL LOOKUP WITH FALLBACK
// ======================================================

export async function externalLookup(number) {
  if (!config.apiFallback) {
    return {
      success: false,
      source: "DISABLED",
      status: "UNKNOWN",
      whatsapp_status: "UNKNOWN_WHATSAPP",
      whatsapp_registered: null,
      failures: []
    };
  }

  if (!number || typeof number !== "string") {
    return {
      success: false,
      source: "INVALID_INPUT",
      status: "UNKNOWN",
      whatsapp_status: "UNKNOWN_WHATSAPP",
      whatsapp_registered: null,
      failures: []
    };
  }

  const providers = getProviders();
  const failures = [];

  let attempted = 0;

  for (const provider of providers) {
    if (!provider.enabled) continue;

    if (
      provider.requiresApproval &&
      !config.allowPaidLookups
    ) {
      continue;
    }

    attempted++;

    try {
      const data = await provider.run(number);

      return {
        success: true,
        provider: provider.name,
        source: provider.name,
        status: data.status,
        data,

        whatsapp_status: "UNKNOWN_WHATSAPP",
        whatsapp_registered: null,

        failures
      };

    } catch (error) {
      const message = String(
        error?.message || "Unknown provider error"
      ).slice(0, 200);

      // Jangan mencatat API key atau nomor telepon.
      console.error(
        `Provider ${provider.name} failed: ${message}`
      );

      failures.push({
        provider: provider.name,
        error: message
      });
    }
  }

  return {
    success: false,

    source: attempted > 0
      ? "ALL_PROVIDERS_FAILED"
      : "LOCAL_ONLY",

    status: "UNKNOWN",

    whatsapp_status: "UNKNOWN_WHATSAPP",
    whatsapp_registered: null,

    failures
  };
}

// ======================================================
// PROVIDER STATUS
// ======================================================

export function getProviderStatus() {
  return getProviders().map(provider => ({
    name: provider.name,
    enabled: provider.enabled,
    requiresApproval: provider.requiresApproval,

    available:
      provider.enabled &&
      (
        !provider.requiresApproval ||
        config.allowPaidLookups
      )
  }));
}
  
