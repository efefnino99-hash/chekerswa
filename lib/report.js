
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
  // 1. INPUT VALIDATION
  // ========================================

  if (!local || typeof local !== "object") {
    return [
      "╭━━ WHATSAPP HEALTH REPORT ━━╮",
      "",
      "🔴 DATA PEMERIKSAAN TIDAK VALID",
      "",
      "Data nomor tidak dapat diproses.",
      "Status WhatsApp: UNKNOWN_WHATSAPP",
      "",
      "╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯"
    ].join("\n");
  }

  // ========================================
  // 2. LOCAL NUMBER VALIDATION FAILED
  // ========================================

  if (!local.valid) {
    return [
      "╭━━ WHATSAPP HEALTH REPORT ━━╮",
      "",
      "🔴 VALIDASI FORMAT GAGAL",
      "",
      `Input: ${show(local.input)}`,
      "Status format: INVALID_FORMAT",
      `Keterangan: ${show(local.error)}`,
      "",
      "━━ INFORMASI ━━",
      "",
      "• Nomor tidak sesuai numbering plan.",
      "• Lookup eksternal tidak dilakukan.",
      "• Status akun WhatsApp tidak diketahui.",
      "",
      "━━ STATUS WHATSAPP ━━",
      "",
      "Status akun: UNKNOWN_WHATSAPP",
      "Pendaftaran: TIDAK DAPAT DIVERIFIKASI",
      "Banned permanen: TIDAK DAPAT DIVERIFIKASI",
      "",
      "⚠️ INVALID_FORMAT bukan bukti nomor diblokir WhatsApp.",
      "",
      "╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯"
    ].join("\n");
  }

  // ========================================
  // 3. EXTERNAL PROVIDER RESPONSE
  // ========================================

  const api = external?.success
    ? external.data || {}
    : {};

  const providerAvailable = Boolean(
    external?.success &&
    typeof api.valid === "boolean"
  );

  let providerStatus = "TIDAK TERSEDIA";

  if (providerAvailable) {
    providerStatus = api.valid
      ? "VALID"
      : "INVALID";
  } else if (external?.source === "ALL_PROVIDERS_FAILED") {
    providerStatus = "SEMUA PROVIDER GAGAL";
  } else if (external?.source === "DISABLED") {
    providerStatus = "DINONAKTIFKAN";
  } else if (external?.source === "LOCAL_ONLY") {
    providerStatus = "LOCAL ONLY";
  }

  // ========================================
  // 4. VALIDATION CONSISTENCY
  // ========================================

  let consistency = "BELUM DAPAT DIBANDINGKAN";

  if (providerAvailable) {
    if (api.valid) {
      consistency = "SESUAI";
    } else {
      consistency = "PERBEDAAN HASIL";
    }
  }

  // ========================================
  // 5. PROVIDER INFORMATION
  // ========================================

  const providerName =
    external?.provider ||
    external?.source ||
    "LOCAL ONLY";

  const failures = Array.isArray(external?.failures)
    ? external.failures
    : [];

  const failureNames = failures.map(item =>
    typeof item === "string"
      ? item
      : item?.provider
  ).filter(Boolean);

  // ========================================
  // 6. WHATSAPP STATUS
  // ========================================

  // Provider validasi nomor tidak membuktikan
  // bahwa akun WhatsApp terdaftar atau aktif.

  const whatsappStatus = "UNKNOWN_WHATSAPP";
  const whatsappRegistration = "TIDAK DAPAT DIVERIFIKASI";
  const permanentBanStatus = "TIDAK DAPAT DIVERIFIKASI";

  // ========================================
  // 7. REPORT DATA
  // ========================================

  const rows = [
    ["Format nomor lokal", "VALID"],
    ["Nomor internasional", local.international],
    ["Nomor nasional", local.national],
    ["E.164", local.e164],
    ["Negara", local.country || api.country],
    ["Kode negara", local.callingCode || api.callingCode],
    ["Jenis nomor", local.type || api.lineType],
    ["Operator", api.carrier],
    ["Lokasi", api.location],
    ["Validasi provider", providerStatus],
    ["Kesesuaian hasil", consistency],
    ["Sumber lookup", providerName],
    ["Status akun WhatsApp", whatsappStatus],
    ["Pendaftaran WhatsApp", whatsappRegistration],
    ["Banned permanen", permanentBanStatus],
    ["Laporan spam", "TIDAK TERSEDIA"],
    ["Status suspend", "TIDAK DAPAT DIVERIFIKASI"]
  ];

  // ========================================
  // 8. REPORT HEADER
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
  // 9. PROVIDER FAILURE INFORMATION
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
  // 10. PROVIDER RESULT
  // ========================================

  output.push(
    "",
    "━━ HASIL VALIDASI PROVIDER ━━",
    ""
  );

  if (!providerAvailable) {
    output.push(
      "Pemeriksaan eksternal belum berhasil.",
      "Validasi hanya berdasarkan numbering plan lokal.",
      "Status akun WhatsApp masih UNKNOWN."
    );
  } else if (api.valid) {
    output.push(
      "Provider menyatakan nomor valid.",
      "Informasi nomor berhasil diperoleh.",
      "Status pendaftaran WhatsApp belum diketahui."
    );
  } else {
    output.push(
      "Provider menyatakan nomor tidak valid.",
      "Hasil berbeda dari validasi lokal.",
      "Periksa kembali nomor dan informasi provider."
    );
  }

  // ========================================
  // 11. CONCLUSION
  // ========================================

  output.push(
    "",
    "━━ KESIMPULAN ━━",
    ""
  );

  output.push(
    "Validasi format: SELESAI",
    `Validasi provider: ${providerStatus}`,
    "Status WhatsApp: UNKNOWN_WHATSAPP",
    "Status banned permanen: TIDAK DIKETAHUI"
  );

  // ========================================
  // 12. DISCLAIMER
  // ========================================

  output.push(
    "",
    "━━ INFORMASI PENTING ━━",
    "",
    "VALID bukan berarti akun WhatsApp aktif.",
    "VALID bukan berarti akun WhatsApp terdaftar.",
    "INVALID bukan berarti akun WhatsApp dibanned.",
    "",
    "API ini memeriksa informasi nomor telepon.",
    "Bot tidak dapat membaca laporan spam privat,",
    "status banned permanen, atau kondisi internal WhatsApp.",
    "",
    "╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯"
  );

  return output.join("\n");
      }
    
