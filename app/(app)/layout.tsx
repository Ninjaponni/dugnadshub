import BottomNav from '@/components/layout/BottomNav'
import DesktopShell from '@/components/layout/DesktopShell'

// Mobil-flyt under lg, desktop-shell over lg. Pages rendres i begge.
// DesktopShell har egen lg-gating, så ingen ekstra wrapper rundt den.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="lg:hidden max-w-[430px] mx-auto min-h-dvh pb-20">
        {children}
        <BottomNav />
      </div>
      <DesktopShell>{children}</DesktopShell>
    </>
  )
}
