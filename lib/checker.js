import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export function checkNumber(input) {
  const original = String(input || "").trim();
  if (!original || original.length > 30) {
    return { valid: false, input: original, error: "Input kosong atau terlalu panjang" };
  }

  // Numbers beginning with + are parsed internationally; otherwise assume Indonesia.
  const phone = parsePhoneNumberFromString(
    original,
    original.startsWith("+") ? undefined : "ID"
  );

  if (!phone) {
    return { valid: false, input: original, error: "Format nomor tidak dapat dikenali" };
  }

  if (!phone.isValid()) {
    return { valid: false, input: original, error: "Nomor tidak sesuai numbering plan" };
  }

  return {
    valid: true,
    input: original,
    e164: phone.number,
    international: phone.formatInternational(),
    national: phone.formatNational(),
    country: phone.country || null,
    callingCode: `+${phone.countryCallingCode}`,
    type: phone.getType() || null,
    source: "LOCAL_LIBPHONENUMBER"
  };
}
