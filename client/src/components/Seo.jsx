import { Helmet } from 'react-helmet-async'

const SITE_NAME = 'CaféCampus'
const SITE_URL = 'https://cafecampus-client.onrender.com'
const DEFAULT_DESCRIPTION = 'Order food from campus restaurants, track your order live, and skip the line. Browse menus from campus eateries and pay on pickup or delivery.'

// Drop onto any page to override the static defaults in index.html for that route. `path`
// should start with "/" (or be omitted for the homepage) — it feeds both the canonical link
// and the og:url, which must match the actual page location for either to mean anything.
export default function Seo({ title, description = DEFAULT_DESCRIPTION, path = '', jsonLd }) {
  const fullTitle = title ? `${title} — ${SITE_NAME}` : `${SITE_NAME} — Order. Track. Eat.`
  const url = `${SITE_URL}${path}`
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta name="twitter:card" content="summary" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      {jsonLd && <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>}
    </Helmet>
  )
}
