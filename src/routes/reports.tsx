import { A, useNavigate } from '@solidjs/router'
import clsx from 'clsx'
import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { gameImage, playGame } from '../lib/games'
import { fetchReports, formatPlaytime, formatWhen, sendReport, verdicts } from '../lib/reports'
import type { GameData, GameReport, ReportKind, ReportsData } from '../lib/types'

// Long enough that a page left open follows what is happening, short enough
// that it is not traffic worth mentioning. Same clock as the status page.
const refreshPeriod = 15000

function Tile(props: { label: string; value: string; note?: string; tone?: string }) {
  return (
    <div class="rounded-box bg-base-200 px-4 py-3">
      <p class="text-xs uppercase tracking-wide text-base-content/50">{props.label}</p>
      <p class={clsx('pt-0.5 text-2xl font-semibold', props.tone)}>{props.value}</p>
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

export default function Reports() {
  const [data, setData] = createSignal<ReportsData | null>(null)
  const [games, setGames] = createSignal<Record<string, GameData>>({})
  const [everything, setEverything] = createSignal(false)
  const [loading, setLoading] = createSignal(true)
  // Rows the reader has just pressed something on. The next refresh carries
  // them anyway, but a button that does nothing for fifteen seconds reads as
  // broken.
  const [mine, setMine] = createSignal<Record<string, GameReport>>({})

  const navigate = useNavigate()

  async function refresh() {
    const next = await fetchReports()

    if (next) {
      setData(next)
      setMine({})
    }

    setLoading(false)
  }

  onMount(() => {
    void refresh()

    const timer = setInterval(refresh, refreshPeriod)
    onCleanup(() => clearInterval(timer))

    // The server only ever hears a game's id. What it is called and what it
    // looks like live in games.json, same as everywhere else.
    fetch('/games.json')
      .then((response) => response.json())
      .then((list: GameData[]) => setGames(Object.fromEntries(list.map((game) => [game.id, game]))))
      .catch(() => {})
  })

  async function say(game: string, kind: ReportKind | 'none') {
    const next = await sendReport(game, kind)

    if (next) setMine({ ...mine(), [game]: next })
  }

  // The reader's own answer wins over the last refresh for that one row.
  const rows = createMemo(() => (data()?.games ?? []).map((game) => mine()[game.id] ?? game))

  // Already in the order the server put them in: most reports first, and how
  // many people play the game deciding between games with the same number.
  const problems = createMemo(() => rows().filter((game) => game.verdict === 'flagged'))

  // The case this page exists to handle: somebody flagged it, everybody else
  // is playing it. Worth showing rather than hiding, so the person who flagged
  // it can see what happened to their report.
  const answered = createMemo(() => rows().filter((game) => game.verdict !== 'flagged' && game.flags > 0))

  const rest = createMemo(() => rows().filter((game) => game.flags === 0))

  function name(id: string) {
    return games()[id]?.name ?? id
  }

  function Row(props: { game: GameReport }) {
    const verdict = () => verdicts[props.game.verdict]
    const data = () => games()[props.game.id]

    return (
      <tr>
        <td>
          <div class="flex items-start gap-3">
            <Show when={data()}>{(game) => <img src={gameImage(game())} alt="" class="mt-0.5 h-8 w-12 rounded bg-base-300 object-cover" />}</Show>
            <div class="flex flex-col gap-1">
              <p class="font-medium">{name(props.game.id)}</p>
              <Show when={verdict()}>{(current) => <p class={clsx('text-xs', current().tone)}>{current().detail}</p>}</Show>
              {/* What people actually typed, which is the only thing here that
                  says what is wrong rather than that something is. */}
              <For each={props.game.notes}>
                {(note) => (
                  <p class="max-w-md text-xs italic text-base-content/60">
                    &ldquo;{note.text}&rdquo; <span class="not-italic text-base-content/30">{formatWhen(note.at)}</span>
                  </p>
                )}
              </For>
            </div>
          </div>
        </td>
        <td class="text-right align-top tabular-nums">{props.game.flags.toLocaleString()}</td>
        <td class="text-right align-top tabular-nums">{props.game.works.toLocaleString()}</td>
        <td class="text-right align-top tabular-nums">
          {formatPlaytime(props.game.typical)}
          <Show when={props.game.visits > 0}>
            <span class="block text-xs text-base-content/40">
              {props.game.visits.toLocaleString()} {props.game.visits === 1 ? 'visit' : 'visits'}
            </span>
          </Show>
        </td>
        <td class="text-right align-top text-xs text-base-content/40">{props.game.lastReport ? formatWhen(props.game.lastReport) : '—'}</td>
        <td class="align-top">
          <div class="flex justify-end gap-1">
            <Show when={data()}>
              {(game) => (
                <button type="button" class="btn btn-ghost btn-xs" onClick={() => playGame(game(), navigate)}>
                  Try it
                </button>
              )}
            </Show>
            <button type="button" class={clsx('btn btn-xs', props.game.you === 'works' ? 'btn-success' : 'btn-ghost')} onClick={() => say(props.game.id, props.game.you === 'works' ? 'none' : 'works')}>
              Works
            </button>
            <button type="button" class={clsx('btn btn-xs', props.game.you === 'broken' ? 'btn-error' : 'btn-ghost')} onClick={() => say(props.game.id, props.game.you === 'broken' ? 'none' : 'broken')}>
              Broken
            </button>
          </div>
        </td>
      </tr>
    )
  }

  function Table(props: { games: GameReport[] }) {
    return (
      <div class="w-full overflow-x-auto rounded-box bg-base-200">
        <table class="table table-sm">
          <thead>
            <tr class="text-base-content/50">
              <th>Game</th>
              <th class="text-right">Reports</th>
              <th class="text-right">Works</th>
              <th class="text-right">Typical visit</th>
              <th class="text-right">Last report</th>
              <th class="text-right">Your turn</th>
            </tr>
          </thead>
          <tbody>
            <For each={props.games}>{(game) => <Row game={game} />}</For>
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div class="mx-auto flex w-full max-w-4xl flex-col items-center gap-8 p-8 pb-16">
      <div class="flex flex-col items-center gap-2 text-center">
        <h1 class="text-4xl font-bold">Game reports</h1>
        <p class="max-w-xl text-sm text-base-content/60">Games are hosted somewhere else and break without telling anybody. Open one, press the flag on the control bar, and say what it does. This is what everybody has reported.</p>
      </div>

      <Show when={!loading()} fallback={<span class="loading loading-dots loading-lg" />}>
        <Show when={data()} fallback={<p class="text-sm text-error">The server isn't answering</p>}>
          {(current) => (
            <>
              <Section title="Where things stand">
                <div class="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
                  <Tile label="Flagged" value={current().counts.flagged.toLocaleString()} note="Reported and not answered" tone={current().counts.flagged > 0 ? 'text-error' : undefined} />
                  <Tile label="Reports" value={current().counts.reports.toLocaleString()} note="From everybody, all games" />
                  <Tile label="Answered" value={current().counts.disputed.toLocaleString()} note="Reported, but people play them" />
                  <Tile label="Working" value={current().counts.working.toLocaleString()} note="Nothing outstanding against them" tone="text-success" />
                </div>
              </Section>

              <Section title="Flagged">
                <p class="-mt-1 text-xs text-base-content/40">Most reported first. Two games with the same number of reports are ordered by how many people play them, since the same fault on a game everybody opens is worth fixing first.</p>
                <Show when={problems().length > 0} fallback={<p class="rounded-box bg-base-200 p-6 text-center text-sm text-base-content/40">Nothing is flagged right now</p>}>
                  <Table games={problems()} />
                </Show>
              </Section>

              <Show when={answered().length > 0}>
                <Section title="Reported, but working for others">
                  <p class="-mt-1 text-xs text-base-content/40">Somebody flagged these and enough people have played them since that the report is outweighed. If one of them is broken for you too, say so and it moves up.</p>
                  <Table games={answered()} />
                </Section>
              </Show>

              <Show when={rest().length > 0}>
                <Section title="Everything else">
                  <label class="flex cursor-pointer items-center gap-2 text-sm text-base-content/60">
                    <input type="checkbox" class="checkbox checkbox-sm" checked={everything()} onChange={(event) => setEverything(event.currentTarget.checked)} />
                    Show the {rest().length.toLocaleString()} {rest().length === 1 ? 'game' : 'games'} nobody has reported
                  </label>
                  <Show when={everything()}>
                    <Table games={rest()} />
                  </Show>
                </Section>
              </Show>

              <Section title="How this works">
                <div class="flex w-full flex-col gap-2 rounded-box bg-base-200 px-5 py-4 text-sm text-base-content/60">
                  <p>
                    <span class="font-semibold text-base-content">A game is only called broken because somebody said so.</span> Nothing here guesses. The flag sits on the viewer's control bar next to the home button, it gives you a box to say what happens, and that is the whole of it.
                  </p>
                  <p>
                    <span class="font-semibold text-base-content">One report does not take a game down.</span> Anybody who opens it and finds it fine can say so, and once {current().rules.disputeRatio} times as many people have, the report is answered and the game moves to the list below the flagged one.
                    Nothing is deleted - the report is still there, with what they said, in case it comes back.
                  </p>
                  <p>
                    <span class="font-semibold text-base-content">Staying counts as saying it works.</span> Nobody has to press anything: a visit that runs past {Math.round(current().rules.provenSeconds / 60)} minutes is a game that demonstrably ran, and up to {current().rules.provenWeight} of those count the
                    way people agreeing do. Leaving quickly counts as nothing at all - people close games because they are bored far more often than because they are broken.
                  </p>
                  <p>Reports are forgotten after {current().rules.voteDays} days, so a game that was fixed quietly does not stay flagged forever.</p>
                </div>
              </Section>
            </>
          )}
        </Show>
      </Show>

      <p class="max-w-xl text-center text-xs text-base-content/40">
        Reports are signed with the random id your browser keeps for itself, which is what makes it one report per person per game. Nothing else about you is stored, and what you type here is public. The rest of the numbers are on the{' '}
        <A href="/status" class="link">
          status page
        </A>
        .
      </p>
    </div>
  )
}
