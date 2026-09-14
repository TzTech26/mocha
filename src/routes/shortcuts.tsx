import { Show, createSignal, onMount } from 'solid-js'
import type { ShortcutData } from '../lib/types'

import Shortcut from '../components/shortcut'

export default function Shortcuts() {
  const [data, setData] = createSignal<ShortcutData[]>([])

  onMount(() => {
    fetch('/shortcuts.json')
      .then((res) => res.json())
      .then((res: ShortcutData[]) => {
        const sorted = res.sort((a, b) => {
          return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
        })
        setData(sorted)
      })
  })

  return (
    <div class="flex flex-col items-center gap-2 py-4">
      <h1 class="text-3xl font-bold">Shortcuts</h1>
      <p class="max-w-2xl px-4 text-center text-sm text-base-content/60">The sites people come here to open, one click each, through Mocha's encrypted proxy. No extension and nothing to install.</p>

      <div class="flex flex-wrap justify-center gap-4 px-4 py-8">
        <Show when={!data()[0]}>
          <span class="loading loading-dots loading-lg" />
        </Show>
        {data().map((shortcut) => {
          // biome-ignore lint: it's fine
          return <Shortcut shortcut={shortcut} />
        })}
      </div>
    </div>
  )
}
