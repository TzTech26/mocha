import { Show, createSignal, onCleanup, onMount } from 'solid-js'
import { fetchStatus, formatUptime } from '../lib/status'
import type { StatusData } from '../lib/types'

// Often enough that the numbers move while somebody is looking, rarely enough
// that leaving the page open is not traffic worth mentioning.
const refreshPeriod = 10000

export default function Status() {
  const [status, setStatus] = createSignal<StatusData | null>(null)
  // Not the same as "no users": until the first response lands there is nothing
  // to say, and showing zeroes in the meantime says something false.
  const [loading, setLoading] = createSignal(true)

  async function refresh() {
    setStatus(await fetchStatus())
    setLoading(false)
  }

  onMount(() => {
    void refresh()

    const timer = setInterval(refresh, refreshPeriod)
    onCleanup(() => clearInterval(timer))
  })

  return (
    <div class="mx-auto flex w-full max-w-2xl flex-col items-center gap-6 p-8">
      <div class="flex flex-col items-center gap-2">
        <h1 class="text-4xl font-bold">Status</h1>
        <Show when={!loading()} fallback={<p class="text-sm text-base-content/60">Checking…</p>}>
          <Show when={status()} fallback={<p class="text-sm text-error">The server isn't answering</p>}>
            <p class="flex items-center gap-2 text-sm text-base-content/60">
              <span class="inline-block h-2 w-2 rounded-full bg-success" />
              Everything is running
            </p>
          </Show>
        </Show>
      </div>

      <Show when={status()}>
        {(data) => (
          <div class="stats stats-vertical w-full bg-base-200 sm:stats-horizontal">
            <div class="stat place-items-center">
              <div class="stat-title">Active now</div>
              <div class="stat-value">{data().active.toLocaleString()}</div>
              <div class="stat-desc">In the last minute</div>
            </div>
            <div class="stat place-items-center">
              <div class="stat-title">Total users</div>
              <div class="stat-value">{data().total.toLocaleString()}</div>
              <div class="stat-desc">Since we started counting</div>
            </div>
            <div class="stat place-items-center">
              <div class="stat-title">Uptime</div>
              <div class="stat-value">{formatUptime(data().uptime)}</div>
              <div class="stat-desc">Since the last restart</div>
            </div>
          </div>
        )}
      </Show>

      <p class="text-center text-xs text-base-content/40">Users are counted with a random id your browser keeps for itself. It isn't tied to you, and nothing about what you browse is counted here.</p>
    </div>
  )
}
