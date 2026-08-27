import { useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Download, Plus, Trash2, Upload } from 'lucide-react'
import type { AppState, LegalForm, Store, TaxRegime, VatMode } from '@/types'
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
    setState((prev) => ({
      ...prev,
      stores: prev.stores.map((store) => (store.id === id ? { ...store, ...patch } : store)),
    }))

  const addStore = () =>
    setState((prev) => ({
      ...prev,
      stores: [
        ...prev.stores,
        {
          id: Math.random().toString(36).slice(2, 10),
          name: 'Новый магазин',
          legalForm: 'ip',
          regime: 'usn6',
          insurancePremiums: 0,
          hasEmployees: false,
          usnIncomeRate: 6,
          usnProfitRate: 15,
          vatMode: 'auto',
        },
      ],
    }))

  const removeStore = (id: string) => {
    if (!confirm('Удалить магазин вместе со всеми его операциями?')) return
    setState((prev) => ({
      ...prev,
      stores: prev.stores.filter((store) => store.id !== id),
      operations: prev.operations.filter((operation) => operation.storeId !== id),
      credentials: prev.credentials.filter((credential) => credential.storeId !== id),
    }))
  }

  const downloadJson = (data: unknown, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
  }

  const safeBackup = (): AppState => ({
    ...state,
    // Секреты внешних API никогда не попадают в backup-файл.
    credentials: [],
  })

  const exportJson = () => {
    downloadJson(
      safeBackup(),
      `robot-buhgalter-backup-bez-api-klyuchey-${new Date().toISOString().slice(0, 10)}.json`,
    )
    toast.success('Резервная копия создана без API-ключей маркетплейсов')
  }

  const exportForReview = () => {
    const exportedAt = new Date().toISOString()
    const payload = {
      format: 'robot-buhgalter-accounting-review',
      version: 1,
      exportedAt,
      schemaVersion: state.schemaVersion ?? 3,
      organizations: state.organizations ?? [],
      taxRegistrations: state.taxRegistrations ?? [],
      businessUnits: state.businessUnits ?? [],
      salesChannels: state.salesChannels ?? [],
      stores: state.stores,
      operations: state.operations,
      taxPayments: state.taxPayments ?? [],
      summary: {
        organizations: state.organizations?.length ?? 0,
        stores: state.stores.length,
        operations: state.operations.length,
        firstOperationDate: state.operations.length
          ? [...state.operations].sort((a, b) => a.date.localeCompare(b.date))[0]?.date
          : null,
        lastOperationDate: state.operations.length
          ? [...state.operations].sort((a, b) => b.date.localeCompare(a.date))[0]?.date
          : null,
      },
    }
    downloadJson(payload, `robot-buhgalter-dlya-proverki-${exportedAt.slice(0, 10)}.json`)
    toast.success(
      `Экспортировано операций: ${state.operations.length}. API-ключи в файл не включены.`,
    )
  }

  const importJson = async (file: File) => {
    try {
      const data = JSON.parse(await file.text()) as AppState
      if (!Array.isArray(data.stores) || !Array.isArray(data.operations)) throw new Error()
      // Даже старые backup-файлы с credentials не восстанавливают секреты в приложение.
      setState(() => ({ ...data, credentials: [] }))
      toast.success('Данные восстановлены. API-подключения нужно настроить заново.')
    } catch {
      toast.error('Файл не похож на резервную копию Робота-бухгалтера')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Настройки</h1>
          <p className="mt-1 text-sm text-stone-500">Параметры налогового режима и магазина</p>
        </div>
        <Button variant="outline" className="bg-white" onClick={addStore}>
          <Plus className="mr-2 h-4 w-4" /> Добавить магазин
        </Button>
      </div>

      {state.stores.map((store) => (
        <Card key={store.id} className="bg-white">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">{store.name || 'Магазин'}</CardTitle>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-600"
                onClick={() => removeStore(store.id)}
              >
                <Trash2 className="mr-1 h-4 w-4" /> Удалить
              </Button>
            </div>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Название</Label>
              <Input
                value={store.name}
                onChange={(e) => updateStore(store.id, { name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Форма</Label>
              <Select
                value={store.legalForm ?? 'ip'}
                onValueChange={(value) => updateStore(store.id, { legalForm: value as LegalForm })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ip">ИП</SelectItem>
                  <SelectItem value="ooo">ООО</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Налоговый режим</Label>
              <Select
                value={store.regime}
                onValueChange={(value) => updateStore(store.id, { regime: value as TaxRegime })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REGIME_LABELS).map(([id, label]) => (
                    <SelectItem key={id} value={id}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {store.regime === 'usn6' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Ставка УСН «Доходы», %</Label>
                <Input
                  inputMode="decimal"
                  value={store.usnIncomeRate ?? 6}
                  onChange={(e) =>
                    updateStore(store.id, {
                      usnIncomeRate: Math.min(6, Math.max(1, Number(e.target.value) || 6)),
                    })
                  }
                />
              </div>
            )}
            {store.regime === 'usn15' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Ставка УСН «Доходы − расходы», %</Label>
                <Input
                  inputMode="decimal"
                  value={store.usnProfitRate ?? 15}
                  onChange={(e) =>
                    updateStore(store.id, {
                      usnProfitRate: Math.min(15, Math.max(5, Number(e.target.value) || 15)),
                    })
                  }
                />
              </div>
            )}
            {(store.regime === 'usn6' || store.regime === 'usn15') && (
              <div className="space-y-1.5">
                <Label className="text-xs">Доход за предыдущий год, ₽</Label>
                <Input
                  inputMode="numeric"
                  value={store.priorYearRevenue ?? ''}
                  onChange={(e) =>
                    updateStore(store.id, {
                      priorYearRevenue: Math.abs(parseFloat(e.target.value) || 0),
                    })
                  }
                  placeholder="Нужен для режима НДС в 2026"
                />
              </div>
            )}
            {(store.regime === 'usn6' || store.regime === 'usn15') && (
              <div className="space-y-1.5">
                <Label className="text-xs">НДС при УСН, 2026</Label>
                <Select
                  value={store.vatMode ?? 'auto'}
                  onValueChange={(value) => updateStore(store.id, { vatMode: value as VatMode })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Авто по доходу</SelectItem>
                    <SelectItem value="exempt">Освобождение</SelectItem>
                    <SelectItem value="vat5">НДС 5%</SelectItem>
                    <SelectItem value="vat7">НДС 7%</SelectItem>
                    <SelectItem value="vat22">НДС 22% + вычеты</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {(store.regime === 'usn6' || store.regime === 'usn15' || store.regime === 'psn') && (
              <div className="space-y-1.5">
                <Label className="text-xs">Страховые взносы за год, ₽</Label>
                <Input
                  inputMode="numeric"
                  value={store.insurancePremiums || ''}
                  onChange={(e) =>
                    updateStore(store.id, {
                      insurancePremiums: Math.abs(parseFloat(e.target.value) || 0),
                    })
                  }
                  placeholder="Пусто = авторасчёт для ИП без работников"
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
            {store.regime === 'psn' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Потенциально возможный доход по патенту, ₽</Label>
                <Input
                  inputMode="numeric"
                  value={store.patentPotentialIncome || ''}
                  onChange={(e) =>
                    updateStore(store.id, {
                      patentPotentialIncome: Math.abs(parseFloat(e.target.value) || 0),
                    })
                  }
                />
              </div>
            )}
            {store.regime === 'npd' && (
              <div className="space-y-1.5">
                <Label className="text-xs">Ставка НПД</Label>
                <Select
                  value={String(store.npdRate ?? 6)}
                  onValueChange={(value) => updateStore(store.id, { npdRate: Number(value) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="4">4% (физлица)</SelectItem>
                    <SelectItem value="6">6% (организации / ИП)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {(store.regime === 'usn6' || store.regime === 'usn15' || store.regime === 'psn') && (
              <div className="flex items-center gap-3 pt-5">
                <Switch
                  checked={store.hasEmployees}
                  onCheckedChange={(value) => updateStore(store.id, { hasEmployees: value })}
                />
                <Label className="text-xs">Есть сотрудники</Label>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      <Card className="bg-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Данные</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={exportForReview}>
              <Download className="mr-2 h-4 w-4" /> Экспорт данных для проверки
            </Button>
            <Button variant="outline" onClick={exportJson}>
              <Download className="mr-2 h-4 w-4" /> Скачать безопасную копию
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
            <Button variant="outline" onClick={resetToDemo}>
              Загрузить демо-данные
            </Button>
            <Button
              variant="destructive"
              onClick={() => confirm('Удалить ВСЕ данные безвозвратно?') && clearAll()}
            >
              Очистить всё
            </Button>
          </div>
          <p className="text-xs text-stone-500">
            Оба экспорта исключают API-ключи. После восстановления резервной копии подключения к
            маркетплейсам настраиваются заново.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
