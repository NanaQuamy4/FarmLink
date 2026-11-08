export const REGIONS = [
  'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern', 'Greater Accra', 'North East',
  'Northern', 'Oti', 'Savannah', 'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
]

export const SOIL_TYPES = ['Loamy', 'Sandy loam', 'Clay loam', 'Clay', 'Sandy', 'Alluvial', 'Laterite', 'Not sure']
export const WATER_ACCESS = ['Irrigated', 'Borehole', 'Stream nearby', 'River nearby', 'Well', 'Rain-fed only', 'None']
export const CROPS = [
  'Maize', 'Cassava', 'Yam', 'Plantain', 'Cocoyam', 'Rice', 'Sorghum', 'Millet', 'Groundnut', 'Cowpea', 'Soybean',
  'Tomato', 'Pepper', 'Okra', 'Onion', 'Cabbage', 'Garden egg', 'Vegetables', 'Pineapple', 'Watermelon', 'Cocoa', 'Cashew',
]
export const HARVEST_UNITS = ['bags', 'kg', 'crates', 'tubers', 'bunches', 'fruits', 'baskets', 'tonnes']

export const ROLE_LABELS = {
  landowner: 'Landowner',
  farmer: 'Farmer',
  verifier: 'Verifier',
  admin: 'Administrator',
  buyer: 'Buyer',
}

// status → [label, css class for .fl-status]
export const PLOT_STATUS = {
  pending: ['Awaiting verification', 'pending'],
  verified: ['Verified', 'verified'],
  rejected: ['Not verified', 'rejected'],
  in_deal: ['In a deal', 'neutral'],
  archived: ['Withdrawn', 'neutral'],
}
export const APPLICATION_STATUS = {
  pending: ['Pending', 'pending'],
  accepted: ['Accepted', 'verified'],
  declined: ['Declined', 'rejected'],
  withdrawn: ['Withdrawn', 'neutral'],
}
export const DEAL_STATUS = {
  drafting: ['Agreeing terms', 'pending'],
  active: ['Season running', 'verified'],
  harvested: ['Harvest recorded', 'verified'],
  completed: ['Completed', 'neutral'],
  cancelled: ['Cancelled', 'rejected'],
}
export const DISPUTE_STATUS = {
  open: ['Open', 'rejected'],
  in_mediation: ['In mediation', 'pending'],
  resolved: ['Resolved', 'verified'],
  closed: ['Closed', 'neutral'],
}
export const OFFER_STATUS = {
  pending: ['Pending', 'pending'],
  accepted: ['Accepted', 'verified'],
  declined: ['Declined', 'rejected'],
  withdrawn: ['Withdrawn', 'neutral'],
}

export const MILESTONES = [
  { key: 'cleared', label: 'Cleared', icon: 'bi-tree' },
  { key: 'planted', label: 'Planted', icon: 'bi-flower1' },
  { key: 'weeded', label: 'Weeded', icon: 'bi-scissors' },
  { key: 'harvested', label: 'Harvested', icon: 'bi-basket' },
]

export const RESPONSIBILITIES = [
  { key: 'seed', label: 'Seed or planting material' },
  { key: 'fertiliser', label: 'Fertiliser and chemicals' },
  { key: 'land_clearing', label: 'Land clearing' },
  { key: 'labour', label: 'Labour' },
  { key: 'irrigation', label: 'Irrigation or water' },
  { key: 'transport', label: 'Transport to market' },
]

export const DISPUTE_CATEGORIES = {
  inputs: 'Inputs or responsibilities',
  harvest_share: 'Harvest share',
  land_access: 'Access to the land',
  timing: 'Timing or duration',
  conduct: 'Conduct',
  other: 'Something else',
}
