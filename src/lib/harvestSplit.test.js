import { describe, it, expect } from 'vitest'
import { calculateHarvestSplit } from './harvestSplit'

describe('calculateHarvestSplit', () => {
  it('splits by the agreed percentage', () => {
    const r = calculateHarvestSplit({ total: 100, landownerPercent: 30 })
    expect(r.landownerShare).toBe(30)
    expect(r.farmerShare).toBe(70)
  })

  it('takes the deduction off the top and gives it to the input supplier', () => {
    const r = calculateHarvestSplit({ total: 50, landownerPercent: 30, deduction: 10, deductionTo: 'farmer' })
    expect(r.remaining).toBe(40)
    expect(r.landownerShare).toBe(12)
    expect(r.farmerShare).toBe(38)
  })

  it('can credit the deduction to the landowner', () => {
    const r = calculateHarvestSplit({ total: 50, landownerPercent: 30, deduction: 10, deductionTo: 'landowner' })
    expect(r.landownerShare).toBe(22)
    expect(r.farmerShare).toBe(28)
  })

  it('handles zero yield', () => {
    const r = calculateHarvestSplit({ total: 0, landownerPercent: 40 })
    expect(r.landownerShare).toBe(0)
    expect(r.farmerShare).toBe(0)
  })

  it('gives rounding leftovers to the farmer so shares add up to the total', () => {
    const r = calculateHarvestSplit({ total: 10, landownerPercent: 33.3333, decimals: 1 })
    expect(r.landownerShare).toBe(3.3)
    expect(r.farmerShare).toBe(6.7)
    expect(r.landownerShare + r.farmerShare).toBeCloseTo(10)
  })

  it('works at the 0% and 100% edges', () => {
    expect(calculateHarvestSplit({ total: 7, landownerPercent: 0 }).farmerShare).toBe(7)
    expect(calculateHarvestSplit({ total: 7, landownerPercent: 100 }).landownerShare).toBe(7)
  })

  it('calculates cash value when a sale price is entered', () => {
    const r = calculateHarvestSplit({ total: 42, landownerPercent: 30, salePricePerUnit: 450 })
    expect(r.landownerShare).toBe(12.6)
    expect(r.landownerValue).toBe(5670)
    expect(r.farmerValue).toBe(13230)
  })

  it('rejects invalid input', () => {
    expect(() => calculateHarvestSplit({ total: -1, landownerPercent: 30 })).toThrow()
    expect(() => calculateHarvestSplit({ total: 10, landownerPercent: 120 })).toThrow()
    expect(() => calculateHarvestSplit({ total: 10, landownerPercent: 30, deduction: 11 })).toThrow()
  })
})
