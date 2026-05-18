export default function Terms() {
  return (
    <div className="min-h-screen bg-bg text-text px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Terms of Service</h1>
        <p className="text-xs text-muted mb-8">Last updated: May 2026</p>

        <section className="space-y-6 text-sm text-text2 leading-relaxed">

          <div>
            <h2 className="text-base font-semibold text-text mb-2">1. Acceptance of Terms</h2>
            <p>By accessing or using BillByte ("the Service"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Service. These terms apply to all restaurant owners, staff, and any other users of the platform.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">2. Description of Service</h2>
            <p>BillByte is a cloud-based point-of-sale (POS) and restaurant management platform. It provides tools for order management, billing, inventory tracking, staff management, customer relationship management, and reporting. The Service is provided on a subscription basis following a free trial period.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">3. Account Registration</h2>
            <p>You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately at rohail230@gmail.com if you suspect any unauthorized use of your account.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">4. Free Trial</h2>
            <p>New accounts receive a free trial period as indicated at the time of registration. After the trial ends, continued access requires a paid subscription. We reserve the right to modify the trial duration at any time for new sign-ups.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">5. Payment and Billing</h2>
            <p>Subscription fees are billed in advance on a monthly or annual basis. All fees are non-refundable unless otherwise stated. We reserve the right to change pricing with 30 days' notice. Failure to pay may result in suspension or termination of your account.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">6. Acceptable Use</h2>
            <p>You agree not to use the Service to: (a) violate any applicable law or regulation; (b) transmit harmful, fraudulent, or misleading content; (c) attempt to gain unauthorized access to any part of the platform; (d) reverse-engineer or copy any part of the software; (e) resell or redistribute access to the Service without written permission.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">7. Your Data</h2>
            <p>You retain full ownership of all data you input into BillByte — including menu items, orders, customer records, and staff information. We do not sell your data to third parties. Upon account termination, you may request a data export within 30 days. After 30 days, data may be permanently deleted.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">8. Service Availability</h2>
            <p>We strive for high availability but do not guarantee uninterrupted access. The Service requires an active internet connection. We are not liable for losses arising from downtime, connectivity issues, or interruptions caused by third-party infrastructure providers.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">9. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, BillByte and its operators shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Service, including but not limited to lost revenue, lost data, or business interruption. Our total liability shall not exceed the amount paid by you in the 3 months preceding the claim.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">10. Termination</h2>
            <p>We may suspend or terminate your account at any time if you violate these Terms. You may cancel your account at any time by contacting support. Termination does not entitle you to a refund of any prepaid fees.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">11. Changes to Terms</h2>
            <p>We may update these Terms from time to time. We will notify you of significant changes via email or an in-app notice. Continued use of the Service after changes constitutes acceptance of the new Terms.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">12. Governing Law</h2>
            <p>These Terms are governed by the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts in India.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">13. Contact</h2>
            <p>For any questions about these Terms, contact us at <a href="mailto:rohail230@gmail.com" className="text-green underline">rohail230@gmail.com</a>.</p>
          </div>

        </section>

        <div className="mt-10 pt-6 border-t border-border flex gap-4 text-xs text-muted">
          <a href="#/privacy" className="hover:text-text transition-colors">Privacy Policy</a>
          <span>·</span>
          <a href="#/login" className="hover:text-text transition-colors">Back to Login</a>
        </div>
      </div>
    </div>
  )
}
