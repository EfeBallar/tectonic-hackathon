import { llmConfig } from "@/lib/llm";

export async function GET() {
  return Response.json({ ...llmConfig(), tts: !!process.env.ELEVENLABS_API_KEY });
}
