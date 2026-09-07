import clsx from 'clsx'
import { Show, onMount } from 'solid-js'
import { type AdPlacement, adUnits } from '../lib/ads'

// A single ad placement. Never render this inside the proxy viewer: ads are
// not allowed next to the third party content we serve there.
//
// Pages whose contents arrive asynchronously, or can legitimately be empty,
// pass `when` to say the content is actually there. An ad beside a loading
// spinner or an empty bookmarks list is a screen with no publisher content of
// its own, which is what gets a site thrown out of an ad network.
export default function Ad(props: { placement: AdPlacement; when?: boolean; class?: string }) {
  const unit = () => adUnits[props.placement]
  let container: HTMLDivElement | undefined

  onMount(() => {
    const current = unit()
    if (!current || !container) return

    // One loader script per unit, injected next to its own container.
    const script = document.createElement('script')
    script.async = true
    script.dataset.cfasync = 'false'
    script.src = current.scriptSrc
    container.appendChild(script)
  })

  return (
    <Show when={props.when !== false}>
      <Show when={unit()}>
        {(current) => (
          <div class={clsx('flex w-full justify-center px-4 py-4', props.class)}>
            <div id={current().containerId} ref={container} class="w-full max-w-3xl" />
          </div>
        )}
      </Show>
    </Show>
  )
}
