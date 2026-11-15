const show = value => value === null || value === undefined || value === ""
  ? "Tidak tersedia"
  : String(value);

export function buildReport(local, external) {
  if (!local.valid) {
    return [
      "🔎 WHATSAPP HEALTH REPORT",
      "",
      `Input: ${local.input || "-"}`,
      "Status format: INVALID",
      `Keterangan: ${local.error}`,
      "",
      "Lookup eksternal tidak dilakukan."
    ].join("\n");
  }

  const api = external?.success ? external.data : {};
  const rows = [
    ["Format nomor", "VALID"],
    ["Nomor internasional", local.international],
    ["E.164", local.e164],
    ["Negara", local.country || api.country],
    ["Kode negara", local.callingCode],
    ["Jenis nomor", local.type || api.lineType],
    ["Operator", api.carrier],
    ["Validasi provider", typeof api.valid === "boolean" ? (api.valid ? "VALID" : "INVALID") : "BELUM DIPERIKSA"],
    ["Sumber lookup", external?.provider || "LOCAL ONLY"],
    ["Status akun WhatsApp", "TIDAK DAPAT DIVERIFIKASI"],
    ["Laporan spam", "TIDAK TERSEDIA"],
    ["Banned / suspend", "TIDAK DAPAT DIVERIFIKASI"],
    ["Bug internal WhatsApp", "TIDAK DAPAT DIVERIFIKASI"]
  ];

  return [
    "╭━━ WHATSAPP HEALTH REPORT ━━╮",
    "",
    ...rows.map(([label, value]) => `${label}: ${show(value)}`),
    "",
    "Kesimpulan: format nomor berhasil diperiksa.",
    "Data lain hanya ditampilkan jika tersedia dari sumber.",
    "",
    "⚠️ VALID bukan berarti nomor aktif atau terdaftar WhatsApp.",
    "╰━━━━━━━━━━━━━━━━━━━━━━━━━━╯"
  ].join("\n");
}
