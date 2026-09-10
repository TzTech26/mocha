import { A } from '@solidjs/router'
import Fuse, { type FuseResult } from 'fuse.js'
import { Flag } from 'lucide-solid'
import { Show, createSignal, onMount } from 'solid-js'
import { AdColumn } from '../components/ad'
import Game from '../components/game'
import { fetchReports } from '../lib/reports'
import type { GameData, GameReport } from '../lib/types'

export default function Games() {
  const [data, setData] = createSignal<GameData[]>([])
  const [results, setResults] = createSignal<FuseResult<GameData>[]>([])
  // What everybody else has found broken, so a card can say so before somebody
  // clicks it and finds out the slow way.
  const [reports, setReports] = createSignal<Record<string, GameReport>>({})

  function handleSearch(text: string) {
    const search = data()
    const fuse = new Fuse(search, {
      keys: ['name']
    })
    setResults(fuse.search(text))
  }

  onMount(() => {
    fetch('/games.json')
      .then((res) => res.json())
      .then((res: GameData[]) => {
        setData(res)
      })

    // Never in the way of the games appearing: the badges turn up when they
    // turn up, and the page is the same page without them.
    void fetchReports().then((next) => {
      if (next) setReports(Object.fromEntries(next.games.map((game) => [game.id, game])))
    })
  })

  // Three columns from xl up: a rail, the games, a rail. The rails are in the
  // flow rather than pinned to the window, so they scroll away with the grid
  // instead of following it down the page.
  return (
    <div class="flex items-start justify-center gap-4 py-4">
      <AdColumn placement="games" side="left" when={data().length > 0} />

      <div class="flex min-w-0 flex-1 flex-col items-center gap-2">
        <Show when={data()[0]}>
          <input type="text" class="input input-bordered w-1/3" onInput={(e) => handleSearch(e.target.value)} placeholder={`Search ${data().length} games`} />
          <A href="/reports" class="flex items-center gap-1.5 text-xs text-base-content/40 duration-150 hover:text-base-content/70">
            <Flag class="h-3.5 w-3.5" />
            One of these not working? See what everybody has reported
          </A>
        </Show>

        <div class="flex flex-wrap justify-center gap-4 px-4 py-8">
          <Show when={!data()[0]}>
            <span class="loading loading-dots loading-lg" />
          </Show>
          {results().length > 0
            ? results().map((result) => {
                // biome-ignore lint: shut up
                return <Game game={result.item} report={() => reports()[result.item.id]} />
              })
            : data().map((game) => {
                // biome-ignore lint: shut up
                return <Game game={game} report={() => reports()[game.id]} />
              })}
        </div>
      </div>

      <AdColumn placement="games" side="right" when={data().length > 0} />
    </div>
  )
}
