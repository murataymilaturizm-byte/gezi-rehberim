// Refactored prompt builder - clean and modular
import type { AIPromptContext } from "./types.ts";
import { formatDateHeader, getMultipleTourWarning } from "./prompts/helpers.ts";
import { getRolePrompt } from "./prompts/roles/index.ts";
import { getTonePrompt } from "./prompts/tones/index.ts";
import { getFormatPrompt } from "./prompts/formats.ts";
import { getStagePrompt } from "./prompts/stages/index.ts";
import { getAgencyInfo } from "./prompts/agency.ts";

/**
 * Main function to build system prompt
 * Combines all prompt components in the correct order
 */
export function buildSystemPrompt(context: AIPromptContext): string {
  const { language, tone } = context;

  const promptParts = [
    formatDateHeader(language),
    getRolePrompt(language),
    getTonePrompt(language, tone),
    getFormatPrompt(language),
    getStagePrompt(context),
    getAgencyInfo(context, language),
    getMultipleTourWarning(context, language),
  ];

  // Filter out empty parts and join with double newlines
  return promptParts.filter((part) => part && part.trim() !== "").join("\n\n");
}

// Re-export helper functions for backward compatibility
export { formatDateForLanguage } from "./localization.ts";

export {
  formatToursList,
  formatTourDetails,
  formatCollectedInfo,
  formatReservationSummary,
} from "./prompts/helpers.ts";
