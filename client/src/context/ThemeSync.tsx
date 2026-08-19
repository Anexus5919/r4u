import { useEffect, useRef } from 'react'
import { THEME_STORAGE_KEY } from '@r4u/shared'
import { useAuth } from './AuthContext'
import { useTheme } from './ThemeContext'

/*
  Adopts the theme stored on the account, but only on a device that has not expressed a
  preference of its own.

  FR 2.3 asks for the preference to be retained. Retained across devices means the server value
  seeds a new browser; it does not mean the server overrules someone who just clicked "dark"
  here. localStorage being empty is what distinguishes the two cases.

  Rendered rather than folded into AuthProvider so auth does not have to know about theming.
*/
export function ThemeSync() {
  const { user } = useAuth()
  const { setTheme } = useTheme()
  const applied = useRef(false)

  useEffect(() => {
    if (!user || applied.current) return

    let local: string | null = null
    try {
      local = localStorage.getItem(THEME_STORAGE_KEY)
    } catch {
      // private mode. treat it as no preference
    }

    applied.current = true
    if (!local && user.theme !== 'system') setTheme(user.theme)
  }, [user, setTheme])

  return null
}
