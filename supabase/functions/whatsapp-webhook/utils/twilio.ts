// Twilio TwiML response utilities

export function createTwiMLResponse(message: string): string {
  // Escape XML special characters
  const escapedMessage = message
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${escapedMessage}</Message>
</Response>`;
}

export function createTwiMLHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/xml; charset=utf-8'
  };
}
