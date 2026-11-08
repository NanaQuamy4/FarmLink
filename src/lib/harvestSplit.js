// Harvest split rule (FR8), mirrored by the calculate_harvest_split() SQL function.
//
// 1. An input deduction agreed up front comes off the total first and goes to
//    whoever supplied the inputs.
// 2. The rest is split by the agreed landowner percentage.
// 3. Rounding leftovers go to the farmer, so both shares always add up to the total.
//
// Quantities are handled as integers of the smallest unit (e.g. tenths of a bag)
// to avoid floating-point drift.

export function calculateHarvestSplit({
  total,
  landownerPercent,
  deduction = 0,
  deductionTo = 'farmer',
  decimals = 1,
  salePricePerUnit = null,
}) {
  const t = Number(total)
  const pct = Number(landownerPercent)
  const d = Number(deduction) || 0

  if (!Number.isFinite(t) || t < 0) throw new Error('Total harvest must be zero or more.')
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new Error('Landowner share must be between 0 and 100%.')
  if (!Number.isFinite(d) || d < 0) throw new Error('Deduction must be zero or more.')
  if (d > t) throw new Error('Deduction cannot be more than the total harvest.')
  if (!['farmer', 'landowner'].includes(deductionTo)) throw new Error('Deduction must go to the farmer or the landowner.')

  const scale = 10 ** decimals
  const totalU = Math.round(t * scale)
  const deductionU = Math.round(d * scale)
  const remainingU = totalU - deductionU
  const landownerSplitU = Math.floor((remainingU * pct) / 100)
  const farmerSplitU = remainingU - landownerSplitU

  const landownerU = landownerSplitU + (deductionTo === 'landowner' ? deductionU : 0)
  const farmerU = farmerSplitU + (deductionTo === 'farmer' ? deductionU : 0)

  const result = {
    total: totalU / scale,
    deduction: deductionU / scale,
    remaining: remainingU / scale,
    landownerShare: landownerU / scale,
    farmerShare: farmerU / scale,
    landownerPercent: pct,
    farmerPercent: 100 - pct,
  }

  if (salePricePerUnit !== null && salePricePerUnit !== '' && Number(salePricePerUnit) >= 0) {
    const p = Number(salePricePerUnit)
    result.landownerValue = Math.round(result.landownerShare * p * 100) / 100
    result.farmerValue = Math.round(result.farmerShare * p * 100) / 100
  }
  return result
}
