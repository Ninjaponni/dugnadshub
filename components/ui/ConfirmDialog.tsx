'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string | React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'warning' | 'danger' | 'success'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// In-app confirm-modal — erstatter browser confirm() for et helhetlig design
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Bekreft',
  cancelLabel = 'Avbryt',
  variant = 'warning',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const colorClass =
    variant === 'danger' ? 'text-danger' :
    variant === 'success' ? 'text-success' :
    'text-warning'
  const bgClass =
    variant === 'danger' ? 'bg-danger/10' :
    variant === 'success' ? 'bg-success/10' :
    'bg-warning/10'
  const activeBg =
    variant === 'danger' ? 'active:bg-danger/20' :
    variant === 'success' ? 'active:bg-success/20' :
    'active:bg-warning/20'

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Mørk overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40 z-[60]"
            onClick={onCancel}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[70] flex items-center justify-center px-5 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
              className="bg-card rounded-3xl w-full max-w-[400px] overflow-hidden shadow-[0_24px_48px_rgba(61,53,48,0.20)] pointer-events-auto"
            >
              <div className="p-6">
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-10 h-10 rounded-2xl ${bgClass} flex items-center justify-center shrink-0`}>
                    <AlertTriangle size={20} className={colorClass} />
                  </div>
                  <h3 className="text-lg font-bold font-[var(--font-display)] text-text-primary">{title}</h3>
                </div>
                <div className="text-sm text-text-secondary leading-relaxed whitespace-pre-line">
                  {message}
                </div>
              </div>
              <div className="flex border-t border-text-tertiary/10">
                <button
                  onClick={onCancel}
                  disabled={loading}
                  className="flex-1 py-4 text-sm font-semibold text-text-secondary border-r border-text-tertiary/10 active:bg-surface-low disabled:opacity-50"
                >
                  {cancelLabel}
                </button>
                <button
                  onClick={onConfirm}
                  disabled={loading}
                  className={`flex-1 py-4 text-sm font-semibold ${colorClass} ${activeBg} disabled:opacity-50`}
                >
                  {loading ? 'Vent...' : confirmLabel}
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
