import type { AppState, Operation, Store } from '@/types'

export type CompletenessLevel = 'complete' | 'partial' | 'missing'

export interface SourceCoverage {
  id: string
  label: string
  level: CompletenessLevel
  firstDate?: string
  lastDate?: string
  operations: number
  message: string
}

export interface TaxDataCompleteness {
  level: CompletenessLevel
  finalCalculationAllowed: boolean
  periodFrom: string
  periodTo: string
  sources: SourceCoverage[]
  issues: string[]
}

function coverageForOps(id: string, label: string, ops: Operation[], from: string, to: string): SourceCoverage {
  const inRange = ops.filter((op) => op.date >= from && op.date <= to).sort((a, b) => a.date.localeCompare(b.date))
  if (!inRange.length) {
    return { id, label, level: 'missing', operations: 0, message: `Нет операций за период ${from}—${to}` }
  }

  const firstDate = inRange[0].date
  const lastDate = inRange[inRange.length - 1].date
  // Для налогового расчёта считаем источник полным только если он покрывает начало выбранного периода.
  // Последняя дата может быть раньше конца периода, если расчёт выполняется в течение текущего года.
  const startsOnTime = firstDate <= from
  return {
    id,
    label,
    level: startsOnTime ? 'complete' : 'partial',
    firstDate,
    lastDate,
    operations: inRange.length,
    message: startsOnTime
      ? `Данные есть с ${firstDate} по ${lastDate}`
      : `Данные начинаются только с ${firstDate}; начало периода ${from} отсутствует`,
  }
}

export function checkStoreCompleteness(state: AppState, store: Store, from: string, to: string): TaxDataCompleteness {
  const issues: string[] = []
  const sources: SourceCoverage[] = []
  const ops = state.operations.filter((op) => op.storeId === store.id)

  if (store.regime === 'psn') {
    if (!store.patentCost || store.patentCost <= 0) issues.push('Не заполнена стоимость патента.')
    if (!store.patentPotentialIncome || store.patentPotentialIncome <= 0) issues.push('Не заполнен потенциально возможный доход из патента для расчёта дополнительного 1%.')

    const cashChannels = (state.salesChannels ?? []).filter((channel) =>
      channel.organizationId === store.organizationId &&
      channel.businessUnitId === store.businessUnitId &&
      (channel.type === 'retail' || channel.sourceType === 'cash_register') &&
      channel.active,
    )
    if (cashChannels.length) {
      for (const channel of cashChannels) {
        sources.push(coverageForOps(channel.id, channel.name, ops.filter((op) => op.channelId === channel.id), from, to))
      }
    } else {
      sources.push(coverageForOps(`${store.id}:retail`, 'Розничная касса / ОФД', ops, from, to))
    }
  } else {
    const channels = (state.salesChannels ?? []).filter((channel) =>
      channel.organizationId === store.organizationId &&
      channel.businessUnitId === store.businessUnitId &&
      channel.active,
    )

    if (channels.length) {
      for (const channel of channels) {
        const channelOps = ops.filter((op) => op.channelId === channel.id)
        sources.push(coverageForOps(channel.id, channel.name, channelOps, from, to))
      }
    } else {
      sources.push(coverageForOps(`${store.id}:all`, store.name, ops, from, to))
    }
  }

  const missing = sources.filter((source) => source.level === 'missing')
  const partial = sources.filter((source) => source.level === 'partial')
  missing.forEach((source) => issues.push(`${source.label}: ${source.message}`))
  partial.forEach((source) => issues.push(`${source.label}: ${source.message}`))

  const level: CompletenessLevel = issues.length === 0
    ? 'complete'
    : missing.length || issues.some((issue) => issue.startsWith('Не заполн'))
      ? 'missing'
      : 'partial'

  return {
    level,
    finalCalculationAllowed: level === 'complete',
    periodFrom: from,
    periodTo: to,
    sources,
    issues,
  }
}

export function checkOrganizationCompleteness(state: AppState, organizationId: string, from: string, to: string): TaxDataCompleteness {
  const stores = state.stores.filter((store) => store.organizationId === organizationId)
  const checks = stores.map((store) => checkStoreCompleteness(state, store, from, to))
  const sources = checks.flatMap((check) => check.sources)
  const issues = checks.flatMap((check) => check.issues)
  const level: CompletenessLevel = checks.every((check) => check.level === 'complete')
    ? 'complete'
    : checks.some((check) => check.level === 'missing')
      ? 'missing'
      : 'partial'

  return {
    level,
    finalCalculationAllowed: level === 'complete',
    periodFrom: from,
    periodTo: to,
    sources,
    issues,
  }
}
