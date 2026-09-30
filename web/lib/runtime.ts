// True when running as the no-server static preview (single HTML file). No API routes there,
// so chat + explanations run fully in the browser with the engine + template wording.
export const STATIC =
  typeof window !== "undefined" && !!(window as unknown as { __AHEAD_STATIC__?: boolean }).__AHEAD_STATIC__;
