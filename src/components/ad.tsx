import clsx from 'clsx'
import { Show, onMount } from 'solid-js'
import { type AdPlacement, adClient, adSlots } from '../lib/ads'

declare global {
  interface Window {
    // biome-ignore lint: the AdSense queue is untyped
    adsbygoogle?: any[]
  }
}

// A single responsive AdSense display unit. Never render this inside the proxy
// viewer: AdSense does not allow ads next to third party content we serve.
export default function Ad(props: { placement: AdPlacement; class?: string }) {
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
