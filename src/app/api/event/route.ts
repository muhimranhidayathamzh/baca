import { isMetricEvent, recordMetric } from "@/lib/metrics";
import { checkRateLimit, tooManyRequests } from "@/lib/ratelimit";

/**
 * POST /api/event — body `{ event, device }`.
 *
 * Dikirim lewat `navigator.sendBeacon`, jadi tetap terkirim walau user sedang
 * pindah ke tab paper asli. Selalu membalas 204 untuk input yang valid,
 * termasuk saat Redis gagal: metrik bukan alasan untuk mengganggu user.
 */

/** ID perangkat dibuat client lewat crypto.randomUUID(). */
const DEVICE_ID = /^[0-9a-f-]{36}$/i;

export async function POST(request: Request): Promise<Response> {
  const limit = await checkRateLimit("event", request);
  if (!limit.success) return tooManyRequests();

  let body: unknown;
  try {
    // sendBeacon mengirim Blob tanpa content-type JSON yang dijamin, jadi
    // baca sebagai teks lalu parse sendiri.
    body = JSON.parse(await request.text());
  } catch {
    return new Response(null, { status: 400 });
  }

  const { event, device } = (body ?? {}) as { event?: unknown; device?: unknown };
  if (!isMetricEvent(event) || typeof device !== "string" || !DEVICE_ID.test(device)) {
    return new Response(null, { status: 400 });
  }

  try {
    await recordMetric(event, device.toLowerCase());
  } catch (error) {
    console.error("[api/event] Gagal mencatat:", error);
  }
  return new Response(null, { status: 204 });
}
