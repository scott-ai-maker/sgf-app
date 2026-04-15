import Link from 'next/link'

type HeaderLink = {
  href: string
  label: string
}

type SiteHeaderProps = {
  fixed?: boolean
  badgeText?: string
  links?: HeaderLink[]
  actions?: React.ReactNode
}

const BRAND_LOGO = '/images/logo-mark-source.jpg'

export default function SiteHeader({
  fixed = false,
  badgeText,
  links = [],
  actions,
}: SiteHeaderProps) {
  return (
    <header className={`site-header ${fixed ? 'site-header-fixed' : ''}`}>
      <Link href="/" className="site-brand-link" aria-label="Scott Gordon Fitness home">
        <span
          aria-hidden
          className="site-brand-mark"
          style={{ backgroundImage: `url('${BRAND_LOGO}')` }}
        />
        <span className="site-brand-text">
          Scott Gordon <span>Fitness</span>
        </span>
      </Link>

      <div className="site-header-right">
        {links.length > 0 && (
          <nav className="site-header-links" aria-label="Primary">
            {links.map(link => (
              <Link key={link.href} href={link.href}>
                {link.label}
              </Link>
            ))}
          </nav>
        )}
        {badgeText && <p className="site-header-badge">{badgeText}</p>}
        {actions ? <div className="site-header-actions">{actions}</div> : null}
      </div>
    </header>
  )
}