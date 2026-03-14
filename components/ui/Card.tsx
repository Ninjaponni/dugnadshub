'use client'

import { motion } from 'framer-motion'

interface CardProps {
  children: React.ReactNode
  className?: string
  animate?: boolean
}

// Apple-stil kort med subtil skygge
export default function Card({ children, className = '', animate = true }: CardProps) {
  if (!animate) {
    return (
      <div className={`card p-4 ${className}`}>
        {children}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={`card p-4 ${className}`}
    >
      {children}
    </motion.div>
  )
}
