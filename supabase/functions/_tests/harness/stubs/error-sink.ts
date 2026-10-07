// HARNESS STUB — `_shared/error-sink.ts` yerine (supabase-js/esm.sh ağ bağımlılığı
// harness'te yok). Kayıtlar bellekte tutulur, test isterse okur.
export type ErrorSeverity = "critical" | "error" | "warning";
export interface LogCriticalInput {
  event: string; error?: unknown; context?: Record<string, unknown>;
  agencyId?: string; severity?: ErrorSeverity;
}
export const criticalLog: LogCriticalInput[] = [];
export async function logCritical(input: LogCriticalInput): Promise<void> { criticalLog.push(input); }
