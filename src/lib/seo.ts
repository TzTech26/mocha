import type { GameData } from './types'

// Everything Google is told about a page lives here, so the head the server
// writes into the HTML, the head the app rewrites while somebody is clicking
// around, and the sitemap the build emits can never disagree with each other.
// A crawler that asks for /games and a visitor who navigates to it have to end
// up looking at the same title and the same description.

export const siteName = 'Mocha'

// The canonical home. Everything indexable is addressed from here, so a page
// reached on some other host still points at one address rather than splitting
// its own ranking across two. Deployments override this with SITE_ORIGIN.
export const defaultOrigin = 'https://desginmyvan.com'

// Square, and already in public/. Social cards crop it themselves.
export const socialImage = '/embed.png'

export type ChangeFreq = 'daily' | 'weekly' | 'monthly' | 'yearly'

export interface PageSeo {
  title: string
  description: string
  // Off the sitemap and marked noindex. Either the page is nobody's business
  // but the person whose browser stored it, or it is somebody else's content
  // that only looks like ours because it is framed here.
  indexable?: false
  changefreq?: ChangeFreq
  priority?: number
}

// Titles stay near sixty characters and descriptions near a hundred and sixty,
// which is roughly where Google stops printing them.
export const pages: Record<string, PageSeo> = {
  '/': {
    title: 'Mocha - Free Web Proxy and Unblocked Games',
    description: 'Open blocked sites and play unblocked games free at school or work. Mocha is a fast, encrypted web proxy with nothing to download and nothing to install.',
    changefreq: 'weekly',
    priority: 1
  },
  '/games': {
    title: 'Unblocked Games - Play Free Online Games | Mocha',
    description: 'Play unblocked games free in your browser. Hundreds of titles that run at school or work, with no download, no install and no sign up.',
    changefreq: 'weekly',
    priority: 0.9
  },
  '/shortcuts': {
    title: 'Unblocked Site Shortcuts | Mocha',
    description: 'One click shortcuts to the sites your network blocks, opened through Mocha the encrypted web proxy. No download and no extension needed.',
    changefreq: 'weekly',
    priority: 0.8
  },
  '/about': {
    title: 'About Mocha - Web Proxy and Unblocked Games',
    description: 'What Mocha is, how the proxy encrypts what you browse, and why the games and shortcuts are here. Built to unblock the web without installing anything.',
    changefreq: 'monthly',
    priority: 0.7
  },
  '/faq': {
    title: 'FAQ - How Mocha Unblocks Sites and Games',
    description: 'Answers about using Mocha: what a web proxy does, how to open a blocked site or game, what to do when a game breaks, and why the proxy is sometimes slow.',
    changefreq: 'monthly',
    priority: 0.7
  },
  '/reports': {
    title: 'Which Unblocked Games Are Working | Mocha',
    description: 'Games people have reported as broken, and the ones everybody else is playing fine. Updated from what players say while they are playing them.',
    changefreq: 'daily',
    priority: 0.5
  },
  '/privacy': {
    title: 'Privacy Policy | Mocha',
    description: 'What Mocha stores, what it never sees, and what leaves your browser. Your traffic is encrypted and is not readable by us.',
    changefreq: 'yearly',
    priority: 0.3
  },
  '/terms': {
    title: 'Terms of Service | Mocha',
    description: 'The terms you agree to by using Mocha, the web proxy and unblocked games site.',
    changefreq: 'yearly',
    priority: 0.3
  },

  // Nothing below here belongs in a search result.
  '/bookmarks': {
    title: 'Bookmarks | Mocha',
    description: 'The pages you saved while browsing through Mocha.',
    indexable: false
  },
  '/settings': {
    title: 'Settings | Mocha',
    description: 'Themes, tab cloaking, transports and the rest of how Mocha behaves in your browser.',
    indexable: false
  },
  '/status': {
    title: 'Status | Mocha',
    description: 'How many people are here, what they are playing, and how long the server has been up.',
    indexable: false
  }
}

// The viewer. What it frames is somebody else's page, so it is refused in
// robots.txt and told here as well, since a crawler that reaches it anyway
// should not treat what it finds as a page of this site.
const viewer: PageSeo = {
  title: 'Viewer | Mocha',
  description: 'Browsing through Mocha.',
  indexable: false
}

const notFound: PageSeo = {
  title: 'Page not found | Mocha',
  description: 'That page is not here. The games, the shortcuts and the proxy are.',
  indexable: false
}

export interface SeoTag {
  // The attribute that names the tag, which is 'property' for Open Graph and
  // 'name' for everything else.
  key: 'name' | 'property'
  value: string
  content: string
}

export interface SeoData {
  title: string
  description: string
  canonical: string
  robots: string
  image: string
  indexable: boolean
  jsonLd: object[]
}

// Trailing slashes, index.html and a query string all address the same page, so
// pick one spelling and let the canonical tag say so.
export function normalizePath(pathname: string) {
  const [path] = pathname.split(/[?#]/)
  const trimmed = path.replace(/\/+$/, '')

  return trimmed === '' ? '/' : trimmed
}

export function gamePath(id: string) {
  return `/games/${id}`
}

// A game's id is in the URL, so keep it to what can appear in one. The CDN path
// is built from the same value, and the one in lib/games.ts matches this.
export function isGameId(id: string) {
  return /^[a-zA-Z0-9._-]+$/.test(id)
}

function gameSeo(game: GameData): PageSeo {
  return {
    title: `Play ${game.name} Unblocked Free | Mocha`,
    description: `Play ${game.name} unblocked in your browser at school or work. Free, instant and with nothing to download - ${game.name} runs through Mocha on any device.`,
    changefreq: 'weekly',
    priority: 0.6
  }
}

// What the page for this address says about itself. The game is handed in
// because the names live in games.json rather than in here: the server reads
// that file, the games page already has it loaded, and both end up here.
export function seoForPath(pathname: string, options: { game?: GameData; origin?: string } = {}): SeoData {
  const path = normalizePath(pathname)
  const origin = options.origin ?? defaultOrigin

  const page = path.startsWith('/route/') ? viewer : path.startsWith('/games/') ? (options.game ? gameSeo(options.game) : notFound) : pages[path]

  const seo = page ?? notFound
  const indexable = seo.indexable !== false

  return {
    title: seo.title,
    description: seo.description,
    canonical: `${origin}${path === '/' ? '/' : path}`,
    // max-image-preview lets the artwork through on a games result, which is
    // most of what makes one worth clicking.
    robots: indexable ? 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1' : 'noindex, nofollow',
    image: options.game ? `${origin}/cdn/${options.game.id}/${options.game.image}` : `${origin}${socialImage}`,
    indexable,
    jsonLd: indexable ? jsonLdFor(path, origin, options.game) : []
  }
}

// The tags themselves, in the order they are written into the head. The server
// serializes these and the browser applies the same list on navigation, so what
// a crawler is served and what a visitor ends up with are the same head.
export function tagsFor(seo: SeoData): SeoTag[] {
  return [
    { key: 'name', value: 'description', content: seo.description },
    { key: 'name', value: 'robots', content: seo.robots },
    { key: 'property', value: 'og:title', content: seo.title },
    { key: 'property', value: 'og:description', content: seo.description },
    { key: 'property', value: 'og:type', content: 'website' },
    { key: 'property', value: 'og:url', content: seo.canonical },
    { key: 'property', value: 'og:image', content: seo.image },
    { key: 'property', value: 'og:site_name', content: siteName },
    { key: 'name', value: 'twitter:card', content: 'summary_large_image' },
    { key: 'name', value: 'twitter:title', content: seo.title },
    { key: 'name', value: 'twitter:description', content: seo.description },
    { key: 'name', value: 'twitter:image', content: seo.image }
  ]
}

function organization(origin: string) {
  return {
    '@type': 'Organization',
    name: siteName,
    url: `${origin}/`,
    logo: `${origin}/icon.png`
  }
}

function breadcrumbs(origin: string, trail: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((entry, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: entry.name,
      item: `${origin}${entry.path}`
    }))
  }
}

// Structured data only describes what the page actually shows. The FAQ entries
// below are the ones rendered on /faq, and a game's entry is the game the page
// is about, which is the whole of what makes this eligible for a rich result
// rather than a manual action.
function jsonLdFor(path: string, origin: string, game?: GameData): object[] {
  if (path === '/') {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: siteName,
        alternateName: 'Mocha Proxy',
        url: `${origin}/`,
        description: pages['/'].description,
        publisher: organization(origin)
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: siteName,
        url: `${origin}/`,
        applicationCategory: 'BrowserApplication',
        operatingSystem: 'Any',
        browserRequirements: 'Requires a modern browser with JavaScript',
        description: pages['/'].description,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD'
        }
      }
    ]
  }

  if (path === '/faq') {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faq.map((entry) => ({
          '@type': 'Question',
          name: entry.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: plainAnswer(entry.answer)
          }
        }))
      },
      breadcrumbs(origin, [
        { name: siteName, path: '/' },
        { name: 'FAQ', path: '/faq' }
      ])
    ]
  }

  if (path === '/games') {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: pages['/games'].title,
        url: `${origin}/games`,
        description: pages['/games'].description,
        isPartOf: {
          '@type': 'WebSite',
          name: siteName,
          url: `${origin}/`
        }
      },
      breadcrumbs(origin, [
        { name: siteName, path: '/' },
        { name: 'Games', path: '/games' }
      ])
    ]
  }

  if (game) {
    return [
      {
        '@context': 'https://schema.org',
        '@type': 'VideoGame',
        name: game.name,
        url: `${origin}${gamePath(game.id)}`,
        image: `${origin}/cdn/${game.id}/${game.image}`,
        description: gameSeo(game).description,
        applicationCategory: 'GameApplication',
        gamePlatform: 'Web browser',
        operatingSystem: 'Any',
        playMode: 'SinglePlayer',
        publisher: organization(origin),
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD'
        }
      },
      breadcrumbs(origin, [
        { name: siteName, path: '/' },
        { name: 'Games', path: '/games' },
        { name: game.name, path: gamePath(game.id) }
      ])
    ]
  }

  const page = pages[path]

  if (!page) return []

  return [
    breadcrumbs(origin, [
      { name: siteName, path: '/' },
      { name: page.title.split(' | ')[0].split(' - ')[0], path }
    ])
  ]
}

export interface FaqEntry {
  question: string
  // Links are written as [label](/path) so the page and the structured data are
  // built from the same sentence. Drifting copy is what turns a rich result
  // into a penalty, so there is only one copy of it.
  answer: string
}

export const faq: FaqEntry[] = [
  {
    question: 'What is Mocha?',
    answer: 'Mocha is a web proxy used to unblock websites at work or school. Your traffic is encrypted so no one can read it, not even us.'
  },
  {
    question: 'How do I use it?',
    answer: 'Navigate to the home page and type in a URL or search query. You can also launch a preset [shortcut](/shortcuts) or [game](/games).'
  },
  {
    question: "A game doesn't work. What now?",
    answer:
      'Games are hosted somewhere else and break without telling anybody, so the flag in the bottom left corner while you are playing one is how to say so. Everything anybody has reported is on the [reports page](/reports), along with the games somebody flagged that everybody else is playing fine. One report never takes a game down on its own, and if one works for you, say that instead, and it counts.'
  },
  {
    question: 'A game ignores my keyboard',
    answer:
      'A game only hears the keyboard while it holds focus, and some of them never take it. Mocha hands it over when the game loads and again whenever you click, and copies any key that still lands on the page around it into the game, so this should fix itself. If a game is still deaf, report it with the flag on the control bar and say so in the box, which is the kind of thing nobody else can see from the outside.'
  },
  {
    question: 'Why is the proxy slow?',
    answer: 'The proxy is hosted on a shared server that serves all users. If there is a significant amount of users at one time, it can cause network congestion and slow down requests.'
  },
  {
    question: 'Do I need to download or install anything?',
    answer: 'No. Mocha runs in the browser you already have. There is nothing to install, no extension and no account, so it works on a managed laptop that will not let you install anything.'
  }
]

// The same sentence with the link markup taken back out, for the copy that goes
// to a crawler as structured data.
export function plainAnswer(answer: string) {
  return answer.replace(/\[([^\]]+)\]\((\/[^)]*)\)/g, '$1')
}

// Split into text and links, for rendering the same sentence on the page.
export function answerParts(answer: string): ({ text: string } | { text: string; href: string })[] {
  const parts: ({ text: string } | { text: string; href: string })[] = []
  const pattern = /\[([^\]]+)\]\((\/[^)]*)\)/g
  let last = 0
  let match = pattern.exec(answer)

  while (match) {
    if (match.index > last) parts.push({ text: answer.slice(last, match.index) })
    parts.push({ text: match[1], href: match[2] })
    last = match.index + match[0].length
    match = pattern.exec(answer)
  }

  if (last < answer.length) parts.push({ text: answer.slice(last) })

  return parts
}

// Every address worth listing in the sitemap. Games are handed in rather than
// read here, because this file is loaded by the browser too and games.json is
// a fetch there and a file read at build time.
export function sitemapEntries(games: GameData[] = []) {
  const entries = Object.entries(pages)
    .filter(([, page]) => page.indexable !== false)
    .map(([path, page]) => ({
      path,
      changefreq: page.changefreq ?? 'monthly',
      priority: page.priority ?? 0.5
    }))

  for (const game of games) {
    if (!isGameId(game.id)) continue

    entries.push({ path: gamePath(game.id), changefreq: 'weekly', priority: 0.6 })
  }

  return entries
}
