// The pure entry point of the package: no browser APIs, no driver.js, no
// React. The GraphQL backend imports it to validate what a client claims to
// have finished, so everything here has to run in Node as well.

/**
 * Every tour the product knows, by id. Tours are defined in code, never in the
 * database and never as catalog content: a tour is a sequence of steps over
 * specific UI elements, so it only ever exists in a deployed frontend.
 *
 * The ids are the stored values of the per-actor tour state, so an id is
 * permanent once released. A tour whose steps change materially gets a new
 * `-vN` id instead, which makes every actor eligible for the new version.
 */
export const TOUR_IDS = ['manage-onboarding-v1', 'chat-onboarding-v1'] as const

export type TourId = (typeof TOUR_IDS)[number]

const KNOWN_TOUR_IDS = new Set<string>(TOUR_IDS)

/**
 * Whether an id names a tour this build knows. The tour-state rows carry no
 * foreign key, so both writers (the GraphQL service and, later, the chat API
 * routes) check this before storing anything.
 */
export function isKnownTourId(value: string): value is TourId {
  return KNOWN_TOUR_IDS.has(value)
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

/**
 * Escapes a string that is about to be written into a driver.js popover.
 *
 * Driver.js assigns every popover string with innerHTML, so a step title such
 * as "Faster grading (<2s)" would otherwise lose part of itself to the HTML
 * parser — and any text that ever comes from outside the app would be a script
 * injection. Callers escape at the boundary; the overlay itself never sees raw
 * text.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]!)
}
