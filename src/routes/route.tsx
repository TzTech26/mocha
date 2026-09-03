import { A, useParams, useSearchParams } from '@solidjs/router'
import clsx from 'clsx'
import { Bookmark, ChevronLeft, ChevronRight, CircleAlert, FileCode, Flag, Home, PanelBottomClose, PanelBottomOpen, RotateCw, SquareArrowOutUpRight, TriangleAlert } from 'lucide-solid'
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import toast from 'solid-toast'
import store from 'store2'
import { openAbWindow } from '../lib/aboutblank'
import { bookmarks, handleBookmark } from '../lib/bookmarks'
import { gameIdFromTarget } from '../lib/games'
import { focusFrame, watchKeyboard } from '../lib/keyboard'
import { handlePanicKey } from '../lib/panic'
import { patches } from '../lib/patch'
import { fetchGameReport, reportKinds, sendReport, verdicts } from '../lib/reports'
import { handleTransport } from '../lib/transport'
import type { ContentWindow, DevtoolsData, GameReport, ReportKind, TransportData } from '../lib/types'
import { encodeXor, formatSearch, getFavicon } from '../lib/utils'

export const [proxyReady, setProxyStatus] = createSignal(false)

export default function Route() {
  let ref: HTMLIFrameElement
  let reportDialog: HTMLDialogElement
  const [url, setUrl] = createSignal('')
  const [showControls, setShowControls] = createSignal(true)
  const [bookmarked, setBookmarked] = createSignal(false)
  const [report, setReport] = createSignal<GameReport | null>(null)

  const params = useParams()
  const [searchParams] = useSearchParams()

  // Which game this is, if it is one. Games are the only thing here worth
  // offering to report: everything else in the viewer is somebody's own address
  // and nobody else will ever open it.
  const game = createMemo(() => {
    try {
      return gameIdFromTarget(atob(params.route))
    } catch {
      return null
    }
  })

  onMount(() => {
    if (searchParams.hidecontrolbar === 'true') {
      setShowControls(false)
    }

    // Games only hear the keyboard while the frame holds focus, and arriving
    // here gives it to the page instead. See src/lib/keyboard.ts.
    onCleanup(watchKeyboard(() => ref))
  })

  async function openReport() {
    const id = game()

    if (!id) return

    reportDialog.showModal()
    setReport(await fetchGameReport(id))
  }

  async function say(kind: ReportKind | 'none') {
    const id = game()

    if (!id) return

    const next = await sendReport(id, kind)

    if (next) setReport(next)

    reportDialog.close()

    if (kind === 'keyboard') {
      // The report is worth having, and so is trying the fix while they are
      // still sitting in front of the game.
      focusFrame(ref)
      toast.success('Reported. The game has been handed the keyboard back - try the keys again.')
    } else if (kind === 'none') {
      toast.success('Your report has been taken back.')
    } else if (kind === 'works') {
      toast.success('Noted - that counts against anything reported here.')
    } else {
      toast.success("Reported. It's on the reports page now.")
    }
  }

  createEffect(() => {
    // Read what this depends on before the guard. An effect that returns
    // without reading anything has nothing to re-run on, so an iframe that was
    // not ready on the first pass - or a proxy that was not ready yet, which is
    // the normal case now that setup waits for the service worker to take
    // control - would leave the viewer blank for good.
    const ready = proxyReady()
    const query = atob(params.route)

    if (!ready || !ref || !ref.contentWindow) return

    ref.src = `/~/${encodeXor(formatSearch(query))}`
  })

  function handleLoad() {
    if (!ref || !ref.contentWindow) return
    const contentWindow = ref.contentWindow as ContentWindow

    if (!('__uv$location' in contentWindow)) return

    setUrl(contentWindow.__uv$location.href)

    contentWindow.addEventListener('keydown', handlePanicKey)

    // Hand the keyboard to what just loaded. Without this a game waits for a
    // click that lands on something focusable, which some of them never have.
    focusFrame(ref)

    if (bookmarks().some((val) => val.url === contentWindow.__uv$location.href)) {
      setBookmarked(true)
    } else {
      setBookmarked(false)
    }

    const hostname = contentWindow.__uv$location.hostname

    const patch = patches.find((x) => hostname.includes(x.hostname))
    if (!patch) return

    if (patch.suggestedTransport && patch.suggestedTransport !== (store('transport') as TransportData).transport) {
      toast.custom((x) => {
        return (
          <div class="toast toast-center toast-top">
            <div class="alert alert-warning">
              <TriangleAlert />
              <span>
                This website might run better with the <span class="font-semibold">{patch.suggestedTransport}</span> transport enabled. <br />{' '}
                <span
                  class="cursor-pointer underline underline-offset-4"
                  onMouseDown={() => {
                    handleTransport(patch.suggestedTransport)
                    toast.dismiss(x.id)
                    contentWindow.location.reload()
                  }}
                >
                  Set Transport
                </span>
              </span>
            </div>
          </div>
        )
      })
    }

    // Skip the offer once the suggested address is the one already open, since
    // the patch matches that hostname too.
    if (patch.suggestedUrl && new URL(patch.suggestedUrl.url).hostname !== hostname) {
      const suggestedUrl = patch.suggestedUrl

      toast.custom((x) => {
        return (
          <div class="toast toast-center toast-top">
            <div class="alert alert-warning">
              <TriangleAlert />
              <span>
                {suggestedUrl.reason} <br />{' '}
                <span
                  class="cursor-pointer underline underline-offset-4"
                  onMouseDown={() => {
                    if (!ref) return
                    ref.src = `/~/${encodeXor(suggestedUrl.url)}`
                    toast.dismiss(x.id)
                  }}
                >
                  Switch to the mobile site
                </span>
              </span>
            </div>
          </div>
        )
      })
    }

    if (patch.works === false) {
      toast.custom(() => {
        return (
          <div class="toast toast-center toast-top">
            <div class="alert alert-error">
              <CircleAlert />
              <span>This website is known not to work correctly.</span>
            </div>
          </div>
        )
      })
    }

    if (patch.execute) {
      patch.execute(contentWindow)
    }
  }
  return (
    <div>
      <iframe
        class="h-screen w-screen fixed"
        ref={
          // biome-ignore lint: needs to be here for Solid refs
          ref!
        }
        onLoad={handleLoad}
        title="Viewer"
      />

      <div data-viewer-controls class={clsx('rounded-m join fixed left-1/2 z-40 -translate-x-1/2 bg-base-200 px-2 transition-[bottom] duration-300', showControls() ? 'bottom-2' : '-bottom-16')}>
        <div class="tooltip" data-tip="Go back">
          <button
            class="btn btn-square join-item bg-base-200"
            type="button"
            onClick={() => {
              if (!ref || !ref.contentWindow) return
              const contentWindow = ref.contentWindow as ContentWindow
              contentWindow.history.back()
            }}
          >
            <ChevronLeft class="h-5 w-5" />
          </button>
        </div>

        <div class="tooltip" data-tip="Reload">
          <button
            class="btn btn-square join-item bg-base-200"
            type="button"
            onClick={() => {
              if (!ref || !ref.contentWindow) return
              const contentWindow = ref.contentWindow as ContentWindow
              contentWindow.location.reload()
            }}
          >
            <RotateCw class="h-5 w-5" />
          </button>
        </div>
        <div class="tooltip" data-tip="Go forward">
          <button
            class="btn btn-square join-item bg-base-200"
            type="button"
            onClick={() => {
              if (!ref || !ref.contentWindow) return
              const contentWindow = ref.contentWindow as ContentWindow

              contentWindow.history.forward()
            }}
          >
            <ChevronRight class="h-5 w-5" />
          </button>
        </div>

        <input
          value={url()}
          type="text"
          class="input join-item w-96 bg-base-200 focus:outline-none "
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            if (!ref || !ref.contentWindow) return

            ref.src = `/~/${encodeXor(formatSearch(e.currentTarget.value))}`
            e.currentTarget.blur()
          }}
        />
        <div class="tooltip" data-tip="Return to home screen">
          <A class="btn btn-square join-item bg-base-200" href="/">
            <Home class="h-5 w-5" />
          </A>
        </div>

        {(store('devtools') as DevtoolsData).enabled ? (
          <div class="tooltip" data-tip="Toggle devtools">
            <button
              class="btn btn-square join-item bg-base-200"
              type="button"
              onClick={() => {
                if (!ref || !ref.contentWindow) return
                const contentWindow = ref.contentWindow as ContentWindow

                if (contentWindow.eruda?._isInit) {
                  contentWindow.eruda.destroy()
                } else {
                  const erudaScript = contentWindow.document.createElement('script')
                  erudaScript.src = 'https://cdn.jsdelivr.net/npm/eruda'
                  erudaScript.onload = () => {
                    if (!contentWindow) return
                    contentWindow.eruda.init()
                    contentWindow.eruda.show()
                  }
                  contentWindow.document.body.appendChild(erudaScript)
                }
              }}
            >
              <FileCode class="h-5 w-5" />
            </button>
          </div>
        ) : null}

        <div class="tooltip" data-tip={!bookmarked() ? 'Bookmark' : 'Remove bookmark'}>
          <button
            class="btn btn-square join-item bg-base-200"
            type="button"
            onClick={async () => {
              if (!ref || !ref.contentWindow) return
              const contentWindow = ref.contentWindow as ContentWindow
              if (!('__uv$location' in contentWindow)) return

              const { status } = handleBookmark({
                title: contentWindow.document.title,
                url: contentWindow.__uv$location.href,
                image: await getFavicon(contentWindow)
              })

              setBookmarked(status === 'added')
            }}
          >
            <Bookmark class={clsx('h-5 w-5', bookmarked() ? 'fill-base-content' : 'fill-none')} />
          </button>
        </div>
        <div class="tooltip" data-tip="Pop out tab">
          <button
            class="btn btn-square join-item bg-base-200"
            type="button"
            onClick={() => {
              if (!ref || !ref.contentWindow) return
              const contentWindow = ref.contentWindow as ContentWindow

              openAbWindow(contentWindow.location.href, false)
            }}
          >
            <SquareArrowOutUpRight class="h-5 w-5" />
          </button>
        </div>
        <div class="tooltip" data-tip="Minimize control bar">
          <button
            class="btn btn-square join-item bg-base-200"
            type="button"
            onClick={() => {
              setShowControls(false)
            }}
          >
            <PanelBottomClose class="h-5 w-5" />
          </button>
        </div>
      </div>

      <div data-viewer-controls class={clsx('fixed bottom-2 right-2 transition-opacity duration-300', showControls() ? 'opacity-0 pointer-events-none' : 'opacity-100')}>
        <div class="tooltip tooltip-left" data-tip="Maximize control bar">
          <button type="button" class="btn btn-square btn-ghost" onClick={() => setShowControls(true)}>
            <PanelBottomOpen />
          </button>
        </div>
      </div>

      {/* Only for games, and kept faint until it is pointed at: somebody
          playing one should not be looking at a button asking whether it
          works. It is still the only moment anybody knows the answer. */}
      <Show when={game()}>
        <div data-viewer-controls class="fixed bottom-2 left-2 z-40 opacity-30 transition-opacity duration-300 hover:opacity-100">
          <div class="tooltip tooltip-right" data-tip="Report a problem with this game">
            <button type="button" class="btn btn-square btn-ghost" onClick={openReport} aria-label="Report a problem with this game">
              <Flag class="h-5 w-5" />
            </button>
          </div>
        </div>

        <dialog
          class="modal"
          ref={
            // biome-ignore lint: needs to be here for Solid refs
            reportDialog!
          }
        >
          <div class="modal-box">
            <h3 class="text-lg font-bold">Is this game working?</h3>

            <Show when={report()} fallback={<p class="pt-1 text-sm text-base-content/50">Nobody has said anything about this one yet.</p>}>
              {(current) => (
                <p class="pt-1 text-sm text-base-content/50">
                  <Show when={verdicts[current().verdict]} fallback={<>Nothing has been reported about this one yet.</>}>
                    {(verdict) => (
                      <>
                        <span class={verdict().tone}>{verdict().label}</span> &middot; {current().flags} {current().flags === 1 ? 'report' : 'reports'}, {current().works} {current().works === 1 ? 'person says' : 'people say'} it works
                      </>
                    )}
                  </Show>
                </p>
              )}
            </Show>

            <div class="flex flex-col gap-2 py-4">
              <For each={reportKinds}>
                {(option) => (
                  <button type="button" class={clsx('rounded-btn px-4 py-3 text-left duration-150', report()?.you === option.kind ? 'bg-primary text-primary-content' : 'bg-base-200 hover:bg-base-300')} onClick={() => say(option.kind)}>
                    <p class="text-sm font-medium">{option.label}</p>
                    <p class={clsx('text-xs', report()?.you === option.kind ? 'text-primary-content/70' : 'text-base-content/50')}>{option.detail}</p>
                  </button>
                )}
              </For>
            </div>

            <p class="text-xs text-base-content/40">
              One report per person per game, and you can change your mind. Everything said about every game is on the{' '}
              <A href="/reports" class="link">
                reports page
              </A>
              .
            </p>

            <div class="modal-action">
              <Show when={report()?.you}>
                <button class="btn btn-ghost" type="button" onClick={() => say('none')}>
                  Take it back
                </button>
              </Show>
              <form method="dialog">
                <button class="btn w-28" type="submit">
                  Close
                </button>
              </form>
            </div>
          </div>
          <form method="dialog" class="modal-backdrop">
            <button type="submit">close</button>
          </form>
        </dialog>
      </Show>
    </div>
  )
}
