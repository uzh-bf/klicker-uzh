import { useLazyQuery } from '@apollo/client'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GetCourseDiscussionCourseEmbeddingInfoDocument,
  GetCourseDiscussionEmbeddingInfoDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  COURSE_QA_EXTERNAL_REF_MAX_LENGTH,
  COURSE_QA_EXTERNAL_SOURCE_MAX_LENGTH,
} from '@klicker-uzh/types'
import { Button, H3, toast } from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

interface CourseDiscussionEmbedGeneratorProps {
  courseId: string
  isCourseQAAnonymousEnabled: boolean
}

function CourseDiscussionEmbedGenerator({
  courseId,
  isCourseQAAnonymousEnabled,
}: CourseDiscussionEmbedGeneratorProps) {
  const t = useTranslations()
  const formatter = useFormatter()
  const [embedScope, setEmbedScope] = useState<'external' | 'course'>(
    'external'
  )
  const [externalSource, setExternalSource] = useState('')
  const [externalRef, setExternalRef] = useState('')
  const [allowAnonymous, setAllowAnonymous] = useState(false)
  const [expiresInHours, setExpiresInHours] = useState(48)
  const [generatedEmbedInfo, setGeneratedEmbedInfo] = useState<{
    embedUrl: string
    expiresAt: string
  } | null>(null)
  const [currentTime, setCurrentTime] = useState(0)

  const [generateEmbedInfo, { loading: loadingEmbed }] = useLazyQuery(
    GetCourseDiscussionEmbeddingInfoDocument,
    {
      fetchPolicy: 'no-cache',
    }
  )
  const [generateCourseEmbedInfo, { loading: loadingCourseEmbed }] =
    useLazyQuery(GetCourseDiscussionCourseEmbeddingInfoDocument, {
      fetchPolicy: 'no-cache',
    })
  const isExternalEmbed = embedScope === 'external'
  const isGeneratingEmbed = loadingEmbed || loadingCourseEmbed
  const effectiveAllowAnonymous = isCourseQAAnonymousEnabled && allowAnonymous
  const hasValidExternalBlock =
    externalSource.trim().length > 0 &&
    externalSource.trim().length <= COURSE_QA_EXTERNAL_SOURCE_MAX_LENGTH &&
    externalRef.trim().length > 0 &&
    externalRef.trim().length <= COURSE_QA_EXTERNAL_REF_MAX_LENGTH

  useEffect(() => {
    if (isCourseQAAnonymousEnabled) return

    setAllowAnonymous(false)
  }, [isCourseQAAnonymousEnabled])

  useEffect(() => {
    if (!generatedEmbedInfo) return

    const intervalId = window.setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)

    return () => window.clearInterval(intervalId)
  }, [generatedEmbedInfo])

  useEffect(() => {
    setGeneratedEmbedInfo(null)
  }, [embedScope, externalSource, externalRef, allowAnonymous, expiresInHours])

  const formatDateTime = (value: string) =>
    formatter.dateTime(new Date(value), {
      dateStyle: 'medium',
      timeStyle: 'short',
    })
  const embedExpiryTimestamp = generatedEmbedInfo
    ? new Date(generatedEmbedInfo.expiresAt).getTime()
    : null
  const embedExpired =
    embedExpiryTimestamp !== null &&
    Number.isFinite(embedExpiryTimestamp) &&
    embedExpiryTimestamp < currentTime

  return (
    <details className="group rounded-lg border border-gray-200 bg-white p-4">
      <summary className="focus-visible:outline-primary-100 flex cursor-pointer list-none items-start justify-between gap-4 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">
        <div className="min-w-0">
          <H3 className={{ root: 'm-0' }}>
            {t('manage.course.embedLinkGenerator')}
          </H3>
          <div className="mt-2 text-sm text-gray-600">
            {isExternalEmbed
              ? t('manage.course.embedExternalBlockHelp')
              : t('manage.course.embedCourseHelp')}
          </div>
        </div>
        <FontAwesomeIcon
          icon={faChevronDown}
          className="mt-1 shrink-0 text-gray-500 group-open:rotate-180 motion-safe:transition-transform"
          aria-hidden="true"
        />
      </summary>

      <fieldset className="mt-4">
        <legend className="mb-1 block text-xs font-semibold text-gray-700">
          {t('manage.course.embedScope')}
        </legend>
        <div className="inline-flex rounded-md border border-gray-300 bg-gray-50 p-0.5">
          {(['external', 'course'] as const).map((scope) => (
            <label
              key={scope}
              className={`focus-within:ring-primary-100 cursor-pointer rounded px-3 py-1.5 text-sm focus-within:ring-2 ${
                embedScope === scope
                  ? 'bg-white font-semibold text-gray-900 shadow-sm'
                  : 'text-gray-600'
              }`}
              data-cy={`course-qa-embed-scope-${scope}`}
            >
              <input
                type="radio"
                name="embed-scope"
                value={scope}
                checked={embedScope === scope}
                onChange={() => setEmbedScope(scope)}
                className="sr-only"
              />
              {scope === 'course'
                ? t('manage.course.embedScopeCourse')
                : t('manage.course.embedScopeExternal')}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        {isExternalEmbed && (
          <>
            <div>
              <label
                className="mb-1 block text-xs font-semibold text-gray-700"
                htmlFor="embed-external-source"
              >
                {t('manage.course.embedExternalSource')}
              </label>
              <input
                id="embed-external-source"
                name="embed-external-source"
                type="text"
                maxLength={COURSE_QA_EXTERNAL_SOURCE_MAX_LENGTH}
                value={externalSource}
                onChange={(event) => setExternalSource(event.target.value)}
                autoComplete="off"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                placeholder={t('manage.course.embedExternalSourcePlaceholder')}
                data-cy="course-qa-external-source"
              />
            </div>

            <div>
              <label
                className="mb-1 block text-xs font-semibold text-gray-700"
                htmlFor="embed-external-ref"
              >
                {t('manage.course.embedExternalRef')}
              </label>
              <input
                id="embed-external-ref"
                name="embed-external-ref"
                type="text"
                maxLength={COURSE_QA_EXTERNAL_REF_MAX_LENGTH}
                value={externalRef}
                onChange={(event) => setExternalRef(event.target.value)}
                autoComplete="off"
                className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                placeholder={t('manage.course.embedExternalRefPlaceholder')}
                data-cy="course-qa-external-ref"
              />
            </div>
          </>
        )}

        <div>
          <label
            className="mb-1 block text-xs font-semibold text-gray-700"
            htmlFor="embed-token-lifetime"
          >
            {t('manage.course.tokenLifetime')}
          </label>
          <input
            id="embed-token-lifetime"
            name="embed-token-lifetime"
            type="number"
            min={1}
            max={336}
            value={expiresInHours}
            inputMode="numeric"
            autoComplete="off"
            onChange={(event) =>
              setExpiresInHours(
                Math.max(
                  1,
                  Math.min(336, Number.parseInt(event.target.value || '1', 10))
                )
              )
            }
            className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            data-cy="course-qa-expires-hours"
          />
        </div>

        <div className="flex items-end">
          <label
            className="inline-flex items-center gap-2 text-sm text-gray-700"
            htmlFor="embed-allow-anonymous"
          >
            <input
              id="embed-allow-anonymous"
              name="embed-allow-anonymous"
              type="checkbox"
              checked={effectiveAllowAnonymous}
              disabled={!isCourseQAAnonymousEnabled}
              onChange={(event) => setAllowAnonymous(event.target.checked)}
              data-cy="course-qa-allow-anonymous-embed"
            />
            {t('manage.course.allowAnonymousPosting')}
          </label>
        </div>
      </div>

      {!isCourseQAAnonymousEnabled && (
        <div className="mt-2 text-xs text-amber-700">
          {t('manage.course.allowAnonymousPostingDisabled')}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button
          primary
          loading={isGeneratingEmbed}
          disabled={
            (isExternalEmbed && !hasValidExternalBlock) || isGeneratingEmbed
          }
          onClick={async () => {
            try {
              const variables = {
                courseId,
                allowAnonymous: effectiveAllowAnonymous,
                expiresInHours,
              }
              const result = isExternalEmbed
                ? await generateEmbedInfo({
                    variables: {
                      ...variables,
                      externalBlock: {
                        externalSource: externalSource.trim(),
                        externalRef: externalRef.trim(),
                      },
                    },
                  })
                : await generateCourseEmbedInfo({ variables })

              if (!result.data?.getCourseDiscussionEmbeddingInfo?.embedUrl) {
                toast({
                  type: 'error',
                  message: t('manage.course.embedGenFailed'),
                })
                setGeneratedEmbedInfo(null)
                return
              }

              setCurrentTime(Date.now())
              setGeneratedEmbedInfo({
                embedUrl: result.data.getCourseDiscussionEmbeddingInfo.embedUrl,
                expiresAt:
                  result.data.getCourseDiscussionEmbeddingInfo.expiresAt,
              })
            } catch {
              toast({
                type: 'error',
                message: t('manage.course.embedGenFailed'),
              })
              setGeneratedEmbedInfo(null)
            }
          }}
          data={{ cy: 'course-qa-generate-embed' }}
        >
          <Button.Label>{t('manage.course.generateEmbedLink')}</Button.Label>
        </Button>

        <Button
          onClick={async () => {
            if (!generatedEmbedInfo?.embedUrl) return

            try {
              await navigator.clipboard.writeText(generatedEmbedInfo.embedUrl)
              toast({
                type: 'success',
                message: t('manage.course.embedCopied'),
              })
            } catch {
              toast({
                type: 'error',
                message: t('shared.generic.systemError'),
              })
            }
          }}
          disabled={!generatedEmbedInfo?.embedUrl || embedExpired}
          data={{ cy: 'course-qa-copy-embed' }}
        >
          <Button.Label>{t('manage.course.copyUrl')}</Button.Label>
        </Button>
      </div>

      {generatedEmbedInfo?.embedUrl && (
        <div className="mt-3 rounded-md border border-gray-200 bg-gray-50 p-2 text-xs">
          <div className="mb-1 font-semibold text-gray-700">
            {t('manage.course.embedUrl')}
          </div>
          {!embedExpired && (
            <div
              className="break-all text-gray-800"
              data-cy="course-qa-embed-url"
            >
              {generatedEmbedInfo.embedUrl}
            </div>
          )}
          <div className="mt-1 text-gray-600">
            {t('manage.course.expiresAt', {
              date: formatDateTime(generatedEmbedInfo.expiresAt),
            })}
          </div>
          {embedExpired && (
            <div className="mt-1 text-amber-700">
              {t('manage.course.embedExpiredRegenerate')}
            </div>
          )}
        </div>
      )}
    </details>
  )
}

export default CourseDiscussionEmbedGenerator
