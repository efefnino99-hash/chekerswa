
const show = value =>
  value === null || value === undefined || value === ""
    ? "Tidak tersedia"
    : String(value);

// ==========================================
// WHATSAPP NUMBER HEALTH CHECKER V2
// REPORT GENERATOR
// ==========================================

export function buildReport(local, external) {

  // ========================================
  // 1. LOCAL NUMBER VALIDATION FAILED
  // ========================================

  if (!local.valid) {
    return [
      "╭━━ WHATSAPP HEALTH REPORT ━━╮",
      "",
      "🔴 VALIDASI FORMAT GAGAL",
      "",
      `Input: ${local.input || "-"}`,
      "Status format: INVALID",
      `Keterangan: ${local.error || "Nomor tidak valid"}`,
      "",
      "Informasi:",
      "• Format nomor tidak sesuai numbering plan.",
      "• Lookup eksternal tidak dilakukan.",
      "• Status akun WhatsApp tidak diketahui.",
      "",
      "Status akun WhatsApp: UNKNOWN",
      "Pendaftaran WhatsApp: TIDAK DAPAT DIVERIFIKASI",
      "",
      "⚠️ INVALID FORMAT bukan bukti nomor diblokir WhatsApp.",
      "",
      "╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯"
    ].join("\n");
  }

  // ========================================
  // 2. EXTERNAL PROVIDER RESPONSE
  // ========================================

  const api = external?.success
    ? external.data || {}
    : {};

  const providerAvailable = Boolean(external?.success);

  let providerStatus = "BELUM DIPERIKSA";

  if (providerAvailable) {
    if (typeof api.valid === "boolean") {
      providerStatus = api.valid
        ? "VALID"
        : "INVALID";
    }
  } else if (external?.source === "ALL_PROVIDERS_FAILED") {
    providerStatus = "SEMUA PROVIDER GAGAL";
  } else if (external?.source === "DISABLED") {
    providerStatus = "DINONAKTIFKAN";
  } else {
    providerStatus = "TIDAK TERSEDIA";
  }

  // ========================================
  // 3. VALIDATION CONSISTENCY
  // ========================================

  let consistency = "BELUM DAPAT DIBANDINGKAN";

  if (providerAvailable && typeof api.valid === "boolean") {
    if (local.valid && api.valid) {
      consistency = "SESUAI";
    } else if (local.valid && !api.valid) {
      consistency = "PERBEDAAN HASIL";
    }
  }

  // ========================================
  // 4. PROVIDER INFORMATION
  // ========================================

  const providerName = external?.provider ||
    external?.source ||
    "LOCAL ONLY";

  const failures = Array.isArray(external?.failures)
    ? external.failures
    : [];

  const failureNames = failures.map(item =>
    typeof item === "string"
      ? item
      : item.provider
  ).filter(Boolean);

  // ========================================
  // 5. REPORT DATA
  // ========================================

  const rows = [
    ["Format nomor lokal", "VALID"],
    ["Nomor internasional", local.international],
    ["E.164", local.e164],
    ["Negara", local.country || api.country],
    ["Kode negara", local.callingCode],
    ["Jenis nomor", local.type || api.lineType],
    ["Operator", api.carrier],
    ["Lokasi", api.location],
    ["Validasi provider", providerStatus],
    ["Kesesuaian hasil", consistency],
    ["Sumber lookup", providerName],
    ["Status akun WhatsApp", "TIDAK DAPAT DIVERIFIKASI"],
    ["Pendaftaran WhatsApp", "UNKNOWN"],
    ["Laporan spam", "TIDAK TERSEDIA"],
    ["Banned / suspend", "TIDAK DAPAT DIVERIFIKASI"],
    ["Bug internal WhatsApp", "TIDAK DAPAT DIVERIFIKASI"]
  ];

  // ========================================
  // 6. REPORT HEADER
  // ========================================

  const output = [
    "╭━━ WHATSAPP HEALTH REPORT ━━╮",
    "",
    "🟢 FORMAT NOMOR BERHASIL DIPERIKSA",
    "",
    ...rows.map(([label, value]) =>
      `${label}: ${show(value)}`
    )
  ];

  // ========================================
  // 7. PROVIDER FAILURE INFORMATION
  // ========================================

  if (failureNames.length > 0) {
    output.push(
      "",
      "⚠️ PROVIDER FALLBACK",
      `Provider gagal: ${failureNames.join(", ")}`,
      `Jumlah kegagalan: ${failureNames.length}`
    );
  }

  // ========================================
  // 8. CONCLUSION
  // ========================================

  output.push(
    "",
    "━━ KESIMPULAN ━━",
    ""
  );

  if (!providerAvailable) {
    output.push(
      "Format nomor sesuai numbering plan.",
      "Pemeriksaan eksternal belum berhasil.",
      "Status nomor WhatsApp masih UNKNOWN."
    );
  } else if (typeof api.valid === "boolean" && api.valid) {
    output.push(
      "Format nomor berhasil divalidasi.",
      "Provider memberikan hasil valid.",
      "Status pendaftaran WhatsApp belum diketahui."
    );
  } else if (typeof api.valid === "boolean" && !api.valid) {
    output.push(
      "Validasi lokal dan provider memberikan hasil berbeda.",
      "Nomor perlu diperiksa kembali.",
      "Jangan menganggap hasil ini sebagai status akun WhatsApp."
    );
  } else {
    output.push(
      "Provider tidak memberikan hasil validasi yang cukup.",
      "Status nomor WhatsApp masih UNKNOWN."
    );
  }

  // ========================================
  // 9. DISCLAIMER
  // ========================================

  output.push(
    "",
    "⚠️ INFORMASI PENTING",
    "VALID bukan berarti nomor aktif atau terdaftar WhatsApp.",
    "Provider ini memeriksa informasi nomor telepon.",
    "Bot tidak dapat membaca laporan spam privat,",
    "status banned, atau kondisi internal WhatsApp.",
    "",
    "╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯"
  );

  return output.join("\n");
      }
    
