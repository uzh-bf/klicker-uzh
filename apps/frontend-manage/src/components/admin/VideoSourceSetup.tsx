import { useLazyQuery, useMutation, useQuery } from '@apollo/client'
import {
  CreateVideoSourceDocument,
  KbVideoCutMode,
  RequestVideoSourceApprovalDocument,
  ResolveVideoSourceDocument,
  VideoSourceProviderConfiguredDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  SelectField,
  TextField,
  UserNotification,
} from '@uzh-bf/design-system'
import { useFormatter, useTranslations } from 'next-intl'
import { useState } from 'react'

// Accepts a knowledge base id or a Manage link to it.
function knowledgeBaseId(value: string): string {
  const trimmed = value.trim()
  return /knowledgeBases\/([^/?#]+)/.exec(trimmed)?.[1] ?? trimmed
}

// One recipient per line: "Name <email>" or just the email.
export function parseRecipientLines(
  value: string
): Array<{ name: string; email: string }> {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = /^(.*?)\s*<([^>]+)>$/.exec(line)
      const email = (match?.[2] ?? line).trim()
      return { name: match?.[1]?.trim() || email, email }
    })
}

// Admin flow for adding a lecture video source: paste the recordings link and
// the course directory link, check what the course-sources provider resolved,
// pick the proposed collection, then create the source and email the
// lecturers their approval links. Without a provider the admin enters the
// course, the period, the recipients and the category id by hand.
function VideoSourceSetup() {
  const t = useTranslations()
  const format = useFormatter()

  const { data: providerData, loading: providerLoading } = useQuery(
    VideoSourceProviderConfiguredDocument
  )
  const manualMode =
    !providerLoading && providerData?.videoSourceProviderConfigured === false

  const [kb, setKb] = useState('')
  const [sourceUrl, setSourceUrl] = useState('')
  const [directoryUrl, setDirectoryUrl] = useState('')
  const [period, setPeriod] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [name, setName] = useState('')
  const [cutMode, setCutMode] = useState<KbVideoCutMode>(KbVideoCutMode.Clip)
  const [namePattern, setNamePattern] = useState('')
  const [captionLanguage, setCaptionLanguage] = useState('de')
  // Manual mode only.
  const [courseTitle, setCourseTitle] = useState('')
  const [courseShortName, setCourseShortName] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [recipientLines, setRecipientLines] = useState('')

  const [resolve, { data, loading: resolving, error: resolveError }] =
    useLazyQuery(ResolveVideoSourceDocument, { fetchPolicy: 'network-only' })
  const [createSource, { loading: creating, error: createError }] = useMutation(
    CreateVideoSourceDocument
  )
  const [requestApproval, { data: sent, loading: sending, error: sendError }] =
    useMutation(RequestVideoSourceApprovalDocument)

  const resolution = data?.resolveVideoSource
  const date = (value: string | Date | null | undefined) =>
    value
      ? format.dateTime(new Date(value), {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })
      : '–'

  const lookUp = () => {
    resolve({
      variables: {
        sourceUrl: sourceUrl.trim(),
        directoryUrl: directoryUrl.trim(),
        period: period.trim() || null,
      },
    })
      .then(({ data: result }) => {
        const res = result?.resolveVideoSource
        const proposed =
          res?.collections.find((c) => c.recommended) ??
          (res?.collections.length === 1 ? res.collections[0] : undefined)
        setCategoryId(res?.fixedCollectionId ?? proposed?.id ?? '')
        if (res?.directory && !name.trim()) {
          setName(`${res.directory.shortName} ${res.directory.title}`.trim())
        }
      })
      .catch(() => undefined)
  }

  const manualRecipients = parseRecipientLines(recipientLines)
  // A date input yields midnight UTC of that day; the period ends after it.
  const manualPeriodEnd = periodEnd
    ? new Date(new Date(`${periodEnd}T00:00:00Z`).getTime() + 86_400_000)
    : null

  const createAndSend = () => {
    createSource({
      variables: {
        kbId: knowledgeBaseId(kb),
        name: name.trim(),
        sourceUrl: sourceUrl.trim(),
        directoryUrl: directoryUrl.trim(),
        kalturaCategoryId: categoryId.trim(),
        cutMode,
        namePattern:
          cutMode === KbVideoCutMode.Edited ? namePattern.trim() : null,
        captionLanguage: captionLanguage.trim(),
      },
    })
      .then(({ data: created }) => {
        const sourceId = created?.createVideoSource?.id
        if (!sourceId) return
        return requestApproval({
          variables: manualMode
            ? {
                sourceId,
                manual: {
                  courseTitle: courseTitle.trim(),
                  courseShortName: courseShortName.trim() || null,
                  periodLabel: period.trim(),
                  periodEnd: manualPeriodEnd,
                },
                additionalRecipients: manualRecipients,
              }
            : { sourceId, period: resolution?.periodLabel ?? null },
        })
      })
      .catch(() => undefined)
  }

  const canLookUp = Boolean(sourceUrl.trim() && directoryUrl.trim())
  const ready = manualMode
    ? Boolean(
        canLookUp &&
          courseTitle.trim() &&
          period.trim() &&
          manualPeriodEnd &&
          manualRecipients.length > 0
      )
    : Boolean(resolution?.directory)
  const canCreate =
    ready &&
    Boolean(
      knowledgeBaseId(kb) &&
        name.trim() &&
        /^\d+$/.test(categoryId.trim()) &&
        captionLanguage.trim()
    ) &&
    (cutMode !== KbVideoCutMode.Edited || Boolean(namePattern.trim()))
  const mutationError = createError ?? sendError
  const showDetails = manualMode || Boolean(resolution)

  return (
    <div className="flex flex-col gap-4" data-cy="video-source-setup">
      <p className="text-sm text-gray-600">
        {t('manage.admin.videoSourceDescription')}
      </p>
      {manualMode && (
        <UserNotification type="info" data={{ cy: 'video-source-manual' }}>
          {t('manage.admin.videoSourceManualMode')}
        </UserNotification>
      )}

      <div className="flex flex-col gap-2">
        <TextField
          label={t('manage.admin.videoSourceKb')}
          value={kb}
          onChange={(value: string) => setKb(value)}
          data={{ cy: 'video-source-kb' }}
        />
        <TextField
          label={t('manage.admin.videoSourceUrl')}
          placeholder="https://…"
          value={sourceUrl}
          onChange={(value: string) => setSourceUrl(value)}
          data={{ cy: 'video-source-url' }}
        />
        <TextField
          label={t('manage.admin.videoSourceDirectoryUrl')}
          placeholder="https://…"
          value={directoryUrl}
          onChange={(value: string) => setDirectoryUrl(value)}
          data={{ cy: 'video-source-directory-url' }}
        />
        <TextField
          label={t('manage.admin.videoSourcePeriod')}
          placeholder="HS26"
          value={period}
          onChange={(value: string) => setPeriod(value)}
          data={{ cy: 'video-source-period' }}
        />
        {!manualMode && (
          <div>
            <Button
              disabled={!canLookUp || resolving || providerLoading}
              loading={resolving}
              onClick={lookUp}
              data={{ cy: 'video-source-resolve' }}
            >
              {t('manage.admin.videoSourceResolve')}
            </Button>
          </div>
        )}
      </div>

      {resolveError && (
        <UserNotification type="error">{resolveError.message}</UserNotification>
      )}

      {manualMode && (
        <section className="flex flex-col gap-2 rounded border p-3">
          <TextField
            label={t('manage.admin.videoSourceCourseTitle')}
            value={courseTitle}
            onChange={(value: string) => setCourseTitle(value)}
            data={{ cy: 'video-source-course-title' }}
          />
          <TextField
            label={t('manage.admin.videoSourceCourseShortName')}
            value={courseShortName}
            onChange={(value: string) => setCourseShortName(value)}
          />
          <label className="flex flex-col gap-1 text-sm font-bold">
            {t('manage.admin.videoSourcePeriodEnd')}
            <input
              type="date"
              className="rounded border px-2 py-1 font-normal"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              data-cy="video-source-period-end"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm font-bold">
            {t('manage.admin.videoSourceRecipientLines')}
            <textarea
              className="min-h-24 rounded border px-2 py-1 font-normal"
              placeholder="Ada Example <ada@example.org>"
              value={recipientLines}
              onChange={(e) => setRecipientLines(e.target.value)}
              data-cy="video-source-recipients"
            />
          </label>
          <TextField
            label={t('manage.admin.videoSourceCategoryId')}
            value={categoryId}
            onChange={(value: string) => setCategoryId(value)}
            data={{ cy: 'video-source-category-id' }}
          />
        </section>
      )}

      {resolution && (
        <section className="flex flex-col gap-2 rounded border p-3">
          <h3 className="font-bold">
            {t('manage.admin.videoSourceDirectory', {
              period: resolution.periodLabel,
            })}
          </h3>
          {resolution.directoryError && (
            <UserNotification type="error">
              {resolution.directoryError}
            </UserNotification>
          )}
          {resolution.directory && (
            <>
              <div>
                {resolution.directory.title} ({resolution.directory.shortName})
              </div>
              <div className="text-sm">
                {t('manage.admin.videoSourceRecipients')}
              </div>
              <ul className="list-disc pl-5 text-sm">
                {resolution.directory.recipients.map((r) => (
                  <li key={r.email}>
                    {r.name} &lt;{r.email}&gt; · {r.roles.join(', ')}
                  </li>
                ))}
              </ul>
              {resolution.directory.withoutEmail.length > 0 && (
                <UserNotification type="warning">
                  {t('manage.admin.videoSourceWithoutEmail', {
                    names: resolution.directory.withoutEmail.join(', '),
                  })}
                </UserNotification>
              )}
              {resolution.directory.warnings.map((w) => (
                <UserNotification key={w} type="warning">
                  {w}
                </UserNotification>
              ))}
            </>
          )}
        </section>
      )}

      {resolution && (
        <section className="flex flex-col gap-2 rounded border p-3">
          <h3 className="font-bold">
            {t('manage.admin.videoSourceCategories')}
          </h3>
          {resolution.externalRef && (
            <div className="text-sm text-gray-600">
              {t('manage.admin.videoSourceLinkKind', {
                kind: resolution.sourceKind,
                ref: resolution.externalRef,
              })}
            </div>
          )}
          {resolution.collectionsError && (
            <UserNotification type="warning">
              {resolution.collectionsError}
            </UserNotification>
          )}
          {resolution.collections.map((c) => (
            <label
              key={c.id}
              className="flex cursor-pointer gap-3 rounded border p-2 has-[:checked]:border-primary-100"
              data-cy={`video-source-candidate-${c.id}`}
            >
              <input
                type="radio"
                name="video-source-category"
                checked={categoryId === c.id}
                onChange={() => setCategoryId(c.id)}
              />
              <div className="flex flex-col text-sm">
                <span className="font-bold">
                  {c.name} · {c.id}
                  {c.recommended &&
                    ` · ${t('manage.admin.videoSourceRecommended')}`}
                </span>
                <span>
                  {t('manage.admin.videoSourceCandidateStats', {
                    created: date(c.createdAt),
                    entries: c.entriesCount,
                    inPeriod: c.recordingsInPeriod,
                  })}
                </span>
                <span>
                  {t('manage.admin.videoSourceLatest', {
                    name: c.latestRecordingName ?? '–',
                    date: date(c.latestRecordingAt),
                  })}
                </span>
                {c.sampleRecordingNames.length > 0 && (
                  <span className="text-gray-600">
                    {c.sampleRecordingNames.join(' · ')}
                  </span>
                )}
              </div>
            </label>
          ))}
          <TextField
            label={t('manage.admin.videoSourceCategoryId')}
            value={categoryId}
            disabled={Boolean(resolution.fixedCollectionId)}
            onChange={(value: string) => setCategoryId(value)}
            data={{ cy: 'video-source-category-id' }}
          />
          <p className="text-xs text-gray-600">
            {t('manage.admin.videoSourceConfirmHint')}
          </p>
        </section>
      )}

      {showDetails && (
        <section className="flex flex-col gap-2 rounded border p-3">
          <TextField
            label={t('manage.admin.videoSourceName')}
            value={name}
            onChange={(value: string) => setName(value)}
            data={{ cy: 'video-source-name' }}
          />
          <SelectField
            label={t('manage.admin.videoSourceCutMode')}
            value={cutMode}
            onChange={(value) => setCutMode(value as KbVideoCutMode)}
            items={[
              KbVideoCutMode.Clip,
              KbVideoCutMode.Edited,
              KbVideoCutMode.AsRecorded,
            ].map((mode) => ({
              value: mode,
              label: t(`manage.videoApproval.cutMode${mode}`),
            }))}
          />
          {cutMode === KbVideoCutMode.Edited && (
            <TextField
              label={t('manage.admin.videoSourceNamePattern')}
              placeholder="^\d{2}[a-z]?_"
              value={namePattern}
              onChange={(value: string) => setNamePattern(value)}
            />
          )}
          <TextField
            label={t('manage.admin.videoSourceCaptionLanguage')}
            value={captionLanguage}
            onChange={(value: string) => setCaptionLanguage(value)}
          />
          {mutationError && (
            <UserNotification type="error">
              {mutationError.message}
            </UserNotification>
          )}
          {sent?.requestVideoSourceApproval ? (
            <UserNotification type="success" data={{ cy: 'video-source-sent' }}>
              {t('manage.admin.videoSourceSent', {
                count: sent.requestVideoSourceApproval.recipients.filter(
                  (r) => r.sent
                ).length,
                period: sent.requestVideoSourceApproval.periodLabel,
              })}
            </UserNotification>
          ) : (
            <div>
              <Button
                disabled={!canCreate || creating || sending}
                loading={creating || sending}
                onClick={createAndSend}
                className={{ root: 'bg-primary-100 text-white' }}
                data={{ cy: 'video-source-create' }}
              >
                {t('manage.admin.videoSourceCreate')}
              </Button>
            </div>
          )}
        </section>
      )}
    </div>
  )
}

export default VideoSourceSetup
