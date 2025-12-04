// Structured Logger Utility

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL = Deno.env.get("LOG_LEVEL") || "info";

const shouldLog = (level: LogLevel): boolean => {
  const levels: LogLevel[] = ["debug", "info", "warn", "error"];
  const currentIndex = levels.indexOf(LOG_LEVEL as LogLevel);
  const targetIndex = levels.indexOf(level);
  return targetIndex >= currentIndex;
};

const formatData = (data?: unknown): string => {
  if (data === undefined || data === null) return "";
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
};

export const logger = {
  debug: (message: string, data?: unknown) => {
    if (shouldLog("debug")) {
      console.log(`[DEBUG] ${message}`, data ? formatData(data) : "");
    }
  },
  
  info: (message: string, data?: unknown) => {
    if (shouldLog("info")) {
      console.log(`[INFO] ${message}`, data ? formatData(data) : "");
    }
  },
  
  warn: (message: string, data?: unknown) => {
    if (shouldLog("warn")) {
      console.warn(`[WARN] ${message}`, data ? formatData(data) : "");
    }
  },
  
  error: (message: string, error?: unknown) => {
    if (shouldLog("error")) {
      console.error(`[ERROR] ${message}`, error || "");
    }
  },
  
  // Convenience methods with emojis for demo chat
  start: (version: string) => {
    console.log(`🚀 DEMO CHAT FSM ${version} - CLEAN START`);
  },
  
  transition: (from: string, to: string) => {
    console.log(`🔄 Transition: ${from} → ${to}`);
  },
  
  intent: (nluIntent: string, fsmIntent: string) => {
    console.log(`🧠 NLU Intent: ${nluIntent}`);
    console.log(`🎯 FSM Intent: ${fsmIntent}`);
  },
  
  tourMatch: (type: string, tourName: string) => {
    console.log(`🎫 Tour matched by ${type}: ${tourName}`);
  },
  
  multipleTours: (tourNames: string[]) => {
    console.log(`🎫 Multiple tours matched: ${tourNames.join(", ")}`);
  },
};
