import { directGame } from './direct'
import { recordPlay } from './status'
import type { GameData } from './types'

// Artwork is worked out in lib/seo.ts, which the server loads as well, and is
// re-exported here so everything that shows a game imports it from one place.
export { gameImage } from './seo'

// Where a game lives on the CDN, and the one place that shape is written down:
// the status ping reads the game's id back out of this path, so the two have to
// agree. A game on its own site is played from there instead, and its id comes
// back from lib/direct.ts.
export function gameUrl(game: Pick<GameData, 'id' | 'file' | 'url'>) {
  return game.url ?? `/cdn/${game.id}/${game.file}`
}

// The other direction, and the reason the shape above is worth having in one
// place: the viewer is handed an address and has to work out whether what it is
// showing is a game, so it can offer to report one.
export function gameIdFromTarget(target: string) {
  return /^\/cdn\/([a-zA-Z0-9._-]+)\//.exec(target)?.[1] ?? directGame(target)
}

// Opening a game is a play, wherever it was opened from. The count is sent
// without waiting for it, because a slow request should never sit between the
// button and the game.
export function playGame(game: Pick<GameData, 'id' | 'file' | 'url'>, navigate: (path: string) => void) {
  void recordPlay(game.id)

  navigate(`/route/${btoa(gameUrl(game))}?hidecontrolbar=true`)
}
