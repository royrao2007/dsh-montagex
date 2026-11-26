/**
 * Deterministic generation pricing for the pre-flight cost gate.
 *
 * The plugin ships no price table of its own and must not invent live rates:
 * a wrong number is worse than no number. This module only does arithmetic on
 * rates the caller (or the user's settings, via `model-price.json`) supplies.
 *
 * Units are intentionally explicit:
 * - `unit: 'call'`  → one generated item costs `price`.
 * - `unit: 'second'`→ price per second of output; total = price × duration × count.
 * - `unit: '1k-image'` → price per image; total = price × count.
 *
 * All totals are rounded to cents (2 decimals) with half-up rounding, so the
 * same inputs always produce the same number.
 */

export type PriceUnit = 'call' | 'second' | '1k-image'

export interface ModelPrice {
  /** Model id as configured (matched case-insensitively, exact otherwise). */
  model: string
  /** Price in the currency's major unit (e.g. CNY 元 / USD dollars). */
  price: number
  unit: PriceUnit
  currency?: string
}

export interface CostEstimateInput {
  prices: ModelPrice[]
  model?: string
  type?: 'image' | 'video' | 'audio'
  duration?: number
  count?: number
}

export interface CostEstimate {
  /** Whether a matching price row was found. */
  known: boolean
  /** Null when no row matched, or when a per-second row lacks a duration. */
  estimatedCost: number | null
  currency: string | null
  /** One human-readable line explaining how the number was produced. */
  breakdown: string
  /** True when the number is missing because an input is missing, not because the model is unknown. */
  missingInput?: boolean
}

/** Round half away from zero to cents — deterministic across platforms. */
export function roundCents(value: number): number {
  if (!Number.isFinite(value)) return 0
  const scaled = Math.abs(value) * 100
  const rounded = Math.floor(scaled + 0.5 + 1e-9)
  return (Math.sign(value) * rounded) / 100
}

export function findPrice(prices: ModelPrice[], model: string | undefined): ModelPrice | undefined {
  if (model === undefined || model.trim() === '') return undefined
  const target = model.trim().toLowerCase()
  return prices.find(row => row.model.trim().toLowerCase() === target)
}

/**
 * Estimate a generation's cost from explicit price rows.
 * Never guesses a rate: an unknown model yields `known: false` and a null cost.
 */
export function estimateCost(input: CostEstimateInput): CostEstimate {
  const count = Number.isFinite(input.count) && (input.count as number) > 0 ? Math.floor(input.count as number) : 1
  const row = findPrice(input.prices, input.model)
  if (row === undefined) {
    return {
      known: false,
      estimatedCost: null,
      currency: null,
      breakdown: input.model === undefined || input.model === ''
        ? `未指定模型，无法估算（本插件不内置价目表；未计价按 ${count} 次计费待确认）`
        : `模型 ${input.model} 不在已知价目表内，无法估算（未计价按 ${count} 次计费待确认）`,
    }
  }
  const currency = row.currency ?? 'CNY'
  const unitPrice = Number.isFinite(row.price) && row.price >= 0 ? row.price : 0
  if (row.unit === 'second') {
    const duration = input.duration
    if (duration === undefined || !Number.isFinite(duration) || duration <= 0) {
      return {
        known: true,
        estimatedCost: null,
        currency,
        missingInput: true,
        breakdown: `${row.model} 按秒计价 ${unitPrice} ${currency}/s，但未提供时长，无法估算`,
      }
    }
    const total = roundCents(unitPrice * duration * count)
    return {
      known: true,
      estimatedCost: total,
      currency,
      breakdown: `${row.model} ${unitPrice} ${currency}/s × ${duration}s × ${count} 次 = ${total.toFixed(2)} ${currency}`,
    }
  }
  const total = roundCents(unitPrice * count)
  const unitLabel = row.unit === '1k-image' ? '张' : '次'
  return {
    known: true,
    estimatedCost: total,
    currency,
    breakdown: `${row.model} ${unitPrice} ${currency}/${unitLabel} × ${count} = ${total.toFixed(2)} ${currency}`,
  }
}

/**
 * Parse a `model-price.json` document into rows.
 * Invalid entries are dropped rather than guessed; the caller can compare the
 * returned length with the input length to report skipped rows.
 */
export function parsePriceTable(raw: unknown): ModelPrice[] {
  const list = Array.isArray(raw)
    ? raw
    : raw !== null && typeof raw === 'object' && Array.isArray((raw as { models?: unknown }).models)
      ? (raw as { models: unknown[] }).models
      : []
  const rows: ModelPrice[] = []
  for (const item of list) {
    if (item === null || typeof item !== 'object') continue
    const record = item as Record<string, unknown>
    const model = typeof record.model === 'string' ? record.model.trim() : ''
    const price = typeof record.price === 'number' ? record.price : Number(record.price)
    const unit = record.unit
    if (model === '' || !Number.isFinite(price) || price < 0) continue
    if (unit !== 'call' && unit !== 'second' && unit !== '1k-image') continue
    rows.push({
      model,
      price,
      unit,
      ...(typeof record.currency === 'string' && record.currency.trim() !== '' ? { currency: record.currency.trim() } : {}),
    })
  }
  return rows
}