import clsx from 'clsx'
import { For, Show, onMount } from 'solid-js'
import { type AdPlacement, type AdSide, type AdUnit, adRails, adSides } from '../lib/ads'

// How much room one rail takes on the edge it is pinned to. It is a custom
// property rather than a number in here because the screens that show rails
// have to keep exactly that much clear on the same edge, and one value both of
// them read is the only way those two stay in step. See --ad-rail in
// src/style.css.
const railWidth = 'var(--ad-rail)'

// Whether this screen has a banner for that edge. A rail with no unit behind it
// is not rendered and takes no room, so the layout does not hold a gap open for
// a banner that is not there.
function hasRail(placement: AdPlacement, side: AdSide) {
  return Boolean(adRails[placement][side])
}

// Padding that keeps a page's own content out from under its rails. Only from
// xl up, because that is the only width where a rail is rendered at all.
export function adRailPadding(placement: AdPlacement) {
  return clsx(hasRail(placement, 'left') && 'xl:pl-[var(--ad-rail)]', hasRail(placement, 'right') && 'xl:pr-[var(--ad-rail)]')
}

// The same idea for a fixed, full window element that has to sit between the
// rails rather than under them - the proxy viewer's frame is the only one.
// Below xl there are no rails and it gets the whole window back.
export function adRailInset(placement: AdPlacement) {
  const left = hasRail(placement, 'left')
  const right = hasRail(placement, 'right')
  const rails = Number(left) + Number(right)

  return clsx('left-0 w-screen', left && 'xl:left-[var(--ad-rail)]', rails === 1 && 'xl:w-[calc(100vw-var(--ad-rail))]', rails === 2 && 'xl:w-[calc(100vw-var(--ad-rail)*2)]')
}

function Rail(props: { side: AdSide; unit: AdUnit }) {
  let wrapper: HTMLDivElement | undefined

  onMount(() => {
    if (!wrapper) return

    // Beside the container rather than inside it, the way the dashboard's
    // snippet has it. The loader finds the container by id and fills it, so a
    // script sitting in there is writing into the element it is about to be
    // replaced by.
    const script = document.createElement('script')
    script.async = true
    script.dataset.cfasync = 'false'
    script.src = props.unit.scriptSrc
    wrapper.appendChild(script)
  })

  return (
    <div
      ref={wrapper}
      data-ad-rail={props.side}
      class={clsx(
        // Pinned to the edge and vertically centred, and only from xl up.
        // Narrower than that there is no room for a column beside the content,
        // and a banner with nowhere to go is better not shown than dropped into
        // the middle of the page.
        //
        // The wrapper is click-through: it is the full width of the rail
        // whatever the banner turns out to be, and the padding around a short
        // banner should not be eating clicks meant for the page behind it.
        'pointer-events-none fixed top-1/2 z-30 hidden -translate-y-1/2 flex-col justify-center px-2 xl:flex',
        props.side === 'left' ? 'left-0' : 'right-0'
      )}
      style={{ width: railWidth }}
    >
      {/* Stacked one item above the next by the rules in style.css, which key
          off data-ad-container. A unit tall enough to run off the top and
          bottom of the window scrolls inside the rail instead. */}
      <div id={props.unit.containerId} data-ad-container="true" class="pointer-events-auto max-h-[calc(100vh-8rem)] w-full overflow-y-auto" />
    </div>
  )
}

// The ad rails for a screen: a banner down the left edge, a banner down the
// right, and nothing anywhere else - never in the flow of the page, never over
// the top of it. Only the games list and the proxy viewer mount this, so
// nothing else on the site carries ads at all. See adPlacements in lib/ads.ts.
//
// Screens whose contents arrive asynchronously pass `when` to say the content
// is actually there. A banner beside a loading spinner is a screen with no
// publisher content of its own, which is what gets a site thrown out of an ad
// network.
export default function Ad(props: { placement: AdPlacement; when?: boolean }) {
  return (
    <Show when={props.when !== false}>
      <For each={adSides}>{(side) => <Show when={adRails[props.placement][side]}>{(unit) => <Rail side={side} unit={unit()} />}</Show>}</For>
    </Show>
  )
}
