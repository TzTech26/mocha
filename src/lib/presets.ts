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
    title: 'Home',
    icon: 'https://ssl.gstatic.com/classroom/favicon.png'
  }
]
