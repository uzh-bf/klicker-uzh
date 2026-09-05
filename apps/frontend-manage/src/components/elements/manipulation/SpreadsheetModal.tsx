import { useApolloClient } from '@apollo/client'
import {
  GetElementSpreadsheetDocument,
  ImportElementSpreadsheetDocument,
  PrepareElementSpreadsheetUploadDocument,
  ValidateElementSpreadsheetDocument,
  type ValidateElementSpreadsheetMutation,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { createElementImportReviewModel } from '~/lib/elementImportPreview'
import ImportedElementsOverviewTable from '../details/ImportedElementsOverviewTable'

type Preview = NonNullable<
  ValidateElementSpreadsheetMutation['validateElementSpreadsheet']
>

const issueMessages = {
  SOURCE_IMAGE_DEPENDENCY: 'spreadsheetImageDependency',
  TIMER_NOT_IMPORTED: 'spreadsheetTimerOmitted',
  KAHOOT_IMAGES_NOT_IMPORTED: 'spreadsheetImagesOmitted',
  INVALID_ORDER: 'spreadsheetInvalidOrder',
  DUPLICATE_REFERENCE: 'spreadsheetDuplicateRef',
  UNKNOWN_REFERENCE: 'spreadsheetUnknownRef',
  DISABLED_SOLUTION_DATA: 'spreadsheetDisabledSolution',
  AMBIGUOUS_SOLUTION: 'spreadsheetAmbiguousSolution',
  INVALID_IMAGE_URL: 'spreadsheetInvalidImage',
  UNSUPPORTED_CELL: 'spreadsheetUnsupportedCell',
} as const

function SpreadsheetModal({
  selectedElementIds,
  onClose,
  refetchElements,
}: {
  selectedElementIds: number[]
  onClose: () => void
  refetchElements: () => Promise<void>
}) {
  const t = useTranslations('manage.elements')
  const client = useApolloClient()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const mounted = useRef(true)
  const abort = useRef<AbortController | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const issues = useMemo(
    () => [
      ...new Map(
        preview?.issues.map((issue) => [
          `${issue.sheet}:${issue.row}:${issue.field}:${issue.code}`,
          issue,
        ])
      ).entries(),
    ],
    [preview]
  )
  const sources = useMemo(
    () => new Map(preview?.sources.map((source) => [source.ref, source])),
    [preview]
  )
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    importedElements: number
    skippedElementRefs: string[]
  } | null>(null)
  const review = useMemo(
    () =>
      preview?.importToken
        ? createElementImportReviewModel({
            elements: preview.elements,
            answerCollections: preview.answerCollections,
            importToken: preview.importToken,
            warnings: [],
            errors: [],
          })
        : null,
    [preview]
  )
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      abort.current?.abort()
    }
  }, [])
  useEffect(() => {
    if (!busy) return
    const state = window.history.state
    const url = window.location.href
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', beforeUnload)
    router.beforePopState(() => {
      window.history.pushState(state, '', url)
      return false
    })
    return () => {
      window.removeEventListener('beforeunload', beforeUnload)
      router.beforePopState(() => true)
    }
  }, [busy, router])
  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch {
      if (mounted.current) setError(t('spreadsheetFailure'))
    } finally {
      busyRef.current = false
      if (mounted.current) setBusy(false)
    }
  }
  const download = (ids: number[]) =>
    run(async () => {
      const response = await client.query({
        query: GetElementSpreadsheetDocument,
        variables: { elementIds: ids },
        fetchPolicy: 'no-cache',
      })
      const file = response.data.getElementSpreadsheet
      if (!file || !mounted.current) return
      const bytes = Uint8Array.from(atob(file.base64), (value) =>
        value.charCodeAt(0)
      )
      const href = URL.createObjectURL(
        new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        })
      )
      try {
        const link = document.createElement('a')
        link.href = href
        link.download = file.filename
        link.click()
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(href), 1000)
      }
    })
  const upload = (file: File) =>
    run(async () => {
      setResult(null)
      setPreview(null)
      if (
        !file.name.toLowerCase().endsWith('.xlsx') ||
        file.size === 0 ||
        file.size > 5 * 1024 * 1024
      ) {
        setError(t('spreadsheetFileRequirements'))
        return
      }
      const controller = new AbortController()
      abort.current = controller
      const context = { fetchOptions: { signal: controller.signal } }
      const prepared = await client.mutate({
        mutation: PrepareElementSpreadsheetUploadDocument,
        variables: { filename: file.name, bytes: file.size },
        context,
      })
      const target = prepared.data?.prepareElementSpreadsheetUpload
      if (!target) throw new Error('UPLOAD_FAILED')
      const response = await fetch(target.uploadURL, {
        method: 'PUT',
        credentials: 'include',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/zip',
          'x-klicker-import-upload-capability': target.uploadCapability,
        },
        body: file,
      })
      if (!response.ok) throw new Error('UPLOAD_FAILED')
      const validated = await client.mutate({
        mutation: ValidateElementSpreadsheetDocument,
        variables: { artifactId: target.artifactId },
        context,
      })
      if (!validated.data?.validateElementSpreadsheet)
        throw new Error('VALIDATION_FAILED')
      if (mounted.current) setPreview(validated.data.validateElementSpreadsheet)
    })
  const importElements = (refs: string[]) =>
    run(async () => {
      if (!preview?.importToken) return
      const response = await client.mutate({
        mutation: ImportElementSpreadsheetDocument,
        variables: {
          importToken: preview.importToken,
          selectedElementRefs: refs,
        },
      })
      if (!response.data?.importElementSpreadsheet)
        throw new Error('IMPORT_FAILED')
      if (mounted.current) setResult(response.data.importElementSpreadsheet)
      try {
        await refetchElements()
      } catch {
        /* Retain the completed result; a refresh must not prompt another import. */
      }
    })
  return (
    <Modal
      open
      title={t('spreadsheetTitle')}
      onClose={() => {
        if (!busyRef.current) onClose()
      }}
      escapeDisabled={busy}
      hideCloseButton={busy}
      className={{
        content:
          'max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] overflow-y-auto xl:w-300',
      }}
      dataContent={{ cy: 'element-spreadsheet-modal' }}
    >
      <div className="flex flex-col gap-4" aria-busy={busy}>
        <p>{t('spreadsheetInfo')}</p>
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={busy}
            onClick={() => void download([])}
            data={{ cy: 'spreadsheet-template' }}
          >
            <Button.Label>{t('spreadsheetTemplate')}</Button.Label>
          </Button>
          <Button
            disabled={busy || selectedElementIds.length === 0}
            onClick={() => void download(selectedElementIds)}
            data={{ cy: 'spreadsheet-export' }}
          >
            <Button.Label>{t('spreadsheetExport')}</Button.Label>
          </Button>
          <a
            className="self-center underline"
            href="https://support.kahoot.com/hc/en-us/articles/115002812547-How-to-import-questions-from-a-spreadsheet-to-your-kahoot"
            target="_blank"
            rel="noreferrer"
          >
            {t('spreadsheetKahootTemplate')}
          </a>
        </div>
        <label className="flex flex-col gap-2">
          {t('spreadsheetUpload')}
          <input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            disabled={busy}
            data-cy="spreadsheet-upload"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) void upload(file)
            }}
          />
        </label>
        <p role="status" aria-live="polite">
          {busy ? t('spreadsheetWorking') : ''}
        </p>
        {error && <UserNotification type="error" message={error} />}
        {preview && (
          <>
            <UserNotification
              type="info"
              message={t('spreadsheetDuplicatePolicy')}
            />
            {preview.issues.length > 0 && (
              <div
                className="max-h-48 overflow-auto"
                data-cy="spreadsheet-issues"
              >
                <p>{t('spreadsheetIssues')}</p>
                <ul className="list-disc pl-6">
                  {issues.map(([key, issue]) => (
                    <li key={key}>
                      {issue.sheet}, {t('spreadsheetRow', { row: issue.row })}
                      {issue.field ? ` (${issue.field})` : ''}:{' '}
                      {t(
                        issueMessages[
                          issue.code as keyof typeof issueMessages
                        ] ?? 'spreadsheetInvalidRow'
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {result ? (
              <div role="status" data-cy="spreadsheet-result">
                <p>
                  {t('spreadsheetImported', { count: result.importedElements })}
                </p>
                {result.skippedElementRefs.length > 0 && (
                  <>
                    <p>{t('spreadsheetSkipped')}</p>
                    <ul className="list-disc pl-6">
                      {result.skippedElementRefs.map((ref) => {
                        const source = sources.get(ref)
                        return (
                          <li key={ref}>
                            {source
                              ? `${source.name} — ${source.sheet}, ${t('spreadsheetRow', { row: source.row })}`
                              : ref}
                          </li>
                        )
                      })}
                    </ul>
                  </>
                )}
              </div>
            ) : review ? (
              <ImportedElementsOverviewTable
                elements={review.elements}
                elementMeta={review.elementMeta}
                answerCollectionEntries={review.answerCollectionEntries}
                answerCollectionsForOverview={review.answerCollections}
                importing={busy}
                commitError={null}
                onImport={importElements}
                duplicatePolicy="skip"
              />
            ) : (
              <p>{t('spreadsheetNoValidElements')}</p>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

export default SpreadsheetModal
