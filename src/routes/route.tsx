import { A, useParams, useSearchParams } from '@solidjs/router'
import clsx from 'clsx'
import { Bookmark, ChevronLeft, ChevronRight, CircleAlert, FileCode, Flag, Home, PanelBottomClose, PanelBottomOpen, RotateCw, SquareArrowOutUpRight, TriangleAlert } from 'lucide-solid'
import { Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import toast from 'solid-toast'
import store from 'store2'
import { openAbWindow } from '../lib/aboutblank'
import { bookmarks, handleBookmark } from '../lib/bookmarks'
import { gameIdFromTarget } from '../lib/games'
import { focusFrame, watchKeyboard } from '../lib/keyboard'
import { handlePanicKey } from '../lib/panic'
import { patches } from '../lib/patch'
import { fetchGameReport, noteLimit, sendReport, verdicts } from '../lib/reports'
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
  const [note, setNote] = createSignal('')

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

    setNote('')
    reportDialog.showModal()
    setReport(await fetchGameReport(id))
  }

  // Whatever the dialog did, the game should be the one hearing the keyboard
  // again on the way out of it.
  function closeReport() {
    reportDialog.close()
    focusFrame(ref)
  }

  async function say(kind: ReportKind | 'none') {
    const id = game()

    if (!id) return

    const next = await sendReport(id, kind, note())

    if (next) setReport(next)

    closeReport()

    if (kind === 'none') {
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

        {/* Only for games. Everything else in here is somebody's own address,
            which nobody else will ever open and so nobody else can confirm. */}
        <Show when={game()}>
          <div class="tooltip" data-tip="This game isn't working">
            <button class="btn btn-square join-item bg-base-200" type="button" onClick={openReport} aria-label="Report this game">
              <Flag class="h-5 w-5" />
            </button>
          </div>
        </Show>

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

      <Show when={game()}>
        <dialog
          class="modal"
          ref={
            // biome-ignore lint: needs to be here for Solid refs
            reportDialog!
          }
          onClose={() => focusFrame(ref)}
        >
          <div class="modal-box">
            <h3 class="text-lg font-bold">Report this game</h3>

            <Show when={report()} fallback={<p class="pt-1 text-sm text-base-content/50">Say what it does. Everybody else sees it on the reports page.</p>}>
              {(current) => (
                <p class="pt-1 text-sm text-base-content/50">
                  <Show when={current().flags > 0} fallback={<>Say what it does. Everybody else sees it on the reports page.</>}>
                    <span class={verdicts[current().verdict]?.tone}>
                      {current().flags} {current().flags === 1 ? 'person has' : 'people have'} reported this
                    </span>
                    , {current().works} {current().works === 1 ? 'says' : 'say'} it works for them.
                  </Show>
                </p>
              )}
            </Show>

            <textarea class="textarea textarea-bordered mt-4 h-24 w-full" maxlength={noteLimit} placeholder="What happens when you open it?" value={note()} onInput={(event) => setNote(event.currentTarget.value)} />

            <div class="flex items-center justify-between pt-1">
              <p class="text-xs text-base-content/40">
                One report per person per game, and you can change your mind.{' '}
                <A href="/reports" class="link" onClick={closeReport}>
                  Every reported game
                </A>
              </p>
              <p class="text-xs text-base-content/30">
                {note().length}/{noteLimit}
              </p>
            </div>

            <div class="modal-action">
              <Show when={report()?.you}>
                <button class="btn btn-ghost" type="button" onClick={() => say('none')}>
                  Take it back
                </button>
              </Show>
              <button class={clsx('btn', report()?.you === 'works' ? 'btn-success' : 'btn-ghost')} type="button" onClick={() => say('works')}>
                It works for me
              </button>
              <button class="btn btn-error" type="button" onClick={() => say('broken')}>
                Report it
              </button>
              <button class="btn" type="button" onClick={closeReport}>
                Close
              </button>
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
