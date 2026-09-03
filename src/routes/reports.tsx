import { A, useNavigate } from '@solidjs/router'
import clsx from 'clsx'
import { For, Show, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { gameImage, playGame } from '../lib/games'
import { fetchReports, formatPlaytime, formatWhen, sendReport, verdicts } from '../lib/reports'
import type { GameData, GameReport, ReportKind, ReportsData } from '../lib/types'

// Long enough that a page left open follows what is happening, short enough
// that it is not traffic worth mentioning. Same clock as the status page.
const refreshPeriod = 15000

// Everything anybody would come here for is in these; the rest of what is
// measured is behind the toggle.
const flagged = new Set(['broken', 'keyboard', 'suspect', 'reported'])

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
  // Rows the reader has just voted on. The next refresh carries them anyway,
  // but a button that does nothing for fifteen seconds reads as broken.
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

  // The reader's own vote wins over the last refresh for that one row.
  const rows = createMemo(() => (data()?.games ?? []).map((game) => mine()[game.id] ?? game))

  const problems = createMemo(() => rows().filter((game) => flagged.has(game.verdict)))

  // The case this page exists to handle: somebody flagged it, everybody else
  // is playing it. Worth showing rather than hiding, so the person who flagged
  // it can see what happened to their report.
  const disputed = createMemo(() => rows().filter((game) => game.verdict === 'working' && game.flags > 0))

  const rest = createMemo(() => rows().filter((game) => !flagged.has(game.verdict) && game.flags === 0))

  function name(id: string) {
    return games()[id]?.name ?? id
  }

  function Row(props: { game: GameReport }) {
    const verdict = () => verdicts[props.game.verdict]
    const data = () => games()[props.game.id]

    return (
      <tr>
        <td>
          <div class="flex items-center gap-3">
            <Show when={data()}>{(game) => <img src={gameImage(game())} alt="" class="h-8 w-12 rounded bg-base-300 object-cover" />}</Show>
            <div>
              <p class="font-medium">{name(props.game.id)}</p>
              <Show when={verdict()}>{(current) => <p class={clsx('text-xs', current().tone)}>{current().detail}</p>}</Show>
            </div>
          </div>
        </td>
        <td class="text-right tabular-nums">
          {props.game.flags.toLocaleString()}
          <Show when={props.game.keyboard > 0}>
            <span class="block text-xs text-base-content/40">{props.game.keyboard} keyboard</span>
          </Show>
        </td>
        <td class="text-right tabular-nums">{props.game.works.toLocaleString()}</td>
        <td class="text-right tabular-nums">
          {formatPlaytime(props.game.typical)}
          <Show when={props.game.visits > 0}>
            <span class="block text-xs text-base-content/40">
              {props.game.visits.toLocaleString()} {props.game.visits === 1 ? 'visit' : 'visits'}
            </span>
          </Show>
        </td>
        <td class="text-right text-xs text-base-content/40">{props.game.lastReport ? formatWhen(props.game.lastReport) : '—'}</td>
        <td>
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
            <button type="button" class={clsx('btn btn-xs', props.game.you && props.game.you !== 'works' ? 'btn-error' : 'btn-ghost')} onClick={() => say(props.game.id, props.game.you && props.game.you !== 'works' ? 'none' : 'broken')}>
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
        <p class="max-w-xl text-sm text-base-content/60">Games are hosted somewhere else and break without telling anybody. Anyone can flag one from the flag in the corner while playing it, and anyone can disagree. This is what everybody has said.</p>
      </div>

      <Show when={!loading()} fallback={<span class="loading loading-dots loading-lg" />}>
        <Show when={data()} fallback={<p class="text-sm text-error">The server isn't answering</p>}>
          {(current) => (
            <>
              <Section title="Where things stand">
                <div class="grid w-full grid-cols-2 gap-3 sm:grid-cols-4">
                  <Tile label="Not working" value={current().counts.broken.toLocaleString()} note="Agreed by more than one person" tone={current().counts.broken > 0 ? 'text-error' : undefined} />
                  <Tile label="Keyboard" value={current().counts.keyboard.toLocaleString()} note="Loads, but the keys do nothing" tone={current().counts.keyboard > 0 ? 'text-warning' : undefined} />
                  <Tile label="Unconfirmed" value={(current().counts.reported + current().counts.suspect).toLocaleString()} note="Reported once, or everybody leaves" />
                  <Tile label="Working" value={current().counts.working.toLocaleString()} note="People are playing them" tone="text-success" />
                </div>
              </Section>

              <Section title="Flagged">
                <Show when={problems().length > 0} fallback={<p class="rounded-box bg-base-200 p-6 text-center text-sm text-base-content/40">Nothing is flagged right now</p>}>
                  <Table games={problems()} />
                </Show>
              </Section>

              <Show when={disputed().length > 0}>
                <Section title="Reported, but working for others">
                  <p class="-mt-1 text-xs text-base-content/40">Somebody flagged these and enough people have played them since that the report is outweighed. If one of them is broken for you too, say so and it moves up.</p>
                  <Table games={disputed()} />
                </Section>
              </Show>

              <Section title="Everything else">
                <label class="flex cursor-pointer items-center gap-2 text-sm text-base-content/60">
                  <input type="checkbox" class="checkbox checkbox-sm" checked={everything()} onChange={(event) => setEverything(event.currentTarget.checked)} />
                  Show the {rest().length.toLocaleString()} {rest().length === 1 ? 'game' : 'games'} nobody has reported
                </label>
                <Show when={everything() && rest().length > 0}>
                  <Table games={rest()} />
                </Show>
              </Section>

              <Section title="How a game gets flagged">
                <div class="flex w-full flex-col gap-2 rounded-box bg-base-200 px-5 py-4 text-sm text-base-content/60">
                  <p>
                    <span class="font-semibold text-base-content">One report is a report, not a verdict.</span> It takes {current().rules.confirmFlags} people agreeing before a game is called not working, and a report is answered when {current().rules.disputeRatio} times as many people say it works. Saying so
                    yourself is the fastest way to clear a game somebody flagged by mistake.
                  </p>
                  <p>
                    <span class="font-semibold text-base-content">Staying counts as saying it works.</span> Nobody has to press anything: a visit that runs past {Math.round(current().rules.provenSeconds / 60)} minutes is a game that demonstrably ran, and up to {current().rules.provenWeight} of those stand in
                    for people agreeing. They are capped there on purpose - a game that broke this morning still has every long visit it ever held.
                  </p>
                  <p>
                    <span class="font-semibold text-base-content">Walking straight back out counts too.</span> A game that {current().rules.autoSessions} or more people have opened and nearly all of them left inside {current().rules.bounceSeconds} seconds is flagged without anybody reporting it, until
                    somebody says otherwise. That is the case reports alone always miss: people who cannot play something usually just leave rather than say so.
                  </p>
                  <p>Reports are forgotten after {current().rules.voteDays} days, so a game that was fixed quietly does not stay flagged forever.</p>
                </div>
              </Section>
            </>
          )}
        </Show>
      </Show>

      <p class="max-w-xl text-center text-xs text-base-content/40">
        Reports are signed with the random id your browser keeps for itself, which is what makes it one report per person per game. Nothing else about you is stored. The rest of the numbers are on the{' '}
        <A href="/status" class="link">
          status page
        </A>
        .
      </p>
    </div>
  )
}
