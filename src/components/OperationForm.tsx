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
import type { AppState, MarketplaceId, Operation } from '@/types'
import { MARKETPLACES } from '@/lib/marketplaces'

interface Props {
  open: boolean
  onClose: () => void
  state: AppState
  onSave: (op: Operation) => void
}

export default function OperationForm({ open, onClose, state, onSave }: Props) {
  const [storeId, setStoreId] = useState(state.stores[0]?.id ?? '')
  const [marketplace, setMarketplace] = useState<MarketplaceId>('ozon')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [vals, setVals] = useState({
    revenue: '',
    commission: '',
    logistics: '',
    ads: '',
    otherExpenses: '',
    note: '',
  })

  const num = (s: string) => Math.abs(parseFloat(s.replace(',', '.')) || 0)

  const save = () => {
    if (!storeId || num(vals.revenue) === 0) return
    onSave({
      id: Math.random().toString(36).slice(2, 10),
      storeId,
      marketplace,
      date,
      revenue: num(vals.revenue),
      commission: num(vals.commission),
      logistics: num(vals.logistics),
      ads: num(vals.ads),
      otherExpenses: num(vals.otherExpenses),
      note: vals.note || undefined,
    })
    setVals({ revenue: '', commission: '', logistics: '', ads: '', otherExpenses: '', note: '' })
    onClose()
  }

  const moneyField = (key: keyof typeof vals, label: string) => (
    <div className="space-y-1.5" key={key}>
      <Label className="text-xs">{label}</Label>
      <Input
        inputMode="decimal"
        value={vals[key]}
        onChange={(e) => setVals({ ...vals, [key]: e.target.value })}
        placeholder="0"
      />
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новая операция</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Магазин</Label>
            <Select value={storeId} onValueChange={setStoreId}>
              <SelectTrigger>
                <SelectValue />
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
            <Label className="text-xs">Маркетплейс</Label>
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
          <div className="space-y-1.5">
            <Label className="text-xs">Дата</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {moneyField('revenue', 'Выручка, ₽ *')}
          {moneyField('commission', 'Комиссия, ₽')}
          {moneyField('logistics', 'Логистика, ₽')}
          {moneyField('ads', 'Реклама, ₽')}
          {moneyField('otherExpenses', 'Прочие расходы, ₽')}
          <div className="col-span-2 space-y-1.5">
            <Label className="text-xs">Комментарий</Label>
            <Input
              value={vals.note}
              onChange={(e) => setVals({ ...vals, note: e.target.value })}
              placeholder="Например: отчёт за неделю"
            />
          </div>
        </div>
        <Button onClick={save} className="w-full bg-emerald-700 hover:bg-emerald-800">
          Сохранить
        </Button>
      </DialogContent>
    </Dialog>
  )
}
