import { useEffect, useRef } from 'react'
import { THEME_STORAGE_KEY } from '@r4u/shared'
import { useAuth } from './AuthContext'
import { useTheme } from './ThemeContext'

// the account theme seeds only a device with no local preference (FR 2.3)
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
