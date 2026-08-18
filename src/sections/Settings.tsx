import { useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Download, Plus, Trash2, Upload } from 'lucide-react'
import type { AppState, Store, TaxRegime } from '@/types'
import { REGIME_LABELS } from '@/lib/tax'
import { toast } from 'sonner'

interface Props {
  state: AppState
  setState: (updater: (prev: AppState) => AppState) => void
  resetToDemo: () => void
  clearAll: () => void
}

export default function SettingsSection({ state, setState, resetToDemo, clearAll }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)

  const updateStore = (id: string, patch: Partial<Store>) =>
    setState((p) => ({
      ...p,
      stores: p.stores.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }))

  const addStore = () =>
    setState((p) => ({
      ...p,
      stores: [
        ...p.stores,
        {
          id: Math.random().toString(36).slice(2, 10),
          name: 'Новый магазин',
          regime: 'usn6',
          insurancePremiums: 0,
          hasEmployees: false,
        },
      ],
    }))

  const removeStore = (id: string) => {
    if (!confirm('Удалить магазин вместе со всеми его операциями?')) return
    setState((p) => ({
      ...p,
      stores: p.stores.filter((s) => s.id !== id),
      operations: p.operations.filter((o) => o.storeId !== id),
      credentials: p.credentials.filter((c) => c.storeId !== id),
    }))
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `robot-buhgalter-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
  }

  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as AppState
      if (!Array.isArray(data.stores) || !Array.isArray(data.operations)) throw new Error()
      setState(() => ({ stores: data.stores, operations: data.operations, credentials: data.credentials ?? [] }))
      toast.success('Данные восстановлены из резервной копии')
    } catch {
      toast.error('Файл не похож на резервную копию Робота-бухгалтера')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Настройки</h1>
        <Button variant="outline" className="bg-white" onClick={addStore}>
          <Plus className="mr-2 h-4 w-4" /> Добавить магазин
        </Button>
      </div>

      {state.stores.map((store) => (
        <Card key={store.id} className="bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Магазин</CardTitle>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={() => removeStore(store.id)}>
                <Trash2 className="mr-1 h-4 w-4" /> Удалить
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Название</Label>
              <Input value={store.name} onChange={(e) => updateStore(store.id, { name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Налоговый режим</Label>
              <Select
                value={store.regime}
                onValueChange={(v) => updateStore(store.id, { regime: v as TaxRegime })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(REGIME_LABELS).map(([id, label]) => (
                    <SelectItem key={id} value={id}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {(store.regime === 'usn6' || store.regime === 'psn') && (
              <div className="space-y-1.5">
                <Label className="text-xs">Страховые взносы за год, ₽</Label>
                <Input
                  inputMode="numeric"
                  value={store.insurancePremiums || ''}
                  onChange={(e) =>
                    updateStore(store.id, { insurancePremiums: Math.abs(parseFloat(e.target.value) || 0) })
                  }
                  placeholder="53658"
                />
              </div>
            )}
            {store.regime === 'psn' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Стоимость патента за год, ₽</Label>
                <Input
                  inputMode="numeric"
                  value={store.patentCost || ''}
                  onChange={(e) =>
                    updateStore(store.id, { patentCost: Math.abs(parseFloat(e.target.value) || 0) })
                  }
                />
              </div>
            )}
            {store.regime === 'npd' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Ставка НПД</Label>
                <Select
                  value={String(store.npdRate ?? 6)}
                  onValueChange={(v) => updateStore(store.id, { npdRate: Number(v) })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4% (физлица)</SelectItem>
                    <SelectItem value="6">6% (через маркетплейс)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {(store.regime === 'usn6' || store.regime === 'psn') && (
              <div className="flex items-center gap-3 pt-5">
                <Switch
                  checked={store.hasEmployees}
                  onCheckedChange={(v) => updateStore(store.id, { hasEmployees: v })}
                />
                <Label className="text-xs">Есть сотрудники (вычет до 50%)</Label>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Card className="bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Данные</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={exportJson}>
            <Download className="mr-2 h-4 w-4" /> Скачать резервную копию
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" /> Восстановить из копии
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
          />
          <Button variant="outline" onClick={resetToDemo}>Загрузить демо-данные</Button>
          <Button
            variant="destructive"
            onClick={() => confirm('Удалить ВСЕ данные безвозвратно?') && clearAll()}
          >
            Очистить всё
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
