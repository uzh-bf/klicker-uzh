import { useLazyQuery } from '@apollo/client'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import { PreviewActivityArtifactDocument } from '@klicker-uzh/graphql/dist/ops'
import ActivityArtifactFrame from '@klicker-uzh/shared-components/src/ActivityArtifactFrame'
import type { ActivityArtifactExercise } from '@klicker-uzh/types'
import {
  Button,
  FormLabel,
  TextField,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import type { FormikErrors } from 'formik'
import { useCallback, useEffect, useRef, useState } from 'react'
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
 * reviewed revision with the element; ordinary edits leave it untouched. A
 * stored pin is compared with the latest server-side revision on open without
 * changing the form value.
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
  const [latestArtifact, setLatestArtifact] = useState<ReviewedArtifact | null>(
    null
  )
  const [preview, setPreview] = useState<ReviewedArtifact | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestSequence = useRef(0)
  const currentUrl = useRef(url)
  const currentArtifactUrl = currentArtifact?.url

  const loadArtifact = useCallback(
    async (
      requestedUrl: string,
      apply: (artifact: ReviewedArtifact) => void
    ) => {
      const request = ++requestSequence.current
      const normalizedUrl = requestedUrl.trim()
      const result = await loadPreview({
        variables: { url: normalizedUrl },
      })
      const resolved = result.data?.previewActivityArtifact

      if (
        request !== requestSequence.current ||
        currentUrl.current.trim() !== normalizedUrl
      ) {
        return null
      }

      if (!resolved) {
        setPreview(null)
        setError(
          'The artifact could not be resolved. Check that the link is a canonical publisher link for an authorized artifact.'
        )
        return null
      }

      const artifact = resolved as ReviewedArtifact
      apply(artifact)
      return artifact
    },
    [loadPreview]
  )

  useEffect(() => {
    if (!enabled || !currentArtifactUrl || disabled) return

    let active = true
    void loadArtifact(currentArtifactUrl, (artifact) => {
      if (active) setLatestArtifact(artifact)
    })

    return () => {
      active = false
    }
  }, [currentArtifactUrl, disabled, enabled, loadArtifact])

  async function review() {
    setError(null)
    await loadArtifact(url, setPreview)
  }

  async function confirm() {
    if (!preview) return

    await setFieldValue('pendingActivityArtifact', {
      url: preview.url,
      artifactId: preview.artifactId,
      revisionId: preview.revisionId,
      version: preview.version,
    })
    toast({
      type: 'success',
      message: `v${preview.version} is selected. Save the element to store it.`,
    })
  }

  function cancelPreview() {
    if (!preview) return

    setPreview(null)
    if (
      pendingArtifact?.artifactId === preview.artifactId &&
      pendingArtifact.revisionId === preview.revisionId
    ) {
      void setFieldValue('pendingActivityArtifact', undefined)
    }
  }

  if (!enabled) return null

  return (
    <div
      className="mt-4 rounded border border-slate-300 p-3"
      data-cy="activity-artifact-section"
    >
      <FormLabel
        required={false}
        label={currentArtifact ? 'Attached artifact' : 'Attach artifact'}
        labelType="small"
        tooltip="Attach an immutable publisher revision to this content element. Students receive only the trusted renderer."
      />

      {currentArtifact ? (
        <UserNotification type="info" className={{ root: 'mb-3' }}>
          Using v{currentArtifact.version}
          {latestArtifact &&
          latestArtifact.artifactId === currentArtifact.artifactId &&
          latestArtifact.version > currentArtifact.version
            ? ` · v${latestArtifact.version} available`
            : null}
        </UserNotification>
      ) : (
        <UserNotification type="info" className={{ root: 'mb-3' }}>
          No artifact attached. The element renders its Markdown content as
          before.
        </UserNotification>
      )}

      {pendingArtifact ? (
        <UserNotification type="success" className={{ root: 'mb-3' }}>
          v{pendingArtifact.version ?? ''} is selected. Save the element to
          store it.
        </UserNotification>
      ) : null}

      <div className="flex flex-col gap-2">
        <TextField
          label="Artifact link"
          placeholder="https://publisher.example/a/00000000-0000-4000-8000-000000000000"
          value={url}
          disabled={disabled}
          onChange={(value) => {
            currentUrl.current = value
            setUrl(value)
            setLatestArtifact(null)
            setPreview(null)
            setError(null)
          }}
        />
        <div className="text-xs text-slate-500">
          Paste the permanent author link shown beside the saved artifact.
        </div>
        <div className="flex flex-row gap-2">
          <Button
            disabled={disabled || loading || url.trim() === ''}
            onClick={review}
          >
            {loading
              ? 'Resolving…'
              : currentArtifact
                ? 'Preview latest revision'
                : 'Attach artifact'}
          </Button>
        </div>
      </div>

      {currentArtifact &&
      latestArtifact?.artifactId === currentArtifact.artifactId &&
      latestArtifact.version > currentArtifact.version &&
      !preview ? (
        <div className="mt-2">
          <Button
            disabled={disabled || loading}
            onClick={() => {
              setError(null)
              setPreview(latestArtifact)
            }}
          >
            Preview v{latestArtifact.version}
          </Button>
        </div>
      ) : null}

      {error ? (
        <UserNotification type="error" className={{ root: 'mt-3' }}>
          {error}
        </UserNotification>
      ) : null}

      {preview ? (
        <div className="mt-3">
          <div className="mb-1 text-sm">
            {preview.title} · v{preview.version}
          </div>
          <ActivityArtifactFrame
            frameUrl={preview.frameUrl}
            canonicalUrl={preview.url}
            title={preview.title}
            exercise={preview.exercise}
            className="h-[360px] w-full rounded border border-slate-300"
          />
          <div className="mt-2 flex flex-row gap-2">
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
                ? `Update to v${preview.version}`
                : `Attach v${preview.version}`}
            </Button>
            {currentArtifact ? (
              <Button
                onClick={cancelPreview}
                data={{ cy: `cancel-activity-artifact-preview` }}
              >
                Cancel
              </Button>
            ) : null}
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
