import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

// Where people can reach us about their data. Change this to the address you want published.
const CONTACT_EMAIL = 'kamanzigolbert@gmail.com'
const UPDATED = 'September 2026'

const Section = ({ title, children }) => (
  <section className="mt-6">
    <h2 className="text-base font-bold text-ink-900 mb-2">{title}</h2>
    <div className="text-sm text-ink-600 space-y-2 leading-relaxed">{children}</div>
  </section>
)

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-ink-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Link to="/" className="btn btn-ghost btn-sm mb-4 -ml-2 text-ink-500"><ArrowLeft size={15} /> Back to CaféCampus</Link>
        <div className="card p-6">
          <h1 className="text-2xl font-black text-ink-900">Privacy Policy</h1>
          <p className="text-xs text-ink-400 mt-1">CaféCampus · Last updated {UPDATED}</p>

          <Section title="What CaféCampus is">
            <p>CaféCampus lets students order food from their school cafeterias for pickup or delivery. This page explains what information we collect and how it is used.</p>
          </Section>

          <Section title="Information we collect">
            <p><strong>Account details:</strong> your name, school email address and phone number. Passwords are stored only as a one-way hash — we cannot read them.</p>
            <p><strong>Sign in with Google:</strong> if you choose Google, we receive only your name and email address (and whether the email is verified). We never see your Google password and never access your Gmail, contacts, files or any other Google data.</p>
            <p><strong>Orders:</strong> what you ordered, the total, the restaurant, pickup or delivery details (such as your delivery location) and order status. Guests who order without an account provide a name and phone number for that order.</p>
            <p><strong>Notifications:</strong> if you turn on order alerts, your browser gives us a notification address so we can tell you when your order is ready. You can turn this off at any time in your profile.</p>
          </Section>

          <Section title="How we use it">
            <p>To create and secure your account, verify your email, process and track your orders, let the restaurant and delivery staff fulfil them, and send you order updates. We do not sell your information and we do not use it for advertising.</p>
          </Section>

          <Section title="Who can see it">
            <p>The restaurant you order from (and its delivery staff, for delivery orders) can see your name, phone number and order details so they can prepare and hand over your food. Our hosting and database providers process data on our behalf to run the service. We do not share your information with anyone else except where the law requires it.</p>
          </Section>

          <Section title="School emails only">
            <p>Customer accounts are limited to school email addresses (@alustudent.com and @alueducation.com).</p>
          </Section>

          <Section title="Your choices">
            <p>You can update your details in your profile. To have your account and its data deleted, or to ask any question about your information, email <a className="text-alu-red underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
          </Section>

          <Section title="Changes">
            <p>If we change this policy we will update the date at the top of this page.</p>
          </Section>
        </div>
      </div>
    </div>
  )
}
