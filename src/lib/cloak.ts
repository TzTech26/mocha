import store from 'store2'
import { restoreTitle } from './head'
import type { TabData } from './types'

export function handleTabCloak() {
  const tabData = store('tab') as TabData

  if (tabData.name) {
    document.title = tabData.name
  } else {
    // Not 'Mocha' any more: every page has a title of its own now, and that is
    // the one a tab should carry when nothing is hiding it.
    restoreTitle()
  }

  if (tabData.icon) {
    ;(document.querySelector('link[rel~=icon]') as HTMLLinkElement).href = tabData.icon
  }
}
