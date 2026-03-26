export const DEFAULT_MATERIAL_CONFIGS = [
  {
    name: "Tarpaulin",
    displayName: "Tarpaulin",
    type: "standard",
    requiresSubOption: true,
    subOptionType: "Tarpaulin type",
    isLengthMaterial: true,
    defaultUnit: "ft",
    defaultReorderLevel: 20,
    subOptions: [
      "3ft tarpaulin",
      "4ft tarpaulin",
      "5ft tarpaulin",
      "6ft tarpaulin",
      "3ft election tarp (8oz)",
      "4ft election tarp (8oz)"
    ]
  },
  {
    name: "Cyan Ink",
    displayName: "Cyan Ink",
    type: "standard",
    defaultUnit: "bottles",
    defaultReorderLevel: 2
  },
  {
    name: "Magenta Ink",
    displayName: "Magenta Ink",
    type: "standard",
    defaultUnit: "bottles",
    defaultReorderLevel: 2
  },
  {
    name: "Yellow Ink",
    displayName: "Yellow Ink",
    type: "standard",
    defaultUnit: "bottles",
    defaultReorderLevel: 2
  },
  {
    name: "Black Ink",
    displayName: "Black Ink",
    type: "standard",
    defaultUnit: "bottles",
    defaultReorderLevel: 2
  },
  {
    name: "Laminating film",
    displayName: "Laminating film",
    type: "standard",
    requiresSubOption: true,
    subOptionType: "Laminating film width",
    isLengthMaterial: true,
    defaultUnit: "ft",
    defaultReorderLevel: 5,
    subOptions: [
      "4ft laminating film (glossy)",
      "5ft laminating film (glossy)",
      "4ft laminating film (matte)",
      "5ft laminating film (matte)"
    ]
  },
  {
    name: "Vinyl sticker",
    displayName: "Vinyl sticker",
    type: "standard",
    requiresSubOption: true,
    subOptionType: "Vinyl width",
    isLengthMaterial: true,
    defaultUnit: "ft",
    defaultReorderLevel: 10,
    subOptions: ["4ft vinyl sticker", "5ft vinyl sticker"]
  },
  {
    name: "Sintra board",
    displayName: "Sintra Board",
    type: "standard",
    requiresSubOption: true,
    subOptionType: "Sintra board size",
    defaultUnit: "sheets",
    defaultReorderLevel: 10,
    subOptions: [
      "A4 sintra board",
      "A3 sintra board",
      "A2 sintra board",
      "A4 sintra board - 3mm",
      "A3 sintra board - 3mm",
      "A2 sintra board - 3mm",
      "A4 sintra board - 5mm",
      "A3 sintra board - 5mm",
      "A2 sintra board - 5mm"
    ]
  },
  {
    name: "Pull-up banner",
    displayName: "Pull-up Banner",
    type: "standard",
    requiresSubOption: true,
    subOptionType: "Pull-up banner size",
    defaultReorderLevel: 3,
    subOptions: ["2.75ft x 6.5ft", "2ft x 5ft", "2.5ft x 6ft"]
  },
  {
    name: "X-banner",
    displayName: "X-Banner",
    type: "standard",
    requiresSubOption: true,
    subOptionType: "X-banner size",
    defaultReorderLevel: 5,
    subOptions: ["2.75ft x 6.5ft", "2ft x 5ft", "2.5ft x 6ft"]
  },
  {
    name: "Round neck shirt",
    displayName: "Round neck shirt",
    type: "standard",
    defaultUnit: "pieces",
    defaultReorderLevel: 2
  }
]

export const DEFAULT_SUPPLIERS = [
  {
    name: "ArtMart Signage Materials Trading",
    dateAdded: "2025-01-01",
    isCustom: false
  },
  { name: "EasyAds", dateAdded: "2025-01-01", isCustom: false },
  {
    name: "Black Horse",
    dateAdded: "2025-01-01",
    isCustom: false
  },
  {
    name: "Apple Tee",
    dateAdded: "2025-01-01",
    isCustom: false
  }
]

export const MATERIALS = DEFAULT_MATERIAL_CONFIGS.map(config => ({
  name: config.name,
  displayName: config.displayName,
  value: config.name,
  unit: config.defaultUnit || "units",
  isLengthMaterial: config.isLengthMaterial,
  subOptions: config.subOptions
}))
