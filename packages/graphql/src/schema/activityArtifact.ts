import type { ActivityArtifactPin as StoredActivityArtifactPin } from '@klicker-uzh/types'
import builder from '../builder.js'
import { sanitizeActivityArtifactPin } from '../lib/activityArtifacts.js'
import type { ClientActivityArtifact } from '../services/activityArtifacts.js'

// The stored pin carries the mapped lecturer subject for later authorized
// reads. Students and the lecturer UI only ever see this public projection.
export type PublicActivityArtifactPin = Omit<
  StoredActivityArtifactPin,
  'subject'
>

export function toPublicActivityArtifactPin(
  options: unknown
): PublicActivityArtifactPin | null {
  if (typeof options !== 'object' || options === null) return null

  const pin = sanitizeActivityArtifactPin(
    (options as { activityArtifact?: unknown }).activityArtifact
  )
  if (!pin) return null

  const { subject: _subject, ...publicPin } = pin
  return publicPin
}

/**
 * A resolved artifact revision. `exercise` is the validated declarative
 * numeric payload that the fixed frame renders; publisher markup never leaves
 * the server.
 */
export const ActivityArtifactRevisionRef =
  builder.objectRef<ClientActivityArtifact>('ActivityArtifactRevision')
export const ActivityArtifactRevision = ActivityArtifactRevisionRef.implement({
  fields: (t) => ({
    artifactId: t.exposeID('artifactId'),
    revisionId: t.exposeID('revisionId'),
    digest: t.exposeString('digest'),
    version: t.exposeInt('version'),
    title: t.exposeString('title'),
    url: t.exposeString('url'),
    renderedDigest: t.exposeString('renderedDigest'),
    frameUrl: t.exposeString('frameUrl'),
    exercise: t.expose('exercise', { type: 'Json' }),
  }),
})

export const ActivityArtifactPinRef =
  builder.objectRef<PublicActivityArtifactPin>('ActivityArtifactPin')
export const ActivityArtifactPin = ActivityArtifactPinRef.implement({
  fields: (t) => ({
    artifactId: t.exposeID('artifactId'),
    revisionId: t.exposeID('revisionId'),
    digest: t.exposeString('digest'),
    version: t.exposeInt('version'),
    title: t.exposeString('title'),
    url: t.exposeString('url'),
    renderedDigest: t.exposeString('renderedDigest'),
    exercise: t.expose('exercise', { type: 'Json' }),
  }),
})

// Confirming an attach or explicit upgrade sends the reviewed revision. The
// server re-resolves it before the pin is stored.
export const ContentArtifactInput = builder.inputType('ContentArtifactInput', {
  fields: (t) => ({
    url: t.string({ required: true }),
    artifactId: t.string({ required: true }),
    revisionId: t.string({ required: true }),
  }),
})
