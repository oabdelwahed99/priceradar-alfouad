/**
 * Single-workspace mode for the MVP. Replace with a session-derived workspace once auth exists.
 */
export function getCurrentWorkspaceId(): string {
  return process.env.DEFAULT_WORKSPACE_ID || "default";
}
