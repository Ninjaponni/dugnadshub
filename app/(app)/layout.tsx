import BottomNav from '@/components/layout/BottomNav'

// Layout for innloggede sider — bottom nav + innhold
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[430px] mx-auto min-h-dvh pb-20">
      {children}
      <BottomNav />
    </div>
  )
}
