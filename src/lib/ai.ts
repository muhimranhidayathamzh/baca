import "server-only";
import { GoogleGenAI, ThinkingLevel, type ThinkingConfig } from "@google/genai";

/**
 * Satu-satunya tempat yang berbicara langsung dengan provider AI. Ringkasan
 * (lib/summarize.ts) dan perluasan query search (lib/query-expand.ts) sama-sama
 * lewat sini. Untuk pindah ke Claude API nanti, cukup ganti isi file ini.
 */

/**
 * Nama model bisa diatur lewat env supaya tidak perlu ubah kode saat Google
 * memensiunkan sebuah versi.
 *
 * Default `gemini-3.5-flash-lite`: per September 2026 Google membatasi akses
 * model 2.5 hanya untuk akun yang pernah memakainya, jadi API key baru akan
 * ditolak. Flash-Lite dipilih karena tugasnya sederhana (teks pendek → JSON)
 * dan kecepatan penting — kartu menampilkan shimmer selama menunggu.
 */
const DEFAULT_MODEL = "gemini-3.5-flash-lite";

/**
 * Token "thinking" pada model Gemini 3.x ikut dihitung ke batas ini sebagai
 * batas keras. Dengan batas 1000 seperti draft awal SPEC, pemikiran yang
 * panjang bisa memotong JSON di tengah jalan. 2048 memberi ruang aman.
 */
const MAX_OUTPUT_TOKENS = 2048;

/**
 * Tingkat thinking terendah yang diizinkan tiap keluarga model. Thinking tidak
 * bisa dimatikan sepenuhnya di 3.x, dan nilai yang tidak didukung membuat API
 * menolak request — "minimal" hanya sah untuk Flash-Lite, Flash biasa minimal "low".
 */
function thinkingConfigFor(model: string): ThinkingConfig | undefined {
  if (model.startsWith("gemini-2")) return { thinkingBudget: 0 };
  if (model.includes("lite")) return { thinkingLevel: ThinkingLevel.MINIMAL };
  if (model.startsWith("gemini-3")) return { thinkingLevel: ThinkingLevel.LOW };
  return undefined;
}

let cachedClient: GoogleGenAI | null = null;

function getClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  if (!cachedClient) cachedClient = new GoogleGenAI({ apiKey });
  return cachedClient;
}

export function isAiConfigured(): boolean {
  return getClient() !== null;
}

export type AiCallResult =
  | { ok: true; text: string }
  /**
   * `retryAfter` terisi (detik) hanya kalau provider menolak karena kuota
   * per menit — kondisi sementara yang sembuh sendiri. `null` berarti gagal
   * karena hal lain dan mencoba lagi segera tidak ada gunanya.
   */
  | { ok: false; retryAfter: number | null };

/** Jeda default kalau provider bilang "kuota habis" tanpa menyebut berapa lama. */
const DEFAULT_RETRY_AFTER = 15;

/**
 * Kenali penolakan kuota Gemini (HTTP 429 / RESOURCE_EXHAUSTED) dan ambil
 * jeda yang disarankan dari `retryDelay` di badan error-nya.
 */
function quotaRetryAfter(error: unknown): number | null {
  const status = (error as { status?: unknown })?.status;
  const message = error instanceof Error ? error.message : String(error);
  if (status !== 429 && !/\b429\b|RESOURCE_EXHAUSTED/.test(message)) return null;

  const match = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(message);
  const seconds = match ? Math.ceil(Number(match[1])) : DEFAULT_RETRY_AFTER;
  return Math.min(Math.max(seconds, 2), 60);
}

/**
 * Panggil model dan minta keluaran JSON. Tidak pernah melempar error.
 *
 * Output JSON dipaksa di level API (`responseMimeType`) — jauh lebih andal
 * daripada sekadar memintanya lewat prompt.
 */
export async function generateJson(
  prompt: string,
  { temperature }: { temperature: number },
): Promise<AiCallResult> {
  const client = getClient();
  if (!client) {
    console.error("[ai] GEMINI_API_KEY belum diisi.");
    return { ok: false, retryAfter: null };
  }

  const model = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;

  try {
    const response = await client.models.generateContent({
      model,
      contents: prompt,
      config: {
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        responseMimeType: "application/json",
        temperature,
        thinkingConfig: thinkingConfigFor(model),
      },
    });
    const text = response.text;
    return text ? { ok: true, text } : { ok: false, retryAfter: null };
  } catch (error) {
    const retryAfter = quotaRetryAfter(error);
    if (retryAfter !== null) {
      console.warn(`[ai] Kuota per menit penuh, coba lagi dalam ${retryAfter} dtk.`);
      return { ok: false, retryAfter };
    }
    console.error("[ai] Panggilan gagal:", error);
    return { ok: false, retryAfter: null };
  }
}

/** Buang pagar markdown kalau model tetap membungkus JSON-nya. */
export function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}
