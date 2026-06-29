import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

export default function Modal({ open, onClose, title, children, footer, size = 'md' }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose()
    if (open) {
      document.addEventListener('keydown', h)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', h)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const maxW = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl' }[size] || 'max-w-md'

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fadeIn"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div
        className={`bg-surface border border-border rounded-2xl w-full ${maxW} shadow-lg animate-fadeUp flex flex-col`}
        style={{ maxHeight: '85vh' }}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <h3 className="font-display font-bold text-base text-text">{title}</h3>
          <button onClick={onClose} className="text-muted hover:text-text transition-colors p-1 rounded-lg hover:bg-surface2">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {children}
        </div>

        {footer && (
          <div className="flex gap-2 justify-end p-4 pt-0 flex-shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}