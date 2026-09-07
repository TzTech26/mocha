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
// Banner-style units that render into a container on one specific page. Create
// a "Native Banner" unit per placement in the Adsterra dashboard: it gives you
// a snippet with a container <div id="..."> and a loader <script src="...">,
// and those two values go here verbatim.
//
// A null placement renders nothing at all, so the site never shows an empty ad
// box for a unit that has not been created yet. All of them are null today -
// the site wide formats below are doing the earning.
export type AdUnit = { containerId: string; scriptSrc: string }

export const adUnits: Record<AdPlacement, AdUnit | null> = {
  games: null,
  shortcuts: null,
  bookmarks: null,
  faq: null,
  legal: null,
  about: null
}

// --- Site wide formats ---
// Popunder and multitag are one script for the whole site rather than one per
// placement, which is why they are here rather than in the Ad component. They
// pay several times what a banner does on this kind of traffic and take one
// pasted URL to install.
//
// An entry with an empty src is skipped, so an unused slot costs nothing.
// Loading is handled by lib/sitewide.ts, which keeps them off the proxy
// viewer - see the reasoning there before moving any of this into index.html.
//
// Two popunders will fire two windows, so if a second one is added here, set a
// frequency cap in at least one dashboard first.
export type SiteWideAd = { name: string; src: string }

export const siteWideAds: SiteWideAd[] = [{ name: 'monetag-popunder', src: 'https://pl31235347.profitableratecpmnetwork.com/2f/82/b7/2f82b73e8f188696e540dbc36017e72f.js' }]
