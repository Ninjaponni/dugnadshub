'use client'

import { motion } from 'framer-motion'
import { Smartphone, Share, MoreVertical, Plus } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useInstallPrompt } from '@/lib/hooks/useInstallPrompt'

// Steg 3: PWA installasjon med plattformspesifikke instruksjoner
export default function InstallStep() {
  const { platform, isStandalone, canInstall, promptInstall } = useInstallPrompt()

  if (isStandalone) {
    return (
      <div className="flex flex-col items-center justify-center h-full px-8 text-center">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="w-20 h-20 rounded-full bg-success/10 flex items-center justify-center mb-6"
        >
          <Smartphone size={36} className="text-success" />
        </motion.div>
        <h2 className="text-2xl font-bold mb-2">Allerede installert!</h2>
        <p className="text-text-secondary">Appen er lagt til på hjemskjermen din.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-8 text-center">
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
        className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-6"
      >
        <Smartphone size={32} className="text-accent" />
      </motion.div>

      <h2 className="text-2xl font-bold mb-2">Legg til appen</h2>
      <p className="text-text-secondary text-[15px] mb-8 max-w-[280px]">
        Få rask tilgang fra hjemskjermen — som en vanlig app.
      </p>

      {platform === 'ios' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-[300px] space-y-4"
        >
          <InstructionRow step={1} icon={<Share size={20} className="text-accent" />}>
            Trykk <span className="font-semibold">Del-knappen</span> i Safari
          </InstructionRow>
          <InstructionRow step={2} icon={<Plus size={20} className="text-accent" />}>
            Velg <span className="font-semibold">Legg til på Hjem-skjerm</span>
          </InstructionRow>
          <InstructionRow step={3} icon={<Smartphone size={20} className="text-accent" />}>
            Trykk <span className="font-semibold">Legg til</span>
          </InstructionRow>
        </motion.div>
      )}

      {platform === 'android' && !canInstall && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-[300px] space-y-4"
        >
          <InstructionRow step={1} icon={<MoreVertical size={20} className="text-accent" />}>
            Trykk <span className="font-semibold">⋮</span> øverst i Chrome
          </InstructionRow>
          <InstructionRow step={2} icon={<Plus size={20} className="text-accent" />}>
            Velg <span className="font-semibold">Legg til på startskjermen</span>
          </InstructionRow>
        </motion.div>
      )}

      {canInstall && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Button size="lg" onClick={promptInstall}>
            Installer appen
          </Button>
        </motion.div>
      )}

      {platform === 'desktop' && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-text-tertiary text-sm"
        >
          Åpne på mobilen for beste opplevelse.
        </motion.p>
      )}
    </div>
  )
}

// Instruksjonsrad med steg-nummer
function InstructionRow({ step, icon, children }: { step: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 text-left">
      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center shrink-0 relative">
        {icon}
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent text-white text-[10px] font-bold flex items-center justify-center">
          {step}
        </span>
      </div>
      <p className="text-[15px] text-text-primary">{children}</p>
    </div>
  )
}
