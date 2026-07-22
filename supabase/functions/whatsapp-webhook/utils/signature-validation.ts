// Twilio Signature Validation for Deno
// Based on Twilio's security best practices

/**
 * Validates Twilio webhook signature using HMAC-SHA1
 * @param authToken - Agency's Twilio auth token
 * @param signature - X-Twilio-Signature header value
 * @param url - Full webhook URL
 * @param params - POST parameters as key-value object
 * @returns true if signature is valid
 */
export async function validateTwilioSignature(
  authToken: string,
  signature: string,
  url: string,
  params: Record<string, string>
): Promise<boolean> {
  try {
    // 1. Sort parameters alphabetically and concatenate
    const sortedKeys = Object.keys(params).sort();
    let data = url;
    
    for (const key of sortedKeys) {
      data += key + params[key];
    }

    // 2. Create HMAC-SHA1 hash
    const encoder = new TextEncoder();
    const keyData = encoder.encode(authToken);
    const messageData = encoder.encode(data);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);

    // 3. Convert to base64
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureBase64 = btoa(String.fromCharCode(...signatureArray));

    // 4. Compare signatures
    return signatureBase64 === signature;
  } catch (error) {
    console.error('❌ Signature validation error:', error);
    return false;
  }
}

/**
 * Resolves agency by AccountSid from Supabase
 */
export async function resolveAgencyByAccountSid(
  supabase: any,
  accountSid: string
): Promise<{ agency: any; error: string | null }> {
  const { data: agency, error } = await supabase
    .from('agencies')
    .select('*')
    .eq('twilio_account_sid', accountSid)
    .single();

  if (error || !agency) {
    console.error(`❌ Unknown agency AccountSid: ${accountSid}`);
    return { agency: null, error: 'Agency not found' };
  }

  // 2026-07-22: twilio_auth_token agency_secrets'ta → hydrate et.
  const { hydrateAgencySecrets } = await import("../../_shared/agency-secrets.ts");
  await hydrateAgencySecrets(supabase, agency);
  return { agency, error: null };
}

/**
 * Extracts POST parameters from FormData
 */
export function extractFormDataParams(formData: FormData): Record<string, string> {
  const params: Record<string, string> = {};
  
  for (const [key, value] of formData.entries()) {
    if (typeof value === 'string') {
      params[key] = value;
    }
  }
  
  return params;
}

/**
 * Validates Twilio webhook request for a specific agency
 */
export async function validateTwilioWebhook(
  req: Request,
  formData: FormData,
  supabase: any
): Promise<{ 
  isValid: boolean; 
  agency: any | null; 
  error: string | null;
  accountSid: string;
}> {
  // 1. Extract AccountSid
  const accountSid = formData.get('AccountSid')?.toString() || '';
  
  if (!accountSid) {
    console.error('❌ Missing AccountSid in request');
    return { isValid: false, agency: null, error: 'Missing AccountSid', accountSid: '' };
  }

  // 2. Resolve agency
  const { agency, error: agencyError } = await resolveAgencyByAccountSid(supabase, accountSid);
  
  if (agencyError || !agency) {
    return { isValid: false, agency: null, error: agencyError, accountSid };
  }

  // 3. Check if agency has auth token configured
  const authToken = agency.twilio_auth_token;
  
  if (!authToken) {
    console.warn(`⚠️ Agency ${agency.name} (${accountSid}) has no auth token configured`);
    // For now, we'll allow requests without auth token for backward compatibility
    // In production, you might want to reject these:
    // return { isValid: false, agency: null, error: 'Auth token not configured', accountSid };
    return { isValid: true, agency, error: null, accountSid };
  }

  // 4. Get signature from headers
  const signature = req.headers.get('X-Twilio-Signature') || '';
  
  if (!signature) {
    console.error(`❌ Missing X-Twilio-Signature header for agency ${agency.name}`);
    return { isValid: false, agency: null, error: 'Missing signature', accountSid };
  }

  // 5. Extract full URL
  const url = req.url;

  // 6. Extract POST parameters
  const params = extractFormDataParams(formData);

  // 7. Validate signature
  const isValid = await validateTwilioSignature(authToken, signature, url, params);

  if (!isValid) {
    console.error(`❌ Twilio signature validation failed for agency ${agency.name} (${accountSid})`);
    return { isValid: false, agency: null, error: 'Invalid signature', accountSid };
  }

  console.log(`✅ Twilio signature validated for agency ${agency.name}`);
  return { isValid: true, agency, error: null, accountSid };
}
