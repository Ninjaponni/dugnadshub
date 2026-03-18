'use client'

import { motion } from 'framer-motion'
import { MapPin, Package, Truck } from 'lucide-react'

// Steg 4: Dugnadsflyten forklart med 3 minikort
const steps = [
  {
    icon: MapPin,
    title: 'Velg sone',
    description: 'Finn en ledig sone på kartet og ta den',
    color: 'text-accent',
    bg: 'bg-accent/10',
  },
  {
    icon: Package,
    title: 'Samle inn',
    description: 'Gå runden og samle flasker og boks',
    color: 'text-success',
    bg: 'bg-success/10',
  },
  {
    icon: Truck,
    title: 'Lever',
    description: 'Marker som ferdig, sjåfør henter',
    color: 'text-purple',
    bg: 'bg-purple/10',
  },
]

export default function HowItWorksStep() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-2xl font-bold mb-2"
      >
        Slik fungerer dugnaden
      </motion.h2>
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="text-text-secondary text-[15px] mb-8"
      >
        Velg sone, gå ut, lever
      </motion.p>

      <div className="w-full max-w-[300px] space-y-4">
        {steps.map((step, i) => {
          const Icon = step.icon
          return (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 + i * 0.15, type: 'spring', stiffness: 300, damping: 25 }}
              className="flex items-center gap-4 text-left card p-4"
            >
              <div className={`w-12 h-12 rounded-2xl ${step.bg} flex items-center justify-center shrink-0`}>
                <Icon size={24} className={step.color} />
              </div>
              <div>
                <p className="font-semibold text-[15px]">{step.title}</p>
                <p className="text-text-secondary text-[13px]">{step.description}</p>
              </div>
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
