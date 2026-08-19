import { clsx } from 'clsx'
import type { ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Merge class names, letting a caller's className win over a component default. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
