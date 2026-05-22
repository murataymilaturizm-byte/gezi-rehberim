// send-template-message — WhatsApp template gönderimi (gerçek Meta template API)
// Tüm modlar sendWhatsAppTemplate kullanır (24h muaf).
// Variable mapping: {full_name} → {{1}} → Meta body.parameters

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendWhatsAppTemplate, getMetaCredentials } from "../_shared/metaWhatsapp.ts";
// K4: tek finansal kaynak
import { calculateTotal } from "../shared/utils/finance.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// DB content'teki named variable'ları sırayla çıkar: {full_name} {tour_name} → ["full_name","tour_name"]
function extractOrderedVariables(content: string): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const m of (content.match(/\{(\w+)\}/g) || [])) {
    const name = m.replace(/[{}]/g, '');
    if (!seen.has(name)) { seen.add(name); ordered.push(name); }
  }
  return ordered;
}

// Named variable değerlerini → Meta body.parameters formatına çevir
// Pozisyonel değişken ("1","2") varsa → önceden tanımlı isimli alanlara sırayla map et
const POSITIONAL_VAR_ORDER = ["full_name", "tour_name", "date", "pax", "total_amount", "currency", "meeting_time", "meeting_point"];

function buildTemplateComponents(content: string, values: Record<string, string>): any[] {
  const vars = extractOrderedVariables(content);
  if (vars.length === 0) return [];

  const isPositional = vars.every(v => /^\d+$/.test(v));
  const parameters = isPositional
    ? vars.map((_, i) => ({ type: 'text', text: (POSITIONAL_VAR_ORDER[i] ? values[POSITIONAL_VAR_ORDER[i]] : undefined) ?? '' }))
    : vars.map(v => ({ type: 'text', text: values[v] || '' }));

  return [{ type: 'body', parameters }];
}

// KÖKEN SEBEP FIX (Meta log kanıtladı: "(#132001) template name (X) does not exist in en_US"):
// Önceki versiyonda toMetaLang fonksiyonu 'en' → 'en_US' çeviriyordu, AMA sync-meta-templates
// Meta'dan template'leri çekerken normalizeLang ile 'en_US' → 'en' indiriyor (DB'ye basit kod yazar).
// Yani Meta'da template kayıtlı dil = DB'deki language (örn. 'en'). Geri gönderirken 'en_US'
// yapmak yanlış idi — Meta o dilde template bulamıyordu.
//
// ÇÖZÜM: Hiçbir dönüşüm yapma. DB'deki language değerini Meta'ya AYNEN gönder.
// (Bu helper artık identity; çağrı yerleri tmpl.language direkt kullanır — fonksiyon kaldırıldı.)

// template_send_log'a kayıt at (non-blocking)
async function logSend(supabase: any, payload: {
  agency_id: string; template_type: string; language: string;
  recipient_phone: string; recipient_name?: string | null;
  registration_id?: string | null; success: boolean; error_message?: string | null;
}) {
  await supabase.from('template_send_log').insert({
    ...payload,
    sent_at: new Date().toISOString(),
  }).catch((e: any) => console.error('[send-template] log insert failed:', e.message));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json();

    // ═══════════════════════════════════════════════════════════
    // MODE 1: Direct (test / bypass) — body.templateName direkt
    // ═══════════════════════════════════════════════════════════
    if (body.phone && body.templateName) {
      const phoneNumberId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || '';
      const accessToken   = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || '';

      if (!phoneNumberId || !accessToken) {
        return new Response(
          JSON.stringify({ error: 'Missing WHATSAPP_PHONE_NUMBER_ID or WHATSAPP_ACCESS_TOKEN' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const phone    = body.phone.replace('+', '').trim();
      // FIX: default basit kod 'en' (DB normalize edilmiş formatla tutarlı).
      // Arayan farklı bir kod gönderirse (body.languageCode) onu kullanır — flex.
      const langCode = body.languageCode || 'en';
      const comps    = body.components || [];

      console.log(`📤 [MODE1] Direct template: ${body.templateName} → ${phone} (${langCode})`);
      const result = await sendWhatsAppTemplate(phoneNumberId, accessToken, phone, body.templateName, langCode, comps);
      return new Response(
        JSON.stringify({ success: result.success, messageId: result.messageId, error: result.error }),
        { status: result.success ? 200 : 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // MODE 2: Manuel (panel'den — agencyId + phone + templateKey)
    // ═══════════════════════════════════════════════════════════
    if (body.agencyId && body.phone && body.templateKey && !body.registrationId) {
      const { agencyId, phone: rawPhone, templateKey, language: lang, variableValues, recipientName } = body;

      const { data: agency } = await supabase
        .from('agencies')
        .select('id, name, meta_phone_number_id, meta_access_token')
        .eq('id', agencyId)
        .single();

      const creds = getMetaCredentials(agency);
      if (!creds.accessToken || !creds.phoneNumberId) {
        return new Response(
          JSON.stringify({ error: 'WhatsApp credentials not configured for this agency' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: tmpl } = await (supabase as any)
        .from('message_templates')
        .select('*')
        .eq('agency_id', agencyId)
        .eq('template_key', templateKey)
        .eq('language', lang || 'tr')
        .eq('is_active', true)
        .maybeSingle();

      if (!tmpl) {
        // is_active=false olabilir → sync-meta-templates eski bug'ı, SQL fix gerekli olabilir
        const { data: anyTmpl } = await (supabase as any)
          .from('message_templates')
          .select('id, language, is_active, meta_status')
          .eq('agency_id', agencyId)
          .eq('template_key', templateKey)
          .eq('language', lang || 'tr')
          .maybeSingle();
        return new Response(
          JSON.stringify({
            error: 'Template not found or not active (is_active=false)',
            debug: {
              templateKey, language: lang || 'tr', agencyId,
              foundButInactive: !!anyTmpl,
              foundStatus: anyTmpl ? { is_active: anyTmpl.is_active, meta_status: anyTmpl.meta_status } : null,
              hint: anyTmpl && !anyTmpl.is_active
                ? "Template exists but is_active=false. Run SQL: UPDATE message_templates SET is_active=true WHERE meta_status='APPROVED'"
                : "Template does not exist for this agency+key+language. Check sync-meta-templates was run.",
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const normalizedPhone = rawPhone.replace('whatsapp:', '').replace('+', '').trim();
      // FIX: DB'deki language değeri Meta'da template'in kayıtlı olduğu dil ile aynı
      // (sync-meta-templates'in normalize ettiği basit kod). Dönüşüm YOK.
      const langCode        = tmpl.language;
      const comps           = buildTemplateComponents(tmpl.content, variableValues || {});
      const _varCount       = comps[0]?.parameters?.length ?? 0;
      const _emptyParams    = comps[0]?.parameters?.filter((p: any) => !p.text || p.text === '').length ?? 0;

      console.log(`📤 [MODE2] Manual template: ${tmpl.template_key} → ${normalizedPhone} (${langCode})`);
      console.log(`[MODE2] Components:`, JSON.stringify(comps));

      const result = await sendWhatsAppTemplate(creds.phoneNumberId, creds.accessToken, normalizedPhone, tmpl.template_key, langCode, comps);

      if (!result.success) {
        // Meta'nın gerçek hatasını detayla — frontend'in görmesi için
        return new Response(
          JSON.stringify({
            success: false,
            error: `Meta API: ${result.error || 'unknown error'}`,
            debug: {
              mode: 'MODE2_manual',
              templateKey: tmpl.template_key,
              dbLanguage: tmpl.language,
              metaLangCode: langCode,
              normalizedPhone,
              paramCount: _varCount,
              emptyParamCount: _emptyParams,
              metaStatus: tmpl.meta_status,
              isActive: tmpl.is_active,
              hasPhoneNumberId: !!creds.phoneNumberId,
              hasAccessToken: !!creds.accessToken,
              metaError: result.error,
            },
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Konuşma geçmişi
      await supabase.from('whatsapp_conversations').insert({
        phone: normalizedPhone, role: 'assistant',
        content: tmpl.content, agency_id: agencyId,
        metadata: { template_key: tmpl.template_key, sent_via: 'template', message_id: result.messageId },
      });

      await logSend(supabase, {
        agency_id: agencyId, template_type: tmpl.template_key, language: tmpl.language,
        recipient_phone: normalizedPhone, recipient_name: recipientName || null,
        registration_id: null, success: true,
      });

      return new Response(
        JSON.stringify({ success: true, messageId: result.messageId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ═══════════════════════════════════════════════════════════
    // MODE 3: Rezervasyon bazlı (registrationId + templateKey)
    // ═══════════════════════════════════════════════════════════
    const { registrationId, templateKey, language: bodyLanguage } = body;

    console.log('[MODE3] Send template request:', { registrationId, templateKey });

    const { data: registration, error: regError } = await supabase
      .from('registrations')
      .select(`
        *,
        tours:tour_id (title, destination, hareket_noktasi, toplanma_saati),
        tour_dates:tour_date_id (departure_date, price_adult),
        agencies:agency_id (id, name, whatsapp_phone_number, meta_phone_number_id, meta_access_token)
      `)
      .eq('id', registrationId)
      .single();

    if (regError || !registration) {
      return new Response(
        JSON.stringify({ error: 'Registration not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Dil: userProfile öncelikli
    let language = bodyLanguage || 'tr';
    const { data: userProfile } = await supabase
      .from('whatsapp_user_profiles')
      .select('language_preference')
      .eq('phone', registration.phone.replace('+', ''))
      .eq('agency_id', registration.agency_id)
      .maybeSingle();
    if (userProfile?.language_preference) language = userProfile.language_preference;

    // Template (dil + fallback 'tr')
    let tmpl: any = null;
    const { data: tmplData } = await (supabase as any)
      .from('message_templates')
      .select('*')
      .eq('agency_id', registration.agency_id)
      .eq('template_key', templateKey)
      .eq('language', language)
      .eq('is_active', true)
      .single();

    tmpl = tmplData;

    if (!tmpl && language !== 'tr') {
      const { data: fallback } = await (supabase as any)
        .from('message_templates')
        .select('*')
        .eq('agency_id', registration.agency_id)
        .eq('template_key', templateKey)
        .eq('language', 'tr')
        .eq('is_active', true)
        .single();
      if (fallback) { tmpl = fallback; language = 'tr'; }
    }

    if (!tmpl) {
      return new Response(
        JSON.stringify({ error: 'Template not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Credential (DB önce, env fallback)
    const agency = registration.agencies as any;
    const credentials = getMetaCredentials(agency);

    if (!credentials.accessToken || !credentials.phoneNumberId) {
      return new Response(
        JSON.stringify({ error: 'WhatsApp credentials not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Variable değerleri
    const varValues: Record<string, string> = {
      full_name:     registration.full_name || '',
      tour_name:     registration.tours?.title || '',
      date:          registration.tour_dates?.departure_date
                       ? new Date(registration.tour_dates.departure_date)
                           .toLocaleDateString('tr-TR', { year: 'numeric', month: 'long', day: 'numeric' })
                       : '',
      pax:           String(registration.pax || ''),
      // K3 + K4: Önce DB snapshot (total_amount), yoksa K4 merkezi hesap.
      // Frontend ile aynı kural — pax × price_adult, Math.round.
      total_amount:  String(
        (registration as any).total_amount && Number((registration as any).total_amount) > 0
          ? Number((registration as any).total_amount)
          : calculateTotal(registration.pax, registration.tour_dates?.price_adult)
      ),
      currency:      'TRY',
      meeting_time:  registration.tours?.toplanma_saati || '09:00',
      meeting_point: registration.tours?.hareket_noktasi || 'Belirlenen toplanma noktası',
    };

    const normalizedPhone = registration.phone.replace('whatsapp:', '').replace('+', '').trim();
    // FIX: DB language değeri Meta'da kayıtlı dil ile aynı — dönüşüm YOK.
    const langCode        = tmpl.language;
    const comps           = buildTemplateComponents(tmpl.content, varValues);
    const _varCount       = comps[0]?.parameters?.length ?? 0;
    const _emptyParams    = comps[0]?.parameters?.filter((p: any) => !p.text || p.text === '').length ?? 0;

    console.log(`📤 [MODE3] Reg template: ${tmpl.template_key} → ${normalizedPhone} (${langCode})`);
    console.log(`[MODE3] Components:`, JSON.stringify(comps));

    const result = await sendWhatsAppTemplate(
      credentials.phoneNumberId, credentials.accessToken,
      normalizedPhone, tmpl.template_key, langCode, comps
    );

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Meta API: ${result.error || 'unknown error'}`,
          debug: {
            mode: 'MODE3_registration',
            templateKey: tmpl.template_key,
            dbLanguage: tmpl.language,
            metaLangCode: langCode,
            normalizedPhone,
            paramCount: _varCount,
            emptyParamCount: _emptyParams,
            metaStatus: tmpl.meta_status,
            isActive: tmpl.is_active,
            hasPhoneNumberId: !!credentials.phoneNumberId,
            hasAccessToken: !!credentials.accessToken,
            metaError: result.error,
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preview (variables doldurulmuş)
    let preview = tmpl.content;
    Object.entries(varValues).forEach(([k, v]) => {
      preview = preview.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    });

    await supabase.from('whatsapp_conversations').insert({
      phone: normalizedPhone, role: 'assistant',
      content: preview, agency_id: registration.agency_id,
      metadata: { template_key: tmpl.template_key, sent_via: 'template', message_id: result.messageId },
    });

    await logSend(supabase, {
      agency_id: registration.agency_id, template_type: tmpl.template_key, language: tmpl.language,
      recipient_phone: normalizedPhone, recipient_name: registration.full_name || null,
      registration_id: registrationId, success: true,
    });

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId, template: tmpl.subject }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[send-template-message] Error:', error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
