// Client for kate-api, the Python/GCP backend at the repository root (kate/api/main.py).
// Calls go to the same-origin /kate proxy (next.config.mjs), with the customer's bearer token.
// The backend is authoritative for the live tab: identity, nudges, feedback, attention budget, voice.

const BASE = "/kate";

export type Persona = {
  customer_id: string;
  first_name: string;
  age: number;
  city: string;
  language: string;
  story: string;
  events: { event_id: string; label: string; story: string }[];
};

export type Profile = {
  customer_id: string;
  first_name: string;
  last_name: string;
  age: number;
  language: string;
  city: string;
  segment: string;
  products: string[];
  consent: Record<string, boolean>;
  muted_topics: string[];
  relevance: Record<string, number> | null;
};

export type RaceEntry = {
  signal_type: string;
  topic: string;
  decision: string;
  priority: number;
  urgency: number;
  confidence: number;
  relevance: number;
  cost: number;
  protective: boolean;
};

export type Nudge = {
  nudge_id: string;
  signal_type: string;
  topic: string;
  status: "new" | "accepted" | "dismissed" | "snoozed";
  created_at: string;
  language: string;
  title: string;
  message: string;
  reason: string;
  suggested_actions: string[];
  product_ids: string[];
  urgency: string;
  evidence: Record<string, unknown>;
  attention: (RaceEntry & { budget: number; used_before: number; used_after: number; runners_up: RaceEntry[] }) | null;
};

export type Txn = {
  transaction_id: string;
  booked_at: string;
  amount: number;
  counterparty: string;
  category: string;
  country: string;
  balance_after: number | null;
};

export type Attention = {
  budget: number;
  used: number;
  relevance: Record<string, number>;
  min_priority: number;
  scoring: Record<string, { urgency: number; cost: number; protective: boolean }>;
};

export type VoiceSession = {
  conversation_token: string;
  signed_url: string;
  language: string;
  dynamic_variables: Record<string, string>;
};

export class KateError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call(path: string, token: string | null, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers, cache: "no-store" });
  } catch {
    throw new KateError(0, "Cannot reach kate-api. Is KATE_API_URL set and the service up?");
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {}
    if (res.status === 404 && path === "/api/demo/personas") detail = "No backend configured (set KATE_API_URL and restart).";
    throw new KateError(res.status, typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return res;
}

const json = <T,>(p: Promise<Response>) => p.then((r) => r.json() as Promise<T>);
const post = (body: unknown): RequestInit => ({ method: "POST", body: JSON.stringify(body) });

export const kate = {
  personas: () => json<Persona[]>(call("/api/demo/personas", null)),
  login: (access_code: string, customer_id: string) =>
    json<{ token: string; expires_in: number; customer: Profile }>(call("/api/auth/demo-login", null, post({ access_code, customer_id }))),
  me: (t: string) => json<Profile>(call("/api/me", t)),
  transactions: (t: string, days = 30) => json<Txn[]>(call(`/api/transactions?days=${days}&limit=40`, t)),
  nudges: (t: string) => json<Nudge[]>(call("/api/nudges", t)),
  attention: (t: string) => json<Attention>(call("/api/attention", t)),
  respond: (t: string, id: string, response: "accepted" | "dismissed" | "snoozed") =>
    json<Nudge>(call(`/api/nudges/${encodeURIComponent(id)}/respond`, t, post({ response }))),
  /** MP3 of Kate reading the nudge (ElevenLabs, key stays on the server). Caller revokes the URL. */
  audioUrl: async (t: string, id: string) => URL.createObjectURL(await (await call(`/api/nudges/${encodeURIComponent(id)}/audio`, t)).blob()),
  voiceSession: (t: string, nudge_id?: string) => json<VoiceSession>(call("/api/voice/session", t, post(nudge_id ? { nudge_id } : {}))),
  event: (t: string, event_id: string) => json<{ event_id: string }>(call("/api/demo/events", t, post({ event_id }))),
  reset: (t: string) => json<{ deleted_nudges: number }>(call("/api/demo/reset", t, post({}))),
};

// Same SDK build as the backend console (kate/api/static/index.html), loaded on demand.
const ELEVENLABS_SDK = "https://cdn.jsdelivr.net/npm/@elevenlabs/client@1.26.0/+esm";

export type Conversation = { endSession: () => Promise<void> };

/** Starts a conversation with the private ElevenLabs agent for this customer (and nudge, if given). */
export async function startVoice(
  session: VoiceSession,
  on: { status: (s: string) => void; message: (who: "kate" | "you", text: string) => void },
): Promise<Conversation> {
  const { Conversation } = await import(/* webpackIgnore: true */ ELEVENLABS_SDK);
  await navigator.mediaDevices.getUserMedia({ audio: true });
  const options = {
    dynamicVariables: session.dynamic_variables,
    overrides: { agent: { language: session.language } },
    onConnect: () => on.status("connected"),
    onDisconnect: () => on.status("ended"),
    onError: (e: unknown) => on.status(`error: ${String(e)}`),
    onModeChange: ({ mode }: { mode: string }) => on.status(mode === "speaking" ? "Kate is speaking" : "listening"),
    onMessage: ({ role, message }: { role: string; message: string }) => on.message(role === "agent" ? "kate" : "you", message),
  };
  try {
    return await Conversation.startSession({ ...options, conversationToken: session.conversation_token, connectionType: "webrtc" });
  } catch {
    return await Conversation.startSession({ ...options, signedUrl: session.signed_url, connectionType: "websocket" });
  }
}
