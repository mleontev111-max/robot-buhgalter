import { lazy, Suspense, useState } from 'react'
import {
  Building2,
  Calculator,
  Leaf,
  LayoutDashboard,
  Loader2,
  Plug,
  ReceiptText,
  Settings,
} from 'lucide-react'
import { useAppState } from '@/lib/storage'
import type { Section } from '@/types'
import { cn } from '@/lib/utils'

// Каждый раздел грузится своим чанком — пользователь почти всегда работает
// в одном разделе за раз, незачем тянуть код всех шести при первой загрузке
// (особенно Dashboard с recharts и Operations с диалогом импорта).
const Dashboard = lazy(() => import('@/sections/Dashboard'))
const Organizations = lazy(() => import('@/sections/Organizations'))
const Operations = lazy(() => import('@/sections/Operations'))
const TaxReport = lazy(() => import('@/sections/TaxReport'))
const Connections = lazy(() => import('@/sections/Connections'))
const SettingsSection = lazy(() => import('@/sections/Settings'))

const NAV = [
  { id: 'dashboard' as Section, label: 'Дашборд', icon: LayoutDashboard },
  { id: 'organizations' as Section, label: 'Мои организации', icon: Building2 },
  { id: 'operations' as Section, label: 'Операции', icon: ReceiptText },
  { id: 'taxes' as Section, label: 'Налоги', icon: Calculator },
  { id: 'connections' as Section, label: 'Подключения API', icon: Plug },
  { id: 'settings' as Section, label: 'Настройки', icon: Settings },
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
            <div className="text-sm font-bold">Робот-бухгалтер</div>
            <div className="text-xs text-stone-500">налоги маркетплейсов</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
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

        <div className="space-y-1 border-t px-5 py-4">
          {(app.state.organizations ?? []).map((organization) => (
            <div key={organization.id} className="flex items-center gap-2 text-xs text-stone-500">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {organization.name}
            </div>
          ))}
        </div>
      </aside>

      <main className="min-w-0 flex-1 p-6 lg:p-8">
        <Suspense
          fallback={
            <div className="flex h-40 items-center justify-center text-stone-400">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          }
        >
          {section === 'dashboard' && <Dashboard state={app.state} setState={app.setState} />}
          {section === 'organizations' && (
            <Organizations state={app.state} setState={app.setState} />
          )}
          {section === 'operations' && <Operations state={app.state} setState={app.setState} />}
          {section === 'taxes' && <TaxReport state={app.state} />}
          {section === 'connections' && <Connections state={app.state} setState={app.setState} />}
          {section === 'settings' && (
            <SettingsSection
              state={app.state}
              setState={app.setState}
              resetToDemo={app.resetToDemo}
              clearAll={app.clearAll}
            />
          )}
        </Suspense>
      </main>
    </div>
  )
}
