'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ChevronUp } from 'lucide-react'
import { useState } from 'react'

const items: Array<{ color: string; label: string; border?: boolean }> = [
  { color: '#E57373', label: 'Ledig' },
  { color: '#FFD54F', label: 'Delvis tatt' },
  { color: '#6B8F71', label: 'Fullt bemannet' },
  { color: '#6B8F71', label: 'Ferdigplukket' },
  { color: '#9C7DB8', label: 'Hentet' },
]

// Kompakt kartlegende med toggle
export default function MapLegend() {
  const [open, setOpen] = useState(false)

  return (
    <div className="absolute bottom-4 left-4 z-10">
      <motion.div
        layout
        className="glass rounded-xl shadow-lg overflow-hidden"
      >
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium"
        >
          <span>Tegnforklaring</span>
          <motion.div animate={{ rotate: open ? 180 : 0 }}>
            <ChevronUp size={14} />
          </motion.div>
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="px-3 pb-2"
            >
              <div className="space-y-1.5">
                {items.map(({ color, label, border }) => (
                  <div key={label} className="flex items-center gap-2 text-xs">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{
                        backgroundColor: border ? 'transparent' : color,
                        opacity: border ? 1 : 0.6,
                        border: border ? `2px solid ${color}` : 'none',
                      }}
                    />
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
