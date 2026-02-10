import type { ReactNode } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative win-window w-full max-w-sm">
        {/* Title Bar */}
        <div className="win-titlebar">
          <span>{title}</span>
          <div className="flex gap-0.5">
            <button onClick={onClose} className="win-titlebar-btn">✕</button>
          </div>
        </div>
        {/* Content */}
        <div className="p-3 bg-win-bg">
          {children}
        </div>
      </div>
    </div>
  )
}
