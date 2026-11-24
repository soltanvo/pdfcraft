import Link from 'next/link';
import { FileText, Mail, RefreshCw, ShieldCheck } from 'lucide-react';

export type LegalDocKind = 'terms' | 'privacy' | 'refunds';

const SUPPORT_EMAIL = 'ssyyss368@gmail.com';
const LAST_UPDATED = 'November 24, 2026';

export function LegalDocumentPage({
  kind,
  locale = 'en',
}: {
  kind: LegalDocKind;
  locale?: string;
}) {
  const isArabic = locale === 'ar';

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-50 py-14 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header Card */}
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-xs space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold">
            {kind === 'terms' && <FileText className="w-3.5 h-3.5 text-amber-600" />}
            {kind === 'privacy' && <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />}
            {kind === 'refunds' && <RefreshCw className="w-3.5 h-3.5 text-blue-600" />}
            <span>SA AI • Legal &amp; Compliance</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
            {kind === 'terms' && (isArabic ? 'شروط الخدمة — Terms of Service' : 'Terms of Service')}
            {kind === 'privacy' && (isArabic ? 'سياسة الخصوصية — Privacy Policy' : 'Privacy Policy')}
            {kind === 'refunds' && (isArabic ? 'سياسة الاسترداد — Refund Policy' : 'Refund Policy')}
          </h1>

          <p className="text-sm text-slate-500">
            Last Updated: {LAST_UPDATED} &bull; Platform: <strong>SA AI</strong> &bull; Support:{' '}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              className="text-blue-700 font-semibold hover:underline"
            >
              {SUPPORT_EMAIL}
            </a>
          </p>

          {/* Quick Legal Navigation */}
          <div className="pt-3 flex flex-wrap gap-2.5 border-t border-slate-100 text-xs font-semibold">
            <Link
              href="/terms"
              className={`px-3 py-1.5 rounded-lg border transition-colors ${
                kind === 'terms'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-gray-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Terms of Service
            </Link>
            <Link
              href="/privacy"
              className={`px-3 py-1.5 rounded-lg border transition-colors ${
                kind === 'privacy'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-gray-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Privacy Policy
            </Link>
            <Link
              href="/refunds"
              className={`px-3 py-1.5 rounded-lg border transition-colors ${
                kind === 'refunds'
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-gray-50 text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              Refund Policy
            </Link>
          </div>
        </div>

        {/* Terms of Service Content */}
        {kind === 'terms' && (
          <div
            dir="ltr"
            className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-xs space-y-7 text-slate-700 text-sm sm:text-base leading-relaxed"
          >
            {isArabic && (
              <div
                dir="rtl"
                className="rounded-xl bg-gray-50 border border-slate-200 p-5 text-sm text-slate-700 space-y-2"
              >
                <p className="font-bold text-slate-900">ملخص شروط الاستخدام في منصة SA AI:</p>
                <p>
                  باستخدامك لأدوات PDF ومساعد الذكاء الاصطناعي في منصة <strong>SA AI</strong>، فإنك توافق على الالتزام بالاستخدام العادل والقانوني للأدوات والباقات، والحفاظ على أمان حسابك. للاستفسار أو الدعم: <strong>{SUPPORT_EMAIL}</strong>.
                </p>
              </div>
            )}

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">1. Acceptance of Terms</h2>
              <p>
                By accessing or using <strong>SA AI</strong> (our web-based suite of 130+ PDF utilities and AI document analysis tools), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, please discontinue use of the service.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">2. Description of Services</h2>
              <p>
                SA AI provides browser-based PDF editing, conversion, compression, merging, splitting, signing, and OCR tools alongside AI-assisted document analysis, summarization, and translation features.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">3. User Accounts &amp; Authentication</h2>
              <p>
                Certain features (including AI Studio credits and paid subscriptions) require signing in with Google via Firebase Authentication. You are responsible for maintaining the security of your account and all activities performed under your credentials.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">4. Subscriptions, Billing &amp; Fair Use</h2>
              <p>
                SA AI offers a Free tier (5 starter credits with watermarked exports) as well as paid monthly subscription tiers (Starter Plan at $2/month and Pro Plan at $5/month) that provide expanded AI credits, priority processing, and watermark-free PDF exports.
              </p>
              <p>
                Fair-use limits apply to prevent automated scraping, abuse, or excessive API load. Subscriptions are billed monthly through our Merchant of Record, <strong>Paddle</strong>, and may be canceled at any time prior to the next billing cycle.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">5. Acceptable Use &amp; Content Ownership</h2>
              <p>
                You retain 100% ownership and copyright of all documents and files you process on SA AI. You agree not to use the platform for unlawful content, malware distribution, copyright infringement, or attempts to circumvent usage limits or security controls.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">6. Disclaimer &amp; Limitation of Liability</h2>
              <p>
                SA AI is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis without warranties of any kind. While we strive for accuracy across all PDF and AI outputs, users should verify critical documents before relying on them. To the maximum extent permitted by law, SA AI shall not be liable for indirect, incidental, or consequential damages arising from service usage.
              </p>
            </section>

            <section className="space-y-2 pt-2 border-t border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">7. Contact &amp; Support</h2>
              <p>
                For questions regarding these Terms of Service or your SA AI subscription, contact our support team at{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-700 font-semibold hover:underline">
                  {SUPPORT_EMAIL}
                </a>.
              </p>
            </section>
          </div>
        )}

        {/* Privacy Policy Content */}
        {kind === 'privacy' && (
          <div
            dir="ltr"
            className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-xs space-y-7 text-slate-700 text-sm sm:text-base leading-relaxed"
          >
            {isArabic && (
              <div
                dir="rtl"
                className="rounded-xl bg-gray-50 border border-slate-200 p-5 text-sm text-slate-700 space-y-2"
              >
                <p className="font-bold text-slate-900">ملخص سياسة الخصوصية في منصة SA AI:</p>
                <p>
                  تتم معالجة ملفات PDF محلياً داخل متصفحك بالكامل دون رفعها أو تخزينها على خوادمنا. نجمع فقط الحد الأدنى من البيانات لإدارة الحساب والاشتراك (البريد الإلكتروني عبر Firebase Authentication ومعالجة الدفع عبر Paddle بصفته التاجر المسجل). للدعم: <strong>{SUPPORT_EMAIL}</strong>.
                </p>
              </div>
            )}

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">1. Client-Side PDF Processing (Zero File Storage)</h2>
              <p>
                At <strong>SA AI</strong>, your privacy is core to our architecture. All standard PDF operations (merging, splitting, compressing, converting, signing, watermarking, OCR, and editing) run <strong>locally inside your browser</strong> using client-side JavaScript and WebAssembly. Your PDF files are never uploaded to or stored on SA AI servers.
              </p>
              <p>
                When you voluntarily submit a prompt or document snippet to the optional SA AI Assistant, only the text or preview required to fulfill that single request is transmitted securely to generate your response and is not permanently stored on our servers.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">2. Account &amp; Subscription Information We Collect</h2>
              <p>
                To manage your account, credit balance, and subscription status, SA AI collects only the essential data needed to operate the service:
              </p>
              <ul className="list-disc ps-6 space-y-1.5">
                <li>
                  <strong>Authentication Data (Firebase Authentication &amp; Firestore):</strong> Your email address, display name, profile photo URL, user ID, credit balance, and active plan tier when you sign in with Google.
                </li>
                <li>
                  <strong>Payment &amp; Billing Data (Paddle):</strong> All payments and subscriptions are processed by <strong>Paddle</strong> (our Merchant of Record). SA AI does not collect, process, or store your credit card numbers or sensitive banking details. We store only non-sensitive billing identifiers returned by Paddle (such as customer ID, subscription ID, plan name, and subscription status).
                </li>
                <li>
                  <strong>Local Browser Preferences:</strong> Language and UI settings stored locally in your browser.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">3. How We Use Information</h2>
              <p>
                We use your account data solely to authenticate access, track AI usage credits, unlock watermark-free exports for active subscribers, respond to customer support requests, and prevent fraud or service abuse. We never sell or rent your personal information to third parties.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">4. Data Retention &amp; Deletion</h2>
              <p>
                You may request deletion of your SA AI account profile and associated Firestore metadata at any time by emailing{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-700 font-semibold hover:underline">
                  {SUPPORT_EMAIL}
                </a>.
              </p>
            </section>

            <section className="space-y-2 pt-2 border-t border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">5. Contact Us</h2>
              <p>
                If you have questions about this Privacy Policy or how SA AI safeguards your data, reach out to{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-700 font-semibold hover:underline">
                  {SUPPORT_EMAIL}
                </a>.
              </p>
            </section>
          </div>
        )}

        {/* Refund Policy Content */}
        {kind === 'refunds' && (
          <div
            dir="ltr"
            className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-xs space-y-7 text-slate-700 text-sm sm:text-base leading-relaxed"
          >
            {isArabic && (
              <div
                dir="rtl"
                className="rounded-xl bg-gray-50 border border-slate-200 p-5 text-sm text-slate-700 space-y-2"
              >
                <p className="font-bold text-slate-900">ملخص سياسة الاسترداد في منصة SA AI:</p>
                <p>
                  نوفر ضمان استرداد كامل للاشتراكات الشهرية خلال <strong>7 أيام</strong> من تاريخ الدفع في حال وجود مشكلة تقنية غير محلولة أو عدم الرضا عن الخدمة، عبر التواصل المباشر مع فريق الدعم على البريد: <strong>{SUPPORT_EMAIL}</strong>.
                </p>
              </div>
            )}

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">1. 7-Day Refund Guarantee</h2>
              <p>
                We stand behind the quality of <strong>SA AI</strong>. If you experience an unresolved technical issue or are not satisfied with your Starter ($2/month) or Pro ($5/month) monthly subscription, you may request a full refund within <strong>7 days</strong> of your initial subscription payment or renewal date.
              </p>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">2. How to Request a Refund</h2>
              <p>
                To submit a refund request, simply contact us directly at{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-700 font-semibold hover:underline">
                  {SUPPORT_EMAIL}
                </a>{' '}
                and include:
              </p>
              <ul className="list-disc ps-6 space-y-1.5">
                <li>The email address associated with your SA AI account.</li>
                <li>Your Paddle order or transaction ID (from your Paddle receipt email).</li>
                <li>A brief description of the technical issue or reason for your request.</li>
              </ul>
            </section>

            <section className="space-y-2">
              <h2 className="text-xl font-bold text-slate-900">3. Processing &amp; Subscription Cancellation</h2>
              <p>
                All orders and refunds are processed via <strong>Paddle</strong>, our Merchant of Record. Approved refunds are typically returned to your original payment method within 3–5 business days depending on your card issuer or bank. Upon refund approval, the corresponding paid subscription returns to the Free tier.
              </p>
              <p>
                You can also cancel an active monthly subscription at any time to prevent future recurring charges before your next billing date.
              </p>
            </section>

            <section className="space-y-2 pt-2 border-t border-slate-100">
              <h2 className="text-xl font-bold text-slate-900">4. Support Contact</h2>
              <div className="flex items-center gap-2 pt-1">
                <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-blue-700 font-semibold hover:underline">
                  {SUPPORT_EMAIL}
                </a>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
