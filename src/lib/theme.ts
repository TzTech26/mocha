import store from 'store2'
import type { ThemeData } from './types'

// Themes defined by us rather than daisyUI. Kept separate so the Tailwind
// config knows which names it has to supply a palette for.
// https://daisyui.com/docs/themes
export const customThemes = ['noir', 'amoled']

// The first entry is the default: daisyUI falls back to it when nothing has set
// data-theme, and the settings dropdown labels index 0 as "Default".
export const themes = ['noir', ...customThemes.slice(1), 'forest', 'aqua', 'dim', 'night', 'bumblebee', 'lemonade', 'luxury', 'sunset']

export const defaultTheme = themes[0]

export function handleTheme() {
  const themeData = store('theme') as ThemeData

  document.documentElement.dataset.theme = themeData.theme || defaultTheme
}
