import { useLazyQuery } from '@apollo/client'
import { useFeatureFlag } from '@klicker-uzh/feature-flags/react'
import {
  PreviewActivityArtifactDocument,
  type PreviewActivityArtifactQuery,
} from '@klicker-uzh/graphql/dist/ops'
import ActivityArtifactFrame from '@klicker-uzh/shared-components/src/ActivityArtifactFrame'
import {
  Button,
  FormLabel,
  TextField,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import type { FormikErrors } from 'formik'
import { useTranslations } from 'next-intl'
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

type ReviewedArtifact = NonNullable<
  PreviewActivityArtifactQuery['previewActivityArtifact']
>
type LoadArtifactError = 'invalidLink' | 'forbidden' | 'unavailable' | 'generic'
type LoadArtifactResult =
  | { status: 'success'; artifact: ReviewedArtifact }
  | { status: 'error'; reason: LoadArtifactError }
  | null

function getGraphQLErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined

  const extensions = (error as { extensions?: { code?: unknown } }).extensions
  if (typeof extensions?.code === 'string') return extensions.code

  const graphQLErrors = (error as { graphQLErrors?: unknown }).graphQLErrors
  if (!Array.isArray(graphQLErrors)) return undefined

  for (const graphQLError of graphQLErrors) {
    const code = getGraphQLErrorCode(graphQLError)
    if (code) return code
  }

  return undefined
}

function getLoadArtifactError(error: unknown): LoadArtifactError {
  const code = getGraphQLErrorCode(error)
  if (code === 'BAD_USER_INPUT') return 'invalidLink'
  if (code === 'FORBIDDEN' || code === 'UNAUTHENTICATED') return 'forbidden'
  if (code === 'SERVICE_UNAVAILABLE') return 'unavailable'
  return 'generic'
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
  const t = useTranslations()
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
  const reviewSequence = useRef(0)
  const compareSequence = useRef(0)
  const currentUrl = useRef(url)
  const mounted = useRef(false)
  const currentArtifactUrl = currentArtifact?.url
  const compareUrl =
    url.trim() === currentArtifactUrl ? currentArtifactUrl : undefined

  const loadArtifact = useCallback(
    async (
      requestedUrl: string,
      requestSequence: { current: number }
    ): Promise<LoadArtifactResult> => {
      const request = ++requestSequence.current
      const normalizedUrl = requestedUrl.trim()
      try {
        const result = await loadPreview({
          variables: { url: normalizedUrl },
        })

        if (
          request !== requestSequence.current ||
          currentUrl.current.trim() !== normalizedUrl
        ) {
          return null
        }

        if (result.error) {
          return {
            status: 'error',
            reason: getLoadArtifactError(result.error),
          }
        }

        const artifact = result.data?.previewActivityArtifact
        if (!artifact) return { status: 'error', reason: 'generic' }

        return { status: 'success', artifact }
      } catch (error) {
        if (
          request !== requestSequence.current ||
          currentUrl.current.trim() !== normalizedUrl
        ) {
          return null
        }

        return { status: 'error', reason: getLoadArtifactError(error) }
      }
    },
    [loadPreview]
  )

  useEffect(() => {
    mounted.current = true

    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled || !compareUrl || disabled) return

    let active = true
    void loadArtifact(compareUrl, compareSequence).then((result) => {
      if (active && result?.status === 'success') {
        setLatestArtifact(result.artifact)
      }
    })

    return () => {
      active = false
    }
  }, [compareUrl, disabled, enabled, loadArtifact])

  function getErrorMessage(reason: LoadArtifactError) {
    switch (reason) {
      case 'invalidLink':
        return t('manage.elements.activityArtifact.errorInvalidLink')
      case 'forbidden':
        return t('manage.elements.activityArtifact.errorForbidden')
      case 'unavailable':
        return t('manage.elements.activityArtifact.errorUnavailable')
      case 'generic':
        return t('manage.elements.activityArtifact.errorGeneric')
    }
  }

  async function review() {
    setError(null)
    const result = await loadArtifact(url, reviewSequence)
    if (!mounted.current || !result) return

    if (result.status === 'error') {
      setPreview(null)
      setError(getErrorMessage(result.reason))
      return
    }

    setPreview(result.artifact)
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
      message: t('manage.elements.activityArtifact.selectedToast', {
        version: preview.version,
      }),
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

  let reviewButtonLabel = t('manage.elements.activityArtifact.attachArtifact')
  if (currentArtifact) {
    reviewButtonLabel = t(
      'manage.elements.activityArtifact.previewLatestRevision'
    )
  }
  if (loading) {
    reviewButtonLabel = t('manage.elements.activityArtifact.resolving')
  }
  const latestRevisionNotice =
    latestArtifact &&
    currentArtifact &&
    latestArtifact.artifactId === currentArtifact.artifactId &&
    latestArtifact.version > currentArtifact.version
      ? t('manage.elements.activityArtifact.latestRevisionAvailable', {
          version: latestArtifact.version,
        })
      : null

  return (
    <div
      className="mt-4 rounded border border-slate-300 p-3"
      data-cy="activity-artifact-section"
    >
      <FormLabel
        required={false}
        label={
          currentArtifact
            ? t('manage.elements.activityArtifact.attachedTitle')
            : t('manage.elements.activityArtifact.attachTitle')
        }
        labelType="small"
        tooltip={t('manage.elements.activityArtifact.tooltip')}
      />

      {currentArtifact ? (
        <UserNotification type="info" className={{ root: 'mb-3' }}>
          {t('manage.elements.activityArtifact.usingRevision', {
            version: currentArtifact.version,
          })}
          {latestRevisionNotice ? ' · ' : null}
          {latestRevisionNotice}
        </UserNotification>
      ) : (
        <UserNotification type="info" className={{ root: 'mb-3' }}>
          {t('manage.elements.activityArtifact.noArtifactAttached')}
        </UserNotification>
      )}

      {pendingArtifact ? (
        <UserNotification type="success" className={{ root: 'mb-3' }}>
          {t('manage.elements.activityArtifact.selectedRevision', {
            version: pendingArtifact.version ?? '',
          })}
        </UserNotification>
      ) : null}

      <div className="flex flex-col gap-2">
        <TextField
          label={t('manage.elements.activityArtifact.linkLabel')}
          placeholder={t('manage.elements.activityArtifact.linkPlaceholder')}
          value={url}
          disabled={disabled}
          onChange={(value) => {
            currentUrl.current = value
            setUrl(value)
            setLatestArtifact(null)
            setPreview(null)
            setError(null)
          }}
          data={{ cy: 'activity-artifact-link' }}
        />
        <div className="text-xs text-slate-500">
          {t('manage.elements.activityArtifact.linkHint')}
        </div>
        <div className="flex flex-row gap-2">
          <Button
            disabled={disabled || loading || url.trim() === ''}
            onClick={review}
            data={{ cy: 'review-activity-artifact' }}
          >
            {reviewButtonLabel}
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
            data={{ cy: 'preview-latest-activity-artifact' }}
            onClick={() => {
              setError(null)
              setPreview(latestArtifact)
            }}
          >
            {t('manage.elements.activityArtifact.previewRevision', {
              version: latestArtifact.version,
            })}
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
            {t('manage.elements.activityArtifact.titleVersion', {
              title: preview.title,
              version: preview.version,
            })}
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
                ? t('manage.elements.activityArtifact.updateRevision', {
                    version: preview.version,
                  })
                : t('manage.elements.activityArtifact.attachRevision', {
                    version: preview.version,
                  })}
            </Button>
            {currentArtifact ? (
              <Button
                disabled={disabled}
                onClick={cancelPreview}
                data={{ cy: 'cancel-activity-artifact-preview' }}
              >
                {t('manage.elements.activityArtifact.cancel')}
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}

      {elementId ? (
        <div className="mt-2 text-xs text-slate-500">
          {t('manage.elements.activityArtifact.keepCurrentPin')}
        </div>
      ) : null}
    </div>
  )
}

export default ActivityArtifactAttachment
