import { createFeatureTargetRegistry } from '@klicker-uzh/product-tours/react'

// The chat-side registry of everything an onboarding overlay may point at. The
// onboarding tour walks through all of them in order. Callers name a target by
// key, never by CSS selector: a selector living in a step list breaks silently
// the next time the markup moves, and nobody notices until a participant sees
// an overlay around nothing.
//
// Adding a target means adding a key here AND spreading `featureTargetProps`
// onto exactly one element in the chat UI. The value describes where that
// element lives, so a later reader can find it without grepping. Several of
// these elements are conditional — the mode switcher is absent on a chatbot
// with a single mode, the attachment button on one that takes no images, and
// the whole sidebar is a sheet that is unmounted on mobile while it is closed.
// A step whose target is missing is left out of the tour instead of pointing
// at nothing.
export const FEATURE_TARGETS = {
  'chat-mode-switcher':
    'The Tutor/Explainer select in the persistent chat header (assistant.tsx), not the copy of it on the welcome card',
  'chat-composer-attach':
    'The image attachment button at the left of the main composer, below the conversation',
  'chat-thread-list':
    'The list of past conversations in the sidebar, under the "Conversations" heading',
  'chat-credits': 'The credit balance and its progress bar in the sidebar foot',
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
 * Returning null is a normal outcome: the target may not be rendered for this
 * chatbot, this viewport, or this moment — see the conditions listed above.
 */
export const resolveFeatureTarget: (
  key: string | undefined
) => HTMLElement | null = registry.resolve
