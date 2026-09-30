import type { Customer } from "./population";
import type { Decision } from "./orchestrator";
import type { DemoAction } from "./demoActions";
import type { Consent } from "./pass";

export type Snapshot = { customer: Customer; decision: Decision; revision: number; customer_id: string; synthetic: true };
async function request<T>(token: string, path = "", body?: unknown): Promise<T> {
  const response = await fetch(`/kate/api/experience${path}`, {
    method: body === undefined ? "GET" : "POST", cache: "no-store", signal: AbortSignal.timeout(25000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.detail === "string" ? data.detail : `Account request failed (${response.status}). Please reconnect.`);
  }
  return response.json();
}
export const experience = {
  current: (t: string) => request<Snapshot>(t),
  act: (t: string, revision: number, action: DemoAction) => request<Snapshot>(t, "/action", { revision, action }),
  consent: (t: string, revision: number, consent: Consent) => request<Snapshot>(t, "/preferences", { revision, consent }),
  contact: (t: string, revision: number, name: string, consented: boolean) => request<Snapshot>(t, "/preferences", { revision, trusted_name: name, trusted_consent: consented }),
  preflight: (t: string) => request<Snapshot>(t, "/preflight", {}),
  prepare: (t: string) => request<{ nudge_id: string; composer: string; message: string }>(t, "/prepare", {}),
};
