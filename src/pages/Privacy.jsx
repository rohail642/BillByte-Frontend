export default function Privacy() {
  return (
    <div className="min-h-screen bg-bg text-text px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">Privacy Policy</h1>
        <p className="text-xs text-muted mb-8">Last updated: May 2026</p>

        <section className="space-y-6 text-sm text-text2 leading-relaxed">

          <div>
            <h2 className="text-base font-semibold text-text mb-2">1. Overview</h2>
            <p>BillByte ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains what information we collect, how we use it, and your rights regarding your data. By using the Service, you agree to the practices described here.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">2. Information We Collect</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li><span className="font-medium text-text">Account information:</span> Restaurant name, owner name, email address, and phone number provided during registration.</li>
              <li><span className="font-medium text-text">Business data:</span> Menu items, pricing, order history, billing records, inventory levels, and table configurations entered by you.</li>
              <li><span className="font-medium text-text">Staff data:</span> Names, email addresses, roles, and login credentials for staff accounts you create.</li>
              <li><span className="font-medium text-text">Customer data:</span> Phone numbers and loyalty point balances for customers you add to the CRM. We do not collect payment card data.</li>
              <li><span className="font-medium text-text">Usage data:</span> Log data such as IP addresses, device type, browser type, and pages visited, for security and performance monitoring.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">3. How We Use Your Information</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>To provide and operate the BillByte platform.</li>
              <li>To send account-related emails (login alerts, trial expiry, updates).</li>
              <li>To monitor and improve platform performance and security.</li>
              <li>To respond to support requests.</li>
              <li>We do not use your data for advertising and we do not sell it to third parties.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">4. Data Storage and Security</h2>
            <p>Your data is stored in a managed PostgreSQL database hosted by Supabase, with servers located in Mumbai, India. We use encrypted connections (HTTPS/TLS) for all data in transit. Access to the database is restricted to authorized services only. While we take reasonable precautions, no system is 100% secure and we cannot guarantee absolute security.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">5. Data Sharing</h2>
            <p>We do not sell, rent, or trade your data. We share data only with:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li><span className="font-medium text-text">Infrastructure providers:</span> Supabase (database), Railway (API hosting), Vercel (frontend hosting). These providers process data solely to deliver the service.</li>
              <li><span className="font-medium text-text">Legal requirements:</span> If required by law, court order, or government authority.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">6. Data Retention</h2>
            <p>We retain your data for as long as your account is active. If you cancel your account, we will retain your data for 30 days to allow for re-activation or export. After 30 days, data is permanently deleted from our systems.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">7. Your Rights</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 mt-2 space-y-1.5">
              <li>Access the data we hold about your restaurant and staff.</li>
              <li>Request correction of inaccurate data.</li>
              <li>Request deletion of your account and all associated data.</li>
              <li>Export your data in a portable format.</li>
            </ul>
            <p className="mt-2">To exercise any of these rights, email us at <a href="mailto:rohail230@gmail.com" className="text-green underline">rohail230@gmail.com</a>.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">8. Customer Data (Your Responsibility)</h2>
            <p>When you add customer phone numbers and information to BillByte's CRM, you are acting as the data controller for that customer data. You are responsible for ensuring you have appropriate consent from your customers to store their information. BillByte acts only as a data processor on your behalf.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">9. Cookies</h2>
            <p>BillByte uses browser localStorage (not cookies) to store your authentication session. No third-party tracking cookies are used.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">10. Children's Privacy</h2>
            <p>The Service is not directed at individuals under 18 years of age. We do not knowingly collect personal data from minors.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">11. Changes to This Policy</h2>
            <p>We may update this Privacy Policy periodically. We will notify you of material changes via email or an in-app notice. Continued use of the Service after changes constitutes acceptance.</p>
          </div>

          <div>
            <h2 className="text-base font-semibold text-text mb-2">12. Contact</h2>
            <p>For privacy-related questions or requests, contact us at <a href="mailto:rohail230@gmail.com" className="text-green underline">rohail230@gmail.com</a>.</p>
          </div>

        </section>

        <div className="mt-10 pt-6 border-t border-border flex gap-4 text-xs text-muted">
          <a href="#/terms" className="hover:text-text transition-colors">Terms of Service</a>
          <span>·</span>
          <a href="#/login" className="hover:text-text transition-colors">Back to Login</a>
        </div>
      </div>
    </div>
  )
}
