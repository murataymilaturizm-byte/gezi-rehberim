// Conversation history service

import type { ConversationMessage } from '../types.ts';

export async function getConversationHistory(
  supabase: any,
  phone: string,
  agencyId: string,
  limit: number = 10
): Promise<ConversationMessage[]> {
  try {
    const { data, error } = await supabase
      .from('whatsapp_conversations')
      .select('role, content')
      .eq('phone', phone)
      .eq('agency_id', agencyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return (data || []).reverse();
  } catch (error) {
    console.error('Error getting conversation history:', error);
    return [];
  }
}

export async function saveMessage(
  supabase: any,
  phone: string,
  role: 'user' | 'assistant',
  content: string,
  agencyId: string
) {
  try {
    await supabase
      .from('whatsapp_conversations')
      .insert({
        phone,
        role,
        content,
        agency_id: agencyId
      });
  } catch (error) {
    console.error('Error saving message:', error);
  }
}
