import { A, useNavigate } from '@solidjs/router'
import { Dot, Search } from 'lucide-solid'
import { For, Show, createSignal, onMount } from 'solid-js'
import { gameImage, playGame } from '../lib/games'
import { fetchTopGames } from '../lib/status'
import type { GameData, TopGame } from '../lib/types'

// Five is enough to be a shortcut without turning the home page into the games
// page, which is one click away for anybody who wants the other 284.
const popularCount = 5

export default function Home() {
  const [query, setQuery] = createSignal('')
  const [popular, setPopular] = createSignal<{ game: GameData; plays: number }[]>([])
  const navigate = useNavigate()
  function processInput() {
    if (!query()) return
    navigate(`/route/${btoa(query())}`)
  }

  onMount(async () => {
    // The server counts plays by id, because that is all it is told. The names
    // and the artwork live in games.json, so the two are joined here rather
    // than teaching the server what a game is called.
    const top = await fetchTopGames(popularCount)

    if (!top.length) return

    const games: GameData[] = await fetch('/games.json')
      .then((response) => response.json())
      .catch(() => [])

    setPopular(top.map((entry: TopGame) => ({ plays: entry.plays, game: games.find((game) => game.id === entry.id) })).filter((entry): entry is { plays: number; game: GameData } => Boolean(entry.game)))
  })
  return (
    <div>
      <div class="absolute left-1/2 top-1/2 flex w-screen -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-4">
        <div class="flex items-center gap-3">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" class="h-12 w-12">
            <title>Mocha icon</title>
            <path
              fill="currentColor"
              d="M88 0C74.7 0 64 10.7 64 24c0 38.9 23.4 59.4 39.1 73.1l1.1 1C120.5 112.3 128 119.9 128 136c0 13.3 10.7 24 24 24s24-10.7 24-24c0-38.9-23.4-59.4-39.1-73.1l-1.1-1C119.5 47.7 112 40.1 112 24c0-13.3-10.7-24-24-24zM32 192c-17.7 0-32 14.3-32 32V416c0 53 43 96 96 96H288c53 0 96-43 96-96h16c61.9 0 112-50.1 112-112s-50.1-112-112-112H352 32zm352 64h16c26.5 0 48 21.5 48 48s-21.5 48-48 48H384V256zM224 24c0-13.3-10.7-24-24-24s-24 10.7-24 24c0 38.9 23.4 59.4 39.1 73.1l1.1 1C232.5 112.3 240 119.9 240 136c0 13.3 10.7 24 24 24s24-10.7 24-24c0-38.9-23.4-59.4-39.1-73.1l-1.1-1C231.5 47.7 224 40.1 224 24z"
            />
          </svg>
          <h1 class="text-5xl font-semibold">Mocha</h1>
        </div>
        <div class="join w-1/3">
          <input
            onKeyPress={(e) => {
              if (e.key !== 'Enter') return
              processInput()
            }}
            value={query()}
            onInput={(e) => setQuery(e.target.value)}
            placeholder="Enter a search query or URL"
            type="text"
            class="input join-item w-full bg-base-300"
          />
          <button class="btn btn-square join-item bg-base-300 border-none" type="button" onClick={processInput}>
            <Search class="h-5 w-5" />
          </button>
        </div>

        {/* Nothing until a game has actually been played: an empty row of
            placeholders says less than no row at all. */}
        <Show when={popular().length > 0}>
          <div class="flex flex-col items-center gap-3 pt-8">
            <p class="text-xs uppercase tracking-widest text-base-content/40">Most played</p>
            <div class="flex flex-wrap justify-center gap-3 px-4">
              <For each={popular()}>
                {(entry) => (
                  <button type="button" class="w-36 overflow-hidden rounded-btn bg-base-300 text-left duration-150 hover:bg-base-200" onClick={() => playGame(entry.game, navigate)}>
                    <img src={gameImage(entry.game)} alt="" class="h-20 w-full bg-base-200 object-cover" />
                    <div class="px-2.5 py-2">
                      <p class="truncate text-sm font-medium">{entry.game.name}</p>
                      <p class="text-xs text-base-content/50">{entry.plays.toLocaleString()} plays</p>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </div>
        </Show>
      </div>

      <div class="absolute bottom-0 flex w-screen items-center justify-between p-4 px-6 text-sm">
        &copy; 2026 Mocha &middot; All rights reserved
        <div class="flex items-center gap-4">
          <A href="/terms" class="link-hover link">
            Terms of Service
          </A>
          <Dot class="-mx-3" />
          <A href="/privacy" class="link-hover link">
            Privacy Policy
          </A>
          <Dot class="-mx-3" />
          <A href="/faq" class="link-hover link">
            FAQ
          </A>
        </div>
      </div>
    </div>
  )
}
