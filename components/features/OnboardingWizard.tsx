'use client'

import { useState, useCallback } from 'react'
import { motion, AnimatePresence, type PanInfo } from 'framer-motion'
import WelcomeStep from './onboarding/WelcomeStep'
import ProfileStep from './onboarding/ProfileStep'
import InstallStep from './onboarding/InstallStep'
import HowItWorksStep from './onboarding/HowItWorksStep'
import BadgesStep from './onboarding/BadgesStep'
import ReadyStep from './onboarding/ReadyStep'

const TOTAL_STEPS = 6
const SWIPE_THRESHOLD = 50

interface OnboardingWizardProps {
  onComplete: () => void
}

// Fullskjerm onboarding-wizard med swipe og prikk-navigasjon
export default function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [profileSaved, setProfileSaved] = useState(false)

  const goNext = useCallback(() => {
    if (step < TOTAL_STEPS - 1) {
      setDirection(1)
      setStep(s => s + 1)
    }
  }, [step])

  const goPrev = useCallback(() => {
    if (step > 0) {
      setDirection(-1)
      setStep(s => s - 1)
    }
  }, [step])

  // Swipe-håndtering
  function handleDragEnd(_: unknown, info: PanInfo) {
    if (info.offset.x < -SWIPE_THRESHOLD && info.velocity.x < 0) {
      goNext()
    } else if (info.offset.x > SWIPE_THRESHOLD && info.velocity.x > 0) {
      goPrev()
    }
  }

  function handleSkip() {
    onComplete()
  }

  // Slide-animasjon
  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? '-100%' : '100%', opacity: 0 }),
  }

  // Rendre riktig steg
  function renderStep() {
    switch (step) {
      case 0: return <WelcomeStep />
      case 1: return <ProfileStep onProfileSaved={() => setProfileSaved(true)} />
      case 2: return <InstallStep />
      case 3: return <HowItWorksStep />
      case 4: return <BadgesStep />
      case 5: return <ReadyStep onStart={onComplete} />
      default: return null
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-bg safe-top safe-bottom flex flex-col">
      {/* Hopp over — vises ikke på siste steg */}
      {step < TOTAL_STEPS - 1 && (
        <div className="flex justify-end px-4 pt-4">
          <button
            onClick={handleSkip}
            className="text-text-tertiary text-[15px] py-1 px-3"
          >
            Hopp over
          </button>
        </div>
      )}

      {/* Steg-innhold med swipe */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            drag={step !== 1 ? 'x' : undefined}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={step !== 1 ? handleDragEnd : undefined}
            className="absolute inset-0"
          >
            {renderStep()}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Navigasjon: prikker + neste-knapp */}
      <div className="pb-8 px-6 safe-bottom">
        {/* Prikk-indikator */}
        <div className="flex justify-center gap-2 mb-5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <motion.div
              key={i}
              animate={{
                width: i === step ? 24 : 8,
                backgroundColor: i === step ? '#007AFF' : '#C7C7CC',
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="h-2 rounded-full"
            />
          ))}
        </div>

        {/* Neste-knapp (vises ikke på profil-steg med ulagret profil, eller siste steg) */}
        {step < TOTAL_STEPS - 1 && (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={goNext}
            className="w-full py-3.5 rounded-xl bg-accent text-white font-semibold text-[17px]"
          >
            {step === 1 && !profileSaved ? 'Hopp over' : 'Neste'}
          </motion.button>
        )}
      </div>
    </div>
  )
}
