
import { parsePhoneNumberFromString } from "libphonenumber-js/max";

export function checkNumber(input) {
  const original = String(input || "").trim();

  // Validasi input dasar
  if (!original || original.length > 30) {
    return {
      valid: false,
      status: "INVALID_FORMAT",
      whatsapp_status: "UNKNOWN_WHATSAPP",
      whatsapp_registered: null,
      input: original,
      error: "Input kosong atau terlalu panjang",
      source: "LOCAL_LIBPHONENUMBER"
    };
  }

  // Hanya menerima angka, tanda +, spasi, tanda kurung, dan tanda hubung
  if (!/^[+0-9()\s.-]+$/.test(original)) {
    return {
      valid: false,
      status: "INVALID_FORMAT",
      whatsapp_status: "UNKNOWN_WHATSAPP",
      whatsapp_registered: null,
      input: original,
      error: "Input mengandung karakter yang tidak diizinkan",
      source: "LOCAL_LIBPHONENUMBER"
    };
  }

  // Nomor dengan + dibaca internasional.
  // Nomor tanpa + diasumsikan menggunakan kode negara Indonesia.
  const phone = parsePhoneNumberFromString(
    original,
    original.startsWith("+") ? undefined : "ID"
  );

  if (!phone) {
    return {
      valid: false,
      status: "INVALID_FORMAT",
      whatsapp_status: "UNKNOWN_WHATSAPP",
      whatsapp_registered: null,
      input: original,
      error: "Format nomor tidak dapat dikenali",
      source: "LOCAL_LIBPHONENUMBER"
    };
  }

  // Periksa kemungkinan nomor berdasarkan numbering plan
  if (!phone.isPossible()) {
    return {
      valid: false,
      status: "INVALID_FORMAT",
      whatsapp_status: "UNKNOWN_WHATSAPP",
      whatsapp_registered: null,
      input: original,
      error: "Panjang nomor tidak sesuai numbering plan",
      source: "LOCAL_LIBPHONENUMBER"
    };
  }

  // Periksa validitas nomor berdasarkan metadata negara
  if (!phone.isValid()) {
    return {
      valid: false,
      status: "INVALID_FORMAT",
      whatsapp_status: "UNKNOWN_WHATSAPP",
      whatsapp_registered: null,
      input: original,
      error: "Nomor tidak sesuai numbering plan",
      source: "LOCAL_LIBPHONENUMBER"
    };
  }

  return {
    valid: true,
    status: "VALID_FORMAT",

    // Validitas nomor bukan bukti akun WhatsApp aktif
    whatsapp_status: "UNKNOWN_WHATSAPP",
    whatsapp_registered: null,

    input: original,
    e164: phone.number,
    international: phone.formatInternational(),
    national: phone.formatNational(),

    country: phone.country || null,
    callingCode: `+${phone.countryCallingCode}`,
    type: phone.getType() || null,

    source: "LOCAL_LIBPHONENUMBER",

    message: "Nomor valid secara format. Status akun WhatsApp belum dapat diverifikasi."
  };
}
