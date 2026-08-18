import { useState } from 'react'
import { Leaf, LayoutDashboard, ReceiptText, Calculator, Plug, Settings } from 'lucide-react'
import { useAppState } from '@/lib/storage'
import type { Section } from '@/types'
import Dashboard from '@/sections/Dashboard'
import Operations from '@/sections/Operations'
import TaxReport from '@/sections/TaxReport'
import Connections from '@/sections/Connections'
import SettingsSection from '@/sections/Settings'
import { cn } from '@/lib/utils'

const NAV: { id: Section; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', label: 'Дашборд', icon: LayoutDashboard },
  { id: 'operations', label: 'Операции', icon: ReceiptText },
  { id: 'taxes', label: 'Налоги', icon: Calculator },
  { id: 'connections', label: 'Подключения API', icon: Plug },
  { id: 'settings', label: 'Настройки', icon: Settings },
]

export default function Home() {
  const app = useAppState()
  const [section, setSection] = useState<Section>('dashboard')

  return (
    <div className="flex min-h-screen bg-stone-50 text-stone-900">
      <aside className="flex w-60 shrink-0 flex-col border-r border-stone-200 bg-white">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-700 text-white">
            <Leaf className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-bold leading-tight">Робот-бухгалтер</div>
            <div className="text-xs text-stone-500">налоги маркетплейсов</div>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                section === id
                  ? 'bg-emerald-50 text-emerald-800'
                  : 'text-stone-600 hover:bg-stone-100',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="space-y-1 border-t border-stone-200 px-5 py-4">
          {app.state.stores.map((s) => (
            <div key={s.id} className="flex items-center gap-2 text-xs text-stone-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {s.name}
            </div>
          ))}
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-6 lg:p-8">
        {section === 'dashboard' && <Dashboard state={app.state} />}
        {section === 'operations' && <Operations state={app.state} setState={app.setState} />}
        {section === 'taxes' && <TaxReport state={app.state} />}
        {section === 'connections' && <Connections state={app.state} setState={app.setState} />}
        {section === 'settings' && (
          <SettingsSection state={app.state} setState={app.setState} resetToDemo={app.resetToDemo} clearAll={app.clearAll} />
        )}
      </main>
    </div>
  )
}
