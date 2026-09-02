import { recordPlay } from './status'
import type { GameData } from './types'

// Where a game lives on the CDN, and the one place that shape is written down:
// the status ping reads the game's id back out of this path, so the two have to
// agree.
export function gameUrl(game: Pick<GameData, 'id' | 'file'>) {
  return `/cdn/${game.id}/${game.file}`
}

export function gameImage(game: Pick<GameData, 'id' | 'image'>) {
  return `/cdn/${game.id}/${game.image}`
}

// Opening a game is a play, wherever it was opened from. The count is sent
// without waiting for it, because a slow request should never sit between the
// button and the game.
export function playGame(game: Pick<GameData, 'id' | 'file'>, navigate: (path: string) => void) {
  void recordPlay(game.id)

  navigate(`/route/${btoa(gameUrl(game))}?hidecontrolbar=true`)
}
