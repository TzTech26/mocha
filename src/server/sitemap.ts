import fs from 'node:fs'
import path from 'node:path'
import { defaultOrigin, sitemapEntries } from '../lib/seo'
import type { GameData } from '../lib/types'

// The sitemap is written from the same table the heads are, so a page that is
// added, renamed or marked noindex cannot be left behind in here saying it is
// still there. Hand written, this file drifted the moment anything moved.

function games(): GameData[] {
  try {
    return JSON.parse(fs.readFileSync(path.resolve('public', 'games.json'), 'utf8')) as GameData[]
  } catch {
    return []
  }
}

export function buildSitemap(origin = (process.env.SITE_ORIGIN || defaultOrigin).replace(/\/+$/, ''), lastmod = new Date().toISOString().slice(0, 10)) {
  const urls = sitemapEntries(games())
    .map((entry) => ['  <url>', `    <loc>${origin}${entry.path}</loc>`, `    <lastmod>${lastmod}</lastmod>`, `    <changefreq>${entry.changefreq}</changefreq>`, `    <priority>${entry.priority.toFixed(1)}</priority>`, '  </url>'].join('\n'))
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<!--
  Generated at build time from src/lib/seo.ts, which is also where the title and
  description of each of these pages comes from. Do not edit by hand.

  Only Mocha's own pages are listed. The proxy viewer, the pages it frames and
  the game CDN are third party content, refused in robots.txt and marked
  noindex, so they are deliberately absent. So are /bookmarks, /settings and
  /status, which are either empty for anybody but the person whose browser
  stored them or deliberately unlinked.
-->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`
}
