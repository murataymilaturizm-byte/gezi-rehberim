// AI service for chat completions with tool calling support

export async function callAI(
  messages: any[],
  temperature: number = 0.7,
  tools?: any[],
  toolChoice?: any
): Promise<any> {
  try {
    const requestBody: any = {
      model: 'google/gemini-2.5-flash',
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
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    
    // If tool was called, return the full message for processing
    if (data.choices[0]?.message?.tool_calls) {
      return data.choices[0].message;
    }
    
    return data.choices[0]?.message?.content || '';
  } catch (error) {
    console.error('Error calling AI:', error);
    throw error;
  }
}
