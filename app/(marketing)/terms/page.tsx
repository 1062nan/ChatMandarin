import { Card, CardContent } from '@/components/ui/card'

export const metadata = { title: 'Terms of Service' }

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="mb-8 text-3xl font-bold">Terms of Service</h1>

      <Card className="mb-6">
        <CardContent className="space-y-4 p-6 text-sm leading-relaxed text-muted-foreground">
          <p><strong className="text-foreground">Last updated:</strong> July 2026</p>

          <h2 className="text-lg font-semibold text-foreground">1. Acceptance of Terms</h2>
          <p>By accessing or using ChatMandarin (&quot;the Service&quot;), you agree to be bound by these Terms of Service. If you do not agree, please do not use the Service.</p>

          <h2 className="text-lg font-semibold text-foreground">2. Description of Service</h2>
          <p>ChatMandarin is an AI-powered Chinese language learning platform that provides conversation practice, HSKK exam preparation, and progress tracking. The Service is provided via web browser (PWA).</p>

          <h2 className="text-lg font-semibold text-foreground">3. Free and Paid Plans</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li><strong>Free Plan:</strong> Limited to 5 minutes of AI conversation per day and 1 HSKK mock test per day.</li>
            <li><strong>Plus Plan ($14.99/month):</strong> Unlimited conversation, all scenarios, HSKK mock tests (3/month).</li>
            <li><strong>Pro Plan ($29/month):</strong> Everything in Plus, unlimited HSKK, detailed reports, priority AI.</li>
          </ul>
          <p>Subscription payments are processed by Lemon Squeezy (our Merchant of Record). You can cancel your subscription at any time. Cancellations take effect at the end of the current billing period.</p>

          <h2 className="text-lg font-semibold text-foreground">4. Refund Policy</h2>
          <p>We offer a 7-day money-back guarantee for first-time subscribers. If you are not satisfied within 7 days of your first payment, email hello@chatmandarin.cc for a full refund. Subsequent billing periods are non-refundable.</p>

          <h2 className="text-lg font-semibold text-foreground">5. Acceptable Use</h2>
          <ul className="list-disc space-y-1 pl-6">
            <li>Do not abuse, overload, or reverse-engineer the Service.</li>
            <li>Do not share your account credentials with others.</li>
            <li>Do not use automated systems (bots, scrapers) without permission.</li>
            <li>Do not use the Service for any illegal or harmful purpose.</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground">6. AI Accuracy Disclaimer</h2>
          <p>ChatMandarin uses AI models for speech recognition, conversation generation, and scoring. While we strive for accuracy, AI-generated content may contain errors. The Service is for educational purposes only and should not be used as a substitute for professional language assessment.</p>

          <h2 className="text-lg font-semibold text-foreground">7. Intellectual Property</h2>
          <p>All content on ChatMandarin (including code, design, HSKK test materials, and UI) is owned by ChatMandarin. HSK and HSKK are official trademarks of the Chinese Ministry of Education. ChatMandarin is not affiliated with or endorsed by the Chinese government.</p>

          <h2 className="text-lg font-semibold text-foreground">8. Limitation of Liability</h2>
          <p>ChatMandarin is provided &quot;as is&quot; without warranties of any kind. We are not liable for any damages arising from the use of the Service, including but not limited to: loss of data, inaccurate AI feedback, or service interruptions.</p>

          <h2 className="text-lg font-semibold text-foreground">9. Changes to Terms</h2>
          <p>We may update these Terms at any time. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>

          <h2 className="text-lg font-semibold text-foreground">10. Contact</h2>
          <p>For questions about these Terms, email: hello@chatmandarin.cc</p>
        </CardContent>
      </Card>
    </div>
  )
}
