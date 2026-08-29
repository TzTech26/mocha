/** @type {import('tailwindcss').Config} */
import { customThemes, themes } from './src/lib/theme'

// daisyUI uses whichever theme comes first here when nothing has set data-theme,
// so noir has to stay at the front of the list.
const builtInThemes = themes.filter((theme) => !customThemes.includes(theme))

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {}
  },

  daisyui: {
    themes: [
      {
        // Monochrome dark theme. Error keeps a little red so destructive
        // buttons still read as destructive.
        noir: {
          'color-scheme': 'dark',
          primary: '#ffffff',
          'primary-content': '#0a0a0a',
          secondary: '#a3a3a3',
          'secondary-content': '#0a0a0a',
          accent: '#d4d4d4',
          'accent-content': '#0a0a0a',
          neutral: '#262626',
          'neutral-content': '#fafafa',
          'base-100': '#0a0a0a',
          'base-200': '#171717',
          'base-300': '#232323',
          'base-content': '#f5f5f5',
          info: '#d4d4d4',
          'info-content': '#0a0a0a',
          success: '#e5e5e5',
          'success-content': '#0a0a0a',
          warning: '#fafafa',
          'warning-content': '#0a0a0a',
          error: '#b91c1c',
          'error-content': '#fafafa'
        }
      },
      {
        amoled: {
          primary: '#fff',
          'primary-content': '#000',
          secondary: '#42f5aa',
          'secondary-content': '#111827',
          accent: '#9d3bff',
          'accent-content': '#eaddff',
          neutral: '#0a0a0a',
          'neutral-content': '#ffffff',
          'base-100': '#000',
          'base-200': '#0a0a0a',
          'base-300': '#060606',
          'base-content': '#fff',
          info: '#3b82f6',
          'info-content': '#010615',
          success: '#6ee7b7',
          'success-content': '#0a0715',
          warning: '#f43f5e',
          'warning-content': '#fff',
          error: '#f43f5e',
          'error-content': '#fff'
        }
      },
      ...builtInThemes
    ]
  },

  plugins: [require('daisyui')]
}
