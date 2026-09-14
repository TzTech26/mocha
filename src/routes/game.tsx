import { A, useNavigate, useParams } from '@solidjs/router'
import { ChevronRight, Flag, Play } from 'lucide-solid'
import { For, Show, createMemo, createSignal, onMount } from 'solid-js'
import { gameImage, playGame } from '../lib/games'
import { applyHeadFor } from '../lib/head'
import { fetchGameReport, verdicts } from '../lib/reports'
import type { GameData, GameReport } from '../lib/types'

// A page per game, and the reason there is one: a game opened in the viewer
// lives at an address nobody can link to and no crawler is allowed to read, so
// three hundred games were worth nothing to anybody searching for one by name.
// This is the page that answers that search, and the Play button opens the same
// viewer it always did.

// Enough to give every game a way in from some other game, without turning the
// bottom of the page into the games list again.
const relatedCount = 8

export default function Game() {
  const params = useParams()
  const navigate = useNavigate()

  const [games, setGames] = createSignal<GameData[]>([])
  const [loaded, setLoaded] = createSignal(false)
  const [report, setReport] = createSignal<GameReport | null>(null)

  const game = createMemo(() => games().find((entry) => entry.id === params.id))

  // Whatever is next to it in the list, which is alphabetical, so the row is at
  // least stable rather than random on every render.
  const related = createMemo(() => {
    const all = games()
    const index = all.findIndex((entry) => entry.id === params.id)

    if (index === -1) return []

    const before = all.slice(Math.max(0, index - relatedCount / 2), index)
    const after = all.slice(index + 1, index + 1 + relatedCount - before.length)

    return [...before, ...after]
  })

  const flag = createMemo(() => {
    const current = report()

    if (!current || current.verdict === 'working' || current.verdict === 'unknown') return null

    return verdicts[current.verdict]
  })

  onMount(async () => {
    const data: GameData[] = await fetch('/games.json')
      .then((response) => response.json())
      .catch(() => [])

    setGames(data)
    setLoaded(true)

    const found = data.find((entry) => entry.id === params.id)

    if (!found) {
      // Nothing here to index, and the server said as much with a 404.
      applyHeadFor(`/games/${params.id}`)

      return
    }

    // The title and the description the server wrote are already this game's.
    // This is for arriving here from somewhere else inside the app, where the
    // document was never reloaded and the head still belongs to wherever
    // somebody came from.
    applyHeadFor(`/games/${found.id}`, found)

    setReport(await fetchGameReport(found.id))
  })

  return (
    <div class="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-6">
      <Show
        when={game()}
        fallback={
          <Show when={loaded()} fallback={<span class="loading loading-dots loading-lg self-center" />}>
            <h1 class="text-4xl font-bold">Game not found</h1>
            <p class="text-base-content/60">This game is not on Mocha, or it was named something else. Everything that is here is on the games page.</p>
            <A href="/games" class="btn btn-primary w-fit">
              All games
            </A>
          </Show>
        }
      >
        {(current) => (
          <>
            {/* Crawlers follow these back up, and so do people who landed on
                this page from a search and have never seen the site. */}
            <div class="flex items-center gap-1 text-sm text-base-content/50">
              <A href="/" class="link-hover link">
                Mocha
              </A>
              <ChevronRight class="h-3.5 w-3.5" />
              <A href="/games" class="link-hover link">
                Games
              </A>
              <ChevronRight class="h-3.5 w-3.5" />
              <span class="text-base-content/70">{current().name}</span>
            </div>

            <div class="flex flex-col gap-6 md:flex-row">
              <img src={gameImage(current())} alt={`${current().name} unblocked`} class="aspect-video w-full rounded-box bg-base-200 object-cover md:w-96" width="384" height="216" />

              <div class="flex flex-col items-start gap-3">
                <h1 class="text-4xl font-bold">Play {current().name} unblocked</h1>

                <Show when={flag()}>{(verdict) => <div class={`badge ${verdict().badge} gap-1`}>{verdict().label}</div>}</Show>

                <p class="text-base-content/70">{current().name} runs in your browser through Mocha, so it works on a school or work network that blocks the game itself. Nothing to download, nothing to install and no account, on a laptop, a Chromebook or a phone.</p>

                <button class="btn btn-primary px-8" type="button" onClick={() => playGame(current(), navigate)}>
                  <Play class="h-5 w-5" /> Play {current().name}
                </button>

                <Show when={report()}>
                  {(current) => (
                    <p class="text-sm text-base-content/50">
                      <Show when={current().flags > 0} fallback={<>Nobody has reported a problem with this one.</>}>
                        {current().flags} {current().flags === 1 ? 'person has' : 'people have'} reported this, {current().works} {current().works === 1 ? 'says' : 'say'} it works for them.
                      </Show>{' '}
                      <A href="/reports" class="link">
                        See every reported game
                      </A>
                    </p>
                  )}
                </Show>

                <p class="flex items-center gap-1.5 text-xs text-base-content/40">
                  <Flag class="h-3.5 w-3.5" />
                  Broken? Say so with the flag on the control bar while you are playing it.
                </p>
              </div>
            </div>

            <Show when={related().length > 0}>
              <div class="flex flex-col gap-3 pt-2">
                <h2 class="text-xl font-semibold">More unblocked games</h2>
                <div class="flex flex-wrap gap-3">
                  <For each={related()}>
                    {(entry) => (
                      <A href={`/games/${entry.id}`} class="w-36 overflow-hidden rounded-btn bg-base-300 text-left duration-150 hover:bg-base-200">
                        <img src={gameImage(entry)} alt="" class="h-20 w-full bg-base-200 object-cover" width="144" height="80" loading="lazy" />
                        <div class="px-2.5 py-2">
                          <p class="truncate text-sm font-medium">{entry.name}</p>
                        </div>
                      </A>
                    )}
                  </For>
                </div>
                <A href="/games" class="link w-fit text-sm">
                  Browse every game
                </A>
              </div>
            </Show>
          </>
        )}
      </Show>
    </div>
  )
}
