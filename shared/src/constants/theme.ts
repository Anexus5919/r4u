export const THEMES = ['light', 'dark', 'system'] as const
export type Theme = (typeof THEMES)[number]

export const RESOLVED_THEMES = ['light', 'dark'] as const
export type ResolvedTheme = (typeof RESOLVED_THEMES)[number]

export const THEME_STORAGE_KEY = 'r4u.theme'

export function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (THEMES as readonly string[]).includes(value)
}
