import { createContext, useContext } from 'react'

export type ToastTone = 'success' | 'warning' | 'danger' | 'info'

export interface Toast {
  id: string
  tone: ToastTone
  message: string
}

export interface ToastContextValue {
  toast: (tone: ToastTone, message: string) => void
  dismiss: (id: string) => void
}

export const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const value = useContext(ToastContext)
  if (!value) throw new Error('useToast must be used inside ToastProvider')
  return value
}
