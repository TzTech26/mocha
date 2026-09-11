import clsx from 'clsx'
import { For, Show, onCleanup, onMount } from 'solid-js'
import { type AdPlacement, type AdSide, type AdUnit, adRails, adSides } from '../lib/ads'

// Whether this screen has anything for that edge. An empty rail is not
// rendered and takes no room, so the page never holds a gap open for a banner
// that is not coming.
function hasRail(placement: AdPlacement, side: AdSide) {
  return adRails[placement][side].length > 0
}

// Classes for a fixed, full window element that has to sit between the rails
// rather than under them - the proxy viewer's frame is the only one, which is
// why this reads the viewer's narrower rail width. Below xl there are no rails
// and it gets the whole window back.
export function adRailInset(placement: AdPlacement) {
  const left = hasRail(placement, 'left')
  const right = hasRail(placement, 'right')
  const rails = Number(left) + Number(right)

  return clsx('left-0 w-screen', left && 'xl:left-[var(--ad-rail-viewer)]', rails === 1 && 'xl:w-[calc(100vw-var(--ad-rail-viewer))]', rails === 2 && 'xl:w-[calc(100vw-var(--ad-rail-viewer)*2)]')
}

// The unit's own layout is a row of columns, sized for a wide in-content slot,
// which in a rail comes out as slivers a character wide. Its class names are
// randomised per request, so this goes after the layout properties
// structurally rather than by name. The page's copy of these rules, for units
// that are not isolated, is in src/style.css - keep the two in step.
const stackCss = `
  [data-ad-container] * {
    grid-template-columns: 1fr !important;
    grid-auto-flow: row !important;
    flex-direction: column !important;
    flex-wrap: nowrap !important;
    float: none !important;
    max-width: 100% !important;
  }

  [data-ad-container] img {
    height: auto !important;
    max-width: 100% !important;
  }
`

// The single-item rule from style.css, for a frame that has to apply it
// itself. Keep the two in step.
const singleCss = `
  [data-ad-container] > * > *:not(:first-child) {
    display: none !important;
  }
`

// The spacing rules from style.css, for a frame that has to apply them itself.
// The gap arrives as pixels rather than the page's own vh: inside a frame vh
// is the frame's height, which is set from the height of its contents, which
// this would then be part of - a gap that grows the frame that defines it.
function spreadCss(gap: number) {
  return `
    [data-ad-container],
    [data-ad-container] > * {
      display: flex !important;
      flex-direction: column !important;
      gap: ${gap}px !important;
    }
  `
}

// What --ad-gap comes to on this window, in pixels. Read off a throwaway
// element rather than restated here, so style.css stays the one place the
// spacing is decided.
function railGap() {
  const probe = window.document.createElement('div')

  probe.style.cssText = 'position:absolute;visibility:hidden;height:var(--ad-gap)'
  window.document.body.appendChild(probe)

  const gap = probe.offsetHeight

  probe.remove()

  return gap
}

// The site's own webfont, so a banner in a frame is not lettered in the
// browser's default serif next to one that is not.
const fontHref = 'https://fonts.googleapis.com/css2?family=Quicksand:wght@300..700&display=swap'

// How long an isolated banner waits for its frame's document before giving up
// on measuring it. Generous, because it is a handful of rAF callbacks against
// a document that is normally there within one, and cheap to be wrong about.
const watchWait = 10000

// One banner, straight into the page: the container the loader fills, and the
// loader beside it rather than inside it, the way the dashboard's snippet has
// it. The loader finds the container by id and replaces what is in there, so a
// script sitting inside it is writing into the element it is about to lose.
function Unit(props: { unit: AdUnit }) {
  let wrapper: HTMLDivElement | undefined

  onMount(() => {
    if (!wrapper) return

    const script = document.createElement('script')
    script.async = true
    script.dataset.cfasync = 'false'
    script.src = props.unit.scriptSrc
    wrapper.appendChild(script)
  })

  return (
    <div ref={wrapper} class="w-full">
      <div id={props.unit.containerId} data-ad-container="true" class="w-full" />
    </div>
  )
}

// The same banner in a document of its own, which is what lets a unit run in
// both rails at once - see the note on `isolate` in lib/ads.ts. srcdoc keeps it
// same origin, so the frame can be measured and kept exactly as tall as what
// the loader put in it, and it starts at zero height so an empty one is
// invisible rather than a gap.
function IsolatedUnit(props: { unit: AdUnit; spread?: boolean; single?: boolean }) {
  let frame: HTMLIFrameElement | undefined

  // A frame is a document of its own, so it inherits nothing: left alone the
  // banner comes out in the browser's default serif, in black, on white, in
  // the middle of a page that is usually dark. Everything it needs to match is
  // read off the page rather than hard coded, because which theme is running
  // is the reader's choice.
  //
  // Background rather than `transparent`: a document with a see-through canvas
  // still paints the default ground for its colour scheme underneath, and a
  // fresh document's scheme is light however dark the page around it is. That
  // is a white card behind the banner. Naming the page's own colour settles
  // both at once.
  const srcDocument = () => {
    const page = getComputedStyle(window.document.body)
    const root = getComputedStyle(window.document.documentElement)
    const colour = page.color || 'inherit'
    const scheme = root.colorScheme && root.colorScheme !== 'normal' ? root.colorScheme : 'light dark'
    const ground = page.backgroundColor === 'rgba(0, 0, 0, 0)' ? root.backgroundColor : page.backgroundColor

    return [
      '<!doctype html><html><head><meta charset="utf-8">',
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
      // Deliberately not a plain stylesheet link. One of those blocks the
      // frame's first paint until it answers, and this is a font CDN loaded
      // inside an ad frame, on a site whose readers are behind exactly the
      // sort of network and extensions that never answer - so a plain link is
      // a banner that renders as nothing at all. Non-matching media keeps it
      // out of the render path, and it is switched on once it arrives; if it
      // never does, the fallback below is already drawn.
      `<link rel="stylesheet" media="print" onload="this.media='all'" href="${fontHref}">`,
      `<style>html,body{margin:0;padding:0;color-scheme:${scheme};background:${ground};color:${colour};font-family:'Quicksand',sans-serif}${stackCss}${props.spread ? spreadCss(railGap()) : ''}${props.single ? singleCss : ''}</style>`,
      '</head><body>',
      `<div id="${props.unit.containerId}" data-ad-container="true"></div>`,
      `<script async data-cfasync="false" src="${props.unit.scriptSrc}"><\/script>`,
      '</body></html>'
    ].join('')
  }

  onMount(() => {
    const el = frame

    if (!el) return

    let observer: ResizeObserver | undefined
    let mutations: MutationObserver | undefined
    let detach: (() => void) | undefined
    let pending = 0

    const fit = () => {
      const inner = el.contentDocument

      if (!inner) return

      // The body's, not the root element's. The root's height is the frame's
      // viewport, which is whatever this line last set it to, so measuring it
      // would only ever agree with itself.
      const height = inner.body?.scrollHeight ?? inner.documentElement?.scrollHeight

      if (!height) return

      el.style.height = `${height}px`
    }

    // Watched rather than measured once: the loader fills the frame long after
    // the document exists, and a native banner keeps growing as its images
    // arrive.
    //
    // What it waits for is the container, not the frame's load event. A frame
    // starts life on a blank document and only then swaps in the one srcdoc
    // describes, so anything attached too early is watching a document that is
    // about to be thrown away - and load, which would have said when the swap
    // was done, waits on every subresource in there, the webfont included. A
    // slow or blocked font CDN would leave a filled banner in a frame still
    // zero pixels tall.
    const deadline = Date.now() + watchWait

    const watch = () => {
      const inner = el.contentDocument
      const body = inner?.body

      if (!inner || !body || !inner.querySelector('[data-ad-container]')) {
        if (Date.now() < deadline) pending = requestAnimationFrame(watch)
        return
      }

      observer?.disconnect()
      observer = new ResizeObserver(fit)

      // The body only. It grows with what the loader puts in it, while the
      // root element's box is the frame's viewport - and watching that means
      // every measurement resizes the thing being measured, which Chrome spots
      // as a loop and answers by quietly dropping the notifications. That is
      // one banner stuck at the height it happened to be when its images were
      // still arriving.
      observer.observe(body)

      // And a second pair of eyes on the markup, for a unit that swaps its
      // contents out without the body's box changing.
      mutations?.disconnect()
      mutations = new MutationObserver(fit)
      mutations.observe(body, { childList: true, subtree: true })

      // The banner's own images are the last thing to change its height, and
      // the case the observers above are worst at: the markup lands first and
      // is measured at once, then every picture in it arrives and pushes the
      // rest down. A load event does not bubble, but it does run capture
      // listeners on the way down, so one on the body hears all of them.
      body.removeEventListener('load', fit, true)
      body.addEventListener('load', fit, true)
      detach = () => body.removeEventListener('load', fit, true)

      // The webfont reflows the text when it swaps in, which moves the height
      // again after everything else has settled.
      void inner.fonts?.ready.then(fit).catch(() => {})

      fit()
    }

    // Nothing to scroll in there once it is sized to its contents, and no
    // scrollbar while it gets there either.
    el.setAttribute('scrolling', 'no')
    watch()

    onCleanup(() => {
      cancelAnimationFrame(pending)
      observer?.disconnect()
      mutations?.disconnect()
      detach?.()
    })
  })

  return <iframe ref={frame} srcdoc={srcDocument()} title="Advertisement" class="w-full border-0" style={{ height: '0px' }} />
}

// Straight into the page, or in a frame of its own - see `isolate` in
// lib/ads.ts. A plain branch rather than a <Show>, which would build both
// sides and have the spare one quietly load the ad script a second time. It
// is read once, which is all it needs: which units there are is fixed
// configuration, not something that changes while the page is open.
function Banner(props: { unit: AdUnit; spread?: boolean; single?: boolean }) {
  return props.unit.isolate ? <IsolatedUnit unit={props.unit} spread={props.spread} single={props.single} /> : <Unit unit={props.unit} />
}

// A rail as a column in the page: it sits in the flow beside the content, so it
// scrolls away with everything else rather than following the window down, and
// it is as long as however many banners are in it. Only from xl up, because
// narrower than that there is no room for a column beside the content, and a
// banner with nowhere to go is better not shown than dropped into the middle of
// the page.
//
// Screens whose contents arrive asynchronously pass `when` to say the content
// is actually there. A banner beside a loading spinner is a screen with no
// publisher content of its own, which is what gets a site thrown out of an ad
// network.
export function AdColumn(props: { placement: AdPlacement; side: AdSide; when?: boolean }) {
  const units = () => adRails[props.placement][props.side]

  return (
    <Show when={props.when !== false && units().length > 0}>
      <aside data-ad-rail={props.side} data-ad-spread="true" class="hidden shrink-0 flex-col gap-8 xl:flex" style={{ width: 'var(--ad-rail)' }}>
        <For each={units()}>{(unit) => <Banner unit={unit} spread />}</For>
      </aside>
    </Show>
  )
}

// Both rails beside a screen with no page to scroll: the viewer is one frame
// filling the window, so there is no flow for a column to sit in and these are
// pinned to the edges instead.
//
// One ad down each edge and no more. Without a scroll there is no way to reach
// a second banner, and the unit's own three or four items would be eight ads
// around one game, so a rail here takes the first banner and shows the first
// item of it: tall and thin, beside the page rather than around it.
export default function Ad(props: { placement: AdPlacement; when?: boolean }) {
  return (
    <Show when={props.when !== false}>
      <For each={adSides}>
        {(side) => (
          <Show when={adRails[props.placement][side][0]}>
            {(unit) => (
              <div
                data-ad-rail={side}
                // Click-through: the rail is its full width whatever the banner
                // turns out to be, and the space around a short one should not
                // be eating clicks meant for the page behind it.
                data-ad-single="true"
                class={clsx('pointer-events-none fixed top-1/2 z-30 hidden max-h-screen -translate-y-1/2 flex-col justify-center overflow-hidden px-2 xl:flex', side === 'left' ? 'left-0' : 'right-0')}
                style={{ width: 'var(--ad-rail-viewer)' }}
              >
                <div class="pointer-events-auto w-full">
                  <Banner unit={unit()} single />
                </div>
              </div>
            )}
          </Show>
        )}
      </For>
    </Show>
  )
}
