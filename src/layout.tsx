import { useLocation } from '@solidjs/router'
import { type ParentProps, createEffect, onCleanup, onMount } from 'solid-js'
import { Toaster } from 'solid-toast'
import Navbar from './components/navbar'

import store from 'store2'
import { handleAboutBlank } from './lib/aboutblank'
import { setBookmarks } from './lib/bookmarks'
import { handleTabCloak } from './lib/cloak'
import { handlePanicKey } from './lib/panic'
import { setupProxy } from './lib/proxy'
import { loadSiteWideAds } from './lib/sitewide'
import { pingStatus, startStatusPings } from './lib/status'
import { handleTheme } from './lib/theme'
import type { Bookmark } from './lib/types'

export default function Layout(props: ParentProps) {
  // Everybody who has Mocha open is a user of it, so the ping that makes the
  // active count real belongs here rather than on the status page, which almost
  // nobody opens.
  let stopStatusPings: (() => void) | undefined

  const location = useLocation()

  // The ping carries which kind of page this is, and the answer changes the
  // moment somebody navigates: opening the status page has to take them out of
  // the active count now, not up to a ping later. This runs on the first render
  // too, so it is also the ping that says hello.
  createEffect(() => {
    void pingStatus(location.pathname)

    // Here rather than in onMount so the route is re-read on every navigation.
    // A gate on the home page would otherwise decide the question once, on the
    // page somebody happened to land on, and never look again.
    loadSiteWideAds(location.pathname)
  })

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
