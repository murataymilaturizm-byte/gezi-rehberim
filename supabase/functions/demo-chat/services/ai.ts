// AI service for chat completions with tool calling support

export async function callAI(
  messages: any[],
  temperature: number = 0.7,
  tools?: any[],
  toolChoice?: any
): Promise<any> {
  const maxRetries = 2;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const requestBody: any = {
        model: 'google/gemini-2.5-pro', // UPGRADED: Using Pro for better instruction following
        messages,
        temperature
      };

      if (tools) {
        requestBody.tools = tools;
      }

      if (toolChoice) {
        requestBody.tool_choice = toolChoice;
      }

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`AI API error (attempt ${attempt}/${maxRetries}):`, response.status, errorText);
        
        // Check for specific error codes
        if (response.status === 503) {
          lastError = new Error('AI_SERVICE_UNAVAILABLE');
        } else if (response.status === 429) {
          lastError = new Error('AI_RATE_LIMIT');
        } else if (response.status === 402) {
          lastError = new Error('AI_PAYMENT_REQUIRED');
        } else {
          lastError = new Error(`AI_ERROR_${response.status}`);
        }
        
        // Retry for 503 errors, throw immediately for others
        if (response.status !== 503 || attempt === maxRetries) {
          throw lastError;
        }
        
        // Wait before retry (exponential backoff)
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      const data = await response.json();
      
      // If tool was called, return the full message for processing
      if (data.choices[0]?.message?.tool_calls) {
        return data.choices[0].message;
      }
      
      return data.choices[0]?.message?.content || '';
    } catch (error) {
      console.error(`Error calling AI (attempt ${attempt}/${maxRetries}):`, error);
      lastError = error instanceof Error ? error : new Error('AI_UNKNOWN_ERROR');
      
      // Check if it's a service unavailable error and we should retry
      const shouldRetry = lastError.message?.includes('AI_SERVICE_UNAVAILABLE') && attempt < maxRetries;
      
      if (!shouldRetry) {
        throw lastError;
      }
      
      // Wait before retry
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
  
  throw lastError || new Error('AI_UNKNOWN_ERROR');
}
