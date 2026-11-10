import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'
import { Button } from './Button'
import { Icon } from './Icon'

export interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  footer?: React.ReactNode
  children?: React.ReactNode
  className?: string
  size?: 'md' | 'lg'
}

export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  className,
  size = 'md',
}: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  // Escape closes the dialog natively, so the parent's state has to follow
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const onCancel = (event: Event) => {
      event.preventDefault()
      onClose()
    }
    dialog.addEventListener('cancel', onCancel)
    return () => dialog.removeEventListener('cancel', onCancel)
  }, [onClose])

  return (
    <dialog
      ref={ref}
      aria-labelledby="modal-title"
      className={cn(
        'm-auto',
        size === 'lg' ? 'w-[min(56rem,calc(100vw-2rem))]' : 'w-[min(32rem,calc(100vw-2rem))]'
      )}
    >
      {/* floating layer: shadow and no border, never both */}
      <div className={cn('float rounded-sm bg-ink-00 p-6', className)}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <h2 id="modal-title" className="text-lg">
              {title}
            </h2>
            {description ? <p className="text-sm text-ink-09">{description}</p> : null}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </Button>
        </div>

        {children ? <div className="pt-5">{children}</div> : null}

        {footer ? <div className="flex justify-end gap-2 pt-6">{footer}</div> : null}
      </div>
    </dialog>
  )
}
