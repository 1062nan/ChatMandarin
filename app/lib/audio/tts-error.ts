/** Only known public protection codes become user-visible messages. */
export function ttsErrorMessage(data: { code?: unknown } | null | undefined): string {
  if(data?.code==='daily_limit') return 'Free audio limit reached: 10,000 requested characters per UTC day. Audio resets at 00:00 UTC; text practice remains available.'
  if(data?.code==='rate_limit') return 'Free audio allows 20 requests per minute. Wait up to one minute and retry; text practice remains available.'
  return 'Audio unavailable. Please retry or continue with the written example.'
}
