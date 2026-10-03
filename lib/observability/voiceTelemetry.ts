/**
 * lib/observability/voiceTelemetry.ts
 *
 * Safe Operational Telemetry for Voice Stream Server.
 * Invariant: Strips tokens, secrets, audio buffers, transcripts, and credentials.
 */

export function logVoiceMetric(event: string, data: Record<string, unknown> = {}): string {
  const safeData = { ...data };
  delete safeData.token;
  delete safeData.secret;
  delete safeData.audio;
  delete safeData.transcript;
  delete safeData.password;

  const entry = {
    timestamp: new Date().toISOString(),
    service: "voice-stream-server",
    event,
    ...safeData,
  };
  const serialized = JSON.stringify(entry);
  console.log(serialized);
  return serialized;
}
