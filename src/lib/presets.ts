export interface CloakPreset {
  id: string
  // Label on the button in settings.
  label: string
  // What the browser tab is titled once the preset is applied. These match what
  // the real site puts in its tab, which is the point of a cloak.
  title: string
  // Favicon URL. Served by the site itself so it keeps working, rather than a
  // Google image search thumbnail, which expires.
  icon: string
}

export const cloakPresets: CloakPreset[] = [
  {
    id: 'classroom',
    label: 'Google Classroom',
    title: 'Home - Classroom',
    icon: 'https://ssl.gstatic.com/classroom/favicon.png'
  },
  {
    id: 'docs',
    label: 'Google Docs',
    title: 'Google Docs',
    icon: 'https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico'
  },
  {
    id: 'slides',
    label: 'Google Slides',
    title: 'Google Slides',
    icon: 'https://ssl.gstatic.com/docs/presentations/images/favicon5.ico'
  },
  {
    id: 'sheets',
    label: 'Google Sheets',
    title: 'Google Sheets',
    icon: 'https://ssl.gstatic.com/docs/spreadsheets/favicon3.ico'
  },
  {
    id: 'drive',
    label: 'Google Drive',
    title: 'My Drive - Google Drive',
    icon: 'https://ssl.gstatic.com/images/branding/product/1x/drive_2020q4_32dp.png'
  },
  {
    id: 'gmail',
    label: 'Gmail',
    title: 'Inbox - Gmail',
    icon: 'https://ssl.gstatic.com/ui/v1/icons/mail/rfr/gmail.ico'
  },
  {
    id: 'clever',
    label: 'Clever',
    title: 'Clever | Portal',
    icon: 'https://clever.com/favicon.ico'
  },
  {
    id: 'khan',
    label: 'Khan Academy',
    title: 'Khan Academy | Free Online Courses, Lessons & Practice',
    icon: 'https://cdn.kastatic.org/images/favicon.ico'
  },
  {
    id: 'quizlet',
    label: 'Quizlet',
    title: 'Quizlet',
    icon: 'https://quizlet.com/favicon.ico'
  },
  {
    id: 'ixl',
    label: 'IXL',
    title: 'IXL | Math, Language Arts, Science, Social Studies, and Spanish',
    icon: 'https://www.ixl.com/favicon.ico'
  },
  {
    id: 'desmos',
    label: 'Desmos',
    title: 'Desmos | Graphing Calculator',
    icon: 'https://www.desmos.com/favicon.ico'
  },
  {
    id: 'wikipedia',
    label: 'Wikipedia',
    title: 'Wikipedia, the free encyclopedia',
    icon: 'https://en.wikipedia.org/static/favicon/wikipedia.ico'
  }
]
