import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from '@/context/AuthProvider'
import { SocketProvider } from '@/context/SocketProvider'
import { ThemeProvider } from '@/context/ThemeProvider'
import { ThemeSync } from '@/context/ThemeSync'
import { ToastProvider } from '@/context/ToastProvider'
import { router } from '@/routes/router'
import '@/styles/index.css'

const container = document.getElementById('root')
if (!container) throw new Error('#root not found')

// AuthProvider above the router so guards can see 'checking' before redirecting
createRoot(container).render(
  <StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <SocketProvider>
            <ThemeSync />
            <RouterProvider router={router} />
          </SocketProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </StrictMode>
)
