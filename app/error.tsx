'use client'
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 bg-bg">
      <h2 className="text-xl font-bold mb-2 font-[var(--font-display)]">Noe gikk galt</h2>
      <p className="text-text-secondary mb-4 text-center">Beklager, det oppstod en feil. Prøv igjen.</p>
      <button onClick={reset} className="px-6 py-3 rounded-full text-white font-bold" style={{ background: 'linear-gradient(135deg, var(--color-accent), var(--color-primary-container))' }}>
        Prøv igjen
      </button>
    </div>
  )
}
