import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Summary } from "@/types";

/**
 * Klien Supabase — SERVER-SIDE ONLY.
 *
 * Memakai service role key, yang melewati Row Level Security. Modul ini tidak
 * boleh diimpor dari komponen client mana pun; semua akses ke Supabase harus
 * lewat API route (SPEC.md Bagian 8).
 */

let cachedClient: SupabaseClient | null = null;

/**
 * Mengembalikan null kalau kredensial belum diisi, supaya app tetap jalan
 * tanpa cache (summary tetap bisa dihasilkan, hanya tidak tersimpan).
 */
function getClient(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_KEY?.trim();
  if (!url || !key) return null;

  if (!cachedClient) {
    cachedClient = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return cachedClient;
}

export function isSupabaseConfigured(): boolean {
  return getClient() !== null;
}

/** Baris tabel `summaries` (SPEC.md Bagian 2). */
interface SummaryRow {
  paper_id: string;
  title: string;
  hook: string;
  key_phrase: string | null;
  quick: string[];
  deep: string;
  original_abstract: string | null;
}

/**
 * Ambil summary dari cache. Cache miss maupun error koneksi sama-sama
 * mengembalikan null — kegagalan cache tidak boleh menggagalkan request,
 * paling buruk hanya berarti memanggil AI lagi.
 */
export async function getCachedSummary(paperId: string): Promise<Summary | null> {
  const client = getClient();
  if (!client) return null;

  const { data, error } = await client
    .from("summaries")
    .select("hook, key_phrase, quick, deep")
    .eq("paper_id", paperId)
    .maybeSingle();

  if (error) {
    console.error("[supabase] Gagal membaca cache:", error.message);
    return null;
  }
  if (!data) return null;

  const row = data as Pick<SummaryRow, "hook" | "key_phrase" | "quick" | "deep">;
  return {
    hook: row.hook,
    key: row.key_phrase,
    quick: Array.isArray(row.quick) ? row.quick : [],
    deep: row.deep,
  };
}

/**
 * Simpan summary ke cache supaya user berikutnya tidak perlu panggilan AI lagi
 * (cache dipakai lintas user — SPEC.md Bagian 2).
 *
 * Sengaja tidak melempar error: gagal menyimpan tidak boleh membatalkan
 * response yang sudah berhasil dibuat.
 */
export async function cacheSummary(params: {
  paperId: string;
  title: string;
  summary: Summary;
  abstract: string;
}): Promise<void> {
  const client = getClient();
  if (!client) return;

  const row: SummaryRow = {
    paper_id: params.paperId,
    title: params.title,
    hook: params.summary.hook,
    key_phrase: params.summary.key,
    quick: params.summary.quick,
    deep: params.summary.deep,
    original_abstract: params.abstract || null,
  };

  const { error } = await client.from("summaries").upsert(row, { onConflict: "paper_id" });
  if (error) console.error("[supabase] Gagal menyimpan cache:", error.message);
}
