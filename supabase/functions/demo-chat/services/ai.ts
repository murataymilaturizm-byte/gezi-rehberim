// AI service for chat completions with tool calling support

import { CONFIG } from "../config/constants.ts";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("AI_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function callAI(
  messages: any[],
  _temperature: number = 1,
  tools?: any[],
  toolChoice?: any,
): Promise<any> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  // Anthropic requires "system" as a top-level parameter, not a message role.
  // Extract any system messages from the array and concatenate them.
  let systemPrompt = "";
  const conversationMessages: any[] = [];
  for (const m of messages) {
    if (m?.role === "system") {
      systemPrompt = systemPrompt ? `${systemPrompt}\n\n${m.content}` : m.content;
    } else if (m?.role === "user" || m?.role === "assistant") {
      conversationMessages.push({ role: m.role, content: m.content });
    }
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const requestBody: any = {
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        messages: conversationMessages,
      };

      if (systemPrompt) {
        requestBody.system = systemPrompt;
      }

      if (tools) {
        requestBody.tools = tools;
      }

      if (toolChoice) {
        requestBody.tool_choice = toolChoice;
      }

      const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") || "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(requestBody),
      }, CONFIG.AI_TIMEOUT_MS);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AI API error (attempt ${attempt}/${maxRetries}):`, response.status, errorText);

        // Check for specific error codes
        if (response.status === 503 || response.status === 529) {
          lastError = new Error("AI_SERVICE_UNAVAILABLE");
        } else if (response.status === 429) {
          lastError = new Error("AI_RATE_LIMIT");
        } else if (response.status === 401 || response.status === 403) {
          lastError = new Error("AI_PAYMENT_REQUIRED");
        } else {
          lastError = new Error(`AI_ERROR_${response.status}`);
        }

        // Retry for transient overload errors, throw immediately for others
        const isTransient = response.status === 503 || response.status === 529;
        if (!isTransient || attempt === maxRetries) {
          throw lastError;
        }

        // Wait before retry (exponential backoff)
        await delay(1000 * attempt);
        continue;
      }

      const data = await response.json();

      // If a tool was used, return the full response for processing
      if (data.stop_reason === "tool_use") {
        return data;
      }

      // Anthropic returns content as an array of blocks; pick the text block(s)
      const text = (data.content || [])
        .filter((b: any) => b?.type === "text")
        .map((b: any) => b.text)
        .join("");
      return text || "";
    } catch (error) {
      console.error(`Error calling AI (attempt ${attempt}/${maxRetries}):`, error);
      lastError = error instanceof Error ? error : new Error("AI_UNKNOWN_ERROR");

      // Check if it's a service unavailable error and we should retry
      const shouldRetry =
        (lastError.message?.includes("AI_SERVICE_UNAVAILABLE") || lastError.message?.includes("AI_TIMEOUT")) &&
        attempt < maxRetries;

      if (!shouldRetry) {
        throw lastError;
      }

      // Wait before retry
      await delay(1000 * attempt);
    }
  }

  throw lastError || new Error("AI_UNKNOWN_ERROR");
}
