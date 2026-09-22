import { useState, useEffect } from 'react'
import { LifeBuoy, Mail, Phone } from 'lucide-react'
import { contactAPI } from '../../services/api'

// "Need help?" card showing the phone/email the super admin has configured under Email
// Settings → Support. Renders nothing until loaded, and nothing at all if neither field is
// set, so an unconfigured platform doesn't show an empty card.
export default function SupportContact({ title = 'Need help?' }) {
  const [contact, setContact] = useState(null)

  useEffect(() => { contactAPI.get().then(res => setContact(res.data.data)).catch(() => setContact(null)) }, [])

  if (!contact || (!contact.supportEmail && !contact.supportPhone)) return null

  return (
    <div className="card p-5">
      <div className="flex items-start gap-3">
        <LifeBuoy size={20} className="text-alu-muted mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-alu-cream text-sm">{title}</p>
          <p className="text-xs text-alu-muted mt-0.5">{contact.supportName || 'Contact us'}</p>
          <div className="mt-2 space-y-1.5">
            {contact.supportEmail && (
              <a href={`mailto:${contact.supportEmail}`} className="flex items-center gap-2 text-sm text-alu-cream hover:underline">
                <Mail size={14} className="text-alu-muted shrink-0" />{contact.supportEmail}
              </a>
            )}
            {contact.supportPhone && (
              <a href={`tel:${contact.supportPhone}`} className="flex items-center gap-2 text-sm text-alu-cream hover:underline">
                <Phone size={14} className="text-alu-muted shrink-0" />{contact.supportPhone}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
