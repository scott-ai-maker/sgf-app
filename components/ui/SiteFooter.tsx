import Link from 'next/link'
import { Camera, CirclePlay, Users, BriefcaseBusiness } from 'lucide-react'

const BRAND_LOGO = '/images/logo-mark-source.png'

const SOCIAL_LINKS = [
  { name: 'Instagram', href: 'https://instagram.com/scottgordonfitness', Icon: Camera },
  { name: 'YouTube', href: 'https://youtube.com/@scottgordonfitness', Icon: CirclePlay },
  { name: 'Facebook', href: 'https://facebook.com/scottgordonfitness', Icon: Users },
  { name: 'LinkedIn', href: 'https://linkedin.com/company/scottgordonfitness', Icon: BriefcaseBusiness },
]

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <Link href="/" className="site-footer-brand" aria-label="Scott Gordon Fitness home">
        <span
          aria-hidden
          className="site-footer-mark"
          style={{ backgroundImage: `url('${BRAND_LOGO}')` }}
        />
        <span className="site-footer-text">
          Scott Gordon <span>Fitness</span>
        </span>
      </Link>

      <p className="site-footer-copyright">
        {new Date().getFullYear()} Scott Gordon Fitness. Evidence-based online coaching.
      </p>

      <div className="site-footer-social" aria-label="Social links">
        {SOCIAL_LINKS.map(({ name, href, Icon }) => (
          <a
            key={name}
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={name}
            className="site-social-link"
          >
            <Icon size={16} strokeWidth={2} />
          </a>
        ))}
      </div>
    </footer>
  )
}