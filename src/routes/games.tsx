import { A } from '@solidjs/router'
import Fuse, { type FuseResult } from 'fuse.js'
import { Flag } from 'lucide-solid'
import { Show, createSignal, onMount } from 'solid-js'
import Ad from '../components/ad'
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

  return (
    <div class="flex flex-col items-center gap-2 py-4">
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

      <Ad placement="games" />
    </div>
  )
}
