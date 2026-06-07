import Link from 'next/link'
import KorpsLogo from '@/components/ui/KorpsLogo'

// Klikkbar logo + 'Dugnadshub'-tekst som tar deg tilbake til /hjem fra hvor som helst.
// Brukes i header på alle sidene.
export default function BrandLink() {
  return (
    <Link href="/hjem" className="flex items-center gap-3 active:opacity-70 transition-opacity">
      <KorpsLogo size={32} />
      <span className="text-xl font-bold text-accent tracking-tight font-[var(--font-display)]">
        Dugnadshub
      </span>
    </Link>
  )
}
