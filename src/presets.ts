/**
 * Built-in industry profile presets: a deterministic registry of expected
 * column lists (name -> declared type) per industry. When `data_profile` is
 * called with `industryPreset`, the preset's columns feed the scorecard's
 * `declaredSchema` so the `accuracy` dimension becomes determinable instead
 * of undetermined. Unknown preset ids fail loud.
 * @module dsh-data-quality/presets
 */

import type { InferredType } from './profile.ts'

/** One industry preset: an id, a human label, and the expected columns with their declared types. */
export interface IndustryPreset {
  readonly id: string
  readonly label: string
  /** Expected column name -> declared type (fed to the scorecard as `declaredSchema`). */
  readonly columns: Readonly<Record<string, InferredType>>
}

/** The built-in industry preset registry. */
export const INDUSTRY_PRESETS: Readonly<Record<string, IndustryPreset>> = {
  retail: {
    id: 'retail',
    label: 'Retail',
    columns: {
      order_id: 'string',
      sku: 'string',
      quantity: 'number',
      unit_price: 'number',
      revenue: 'number',
      order_date: 'date',
      customer_id: 'string',
    },
  },
  saas: {
    id: 'saas',
    label: 'SaaS',
    columns: {
      account_id: 'string',
      plan: 'string',
      seats: 'number',
      mrr: 'number',
      signup_date: 'date',
      churned: 'boolean',
    },
  },
  fund: {
    id: 'fund',
    label: 'Fund',
    columns: {
      fund_code: 'string',
      fund_name: 'string',
      nav: 'number',
      nav_date: 'date',
      holding_value: 'number',
      currency: 'string',
    },
  },
  'real-estate': {
    id: 'real-estate',
    label: 'Real estate',
    columns: {
      property_id: 'string',
      listing_price: 'number',
      area_sqm: 'number',
      bedrooms: 'number',
      list_date: 'date',
      city: 'string',
    },
  },
  'e-commerce': {
    id: 'e-commerce',
    label: 'E-commerce',
    columns: {
      order_id: 'string',
      product_id: 'string',
      quantity: 'number',
      price: 'number',
      order_date: 'date',
      status: 'string',
    },
  },
  healthcare: {
    id: 'healthcare',
    label: 'Healthcare',
    columns: {
      patient_id: 'string',
      admission_date: 'date',
      discharge_date: 'date',
      age: 'number',
      diagnosis: 'string',
      cost: 'number',
    },
  },
  logistics: {
    id: 'logistics',
    label: 'Logistics',
    columns: {
      shipment_id: 'string',
      origin: 'string',
      destination: 'string',
      weight_kg: 'number',
      shipped_date: 'date',
      delivered: 'boolean',
    },
  },
  manufacturing: {
    id: 'manufacturing',
    label: 'Manufacturing',
    columns: {
      part_id: 'string',
      quantity: 'number',
      unit_cost: 'number',
      produced_date: 'date',
      defect: 'boolean',
    },
  },
  energy: {
    id: 'energy',
    label: 'Energy',
    columns: {
      meter_id: 'string',
      reading: 'number',
      unit: 'string',
      reading_date: 'date',
      consumption: 'number',
    },
  },
}

/** The preset ids, for diagnostics and documentation. */
export const INDUSTRY_PRESET_IDS = Object.keys(INDUSTRY_PRESETS) as readonly string[]

/**
 * Resolve an industry preset id to its registry entry, failing loud on an
 * unknown id.
 * @param id - the requested preset id.
 * @returns the preset.
 */
export function resolveIndustryPreset(id: string): IndustryPreset {
  const preset = INDUSTRY_PRESETS[id]
  if (preset === undefined) {
    throw new Error(`unknown industryPreset ${JSON.stringify(id)}; choose one of: ${INDUSTRY_PRESET_IDS.join(', ')}`)
  }
  return preset
}
