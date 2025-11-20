// Natural Language Understanding with AI tool calling
import type { ReservationInfo } from './types.ts';

export interface NLUResult {
  intent: string;
  language: string;
  entities: {
    destination?: string;
    tour_name?: string;
    dates?: string[];
    people_count?: { adults?: number; children?: number };
  };
  updates: Partial<ReservationInfo>;
  clarification_needed?: string;
}

const NLU_SYSTEM_PROMPT = `You are an NLU (Natural Language Understanding) system for a travel agency chatbot. 
Your job is to analyze user messages and extract intents and entities.

**Intents:**
- greeting: User says hello or starts conversation
- browse_tours: User wants to see available tours
- tour_search: User searches for specific destination/tour
- select_tour: User selects a specific tour
- provide_info: User provides reservation details (date, pax, name, phone)
- confirm_reservation: User confirms the booking
- change_info: User wants to modify information
- general: General questions or chat

**Entities to extract:**
- destination: City or country name
- tour_name: Specific tour name mentioned
- dates: Any dates mentioned
- people_count: Number of adults and children
- full_name: Customer's full name
- phone: Phone number

Return your analysis as structured data.`;

export async function analyzeUserMessage(
  userMessage: string,
  conversationSummary?: string,
  currentState?: string,
  selectedTour?: any,
  availableTours?: any[]
): Promise<NLUResult> {
  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Build context prompt
    let contextPrompt = `User message: "${userMessage}"\n\n`;
    
    if (conversationSummary) {
      contextPrompt += `Conversation so far: ${conversationSummary}\n\n`;
    }
    
    if (currentState) {
      contextPrompt += `Current state: ${currentState}\n\n`;
    }
    
    if (selectedTour) {
      contextPrompt += `Currently selected tour: ${selectedTour.title} (${selectedTour.destination})\n\n`;
    }
    
    if (availableTours && availableTours.length > 0) {
      contextPrompt += `Available tours:\n${availableTours.map(t => `- ${t.title} (${t.destination})`).join('\n')}\n\n`;
    }

    // Define tool for structured output
    const nluTool = {
      type: "function" as const,
      function: {
        name: "analyze_message",
        description: "Analyze user message and extract intent and entities",
        parameters: {
          type: "object",
          properties: {
            intent: {
              type: "string",
              enum: ["greeting", "browse_tours", "tour_search", "select_tour", "provide_info", "confirm_reservation", "change_info", "general"],
              description: "The detected user intent"
            },
            language: {
              type: "string",
              enum: ["tr", "en", "de", "ru", "ar", "fr", "es"],
              description: "The detected language"
            },
            entities: {
              type: "object",
              properties: {
                destination: { type: "string" },
                tour_name: { type: "string" },
                dates: { type: "array", items: { type: "string" } },
                people_count: {
                  type: "object",
                  properties: {
                    adults: { type: "number" },
                    children: { type: "number" }
                  }
                },
                full_name: { type: "string" },
                phone: { type: "string" }
              }
            },
            clarification_needed: { type: "string" }
          },
          required: ["intent", "language", "entities"]
        }
      }
    };

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: NLU_SYSTEM_PROMPT },
          { role: 'user', content: contextPrompt }
        ],
        tools: [nluTool],
        tool_choice: { type: "function", function: { name: "analyze_message" } },
        temperature: 0.3
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      // Fallback to general intent
      return {
        intent: 'general',
        language: 'tr',
        entities: {},
        updates: {}
      };
    }

    const analysis = JSON.parse(toolCall.function.arguments);
    
    // Convert entities to reservation updates
    const updates: Partial<ReservationInfo> = {};
    
    if (analysis.entities.people_count?.adults) {
      updates.paxAdult = analysis.entities.people_count.adults;
    }
    if (analysis.entities.people_count?.children) {
      updates.paxChild = analysis.entities.people_count.children;
    }
    if (analysis.entities.full_name) {
      updates.fullName = analysis.entities.full_name;
    }
    if (analysis.entities.phone) {
      updates.phone = analysis.entities.phone;
    }

    return {
      intent: analysis.intent,
      language: analysis.language,
      entities: analysis.entities,
      updates,
      clarification_needed: analysis.clarification_needed
    };

  } catch (error) {
    console.error('NLU error:', error);
    
    // Fallback to simple pattern matching
    return {
      intent: 'general',
      language: 'tr',
      entities: {},
      updates: {}
    };
  }
}

/**
 * Map NLU intent to FSM intent
 */
export function mapNLUIntentToFSMIntent(nluIntent: string): string {
  const mapping: Record<string, string> = {
    'browse_tours': 'browse_tours',
    'tour_search': 'tour_search',
    'select_tour': 'tour_selected',
    'provide_info': 'provide_info',
    'confirm_reservation': 'confirm_reservation',
    'change_info': 'change_info',
    'greeting': 'greeting',
    'general': 'general'
  };
  
  return mapping[nluIntent] || 'general';
}
