import { useState } from 'react'
import { Building2, Plus, Store } from 'lucide-react'
import type { AppState, LegalForm, TaxRegime } from '@/types'

type Props = { state: AppState; setState: (updater: (prev: AppState) => AppState) => void }
const uid = (p: string) => `${p}-${Math.random().toString(36).slice(2, 9)}`

export default function Organizations({ state, setState }: Props) {
  const orgs = state.organizations ?? []
  const regs = state.taxRegistrations ?? []
  const units = state.businessUnits ?? []
  const channels = state.salesChannels ?? []
  const [selectedId, setSelectedId] = useState(orgs[0]?.id ?? '')
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [taxId, setTaxId] = useState('')
  const [form, setForm] = useState<LegalForm>('ip')
  const [regime, setRegime] = useState<TaxRegime>('usn6')
  const [unitName, setUnitName] = useState('')
  const [address, setAddress] = useState('')
  const selected = orgs.find(o => o.id === selectedId) ?? orgs[0]

  function addOrganization() {
    if (!name.trim()) return
    const now = new Date().toISOString()
    const orgId = uid('org'), taxIdNew = uid('tax'), unitId = uid('unit'), channelId = uid('ch')
    const ownerUserId = state.users?.[0]?.id ?? 'local-owner'
    const org = { id: orgId, ownerUserId, legalForm: form, name: name.trim(), taxId: taxId.trim() || undefined, status: 'active' as const, createdAt: now }
    const reg = { id: taxIdNew, organizationId: orgId, regime, validFrom: '2026-01-01', usnIncomeRate: regime === 'usn6' ? 6 : undefined, usnProfitRate: regime === 'usn15' ? 15 : undefined, vatMode: 'auto' as const, hasEmployees: false, employeesCount: 0 }
    const unit = { id: unitId, organizationId: orgId, name: unitName.trim() || 'Основная деятельность', type: 'other' as const, address: address.trim() || undefined, taxRegistrationIds: [taxIdNew], active: true }
    const channel = { id: channelId, organizationId: orgId, businessUnitId: unitId, type: 'manual' as const, name: 'Ручной ввод', sourceType: 'manual' as const, active: true }
    setState(prev => ({ ...prev, organizations: [...(prev.organizations ?? []), org], taxRegistrations: [...(prev.taxRegistrations ?? []), reg], businessUnits: [...(prev.businessUnits ?? []), unit], salesChannels: [...(prev.salesChannels ?? []), channel], accessGrants: prev.accessGrants ?? [] }))
    setSelectedId(orgId); setAdding(false); setName(''); setTaxId(''); setUnitName(''); setAddress('')
  }

  return <div className="mx-auto max-w-6xl space-y-6">
    <div className="flex items-start justify-between gap-4"><div><div className="text-sm font-medium text-emerald-700">Клиентский контур</div><h1 className="mt-1 text-2xl font-semibold">Мои организации</h1><p className="mt-1 text-sm text-stone-500">Один аккаунт → несколько ИП/ООО → несколько налоговых режимов и каналов продаж.</p></div><button onClick={() => setAdding(true)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"><Plus className="h-4 w-4"/>Добавить ИП / ООО</button></div>
    {adding && <div className="rounded-xl border border-emerald-200 bg-white p-5 shadow-sm"><h2 className="font-semibold">Новая организация</h2><p className="mt-1 text-xs text-stone-500">Точные параметры ПСН внесём после получения патента.</p><div className="mt-4 grid gap-4 md:grid-cols-2">
      <label className="text-sm">Название / ФИО<input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="ИП Иванов Иван Иванович"/></label>
      <label className="text-sm">ИНН<input value={taxId} onChange={e=>setTaxId(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="ИНН"/></label>
      <label className="text-sm">Форма<select value={form} onChange={e=>setForm(e.target.value as LegalForm)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="ip">ИП</option><option value="ooo">ООО</option></select></label>
      <label className="text-sm">Режим<select value={regime} onChange={e=>setRegime(e.target.value as TaxRegime)} className="mt-1 w-full rounded-lg border px-3 py-2"><option value="usn6">УСН 6%</option><option value="usn15">УСН 15%</option><option value="psn">ПСН</option><option value="osno">ОСНО</option></select></label>
      <label className="text-sm">Точка / направление<input value={unitName} onChange={e=>setUnitName(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Магазин, маркетплейсы, опт..."/></label>
      <label className="text-sm">Адрес<input value={address} onChange={e=>setAddress(e.target.value)} className="mt-1 w-full rounded-lg border px-3 py-2" placeholder="Адрес"/></label>
    </div><div className="mt-4 flex gap-2"><button onClick={addOrganization} disabled={!name.trim()} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Создать</button><button onClick={()=>setAdding(false)} className="rounded-lg border px-4 py-2 text-sm">Отмена</button></div></div>}
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <div className="rounded-xl border bg-white p-2">{orgs.length === 0 && <div className="p-5 text-sm text-stone-500">Организаций пока нет.</div>}{orgs.map(o=><button key={o.id} onClick={()=>setSelectedId(o.id)} className={`w-full rounded-lg p-3 text-left ${selected?.id===o.id?'bg-emerald-50':'hover:bg-stone-50'}`}><div className="flex items-center gap-3"><Building2 className="h-4 w-4"/><div><div className="text-sm font-semibold">{o.name}</div><div className="text-xs text-stone-500">{o.legalForm==='ip'?'ИП':'ООО'}{o.taxId?` · ИНН ${o.taxId}`:''}</div></div></div></button>)}</div>
      {selected ? <div className="space-y-5"><div className="rounded-xl border bg-white p-5"><h2 className="text-xl font-semibold">{selected.name}</h2><div className="mt-1 text-sm text-stone-500">{selected.legalForm==='ip'?'Индивидуальный предприниматель':'ООО'}{selected.taxId?` · ИНН ${selected.taxId}`:''}</div></div>
        <div className="grid gap-5 md:grid-cols-2"><div className="rounded-xl border bg-white p-5"><h3 className="font-semibold">Налоговые режимы</h3><div className="mt-4 space-y-3">{regs.filter(r=>r.organizationId===selected.id).map(r=><div key={r.id} className="rounded-lg bg-stone-50 p-3"><div className="font-medium">{r.regime==='usn6'?'УСН · доходы 6%':r.regime==='usn15'?'УСН · доходы минус расходы':r.regime==='psn'?'ПСН · патент':r.regime.toUpperCase()}</div><div className="mt-1 text-xs text-stone-500">С {r.validFrom} · работников: {r.employeesCount ?? 0}</div></div>)}</div></div>
        <div className="rounded-xl border bg-white p-5"><h3 className="font-semibold">Точки и каналы продаж</h3><div className="mt-4 space-y-3">{units.filter(u=>u.organizationId===selected.id).map(u=><div key={u.id} className="rounded-lg bg-stone-50 p-3"><div className="flex items-center gap-2 font-medium"><Store className="h-4 w-4"/>{u.name}</div>{u.address&&<div className="mt-1 text-xs text-stone-500">{u.address}</div>}<div className="mt-2 text-xs text-stone-500">Каналы: {channels.filter(c=>c.businessUnitId===u.id).map(c=>c.name).join(', ')||'не подключены'}</div></div>)}</div></div></div>
      </div> : <div className="rounded-xl border border-dashed bg-white p-10 text-center text-sm text-stone-500">Добавьте первую организацию.</div>}
    </div>
  </div>
}
