// Why the keyboard does nothing in some games, and what is done about it.
//
// Everything the viewer shows lives in an iframe, and an iframe only hears the
// keyboard while it has focus. Arriving at a game gives focus to the page
// around it rather than to the frame, so until something moves it, every key
// goes to Mocha and none reach the game. Clicking usually moves it, which is
// why this is never all games: one that puts a canvas under the pointer takes
// focus on the first click, and one that starts on a splash screen the mouse
// never has to touch, or draws into a frame of its own inside the page, does
// not. The mouse works the whole time, which is what makes it look like the
// game rather than the frame around it.
//
// So two things happen here. The frame is given focus whenever the page is
// sure nobody is typing into Mocha itself, and any key that still lands on the
// page is copied into the frame - and into the frames inside it, since the
// proxy serves those from this origin too and a game embedded in one of them
// is exactly the case focus alone does not fix.
const keyEvents = ['keydown', 'keypress', 'keyup'] as const

// A page inside a page inside a page is a game with an ad frame beside it, not
// something worth walking; these are what stop a hostile or merely silly
// document from turning one keystroke into a thousand.
const maxDepth = 3
const maxFrames = 8

function typing(element: Element | null) {
  if (!element) return false

  const tag = element.tagName

  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (element as HTMLElement).isContentEditable
}

// Every same-origin window under this one, itself included. A cross-origin
// frame throws on the first look at its document and is skipped: nothing can be
// dispatched into it anyway.
function reachable(win: Window, depth = 0, found: Window[] = []) {
  found.push(win)

  if (depth >= maxDepth || found.length >= maxFrames) return found

  let children: HTMLCollectionOf<HTMLIFrameElement>

  try {
    children = win.document.getElementsByTagName('iframe')
  } catch {
    return found
  }

  for (const child of children) {
    const inner = child.contentWindow

    if (!inner) continue

    try {
      // The access that throws when the frame is somebody else's.
      void inner.document
    } catch {
      continue
    }

    reachable(inner, depth + 1, found)

    if (found.length >= maxFrames) break
  }

  return found
}

// Returns whether whatever is in there acted on the key, which is what says
// the page around it should not act on it as well.
function copy(event: KeyboardEvent, win: Window) {
  let target: Element | null = null

  try {
    const doc = win.document
    // Whatever the game focused if it focused anything, and the body
    // otherwise: dispatching there still reaches a listener on the document or
    // the window, which is where games put them.
    target = (doc.activeElement && doc.activeElement !== doc.body ? doc.activeElement : doc.body) ?? doc.documentElement
  } catch {
    return false
  }

  if (!target) return false

  const Constructor = (win as Window & typeof globalThis).KeyboardEvent ?? KeyboardEvent

  const clone = new Constructor(event.type, {
    key: event.key,
    code: event.code,
    location: event.location,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
    repeat: event.repeat,
    isComposing: event.isComposing,
    bubbles: true,
    cancelable: true,
    composed: true,
    view: win
  })

  // The games this matters most for are the old ones, and old ones read
  // keyCode. No constructor sets it, so it is put back by hand.
  for (const [name, value] of [
    ['keyCode', event.keyCode],
    ['which', event.which],
    ['charCode', event.charCode]
  ] as const) {
    try {
      Object.defineProperty(clone, name, { get: () => value })
    } catch {
      // A browser that will not let the legacy fields be set still gets the
      // modern ones, which is most of the benefit.
    }
  }

  try {
    target.dispatchEvent(clone)

    return clone.defaultPrevented
  } catch {
    // A frame that went away between the walk and the dispatch.
    return false
  }
}

// Hands the keyboard to whatever the viewer is showing. Safe to call at any
// time: it does nothing while somebody is typing into Mocha's own controls.
export function focusFrame(frame?: HTMLIFrameElement) {
  if (!frame || typing(document.activeElement)) return

  try {
    frame.contentWindow?.focus()
  } catch {
    // Focusing a frame that has not loaded anything yet.
  }

  frame.focus({ preventScroll: true })
}

// Everything above, wired to the page. Returns the way to take it back off.
export function watchKeyboard(frameOf: () => HTMLIFrameElement | undefined) {
  function onKey(event: KeyboardEvent) {
    // Our own copies are not trusted events, so a copy is never copied again.
    if (!event.isTrusted) return

    const frame = frameOf()

    if (!frame || typing(event.target as Element)) return

    const inner = frame.contentWindow

    if (!inner) return

    // The frame having focus is the working case, and then the page never sees
    // the key at all - so anything arriving here is a key the game missed.
    let used = false

    for (const win of reachable(inner)) used = copy(event, win) || used

    // A game that acted on the key is a game that did not want the browser to:
    // arrow keys and space are how it moves and how the page scrolls. Shortcuts
    // are left alone, since taking those is not ours to do.
    if (used && !event.ctrlKey && !event.metaKey && !event.altKey) event.preventDefault()
  }

  // Clicking Mocha's own controls has to keep working, so the frame is only
  // handed focus back for a click that was not one of them. The delay lets the
  // click finish first: taking focus away mid-click is how a button stops
  // registering.
  function onPointerDown(event: PointerEvent) {
    if ((event.target as Element | null)?.closest?.('[data-viewer-controls]')) return

    setTimeout(() => focusFrame(frameOf()), 0)
  }

  // Coming back to the tab lands on the page, not on the frame, which is the
  // other way a game quietly goes deaf.
  function onWindowFocus() {
    if (document.activeElement === document.body) focusFrame(frameOf())
  }

  for (const type of keyEvents) window.addEventListener(type, onKey, true)
  window.addEventListener('pointerdown', onPointerDown, true)
  window.addEventListener('focus', onWindowFocus)

  return () => {
    for (const type of keyEvents) window.removeEventListener(type, onKey, true)
    window.removeEventListener('pointerdown', onPointerDown, true)
    window.removeEventListener('focus', onWindowFocus)
  }
}
