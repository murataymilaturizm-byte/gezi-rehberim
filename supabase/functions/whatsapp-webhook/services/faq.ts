// FAQ check and matching service

export async function checkFAQ(
  supabase: any,
  userMessage: string,
  agencyId: string,
  language: string
): Promise<string | null> {
  try {
    // Get active FAQs for the agency and language
    const { data: faqs, error } = await supabase
      .from('faq_templates')
      .select('*')
      .eq('agency_id', agencyId)
      .eq('is_active', true)
      .or(`language.eq.${language},language.is.null`);

    if (error || !faqs || faqs.length === 0) {
      return null;
    }

    const lowerMessage = userMessage.toLowerCase();
    
    // Check for keyword matches
    for (const faq of faqs) {
      if (faq.keywords && Array.isArray(faq.keywords)) {
        for (const keyword of faq.keywords) {
          if (lowerMessage.includes(keyword.toLowerCase())) {
            // Increment usage count
            await supabase
              .from('faq_templates')
              .update({ usage_count: (faq.usage_count || 0) + 1 })
              .eq('id', faq.id);
            
            return `❓ **${faq.question}**\n\n${faq.answer}`;
          }
        }
      }
      
      // Check if question matches
      if (lowerMessage.includes(faq.question.toLowerCase().substring(0, 15))) {
        await supabase
          .from('faq_templates')
          .update({ usage_count: (faq.usage_count || 0) + 1 })
          .eq('id', faq.id);
        
        return `❓ **${faq.question}**\n\n${faq.answer}`;
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error checking FAQ:', error);
    return null;
  }
}
