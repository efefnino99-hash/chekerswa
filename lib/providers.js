import { config } from "./config.js";

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(7000)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return data;
}

function compact(obj) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, value]) =>
      value !== null && value !== undefined && value !== ""
    )
  );
}

async function abstractLookup(number) {
  const key = config.providers.abstract.key;
  if (!key) throw new Error("Abstract API key tidak tersedia");

  const url = new URL("https://phonevalidation.abstractapi.com/v1/");
  url.searchParams.set("api_key", key);
  url.searchParams.set("phone", number);

  const data = await requestJson(url);
  if (data.error || typeof data.valid !== "boolean") {
    throw new Error("Respons Abstract tidak valid");
  }

  return compact({
    valid: data.valid,
    carrier: data.carrier,
    lineType: data.type,
    country: data.country?.name,
    countryCode: data.country?.code,
    location: data.location,
    source: "ABSTRACT"
  });
}

async function numverifyLookup(number) {
  const key = config.providers.numverify.key;
  if (!key) throw new Error("Numverify API key tidak tersedia");

  const url = new URL("https://apilayer.net/api/validate");
  url.searchParams.set("access_key", key);
  url.searchParams.set("number", number);

  const data = await requestJson(url);
  if (data.error || typeof data.valid !== "boolean") {
    throw new Error("Respons Numverify tidak valid");
  }

  return compact({
    valid: data.valid,
    carrier: data.carrier,
    lineType: data.line_type,
    country: data.country_name,
    countryCode: data.country_code,
    location: data.location,
    source: "NUMVERIFY"
  });
}

async function twilioLookup(number) {
  const { accountSid, apiKey, apiSecret } = config.providers.twilio;
  if (!accountSid || !apiKey || !apiSecret) {
    throw new Error("Kredensial Twilio tidak lengkap");
  }

  const endpoint = `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(number)}`;
  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const data = await requestJson(endpoint, {
    headers: { Authorization: `Basic ${auth}` }
  });

  if (typeof data.valid !== "boolean") {
    throw new Error("Respons Twilio tidak valid");
  }

  return compact({
    valid: data.valid,
    countryCode: data.country_code,
    callingCode: data.calling_country_code,
    nationalFormat: data.national_format,
    source: "TWILIO_BASIC"
  });
}

export async function externalLookup(number) {
  if (!config.apiFallback) {
    return { success: false, source: "DISABLED", failures: [] };
  }

  // Provider order: Abstract -> Numverify -> Twilio.
  // Abstract/Numverify are skipped unless paid/commercial terms are approved.
  const providers = [
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

  const failures = [];
  for (const provider of providers) {
    if (!provider.enabled) continue;
    if (provider.requiresApproval && !config.allowPaidLookups) continue;

    try {
      const data = await provider.run(number);
      return { success: true, provider: provider.name, data, failures };
    } catch (error) {
      // Do not log credentials, URLs, or full phone numbers.
      console.error(`Provider ${provider.name} failed: ${error.message}`);
      failures.push(provider.name);
    }
  }

  return { success: false, source: "LOCAL_ONLY", failures };
}
