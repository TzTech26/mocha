// Ad network configuration.
//
// Google AdSense rejected this site under its "low value content" and
// "Google-served ads on screens without publisher-content" policies, which for
// a proxy is structural rather than something more copy fixes - so it is gone
// entirely and Monetag serves the ads instead. Monetag accepts this site
// category, which is the property that actually matters here.

// The only two screens that carry ads: the games list, and the viewer, which
// is both a game being played and any page opened through the proxy - they are
// the same route. Everything else - the home page, shortcuts, bookmarks, the
// FAQ, the legal pages, settings, status, reports - shows nothing at all.
export const adPlacements = ['games', 'viewer'] as const

export type AdPlacement = (typeof adPlacements)[number]

// Ads only ever appear as a banner in one of the two rails down the sides of
// the page, never in the flow of the content and never over the top of it.
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
// only way to run one unit in two rails at once; see leftBanners below.
export type AdUnit = { containerId: string; scriptSrc: string; isolate?: boolean }

// Adsterra NativeBanner_1, unit 31134849. Reused across both placements, which
// needs nothing special: only one route is mounted at a time, so the games
// list's copy and the viewer's are never in the page together.
const nativeBanner: AdUnit = {
  containerId: 'container-de573f947e06bb50827ceb6741737305',
  scriptSrc: 'https://pl31235348.profitableratecpmnetwork.com/de573f947e06bb50827ceb6741737305/invoke.js'
}

// --- Rails ---
// The banners in each rail, top to bottom. A rail is a column in the page
// rather than something pinned to the window, so it is as long as the page is
// and there is room for more than one banner down it - worth doing on the games
// list, where the grid runs for several screens and a single banner at the top
// is off screen for most of them.
//
// Adding one is two values from the dashboard:
//   Adsterra -> Websites -> this site -> Native Banner -> Create
// which hands back a <div id="container-..."> and a <script src="...invoke.js">.
// Append them here as another entry and the rail grows by one banner.
//
// Prefer a real second unit over another isolated copy of the one above. Both
// render, but a single unit counted twice on a page is the sort of thing an ad
// network reads as invalid traffic, and the reporting cannot tell the two rails
// apart either. The isolated copy is here because both rails should be filled
// today; swap it for a unit of its own when there is one.
//
// The viewer would be better served by a unit of a different shape. A native
// banner is a block of three or four items, which is a column on the games
// list but around a game is eight ads for one screen - so the viewer takes the
// first banner here and shows one item of it, and the rest of the block is
// paid for and never seen. An Adsterra Banner unit at 160x600 is one creative
// the exact shape of that rail, and dropping one into a `viewer` entry of its
// own below would be the right way to fill it.
const rightBanners: AdUnit[] = [nativeBanner]
const leftBanners: AdUnit[] = [{ ...nativeBanner, isolate: true }]

export const adRails: Record<AdPlacement, Record<AdSide, AdUnit[]>> = {
  games: { left: leftBanners, right: rightBanners },
  viewer: { left: leftBanners, right: rightBanners }
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
// lib/sitewide.ts already holds these to the same two screens as the rails, so
// the rest of the site stays clean either way.
export type SiteWideAd = { name: string; src: string; enabled: boolean; attributes?: Record<string, string> }

export const siteWideAds: SiteWideAd[] = [
  { name: 'monetag-multitag', src: 'https://quge5.com/88/tag.min.js', enabled: false, attributes: { 'data-zone': '277546' } },
  { name: 'adsterra-popunder', src: 'https://pl31235347.profitableratecpmnetwork.com/2f/82/b7/2f82b73e8f188696e540dbc36017e72f.js', enabled: false }
]
