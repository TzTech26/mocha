import clsx from 'clsx'
import { Show, onMount } from 'solid-js'
import { type AdPlacement, activeNetwork, adClient, adSlots, adsterraUnits } from '../lib/ads'

declare global {
  interface Window {
    // biome-ignore lint: the AdSense queue is untyped
    adsbygoogle?: any[]
  }
}

// A single ad placement, rendered through whichever network is active in
// lib/ads.ts. Never render this inside the proxy viewer: neither network
// allows ads next to third party content we serve.
//
// Pages whose contents arrive asynchronously, or can legitimately be empty,
// pass `when` to say the content is actually there. An ad beside a loading
// spinner or an empty bookmarks list is a screen with no publisher content of
// its own, which is the specific thing AdSense rejects sites for.
export default function Ad(props: { placement: AdPlacement; when?: boolean; class?: string }) {
  return (
    <Show when={props.when !== false}>
      <Show when={activeNetwork === 'adsterra'} fallback={<AdSenseAd placement={props.placement} class={props.class} />}>
        <AdsterraAd placement={props.placement} class={props.class} />
      </Show>
    </Show>
  )
}

function AdSenseAd(props: { placement: AdPlacement; class?: string }) {
  const slot = () => adSlots[props.placement]

  onMount(() => {
    if (!slot()) return

    try {
      // Tells the already loaded AdSense script to fill the <ins> below. Routing
      // remounts the component, so each visit to the page requests its own ad.
      if (!window.adsbygoogle) window.adsbygoogle = []
      window.adsbygoogle.push({})
    } catch (error) {
      console.error('Failed to request an ad', error)
    }
  })

  return (
    <Show when={slot()}>
      <div class={clsx('flex w-full justify-center px-4 py-4', props.class)}>
        <ins class="adsbygoogle block w-full max-w-3xl" style={{ display: 'block' }} data-ad-client={adClient} data-ad-slot={slot()} data-ad-format="auto" data-full-width-responsive="true" />
      </div>
    </Show>
  )
}

function AdsterraAd(props: { placement: AdPlacement; class?: string }) {
  const unit = () => adsterraUnits[props.placement]
  let container: HTMLDivElement | undefined

  onMount(() => {
    const current = unit()
    if (!current || !container) return

    const script = document.createElement('script')
    script.async = true
    script.dataset.cfasync = 'false'
    script.src = current.scriptSrc
    container.appendChild(script)
  })

  return (
    <Show when={unit()}>
      {(current) => (
        <div class={clsx('flex w-full justify-center px-4 py-4', props.class)}>
          <div id={current().containerId} ref={container} class="w-full max-w-3xl" />
        </div>
      )}
    </Show>
  )
}
