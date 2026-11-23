import { useLazyQuery, useMutation } from '@apollo/client'
import {
  CreateVideoSourceDocument,
  KbVideoCutMode,
  KbVideoSourceKind,
  RequestVideoSourceApprovalDocument,
  ResolveVideoSourceDocument,
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

// Admin flow for adding a lecture video source: paste the recordings link and
// the VVZ link, check what was resolved, pick the proposed Kaltura category,
// then create the source and email the lecturers their approval links.
function VideoSourceSetup() {
  const t = useTranslations()
  const format = useFormatter()

  const [kb, setKb] = useState('')
  const [sourceKind, setSourceKind] = useState<KbVideoSourceKind>(
    KbVideoSourceKind.OlatNode
  )
  const [sourceUrl, setSourceUrl] = useState('')
  const [catalogUrl, setCatalogUrl] = useState('')
  const [semester, setSemester] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [name, setName] = useState('')
  const [cutMode, setCutMode] = useState<KbVideoCutMode>(KbVideoCutMode.Clip)
  const [namePattern, setNamePattern] = useState('')
  const [captionLanguage, setCaptionLanguage] = useState('de')

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
        sourceKind,
        sourceUrl: sourceUrl.trim(),
        catalogUrl: catalogUrl.trim(),
        semester: semester.trim() || null,
      },
    })
      .then(({ data: result }) => {
        const res = result?.resolveVideoSource
        const proposed =
          res?.candidates.find((c) => c.recommended) ??
          (res?.candidates.length === 1 ? res.candidates[0] : undefined)
        setCategoryId(proposed?.categoryId ?? '')
        if (res?.catalog && !name.trim()) {
          setName(`${res.catalog.shortName} ${res.catalog.title}`.trim())
        }
      })
      .catch(() => undefined)
  }

  const createAndSend = () => {
    createSource({
      variables: {
        kbId: knowledgeBaseId(kb),
        name: name.trim(),
        sourceKind,
        sourceUrl: sourceUrl.trim(),
        catalogUrl: catalogUrl.trim(),
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
          variables: {
            sourceId,
            semester: resolution?.semesterLabel ?? null,
          },
        })
      })
      .catch(() => undefined)
  }

  const canLookUp = Boolean(sourceUrl.trim() && catalogUrl.trim())
  const canCreate =
    Boolean(
      resolution?.catalog &&
        knowledgeBaseId(kb) &&
        name.trim() &&
        /^\d+$/.test(categoryId.trim()) &&
        captionLanguage.trim()
    ) &&
    (cutMode !== KbVideoCutMode.Edited || Boolean(namePattern.trim()))
  const mutationError = createError ?? sendError

  return (
    <div className="flex flex-col gap-4" data-cy="video-source-setup">
      <p className="text-sm text-gray-600">
        {t('manage.admin.videoSourceDescription')}
      </p>

      <div className="flex flex-col gap-2">
        <TextField
          label={t('manage.admin.videoSourceKb')}
          value={kb}
          onChange={(value: string) => setKb(value)}
          data={{ cy: 'video-source-kb' }}
        />
        <SelectField
          label={t('manage.admin.videoSourceKind')}
          value={sourceKind}
          onChange={(value) => setSourceKind(value as KbVideoSourceKind)}
          items={[
            {
              value: KbVideoSourceKind.OlatNode,
              label: t('manage.admin.videoSourceKindOLAT_NODE'),
            },
            {
              value: KbVideoSourceKind.KalturaChannel,
              label: t('manage.admin.videoSourceKindKALTURA_CHANNEL'),
            },
          ]}
        />
        <TextField
          label={t('manage.admin.videoSourceUrl')}
          placeholder={
            sourceKind === KbVideoSourceKind.OlatNode
              ? 'https://lms.uzh.ch/auth/RepositoryEntry/…/CourseNode/…'
              : 'https://uzh.mediaspace.cast.switch.ch/channel/…/…'
          }
          value={sourceUrl}
          onChange={(value: string) => setSourceUrl(value)}
          data={{ cy: 'video-source-url' }}
        />
        <TextField
          label={t('manage.admin.videoSourceCatalogUrl')}
          placeholder="https://courses.uzh.ch/#/details/…"
          value={catalogUrl}
          onChange={(value: string) => setCatalogUrl(value)}
          data={{ cy: 'video-source-catalog-url' }}
        />
        <TextField
          label={t('manage.admin.videoSourceSemester')}
          placeholder="HS26"
          value={semester}
          onChange={(value: string) => setSemester(value)}
        />
        <div>
          <Button
            disabled={!canLookUp || resolving}
            loading={resolving}
            onClick={lookUp}
            data={{ cy: 'video-source-resolve' }}
          >
            {t('manage.admin.videoSourceResolve')}
          </Button>
        </div>
      </div>

      {resolveError && (
        <UserNotification type="error">{resolveError.message}</UserNotification>
      )}

      {resolution && (
        <section className="flex flex-col gap-2 rounded border p-3">
          <h3 className="font-bold">
            {t('manage.admin.videoSourceCatalog', {
              semester: resolution.semesterLabel,
            })}
          </h3>
          {resolution.catalogError && (
            <UserNotification type="error">
              {resolution.catalogError}
            </UserNotification>
          )}
          {resolution.catalog && (
            <>
              <div>
                {resolution.catalog.title} ({resolution.catalog.shortName})
              </div>
              <div className="text-sm">
                {t('manage.admin.videoSourceRecipients')}
              </div>
              <ul className="list-disc pl-5 text-sm">
                {resolution.catalog.recipients.map((r) => (
                  <li key={r.email}>
                    {r.name} &lt;{r.email}&gt; · {r.roles.join(', ')}
                  </li>
                ))}
              </ul>
              {resolution.catalog.withoutEmail.length > 0 && (
                <UserNotification type="warning">
                  {t('manage.admin.videoSourceWithoutEmail', {
                    names: resolution.catalog.withoutEmail.join(', '),
                  })}
                </UserNotification>
              )}
              {resolution.catalog.warnings.map((w) => (
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
          {resolution.olatNodeId && (
            <div className="text-sm text-gray-600">
              {t('manage.admin.videoSourceNode', {
                node: resolution.olatNodeId,
              })}
            </div>
          )}
          {resolution.kalturaError && (
            <UserNotification type="warning">
              {resolution.kalturaError}
            </UserNotification>
          )}
          {resolution.candidates.map((c) => (
            <label
              key={c.categoryId}
              className="flex cursor-pointer gap-3 rounded border p-2 has-[:checked]:border-primary-100"
              data-cy={`video-source-candidate-${c.categoryId}`}
            >
              <input
                type="radio"
                name="video-source-category"
                checked={categoryId === c.categoryId}
                onChange={() => setCategoryId(c.categoryId)}
              />
              <div className="flex flex-col text-sm">
                <span className="font-bold">
                  {c.name} · {c.categoryId}
                  {c.recommended &&
                    ` · ${t('manage.admin.videoSourceRecommended')}`}
                </span>
                <span>
                  {t('manage.admin.videoSourceCandidateStats', {
                    created: date(c.createdAt),
                    entries: c.entriesCount,
                    inSemester: c.recordingsInSemester,
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
            onChange={(value: string) => setCategoryId(value)}
            data={{ cy: 'video-source-category-id' }}
          />
          <p className="text-xs text-gray-600">
            {t('manage.admin.videoSourceConfirmHint')}
          </p>
        </section>
      )}

      {resolution && (
        <section className="flex flex-col gap-2 rounded border p-3">
          <TextField
            label={t('manage.admin.videoSourceName')}
            value={name}
            onChange={(value: string) => setName(value)}
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
                semester: sent.requestVideoSourceApproval.semester,
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
