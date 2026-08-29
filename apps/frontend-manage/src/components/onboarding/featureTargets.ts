import { createFeatureTargetRegistry } from '@klicker-uzh/product-tours/react'

// The manage-side registry of everything an onboarding overlay may point at:
// the product-update spotlight highlights one of them at a time, the onboarding
// tour walks through several. Callers name a target by key, never by CSS
// selector: a selector living in editorial content or in a step list breaks
// silently the next time the markup moves, and nobody notices until a lecturer
// sees an overlay around nothing.
//
// Adding a target means adding a key here AND spreading `featureTargetProps`
// onto exactly one element in the manage UI. The value describes where that
// element lives, so a later reader can find it without grepping. Tour steps
// need targets that are on every page, because the tour starts wherever the
// lecturer happens to land.
export const FEATURE_TARGETS = {
  'manage-header-analytics':
    'The learning analytics menu in the manage header, present on every page',
  'manage-header-main-nav':
    'The library, activities and courses buttons in the manage header, present on every page',
  'manage-header-product-updates':
    'The product update bell in the manage header, present on every page',
  'manage-header-account':
    'The support, running-quiz and account controls at the right of the manage header',
} as const

export type FeatureTargetKey = keyof typeof FEATURE_TARGETS

const registry = createFeatureTargetRegistry({
  attribute: 'data-product-feature',
  targets: FEATURE_TARGETS,
})

/**
 * The DOM attribute that makes an element findable by an overlay. Spread onto
 * the element itself, or onto a wrapper when the component in between does not
 * forward unknown props.
 */
export const featureTargetProps: (
  key: FeatureTargetKey
) => Record<string, string> = registry.targetProps

/**
 * Finds the element a key names on the current page.
 *
 * Returning null is a normal outcome in two cases that must both stay quiet:
 * the key is unknown to this frontend, because a catalog entry can be newer
 * than the deployed app, and the target is simply not rendered on the page the
 * reader is looking at.
 */
export const resolveFeatureTarget: (
  key: string | undefined
) => HTMLElement | null = registry.resolve
