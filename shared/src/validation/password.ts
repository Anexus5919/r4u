export const PASSWORD_MIN = 12

/*
  bcrypt silently truncates at 72 bytes. Without an explicit maximum, two different long
  passwords become the same password and nobody finds out.
*/
export const PASSWORD_MAX = 72

export interface PasswordChecks {
  length: boolean
  lower: boolean
  upper: boolean
  digit: boolean
}

/** The exact rules the server enforces, so the meter can never promise what login refuses. */
export function checkPassword(value: string): PasswordChecks {
  return {
    length: value.length >= PASSWORD_MIN && value.length <= PASSWORD_MAX,
    lower: /[a-z]/.test(value),
    upper: /[A-Z]/.test(value),
    digit: /[0-9]/.test(value),
  }
}

export function passwordsMet(value: string): number {
  return Object.values(checkPassword(value)).filter(Boolean).length
}

export const PASSWORD_REQUIREMENTS: { key: keyof PasswordChecks; label: string }[] = [
  { key: 'length', label: `${PASSWORD_MIN} characters or more` },
  { key: 'lower', label: 'A lowercase letter' },
  { key: 'upper', label: 'An uppercase letter' },
  { key: 'digit', label: 'A number' },
]
