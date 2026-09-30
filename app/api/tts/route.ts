// Optional ElevenLabs voice. Without a key the client uses the browser's speechSynthesis.
export const runtime = "nodejs";

export async function GET() {
  return Response.json({ enabled: !!process.env.ELEVENLABS_API_KEY });
}

export async function POST(req: Request) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return new Response("ElevenLabs not configured", { status: 501 });
  const { text } = (await req.json()) as { text: string };
  const voice = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM";
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text: text.slice(0, 600), model_id: "eleven_multilingual_v2" }),
  });
  if (!r.ok) return new Response(await r.text(), { status: r.status });
  return new Response(r.body, { headers: { "Content-Type": "audio/mpeg" } });
}
