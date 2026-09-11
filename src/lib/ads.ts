// Ad network configuration.
//
// Google AdSense rejected this site under its "low value content" and
// "Google-served ads on screens without publisher-content" policies, which for
// a proxy is structural rather than something more copy fixes - so it is gone
// entirely and Monetag serves the ads instead. Monetag accepts this site
// category, which is the property that actually matters here.

// The viewer is the only screen that carries ads: a game being played, or any
// page opened through the proxy, which are the same route. Nothing else shows
// one - not the home page, the games list, shortcuts, bookmarks, the FAQ, the
// legal pages, settings, status or reports.
//
// The games list did, in a column down either side of the grid, and it made
// the page look cheap. Ads belong where somebody has already got what they
// came for, not over the top of them choosing it.
export const adSides = ['left', 'right'] as const

export type AdSide = (typeof adSides)[number]

// --- Units ---
// Banner-style units that render into a container on the page. The values come
// from an Adsterra ad unit's snippet: the id of its container <div> and the src
// of its loader <script>, both verbatim.
//
// `isolate` puts the unit in a frame of its own rather than straight into the
// page. The loader finds its container by id, so a container id can only
// appear in a document once - a second copy in the same document is simply
// never filled. A frame is its own document, so an isolated unit gets its own
// copy of both the container and the loader and fills normally. That is the
// only way to run one unit in two rails at once; see below.
export type AdUnit = { containerId: string; scriptSrc: string; isolate?: boolean }

// Adsterra NativeBanner_1, unit 31134849.
const nativeBanner: AdUnit = {
  containerId: 'container-de573f947e06bb50827ceb6741737305',
  scriptSrc: 'https://pl31235348.profitableratecpmnetwork.com/de573f947e06bb50827ceb6741737305/invoke.js'
}

// --- Rails ---
// One banner down each edge of the viewer, tall and thin, beside the page
// being viewed rather than around it. A null rail is not rendered and takes no
// room, so the viewer just gets that much more width back.
//
// Two things here are worth replacing when there is a minute for the Adsterra
// dashboard, and both are about this being one unit doing two jobs:
//
//   A real second unit, rather than an isolated copy of the first. Both
//   render, but a single unit counted twice on a page is the sort of thing an
//   ad network reads as invalid traffic, and the reporting cannot tell the two
//   rails apart either.
//
//   A shape that suits the rail. A native banner is a block of three or four
//   items, and only the first is shown here - the rest is paid for and never
//   seen. An Adsterra Banner unit at 160x600 is one creative the exact shape
//   of this rail.
export const adRails: Record<AdSide, AdUnit | null> = {
  left: { ...nativeBanner, isolate: true },
  right: nativeBanner
}

// --- Site wide formats ---
// One script for the whole site rather than one per placement, which is why
// these are here rather than in the Ad component. They pay several times what
// a banner does, and they are also the formats that take the page over.
//
// Both are off. Run live, they were unusable: the multitag put a full screen
// "Download is ready" panel over the middle of the home page - a fake download
// prompt, not something anybody wanted to click on purpose - and between the
// two of them a window opened on more or less any click, anywhere.
//
// Turning one back on is `enabled: true`, but do it from the dashboard side
// first, or the same thing happens again:
//   Monetag  - the multitag picks its own formats. Turn off interstitial and
//              vignette there and it stops covering the page. Leaving it off
//              entirely is the safe choice.
//   Adsterra - the popunder needs a frequency cap, one per visitor per day
//              rather than per click, before it goes anywhere near live again.
// lib/sitewide.ts already holds these to the viewer, same as the rails, so the
// rest of the site stays clean either way.
export type SiteWideAd = { name: string; src: string; enabled: boolean; attributes?: Record<string, string> }

export const siteWideAds: SiteWideAd[] = [
  { name: 'monetag-multitag', src: 'https://quge5.com/88/tag.min.js', enabled: false, attributes: { 'data-zone': '277546' } },
  { name: 'adsterra-popunder', src: 'https://pl31235347.profitableratecpmnetwork.com/2f/82/b7/2f82b73e8f188696e540dbc36017e72f.js', enabled: false }
]
