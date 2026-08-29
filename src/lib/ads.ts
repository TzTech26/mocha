// Google AdSense. The loader script lives in index.html; this file only holds
// the publisher ID and the per-placement ad unit IDs.
//
// Create each unit in AdSense (Ads -> By ad unit -> Display ads) and paste the
// data-ad-slot number it gives you below. A placement with an empty slot ID
// renders nothing at all, so the site never shows a blank ad box for a unit
// that has not been created yet.
export const adClient = 'ca-pub-6942133635007335'

export const adSlots = {
  games: '',
  shortcuts: '',
  bookmarks: '',
  faq: '',
  legal: ''
}

export type AdPlacement = keyof typeof adSlots
