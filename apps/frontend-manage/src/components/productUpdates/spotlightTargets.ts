// The manage-side registry of everything a product update may point a
// spotlight at. Catalog entries name a target by key, never by CSS selector: a
// selector living in editorial content breaks silently the next time the markup
// moves, and nobody notices until a lecturer sees an overlay around nothing.
//
// Adding a target means adding a key here AND spreading `spotlightTargetProps`
// onto exactly one element in the manage UI. The value describes where that
// element lives, so a later reader can find it without grepping.
export const SPOTLIGHT_TARGETS = {
  'manage-header-analytics':
    'The learning analytics menu in the manage header, present on every page',
} as const

export type SpotlightTargetKey = keyof typeof SPOTLIGHT_TARGETS

const SPOTLIGHT_ATTRIBUTE = 'data-product-feature'

/**
 * The DOM attribute that makes an element findable by a spotlight. Spread onto
 * the element itself, or onto a wrapper when the component in between does not
 * forward unknown props.
 */
export function spotlightTargetProps(
  key: SpotlightTargetKey
): Record<string, string> {
  return { [SPOTLIGHT_ATTRIBUTE]: key }
}

/**
 * Whether a catalog entry names a target this frontend knows. Knowing the key
 * is necessary but not sufficient: only resolving tells whether the element is
 * on the page the reader is looking at, so callers use that instead.
 */
function isKnownSpotlightTarget(
  key: string | undefined
): key is SpotlightTargetKey {
  return key !== undefined && key in SPOTLIGHT_TARGETS
}

/**
 * Finds the element a catalog entry points at on the current page.
 *
 * Returning null is a normal outcome in two cases that must both stay quiet:
 * the entry names a target this frontend does not know, because the catalog can
 * be newer than the deployed app, and the target is simply not rendered on the
 * page the reader is looking at.
 */
export function resolveSpotlightTarget(
  key: string | undefined
): HTMLElement | null {
  if (!isKnownSpotlightTarget(key)) return null

  return document.querySelector<HTMLElement>(
    `[${SPOTLIGHT_ATTRIBUTE}="${key}"]`
  )
}
