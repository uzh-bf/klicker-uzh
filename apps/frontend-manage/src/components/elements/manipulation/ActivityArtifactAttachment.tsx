import { useLazyQuery } from '@apollo/client'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import { PreviewActivityArtifactDocument } from '@klicker-uzh/graphql/dist/ops'
import ActivityArtifactFrame from '@klicker-uzh/shared-components/src/ActivityArtifactFrame'
import {
  Button,
  FormLabel,
  TextField,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import type { ActivityArtifactExercise } from '@klicker-uzh/types'
import type { FormikErrors } from 'formik'
import { useState } from 'react'
import type {
  ActivityArtifactFormValue,
  ActivityArtifactPinSummary,
  ElementFormTypes,
} from './types'

interface ActivityArtifactAttachmentProps {
  elementId?: number
  disabled?: boolean
  currentArtifact?: ActivityArtifactPinSummary | null
  pendingArtifact?: ActivityArtifactFormValue
  setFieldValue: (
    field: string,
    value: any,
    shouldValidate?: boolean
  ) => Promise<void | FormikErrors<ElementFormTypes>>
}

type ReviewedArtifact = {
  artifactId: string
  revisionId: string
  digest: string
  version: number
  title: string
  url: string
  renderedDigest: string
  frameUrl: string
  exercise: ActivityArtifactExercise
}

/**
 * Attach or explicitly upgrade an activity artifact on a Content Element.
 *
 * The lecturer pastes the canonical author link, reviews the resolved revision
 * in the isolated frame, and only then confirms. Confirmation stores the exact
 * reviewed revision with the element; ordinary edits leave it untouched.
 */
function ActivityArtifactAttachment({
  elementId,
  disabled = false,
  currentArtifact,
  pendingArtifact,
  setFieldValue,
}: ActivityArtifactAttachmentProps) {
  const enabled = useFeatureFlag('activity-artifacts')
  const [url, setUrl] = useState(currentArtifact?.url ?? '')
  const [loadPreview, { loading }] = useLazyQuery(
    PreviewActivityArtifactDocument,
    { fetchPolicy: 'network-only' }
  )
  const [preview, setPreview] = useState<ReviewedArtifact | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function review() {
    setError(null)
    const result = await loadPreview({ variables: { url: url.trim() } })
    const resolved = result.data?.previewActivityArtifact
    if (!resolved) {
      setPreview(null)
      setError(
        'The artifact could not be resolved. Check that the link is a canonical publisher link for an authorized artifact.'
      )
      return
    }
    setPreview(resolved as ReviewedArtifact)
  }

  async function confirm() {
    if (!preview) return

    await setFieldValue('pendingActivityArtifact', {
      url: preview.url,
      artifactId: preview.artifactId,
      revisionId: preview.revisionId,
    })
    toast({
      type: 'success',
      message: `Revision ${preview.version} is attached. Save the element to store it.`,
    })
  }

  if (!enabled) return null

  return (
    <div className="mt-4 rounded border border-slate-300 p-3">
      <FormLabel
        required={false}
        label="Activity artifact"
        labelType="small"
        tooltip="Attach an immutable publisher revision to this content element. Students receive only the trusted renderer."
      />

      {currentArtifact ? (
        <UserNotification type="info" className={{ root: 'mb-3' }}>
          Attached: {currentArtifact.title} (revision v{currentArtifact.version}
          , digest {currentArtifact.digest.slice(0, 12)}…). Editing and saving
          this element keeps this revision.
        </UserNotification>
      ) : (
        <UserNotification type="info" className={{ root: 'mb-3' }}>
          No artifact attached. The element renders its Markdown content as
          before.
        </UserNotification>
      )}

      {pendingArtifact ? (
        <UserNotification type="success" className={{ root: 'mb-3' }}>
          Pending pin: revision {pendingArtifact.revisionId}. Save to store it.
        </UserNotification>
      ) : null}

      <div className="flex flex-col gap-2">
        <TextField
          label="Canonical author link"
          placeholder="https://publisher.example/a/00000000-0000-4000-8000-000000000000"
          value={url}
          disabled={disabled}
          onChange={(value) => setUrl(value)}
        />
        <div className="flex flex-row gap-2">
          <Button
            disabled={disabled || loading || url.trim() === ''}
            onClick={review}
          >
            {loading ? 'Resolving…' : 'Review latest revision'}
          </Button>
        </div>
      </div>

      {error ? (
        <UserNotification type="error" className={{ root: 'mt-3' }}>
          {error}
        </UserNotification>
      ) : null}

      {preview ? (
        <div className="mt-3">
          <div className="mb-1 text-sm">
            {preview.title} · revision v{preview.version} · digest{' '}
            {preview.digest.slice(0, 12)}…
          </div>
          <ActivityArtifactFrame
            frameUrl={preview.frameUrl}
            canonicalUrl={preview.url}
            title={preview.title}
            exercise={preview.exercise}
            className="h-[360px] w-full rounded border border-slate-300"
          />
          <div className="mt-2">
            <Button
              disabled={
                disabled ||
                (pendingArtifact?.revisionId === preview.revisionId &&
                  pendingArtifact?.artifactId === preview.artifactId)
              }
              onClick={confirm}
              data={{ cy: `confirm-activity-artifact` }}
            >
              {currentArtifact
                ? `Upgrade to revision v${preview.version}`
                : `Attach revision v${preview.version}`}
            </Button>
          </div>
        </div>
      ) : null}

      {elementId ? (
        <div className="mt-2 text-xs text-slate-500">
          Saving without confirming a revision keeps the current pin.
        </div>
      ) : null}
    </div>
  )
}

export default ActivityArtifactAttachment
