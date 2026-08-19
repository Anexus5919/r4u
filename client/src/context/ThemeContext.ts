import { createContext, useContext } from 'react'
import type { ResolvedTheme, Theme } from '@r4u/shared'

export interface ThemeContextValue {
  /** what the user chose, including 'system' */
  theme: Theme
  /** what is actually painted right now */
  resolved: ResolvedTheme
  setTheme: (theme: Theme) => void
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) throw new Error('useTheme must be used inside ThemeProvider')
  return value
}
