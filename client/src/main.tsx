import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthProvider'
import { ThemeProvider } from '@/context/ThemeProvider'
import { ToastProvider } from '@/context/ToastProvider'
import { router } from '@/routes/router'
import '@/styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

/*
  AuthProvider sits above the router because the route guards read the session, and it must be
  able to report 'checking' before any protected route decides whether to redirect.
*/
createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>
)
