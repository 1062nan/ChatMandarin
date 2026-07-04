import { Card, CardContent } from '@/components/ui/card'

export const metadata = { title: 'Privacy Policy' }

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold">Privacy Policy</h1>

      <Card className="mb-6">
        <CardContent className="space-y-4 p-6 text-sm leading-relaxed text-muted-foreground">
          <p><strong className="text-foreground">Last updated:</strong> July 2026</p>

          <p>ChatMandarin (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the website chatmandarin.cc and related services. This Privacy Policy explains how we collect, use, and protect your information.</p>

          <h2 className="text-lg font-semibold text-foreground">Information We Collect</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li><strong>Account information:</strong> Email address, display name, authentication tokens (managed by Supabase Auth).</li>
            <li><strong>Learning data:</strong> Your HSK level, conversation transcripts, scores, mistakes, and progress data.</li>
            <li><strong>Audio data:</strong> Voice recordings are processed in real-time for speech recognition. We do <strong>NOT</strong> store your voice recordings unless you explicitly submit an HSKK mock test.</li>
            <li><strong>Usage data:</strong> Browser type, device information, approximate location (country-level), and interaction logs.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">How We Use Your Data</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>To provide AI-powered Chinese conversation practice and feedback.</li>
            <li>To track your learning progress and personalize your experience.</li>
            <li>To process subscription payments (via Lemon Squeezy, our Merchant of Record).</li>
            <li>To improve our services through aggregated analytics.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">Third-Party Services</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li><strong>Supabase</strong> (Netherlands) — Authentication and database hosting.</li>
            <li><strong>DeepSeek</strong> (China) — AI language model for conversation generation.</li>
            <li><strong>Volcengine</strong> (China) — Speech recognition and text-to-speech.</li>
            <li><strong>Lemon Squeezy</strong> (USA) — Payment processing (Merchant of Record).</li>
            <li><strong>Cloudflare</strong> (USA) — Web hosting, CDN, and security.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">Data Storage & Security</h2>
          <p>Your data is encrypted in transit (TLS) and at rest. Access is controlled via Row Level Security (RLS) policies — you can only access your own data.</p>

          <h2 className="text-lg font-semibold text-foreground">Your Rights</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li><strong>Access:</strong> You can view all your data in the app.</li>
            <li><strong>Deletion:</strong> You can delete your account and all associated data at any time by emailing hello@chatmandarin.cc.</li>
            <li><strong>Export:</strong> You can request a data export (JSON/CSV) of all your information.</li>
            <li><strong>Opt-out:</strong> You can unsubscribe from marketing emails at any time.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">GDPR & CCPA Compliance</h2>
          <p>We comply with the EU General Data Protection Regulation (GDPR) and the California Consumer Privacy Act (CCPA). For data deletion or export requests, contact hello@chatmandarin.cc.</p>

          <h2 className="text-lg font-semibold text-foreground">Children&apos;s Privacy</h2>
          <p>ChatMandarin is not directed at children under 13. We do not knowingly collect personal information from children under 13.</p>

          <h2 className="text-lg font-semibold text-foreground">Contact</h2>
          <p>For privacy questions or requests, email: hello@chatmandarin.cc</p>
        </CardContent>
      </Card>
    </div>
  )
}
