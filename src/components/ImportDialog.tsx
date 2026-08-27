import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Upload } from 'lucide-react'
import type { AppState, MarketplaceId, Operation } from '@/types'
import { MARKETPLACES } from '@/lib/marketplaces'
import {
  buildOperations,
  parseReportFile,
  type ColumnMapping,
  type ParsedReport,
} from '@/lib/importer'
import { toast } from 'sonner'

interface Props {
  open: boolean
  onClose: () => void
  state: AppState
  onImport: (ops: Operation[]) => void
}

const MAP_FIELDS: { key: keyof ColumnMapping; label: string; required?: boolean }[] = [
  { key: 'date', label: 'Дата', required: true },
  { key: 'revenue', label: 'Выручка / начислено', required: true },
  { key: 'commission', label: 'Комиссия' },
  { key: 'logistics', label: 'Логистика' },
  { key: 'ads', label: 'Реклама' },
  { key: 'otherExpenses', label: 'Прочие расходы' },
  { key: 'note', label: 'Комментарий' },
]

export default function ImportDialog({ open, onClose, state, onImport }: Props) {
  const [storeId, setStoreId] = useState(state.stores[0]?.id ?? '')
  const [marketplace, setMarketplace] = useState<MarketplaceId>('ozon')
  const [parsed, setParsed] = useState<ParsedReport | null>(null)
  const [map, setMap] = useState<ColumnMapping | null>(null)
  const [fileName, setFileName] = useState('')

  const handleFile = async (file: File) => {
    try {
      const p = await parseReportFile(file)
      if (p.headers.length === 0) {
        toast.error('Не удалось прочитать файл — пустой лист?')
        return
      }
      setParsed(p)
      setMap(p.suggested)
      setFileName(file.name)
    } catch {
      toast.error('Не удалось разобрать файл. Поддерживаются CSV и XLSX.')
    }
  }

  const doImport = () => {
    if (!parsed || !map || !storeId) return
    if (!map.date || !map.revenue) {
      toast.error('Укажите колонки «Дата» и «Выручка»')
      return
    }
    const ops = buildOperations(parsed, map, storeId, marketplace)
    if (ops.length === 0) {
      toast.error('Не нашлось ни одной строки с датой и суммой')
      return
    }
    onImport(ops)
    toast.success(`Импортировано: ${ops.length} дневных сводок из ${parsed.rows.length} строк`)
    setParsed(null)
    onClose()
  }

  const mp = MARKETPLACES.find((m) => m.id === marketplace)!

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Импорт отчёта маркетплейса</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Магазин</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger>
                <SelectValue placeholder="Выберите магазин" />
              </SelectTrigger>
              <SelectContent>
                {state.stores.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Маркетплейс</Label>
            <Select value={marketplace} onValueChange={(v) => setMarketplace(v as MarketplaceId)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKETPLACES.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <p className="rounded-lg bg-stone-100 p-3 text-xs text-stone-600">{mp.reportHelp}</p>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-stone-300 p-6 text-sm text-stone-500 hover:border-emerald-400 hover:bg-emerald-50/50">
          <Upload className="h-6 w-6" />
          {fileName || 'Выберите файл отчёта (CSV или XLSX)'}
          <Input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
        </label>

        {parsed && map && (
          <div className="space-y-3">
            <div className="text-sm font-medium">
              Сопоставление колонок{' '}
              <span className="font-normal text-stone-500">
                (найдено {parsed.rows.length} строк)
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {MAP_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                  </Label>
                  <Select
                    value={map[f.key] || '—'}
                    onValueChange={(v) => setMap({ ...map, [f.key]: v === '—' ? '' : v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="—">— не импортировать —</SelectItem>
                      {parsed.headers.map((h) => (
                        <SelectItem key={h} value={h}>
                          {h}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
            <p className="text-xs text-stone-500">
              Строки отчёта суммируются по дням — так налоговая база считается корректно.
            </p>
            <Button onClick={doImport} className="w-full bg-emerald-700 hover:bg-emerald-800">
              Импортировать
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
