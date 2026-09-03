import { useNavigate } from '@solidjs/router'
import { Show } from 'solid-js'
import { gameImage, playGame } from '../lib/games'
import { verdicts } from '../lib/reports'
import type { GameData, GameReport } from '../lib/types'

// The badge is handed in as a function rather than a value so a card is not
// rebuilt when the reports land: the grid is three hundred of these, and every
// one of them would fetch its artwork again.
export default function Game(props: { game: GameData; report?: () => GameReport | undefined }) {
  const navigate = useNavigate()

  // A card only says anything when there is something to say. Marking the
  // other two hundred and eighty as fine would be noise, and quietly wrong the
  // moment one of them breaks.
  const flag = () => {
    const report = props.report?.()

    if (!report || report.verdict === 'working' || report.verdict === 'unknown') return null

    return verdicts[report.verdict]
  }

  return (
    <div class="card image-full aspect-video w-80 bg-base-100 shadow-xl">
      <figure>
        <img src={gameImage(props.game)} alt={props.game.name} class="object-full h-full w-full" />
      </figure>
      <div class="card-body">
        <h2 class="card-title text-3xl font-bold text-base-content">{props.game.name}</h2>
        <Show when={flag()}>{(verdict) => <div class={`badge ${verdict().badge} absolute right-4 top-4 gap-1`}>{verdict().label}</div>}</Show>
        <div class="card-actions absolute bottom-4 right-4 justify-end">
          <button class="btn btn-primary px-8" type="button" onClick={() => playGame(props.game, navigate)}>
            Play
          </button>
        </div>
      </div>
    </div>
  )
}
