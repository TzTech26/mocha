import type { Patch } from './types'

export const patches: Patch[] = [
  {
    hostname: 'neal.fun',
    suggestedTransport: 'libcurl'
  },
  {
    hostname: 'instagram.com',
    works: false
  },
  {
    // The desktop site ships its interface as web components that the page then
    // hydrates. That script does not survive Ultraviolet's rewriting, so the
    // browser is left holding the bare skeleton markup: unstyled links, a
    // visible file picker, and none of the real layout. The mobile site is
    // built much more plainly and comes through intact.
    hostname: 'youtube.com',
    suggestedUrl: {
      url: 'https://m.youtube.com/',
      reason: "YouTube's desktop site doesn't render correctly through the proxy."
    }
  },
  {
    hostname: 'google.com',
    execute(contentWindow) {
      const currentUrl = new URL(contentWindow.__uv$location.href)
      const currentLanguage = currentUrl.searchParams.get('hl')
      const currentGeoLocation = currentUrl.searchParams.get('gl')
      let changed = false

      if (currentLanguage !== 'en') {
        currentUrl.searchParams.set('hl', 'en')
        changed = true
      }

      if (currentGeoLocation !== 'us') {
        currentUrl.searchParams.set('gl', 'us')
        changed = true
      }

      if (changed) contentWindow.__uv$location.href = currentUrl.toString()
    }
  }
]
