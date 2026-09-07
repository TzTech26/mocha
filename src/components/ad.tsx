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
  let wrapper: HTMLDivElement | undefined

  onMount(() => {
    const current = unit()
    if (!current || !wrapper) return

    // Beside the container rather than inside it, the way the dashboard's
    // snippet has it. The loader finds the container by id and fills it, so a
    // script sitting in there is writing into the element it is about to be
    // replaced by.
    const script = document.createElement('script')
    script.async = true
    script.dataset.cfasync = 'false'
    script.src = current.scriptSrc
    wrapper.appendChild(script)
  })

  return (
    <Show when={props.when !== false}>
      <Show when={unit()}>
        {(current) => (
          <div
            ref={wrapper}
            class={clsx(
              'flex w-full justify-center px-4 py-4',
              // Off to the right on a screen with room beside the content, so
              // it is never in front of what somebody came for. Narrower than
              // that there is no room for a column, and it falls back to
              // sitting at the end of the page.
              'xl:fixed xl:right-4 xl:top-1/2 xl:z-30 xl:w-72 xl:-translate-y-1/2 xl:px-0',
              props.class
            )}
          >
            <div id={current().containerId} class="w-full max-w-3xl xl:max-w-none" />
          </div>
        )}
      </Show>
    </Show>
  )
}
