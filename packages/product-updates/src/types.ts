import type { FeatureFlagKey } from '@klicker-uzh/feature-flags'

// Catalog entries are editorial content that is reviewed as a German/English
// pair, so both locales live in one object instead of the `nameDE`/`nameEN`
// field pairs used elsewhere in the repository. The validation suite enforces
// that neither side is left empty. Do not migrate other code to this shape.
export type LocalizedText = { de: string; en: string }

// The runtime lists are the single source of truth: the union types are derived
// from them so the validation suite can check an unknown value against exactly
// the members the type allows.
export const PRODUCT_UPDATE_AUDIENCES = ['lecturer', 'student'] as const
export type ProductUpdateAudience = (typeof PRODUCT_UPDATE_AUDIENCES)[number]

export const PRODUCT_UPDATE_SURFACES = ['manage', 'pwa', 'docs'] as const
export type ProductUpdateSurface = (typeof PRODUCT_UPDATE_SURFACES)[number]

// "Planned" is deliberately absent: work that is not usable by the audience
// belongs in the roadmap or the Community, never in the update catalog.
export const PRODUCT_UPDATE_MATURITIES = [
  'released',
  'preview',
  'pilot',
] as const
export type ProductUpdateMaturity = (typeof PRODUCT_UPDATE_MATURITIES)[number]

export const PRODUCT_UPDATE_PROMOTIONS = [
  'feed',
  'new-badge',
  'spotlight',
] as const
export type ProductUpdatePromotion = (typeof PRODUCT_UPDATE_PROMOTIONS)[number]

export interface ProductUpdate {
  id: string
  publishedAt: string
  expiresAt?: string
  audiences: ProductUpdateAudience[]
  surfaces: ProductUpdateSurface[]
  maturity: ProductUpdateMaturity
  // Gates whether the entry may be presented, never what it contains: an entry
  // stays in the catalog after its flag is retired, so the flag reference is
  // removed from the entry before the flag itself is deleted in GrowthBook.
  requiredFeatureFlags?: FeatureFlagKey[]
  title: LocalizedText
  summary: LocalizedText
  // Rendered through `@klicker-uzh/markdown`, which has GFM turned off. Tables,
  // strikethrough, and task lists would render as literal text.
  bodyMarkdown?: LocalizedText
  image?: { src: string; alt: LocalizedText }
  cta?: { label: LocalizedText; href: string; featureKey?: string }
  detailsUrl?: string
  promotions: ProductUpdatePromotion[]
  // A key into the feature-target registry, never a CSS selector: selectors in
  // editorial content break silently whenever the markup changes.
  spotlightTarget?: string
  suppressInAssessment: boolean
}
