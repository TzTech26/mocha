import store from 'store2'
import { type SeoData, seoForPath, tagsFor } from './seo'
import type { GameData, TabData } from './types'

// Navigating inside a single page app never reloads the document, so the head
// the server wrote is still the head of whatever page somebody clicked through
// to. This rewrites it. The server marks everything it owns with data-seo and
// so does this, which is what makes replacing the lot safe: nothing hand
// written in index.html is touched.
const owned = 'data-seo'

function tag<K extends keyof HTMLElementTagNameMap>(name: K) {
  const element = document.createElement(name)
  element.setAttribute(owned, '')

  return element
}

// The head this page is meant to have, kept so the title can be put back after
// a cloak is taken off without working out where we are all over again.
let current: SeoData | null = null

export function applyHead(seo: SeoData) {
  current = seo

  // The title element is left where it is and written through document.title
  // below, because removing it would empty the tab for as long as it takes to
  // put the next one in.
  for (const existing of document.querySelectorAll(`[${owned}]:not(title)`)) {
    existing.remove()
  }

  // Cloaking is somebody hiding what this tab is, which outranks saying what
  // page they are on. See lib/cloak.ts.
  if (!(store('tab') as TabData).name) {
    document.title = seo.title
  }

  for (const meta of tagsFor(seo)) {
    const element = tag('meta')
    element.setAttribute(meta.key, meta.value)
    element.content = meta.content
    document.head.appendChild(element)
  }

  const canonical = tag('link')
  canonical.rel = 'canonical'
  canonical.href = seo.canonical
  document.head.appendChild(canonical)

  for (const data of seo.jsonLd) {
    const script = tag('script')
    script.type = 'application/ld+json'
    script.textContent = JSON.stringify(data)
    document.head.appendChild(script)
  }
}

// Uncloaking. The tab was showing somebody else's title and now has to show
// this page's, which is not 'Mocha' unless this is the home page. See
// lib/cloak.ts.
export function restoreTitle() {
  // Falling back to working it out from the address covers being called before
  // any page has applied its head, which nothing does today but is a blank tab
  // if it ever happens.
  document.title = (current ?? seoForPath(window.location.pathname)).title
}

// What the head should say about this address. The game is handed in by
// whoever has games.json loaded already, which is the game page itself.
export function applyHeadFor(pathname: string, game?: GameData) {
  applyHead(seoForPath(pathname, { game }))
}
