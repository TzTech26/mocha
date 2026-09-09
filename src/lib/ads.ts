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

// Ads only ever appear as a banner pinned to the left or right edge, never in
// the flow of the page and never over the top of it.
export const adSides = ['left', 'right'] as const

export type AdSide = (typeof adSides)[number]

// --- Per rail units ---
// Banner-style units that render into a container on the page. The values come
// from an Adsterra ad unit's snippet: the id of its container <div> and the src
// of its loader <script>, both verbatim.
//
// A null rail renders nothing at all, so the site never shows an empty ad box
// for a unit that has not been created yet.
export type AdUnit = { containerId: string; scriptSrc: string }

// Adsterra NativeBanner_1, unit 31134849. One unit is reused across both
// placements, which is fine because only one route is mounted at a time, so two
// containers with this id are never in the page at once.
const rightBanner: AdUnit = {
  containerId: 'container-de573f947e06bb50827ceb6741737305',
  scriptSrc: 'https://pl31235348.profitableratecpmnetwork.com/de573f947e06bb50827ceb6741737305/invoke.js'
}

// The left rail, and the one thing here that needs doing by hand.
//
// It cannot be another copy of the unit above. The loader finds its container
// by id and fills it, so with that id on the page twice only the first one is
// ever filled and the other rail stays empty - and a single unit counted twice
// on one screen is what an ad network reads as invalid traffic, which is the
// account rather than just the rail.
//
// So it needs a unit of its own, which takes about a minute:
//   Adsterra dashboard -> Websites -> this site -> Native Banner -> Create
// The snippet it hands back is a <div id="container-..."> and a <script
// src="...invoke.js">. Put those two values here, exactly as given:
//
//   const leftBanner: AdUnit | null = {
//     containerId: 'container-<the new key>',
//     scriptSrc: 'https://<the new host>/<the new key>/invoke.js'
//   }
//
// Nothing else changes - both rails are already built, and the games list and
// the viewer both make room on this edge the moment it stops being null.
const leftBanner: AdUnit | null = null

export const adRails: Record<AdPlacement, Record<AdSide, AdUnit | null>> = {
  games: { left: leftBanner, right: rightBanner },
  viewer: { left: leftBanner, right: rightBanner }
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
