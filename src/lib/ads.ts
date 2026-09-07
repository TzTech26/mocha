// Ad network configuration.
//
// Google AdSense rejected this site under its "low value content" and
// "Google-served ads on screens without publisher-content" policies, which for
// a proxy is structural rather than something more copy fixes - so it is gone
// entirely and Monetag serves the ads instead. Monetag accepts this site
// category, which is the property that actually matters here.
export const adPlacements = ['games', 'shortcuts', 'bookmarks', 'faq', 'legal', 'about'] as const

export type AdPlacement = (typeof adPlacements)[number]

// --- Per placement units ---
// Banner-style units that render into a container on the page. The values come
// from an Adsterra ad unit's snippet: the id of its container <div> and the src
// of its loader <script>, both verbatim.
//
// A null placement renders nothing at all, so the site never shows an empty ad
// box for a unit that has not been created yet.
export type AdUnit = { containerId: string; scriptSrc: string }

// Adsterra NativeBanner_1, unit 31134849. One unit is reused across every
// placement, which is fine because only one route is mounted at a time, so two
// containers with this id are never in the page at once. Splitting it into a
// unit per page would only be worth doing to see the pages reported separately
// in Adsterra's stats.
const nativeBanner: AdUnit = {
  containerId: 'container-de573f947e06bb50827ceb6741737305',
  scriptSrc: 'https://pl31235348.profitableratecpmnetwork.com/de573f947e06bb50827ceb6741737305/invoke.js'
}

export const adUnits: Record<AdPlacement, AdUnit | null> = {
  games: nativeBanner,
  shortcuts: nativeBanner,
  bookmarks: nativeBanner,
  faq: nativeBanner,
  legal: nativeBanner,
  about: nativeBanner
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
// Either way, gate it to a route in lib/sitewide.ts rather than the whole
// site, so the home page stays clean.
export type SiteWideAd = { name: string; src: string; enabled: boolean; attributes?: Record<string, string> }

export const siteWideAds: SiteWideAd[] = [
  { name: 'monetag-multitag', src: 'https://quge5.com/88/tag.min.js', enabled: false, attributes: { 'data-zone': '277546' } },
  { name: 'adsterra-popunder', src: 'https://pl31235347.profitableratecpmnetwork.com/2f/82/b7/2f82b73e8f188696e540dbc36017e72f.js', enabled: false }
]
