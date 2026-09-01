import { type ParentProps, onCleanup, onMount } from 'solid-js'
import { Toaster } from 'solid-toast'
import Navbar from './components/navbar'

import { handleAboutBlank } from './lib/aboutblank'
import { handleTabCloak } from './lib/cloak'
import { handlePanicKey } from './lib/panic'
import { handleTheme } from './lib/theme'
import { setupProxy } from './lib/proxy'
import { startStatusPings } from './lib/status'
import { setBookmarks } from './lib/bookmarks'
import type { Bookmark } from './lib/types'
import store from 'store2'

export default function Layout(props: ParentProps) {
  // Everybody who has Mocha open is a user of it, so the ping that makes the
  // active count real belongs here rather than on the status page, which almost
  // nobody opens.
  let stopStatusPings: (() => void) | undefined

  onMount(async () => {
    stopStatusPings = startStatusPings()
    handleTabCloak()
    handleTheme()
    handleAboutBlank()
    setBookmarks(store('bookmarks') as Bookmark[])
    await setupProxy()
    document.addEventListener('keydown', handlePanicKey)
  })

  onCleanup(() => {
    stopStatusPings?.()
    document.removeEventListener('keydown', handlePanicKey)
  })
  return (
    <div>
      <Navbar />
      <Toaster position="top-center" />
      {props.children}
    </div>
  )
}
