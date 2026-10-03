import { createFeatureTargetRegistry } from '@klicker-uzh/product-tours/react'

// The student-side registry of everything an onboarding overlay may point at.
// Callers name a target by key, never by CSS selector: a selector living in a
// step list breaks silently the next time the markup moves, and nobody notices
// until a student sees an overlay around nothing.
//
// The keys are the student app's own, even though the lecturer app uses the
// same DOM attribute: the two applications never render each other's markup,
// and the same key would mean different things on the two surfaces.
//
// Adding a target means adding a key here AND spreading `featureTargetProps`
// onto exactly one element in the student UI. The value describes where that
// element lives, so a later reader can find it without grepping. A target that
// is not on the page the student is looking at simply drops its step, which is
// why the tour only starts by itself on the overview page.
export const FEATURE_TARGETS = {
  'pwa-home-practice':
    'The self-paced practice entry points on the student overview page',
  'pwa-home-courses': 'The course list on the student overview page',
  'pwa-home-insights':
    'The learning insights entry on the student overview page',
  'pwa-header-product-updates':
    'The product update bullhorn in the student header',
  'pwa-header-account':
    'The avatar with the level ring and the account menu at the right of the student header',
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
 * Returning null is a normal outcome: the target is simply not rendered on the
 * page the student is looking at, and the step is then left out.
 */
export const resolveFeatureTarget: (
  key: string | undefined
) => HTMLElement | null = registry.resolve
