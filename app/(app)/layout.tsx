import BottomNav from '@/components/layout/BottomNav'
import DesktopShell from '@/components/layout/DesktopShell'

// Children rendres ÉN gang inni DesktopShell — mobil-wrapper-klassene gjelder
// under lg, desktop-chrome (sidebar/topbar) er hidden lg:*, BottomNav lg:hidden.
// (Tidligere dual-render monterte alle sider dobbelt: dobbel datahenting,
// Realtime-topics som stjal fra hverandre, og dobbel Mapbox-instans.)
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DesktopShell mobileMainClassName="max-w-[430px] mx-auto min-h-dvh pb-20">
        {children}
      </DesktopShell>
      <BottomNav />
    </>
  )
}
