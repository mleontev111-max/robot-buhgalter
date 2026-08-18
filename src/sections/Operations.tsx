import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Plus, Trash2, Upload } from 'lucide-react'
import type { AppState, Operation } from '@/types'
import { MARKETPLACES, mpInfo } from '@/lib/marketplaces'
import { fmtDate, fmtMoney } from '@/lib/tax'
import ImportDialog from '@/components/ImportDialog'
import OperationForm from '@/components/OperationForm'

interface Props {
  state: AppState
  setState: (updater: (prev: AppState) => AppState) => void
}

export default function Operations({ state, setState }: Props) {
  const [storeFilter, setStoreFilter] = useState('all')
  const [mpFilter, setMpFilter] = useState('all')
  const [monthFilter, setMonthFilter] = useState('all')
  const [importOpen, setImportOpen] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const months = useMemo(
    () => [...new Set(state.operations.map((o) => o.date.slice(0, 7)))].sort().reverse(),
    [state.operations],
  )

  const ops = useMemo(
    () =>
      state.operations.filter(
        (o) =>
          (storeFilter === 'all' || o.storeId === storeFilter) &&
          (mpFilter === 'all' || o.marketplace === mpFilter) &&
          (monthFilter === 'all' || o.date.startsWith(monthFilter)),
      ),
    [state.operations, storeFilter, mpFilter, monthFilter],
  )

  const storeName = (id: string) => state.stores.find((s) => s.id === id)?.name ?? id

  const addOps = (newOps: Operation[]) =>
    setState((p) => ({ ...p, operations: [...newOps, ...p.operations] }))
  const addOp = (op: Operation) =>
    setState((p) => ({ ...p, operations: [op, ...p.operations] }))
  const removeSelected = () => {
    setState((p) => ({ ...p, operations: p.operations.filter((o) => !selected.has(o.id)) }))
    setSelected(new Set())
  }

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Операции</h1>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button variant="destructive" onClick={removeSelected}>
              <Trash2 className="mr-2 h-4 w-4" /> Удалить ({selected.size})
            </Button>
          )}
          <Button variant="outline" className="bg-white" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Импорт отчёта
          </Button>
          <Button className="bg-emerald-700 hover:bg-emerald-800" onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Добавить
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={storeFilter} onValueChange={setStoreFilter}>
          <SelectTrigger className="w-44 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все магазины</SelectItem>
            {state.stores.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={mpFilter} onValueChange={setMpFilter}>
          <SelectTrigger className="w-44 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все маркетплейсы</SelectItem>
            {MARKETPLACES.map((m) => (
              <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={monthFilter} onValueChange={setMonthFilter}>
          <SelectTrigger className="w-44 bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Все месяцы</SelectItem>
            {months.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="ml-auto w-48 bg-white"
          placeholder={`Показано: ${ops.length} операций`}
          readOnly
        />
      </div>

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8"></TableHead>
              <TableHead>Дата</TableHead>
              <TableHead>Магазин</TableHead>
              <TableHead>Маркетплейс</TableHead>
              <TableHead className="text-right">Выручка</TableHead>
              <TableHead className="text-right">Комиссия</TableHead>
              <TableHead className="text-right">Логистика</TableHead>
              <TableHead className="text-right">Реклама</TableHead>
              <TableHead>Комментарий</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ops.slice(0, 200).map((o) => (
              <TableRow key={o.id} className={selected.has(o.id) ? 'bg-red-50' : ''}>
                <TableCell>
                  <input type="checkbox" checked={selected.has(o.id)} onChange={() => toggle(o.id)} />
                </TableCell>
                <TableCell className="whitespace-nowrap">{fmtDate(o.date)}</TableCell>
                <TableCell>{storeName(o.storeId)}</TableCell>
                <TableCell>
                  <Badge
                    variant="secondary"
                    style={{ color: mpInfo(o.marketplace).color }}
                    className="font-medium"
                  >
                    {mpInfo(o.marketplace).name}
                  </Badge>
                </TableCell>
                <TableCell className="text-right font-medium">{fmtMoney(o.revenue)}</TableCell>
                <TableCell className="text-right text-stone-600">{fmtMoney(o.commission)}</TableCell>
                <TableCell className="text-right text-stone-600">{fmtMoney(o.logistics)}</TableCell>
                <TableCell className="text-right text-stone-600">{fmtMoney(o.ads)}</TableCell>
                <TableCell className="max-w-40 truncate text-xs text-stone-500">{o.note}</TableCell>
              </TableRow>
            ))}
            {ops.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="py-10 text-center text-stone-500">
                  Нет операций. Импортируйте отчёт маркетплейса или добавьте вручную.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {ops.length > 200 && (
          <div className="border-t border-stone-200 p-3 text-center text-xs text-stone-500">
            Показаны первые 200 из {ops.length} — уточните фильтры
          </div>
        )}
      </div>

      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} state={state} onImport={addOps} />
      <OperationForm open={formOpen} onClose={() => setFormOpen(false)} state={state} onSave={addOp} />
    </div>
  )
}
