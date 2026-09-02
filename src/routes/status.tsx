import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { fetchStatus, formatDuration, formatPercent } from '../lib/status'
import type { GameData, StatusData } from '../lib/types'

// Often enough that the numbers move while somebody is looking, rarely enough
// that leaving the page open is not traffic worth mentioning.
const refreshPeriod = 10000

const historyHours = 24

function Tile(props: { label: string; value: string; note?: string }) {
  return (
    <div class="rounded-box bg-base-200 px-4 py-3">
      <p class="text-xs uppercase tracking-wide text-base-content/50">{props.label}</p>
      <p class="pt-0.5 text-2xl font-semibold">{props.value}</p>
      <Show when={props.note}>
        <p class="text-xs text-base-content/40">{props.note}</p>
      </Show>
    </div>
  )
}

function Section(props: { title: string; children: unknown }) {
  return (
    <section class="flex w-full flex-col gap-3">
      <h2 class="text-sm font-semibold uppercase tracking-widest text-base-content/50">{props.title}</h2>
      {props.children as never}
    </section>
  )
}

function clockHour(hour: number) {
  return `${String(new Date(hour * 3600000).getHours()).padStart(2, '0')}:00`
}

function date(at: number) {
  return new Date(at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function Status() {
  const [status, setStatus] = createSignal<StatusData | null>(null)
  const [names, setNames] = createSignal<Record<string, string>>({})
  // Not the same as "nobody is here": until the first response lands there is
  // nothing to say, and showing zeroes in the meantime says something false.
  const [loading, setLoading] = createSignal(true)

  async function refresh() {
    const next = await fetchStatus()

    // Hold the last good numbers rather than blanking the page on one dropped
    // request; the banner is what says the server stopped answering.
    if (next) setStatus(next)
    setLoading(false)
  }

  onMount(() => {
    void refresh()

    const timer = setInterval(refresh, refreshPeriod)
    onCleanup(() => clearInterval(timer))

    // The server counts plays by id because that is all it is told; the names
    // live in games.json.
    fetch('/games.json')
      .then((response) => response.json())
      .then((games: GameData[]) => setNames(Object.fromEntries(games.map((game) => [game.id, game.name]))))
      .catch(() => {})
  })

  // Every hour of the last day, whether or not anything was recorded in it, so
  // the gap left by a server that was not running keeps its place on the axis.
  const hours = createMemo(() => {
    const data = status()
    if (!data) return []

    const now = Math.floor(Date.now() / 3600000)
    const recorded = new Map(data.history.map((bucket) => [bucket.hour, bucket]))

    return Array.from({ length: historyHours }, (_, index) => {
      const hour = now - (historyHours - 1) + index

      return { hour, recorded: recorded.get(hour) }
    })
  })

  const busiest = createMemo(() => hours().reduce((best, entry) => Math.max(best, entry.recorded?.peak ?? 0), 0))

  return (
    <div class="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 p-8 pb-16">
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
          <>
            <Section title="Right now">
              <div class="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
                <Tile label="Here now" value={data().now.active.toLocaleString()} note="People using Mocha" />
                <Tile label="Playing" value={data().now.playing.toLocaleString()} note="In a game" />
                <Tile label="Browsing" value={data().now.proxying.toLocaleString()} note="Through the proxy" />
                <Tile label="Watching" value={data().now.watching.toLocaleString()} note="On this page, not counted above" />
              </div>
            </Section>

            <Section title="Last 24 hours">
              <div class="flex w-full flex-col gap-2 rounded-box bg-base-200 px-4 pb-3 pt-4">
                <Show when={busiest() > 0} fallback={<p class="py-8 text-center text-sm text-base-content/40">Nothing recorded yet</p>}>
                  <p class="text-xs text-base-content/50">
                    Busiest hour held <span class="font-semibold text-base-content">{busiest().toLocaleString()}</span> {busiest() === 1 ? 'person' : 'people'} at once
                  </p>
                  <div class="flex h-28 items-end gap-[2px] border-b border-base-content/10">
                    <For each={hours()}>
                      {(entry) => (
                        <div class="tooltip flex h-full flex-1 items-end" data-tip={entry.recorded ? `${clockHour(entry.hour)} · ${entry.recorded.peak} here · ${entry.recorded.plays} ${entry.recorded.plays === 1 ? 'play' : 'plays'}` : `${clockHour(entry.hour)} · not recorded`}>
                          <div
                            class={entry.recorded ? 'w-full rounded-t bg-primary' : 'w-full rounded-t bg-base-content/10'}
                            style={{
                              // A recorded hour with nobody in it still gets a
                              // sliver, so an empty hour reads as measured
                              // rather than missing.
                              height: entry.recorded ? `${Math.max(2, (entry.recorded.peak / busiest()) * 100)}%` : '2px'
                            }}
                          />
                        </div>
                      )}
                    </For>
                  </div>
                  <div class="flex justify-between text-xs text-base-content/40">
                    <span>{clockHour(hours()[0]?.hour ?? 0)}</span>
                    <span>now</span>
                  </div>
                </Show>
              </div>
            </Section>

            <Section title="Uptime">
              <div class="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
                <Tile label="Uptime" value={formatPercent(data().uptime.percent)} note={`Measured since ${date(data().uptime.since)}`} />
                <Tile label="Up now" value={formatDuration(data().uptime.current)} note="Since the last restart" />
                <Tile label="Best run" value={formatDuration(data().uptime.longest)} note="Longest without a restart" />
                <Tile label="Restarts" value={data().uptime.restarts.toLocaleString()} note={`${formatDuration(data().uptime.down)} of downtime`} />
              </div>
            </Section>

            <Section title="People">
              <div class="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                <Tile label="Total" value={data().people.total.toLocaleString()} note="Everyone who has used Mocha" />
                <Tile label="Came back" value={data().people.returning.toLocaleString()} note="Here on more than one day" />
                <Tile label="New today" value={data().people.newToday.toLocaleString()} note="First visit today" />
                <Tile label="Today" value={data().people.activeToday.toLocaleString()} note="Here at some point today" />
                <Tile label="This week" value={data().people.activeWeek.toLocaleString()} note="Here in the last 7 days" />
              </div>
              <Show when={data().people.peak > 0}>
                <p class="text-xs text-base-content/40">
                  Most at once: {data().people.peak.toLocaleString()} on {date(data().people.peakAt)}
                </p>
              </Show>
            </Section>

            <Section title="Games">
              <div class="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
                <Tile label="Plays" value={data().games.plays.toLocaleString()} note="Games opened, all time" />
                <Tile label="Last 24h" value={data().games.playsDay.toLocaleString()} note="Games opened in the last day" />
                <Tile label="Players" value={data().games.players.toLocaleString()} note="People who played one" />
                <Tile label="Games" value={data().games.tracked.toLocaleString()} note="Different games played" />
              </div>

              <Show when={data().games.top.length > 0} fallback={<p class="rounded-box bg-base-200 p-6 text-center text-sm text-base-content/40">No games have been played yet</p>}>
                <div class="w-full overflow-x-auto rounded-box bg-base-200">
                  <table class="table table-sm">
                    <thead>
                      <tr class="text-base-content/50">
                        <th class="w-8">#</th>
                        <th>Game</th>
                        <th class="text-right">Plays</th>
                        <th class="text-right">Players</th>
                        <th class="text-right">Replays</th>
                        <th class="text-right">Today</th>
                        <th class="text-right">Now</th>
                      </tr>
                    </thead>
                    <tbody class="tabular-nums">
                      <For each={data().games.top}>
                        {(game, index) => (
                          <tr>
                            <td class="text-base-content/40">{index() + 1}</td>
                            <td class="font-medium">{names()[game.id] ?? game.id}</td>
                            <td class="text-right">{game.plays.toLocaleString()}</td>
                            <td class="text-right">{game.players.toLocaleString()}</td>
                            <td class="text-right">{game.repeats.toLocaleString()}</td>
                            <td class="text-right">{game.today.toLocaleString()}</td>
                            <td class="text-right">{game.playing > 0 ? game.playing.toLocaleString() : '—'}</td>
                          </tr>
                        )}
                      </For>
                    </tbody>
                  </table>
                </div>
              </Show>
            </Section>
          </>
        )}
      </Show>

      <p class="max-w-xl text-center text-xs text-base-content/40">People are counted with a random id your browser keeps for itself, along with which games are opened. It isn't tied to you, nothing about what you browse is counted here, and anyone reading this page is left out of the count above.</p>
    </div>
  )
}
