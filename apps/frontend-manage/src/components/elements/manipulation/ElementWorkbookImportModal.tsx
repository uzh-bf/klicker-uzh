import { useApolloClient, useMutation } from '@apollo/client'
import {
  faCheck,
  faCircleCheck,
  faCircleInfo,
  faDownload,
  faFileExcel,
  faUpload,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementWorkbookImportAction,
  type ElementWorkbookIssue,
  type ElementWorkbookPreviewRow,
  GetElementWorkbookTemplateDocument,
  GetUserTagsDocument,
  ImportElementWorkbookDocument,
  PrepareElementWorkbookUploadDocument,
  PreviewElementWorkbookImportDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  downloadBase64Workbook,
  ELEMENT_WORKBOOK_MAX_BYTES,
  uploadWorkbookFile,
} from '@lib/elementWorkbookFiles'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { twMerge } from 'tailwind-merge'

type Step = 'upload' | 'review' | 'done'

const STEPS: Step[] = ['upload', 'review', 'done']

function Steps({ current }: { current: Step }) {
  const t = useTranslations()
  const labels = {
    upload: t('manage.elementWorkbook.stepUpload'),
    review: t('manage.elementWorkbook.stepReview'),
    done: t('manage.elementWorkbook.stepDone'),
  }
  const currentIndex = STEPS.indexOf(current)

  return (
    <ol className="flex gap-5 text-sm">
      {STEPS.map((step, index) => (
        <li
          key={step}
          className={twMerge(
            'flex items-center gap-1.5 text-slate-500',
            index === currentIndex && 'font-bold text-slate-900'
          )}
          aria-current={index === currentIndex ? 'step' : undefined}
        >
          <span
            className={twMerge(
              'flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-xs',
              index <= currentIndex && 'bg-primary-100 text-white'
            )}
          >
            {index < currentIndex ? (
              <FontAwesomeIcon icon={faCheck} />
            ) : (
              index + 1
            )}
          </span>
          {labels[step]}
        </li>
      ))}
    </ol>
  )
}

const ISSUE_CODES = [
  'WORKBOOK_TOO_LARGE',
  'INVALID_WORKBOOK',
  'UNSUPPORTED_WORKBOOK_CONTENT',
  'EMBEDDED_IMAGES_UNSUPPORTED',
  'MISSING_WORKSHEET',
  'UNEXPECTED_WORKSHEET',
  'INVALID_HEADERS',
  'UNEXPECTED_COLUMN',
  'UNSUPPORTED_CELL',
  'CELL_TOO_LONG',
  'REQUIRED_VALUE',
  'NAME_TOO_LONG',
  'INVALID_BOOLEAN',
  'INVALID_TAGS',
  'INVALID_ROW',
  'INVALID_NUMBER',
  'INVALID_MULTIPLIER',
  'INVALID_DISPLAY_MODE',
  'INVALID_VALUE',
  'KPRIM_FOUR_ANSWERS',
  'ORPHAN_CHOICE_DATA',
  'DISABLED_SOLUTION_DATA',
  'SC_ONE_CORRECT',
  'MC_CORRECT_REQUIRED',
  'AMBIGUOUS_SOLUTION',
  'EMPTY_WORKBOOK',
  'UPLOAD_NOT_FOUND',
  'RATE_LIMITED',
] as const

function issueCode(code: string) {
  return (ISSUE_CODES as readonly string[]).includes(code)
    ? (code as (typeof ISSUE_CODES)[number])
    : 'UNKNOWN'
}

function isRateLimited(error: unknown) {
  return error instanceof Error && error.message === 'RATE_LIMITED'
}

function IssueMessage({ issue }: { issue: ElementWorkbookIssue }) {
  const t = useTranslations()

  return (
    <UserNotification type="error" className={{ root: 'text-sm' }}>
      <div data-cy="element-workbook-error">
        {issue.sheet && issue.row && issue.column ? (
          <span className="font-bold">
            {t('manage.elementWorkbook.errorLocation', {
              sheet: issue.sheet,
              row: issue.row,
              column: issue.column,
            })}{' '}
          </span>
        ) : issue.sheet ? (
          <span className="font-bold">
            {t('manage.elementWorkbook.errorLocationSheet', {
              sheet: issue.sheet,
            })}{' '}
          </span>
        ) : null}
        {t(`manage.elementWorkbook.errors.${issueCode(issue.code)}`)}{' '}
        {t('manage.elementWorkbook.fixAndRetry')}
      </div>
    </UserNotification>
  )
}

function PreviewBadge({ row }: { row: ElementWorkbookPreviewRow }) {
  const t = useTranslations()
  if (row.action === ElementWorkbookImportAction.Create) {
    return (
      <span className="whitespace-nowrap rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">
        {t('manage.elementWorkbook.willBeCreated')}
      </span>
    )
  }
  if (row.action === ElementWorkbookImportAction.SkipExisting) {
    return (
      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">
        {t('manage.elementWorkbook.alreadyInLibrary', {
          name: row.existingElementName ?? `#${row.existingElementId}`,
        })}
      </span>
    )
  }
  return (
    <span className="whitespace-nowrap rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
      {t('manage.elementWorkbook.repeatedInFile', { row: row.firstRow ?? '' })}
    </span>
  )
}

interface ElementWorkbookImportModalProps {
  onClose: () => void
  refetchElements: () => void
}

function ElementWorkbookImportModal({
  onClose,
  refetchElements,
}: ElementWorkbookImportModalProps) {
  const t = useTranslations()
  const client = useApolloClient()
  const [step, setStep] = useState<Step>('upload')
  const [file, setFile] = useState<File | null>(null)
  // One upload per chosen file; preview and import refer to it by id.
  const [uploadId, setUploadId] = useState<string | null>(null)
  const [imagesToCopy, setImagesToCopy] = useState(0)
  const [fileError, setFileError] = useState<string | null>(null)
  const [issue, setIssue] = useState<ElementWorkbookIssue | null>(null)
  const [staleNotice, setStaleNotice] = useState(false)
  const [rows, setRows] = useState<ElementWorkbookPreviewRow[]>([])
  const [previewToken, setPreviewToken] = useState<string | null>(null)
  const [result, setResult] = useState<{
    created: number
    skipped: number
    images: number
  } | null>(null)
  const [downloadingTemplate, setDownloadingTemplate] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [prepareUpload] = useMutation(PrepareElementWorkbookUploadDocument)
  const [previewImport, { loading: previewing }] = useMutation(
    PreviewElementWorkbookImportDocument
  )
  const [importWorkbook, { loading: importing }] = useMutation(
    ImportElementWorkbookDocument,
    // Imports can create tags; the sidebar's tag filter has its own query.
    { refetchQueries: [{ query: GetUserTagsDocument }] }
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept: {
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [
        '.xlsx',
      ],
    },
    maxSize: ELEMENT_WORKBOOK_MAX_BYTES,
    onDrop: (accepted, rejected) => {
      setIssue(null)
      if (rejected.length > 0) {
        setFile(null)
        setFileError(
          rejected[0]?.errors.some((error) => error.code === 'file-too-large')
            ? t('manage.elementWorkbook.fileTooLarge')
            : t('manage.elementWorkbook.fileTypeInvalid')
        )
        return
      }
      setFileError(null)
      setFile(accepted[0] ?? null)
      setUploadId(null)
    },
  })

  async function downloadTemplate() {
    setDownloadingTemplate(true)
    try {
      const { data } = await client.query({
        query: GetElementWorkbookTemplateDocument,
        fetchPolicy: 'no-cache',
      })
      downloadBase64Workbook(
        data.elementWorkbookTemplate.filename,
        data.elementWorkbookTemplate.contentBase64
      )
    } catch {
      setFileError(t('manage.elementWorkbook.errors.UNKNOWN'))
    } finally {
      setDownloadingTemplate(false)
    }
  }

  async function runPreview(id: string) {
    const { data } = await previewImport({ variables: { uploadId: id } })
    const preview = data?.previewElementWorkbookImport
    if (!preview || preview.error || !preview.previewToken) {
      setIssue(preview?.error ?? { code: 'UNKNOWN' })
      setStep('upload')
      return
    }
    setRows(preview.rows)
    setImagesToCopy(preview.imagesToCopy)
    setPreviewToken(preview.previewToken)
    setStep('review')
  }

  async function checkFile() {
    if (!file) return
    setIssue(null)
    setStaleNotice(false)
    try {
      let id = uploadId
      if (!id) {
        setUploading(true)
        const { data } = await prepareUpload()
        const upload = data?.prepareElementWorkbookUpload
        if (!upload) throw new Error('Upload could not be prepared')
        await uploadWorkbookFile(upload.uploadUrl, file)
        id = upload.uploadId
        setUploadId(id)
      }
      await runPreview(id)
    } catch (error) {
      setIssue({ code: isRateLimited(error) ? 'RATE_LIMITED' : 'UNKNOWN' })
    } finally {
      setUploading(false)
    }
  }

  async function runImport() {
    if (!uploadId || !previewToken) return
    try {
      const { data } = await importWorkbook({
        variables: { uploadId, previewToken },
      })
      const imported = data?.importElementWorkbook
      if (imported?.error?.code === 'PREVIEW_STALE') {
        setStaleNotice(true)
        await runPreview(uploadId)
        return
      }
      if (!imported || imported.error) {
        setIssue(imported?.error ?? { code: 'UNKNOWN' })
        setStep('upload')
        return
      }
      setResult({
        created: imported.createdElementIds.length,
        skipped: imported.skippedCount,
        images: imagesToCopy,
      })
      setStep('done')
      refetchElements()
    } catch {
      setIssue({ code: 'UNKNOWN' })
      setStep('upload')
    }
  }

  const counts = {
    create: rows.filter((r) => r.action === ElementWorkbookImportAction.Create)
      .length,
    existing: rows.filter(
      (r) => r.action === ElementWorkbookImportAction.SkipExisting
    ).length,
    repeated: rows.filter(
      (r) => r.action === ElementWorkbookImportAction.SkipWorkbook
    ).length,
  }

  return (
    <Modal
      open
      onClose={importing ? () => undefined : onClose}
      title={t('manage.elementWorkbook.importTitle')}
      className={{ content: 'h-max w-[calc(100%-2rem)] md:w-180' }}
      dataCloseButton={{ cy: 'close-element-workbook-import' }}
    >
      <div className="flex flex-col gap-4" data-cy="element-workbook-import">
        <Steps current={step} />

        {step === 'upload' && (
          <>
            <div className="flex flex-col gap-3 rounded-md bg-slate-50 p-3 sm:flex-row sm:items-center">
              <FontAwesomeIcon
                icon={faFileExcel}
                className="text-primary-100 text-2xl"
              />
              <div className="flex-1 text-sm">
                <div className="font-bold">
                  1. {t('manage.elementWorkbook.templateTitle')}
                </div>
                <div className="text-slate-600">
                  {t('manage.elementWorkbook.templateDescription')}
                </div>
              </div>
              <Button
                onClick={() => void downloadTemplate()}
                disabled={downloadingTemplate}
                className={{ root: 'h-9' }}
                data={{ cy: 'element-workbook-download-template' }}
              >
                <Button.Icon icon={faDownload} />
                <Button.Label>
                  {t('manage.elementWorkbook.downloadTemplate')}
                </Button.Label>
              </Button>
            </div>

            <div
              {...getRootProps()}
              className={twMerge(
                'cursor-pointer rounded-md border-2 border-dashed border-slate-300 p-6 text-center text-sm hover:bg-slate-50',
                (file || isDragActive) && 'border-primary-100'
              )}
              data-cy="element-workbook-dropzone"
            >
              <input {...getInputProps()} data-cy="element-workbook-file" />
              <FontAwesomeIcon
                icon={file ? faFileExcel : faUpload}
                className={twMerge(
                  'text-2xl text-slate-500',
                  file && 'text-primary-100'
                )}
              />
              {file ? (
                <>
                  <div className="mt-1 font-bold">{file.name}</div>
                  <div className="text-slate-600">
                    {Math.max(1, Math.round(file.size / 1024))} KB ·{' '}
                    {t('manage.elementWorkbook.chooseAnotherFile')}
                  </div>
                </>
              ) : (
                <>
                  <div className="mt-1 font-bold">
                    2. {t('manage.elementWorkbook.dropTitle')}
                  </div>
                  <div className="text-slate-600">
                    {t('manage.elementWorkbook.dropDescription')}
                  </div>
                </>
              )}
            </div>

            {fileError && (
              <p className="text-sm text-red-600" role="alert">
                {fileError}
              </p>
            )}
            {issue && <IssueMessage issue={issue} />}
          </>
        )}

        {step === 'review' && (
          <>
            {staleNotice && (
              <UserNotification
                type="warning"
                className={{ root: 'text-sm' }}
                message={t('manage.elementWorkbook.previewStale')}
              />
            )}
            <div className="grid grid-cols-3 gap-2">
              {[
                [
                  counts.create,
                  t('manage.elementWorkbook.countCreate'),
                  'text-green-700',
                ],
                [
                  counts.existing,
                  t('manage.elementWorkbook.countExisting'),
                  'text-orange-700',
                ],
                [
                  counts.repeated,
                  t('manage.elementWorkbook.countRepeated'),
                  'text-slate-600',
                ],
              ].map(([count, label, color]) => (
                <div key={label} className="rounded-md bg-slate-50 px-3 py-2">
                  <div className={twMerge('text-xl font-bold', String(color))}>
                    {count}
                  </div>
                  <div className="text-xs text-slate-600">{label}</div>
                </div>
              ))}
            </div>
            <ul
              className="flex max-h-[45vh] flex-col gap-1.5 overflow-y-auto"
              data-cy="element-workbook-preview"
            >
              {rows.map((row) => (
                <li
                  key={`${row.sheet}-${row.row}`}
                  className="flex flex-col gap-1 rounded-md border border-slate-200 px-3 py-2 sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="w-36 shrink-0 text-xs text-slate-500">
                    {row.sheet} · {row.row}
                  </div>
                  <div
                    className={twMerge(
                      'min-w-0 flex-1 truncate text-sm',
                      row.action !== ElementWorkbookImportAction.Create &&
                        'text-slate-500'
                    )}
                  >
                    {row.name}
                  </div>
                  <PreviewBadge row={row} />
                </li>
              ))}
            </ul>
            <p className="flex gap-2 text-xs text-slate-600">
              <FontAwesomeIcon icon={faCircleInfo} className="mt-0.5" />
              {counts.create === 0
                ? t('manage.elementWorkbook.nothingToImport')
                : t('manage.elementWorkbook.reviewHint')}
            </p>
            {issue && <IssueMessage issue={issue} />}
          </>
        )}

        {step === 'done' && result && (
          <div className="flex flex-col items-center gap-1 py-4 text-center">
            <FontAwesomeIcon
              icon={faCircleCheck}
              className="text-4xl text-green-600"
            />
            <div className="mt-1 text-base font-bold">
              {t('manage.elementWorkbook.importedTitle', {
                count: result.created,
              })}
            </div>
            <div className="text-sm text-slate-600">
              {t('manage.elementWorkbook.importedDescription', {
                skipped: result.skipped,
              })}
            </div>
            {result.images > 0 && (
              <div
                className="text-sm text-slate-600"
                data-cy="element-workbook-images"
              >
                {t('manage.elementWorkbook.imagesAdded', {
                  count: result.images,
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          {step === 'upload' && (
            <>
              <Button onClick={onClose} className={{ root: 'h-9' }}>
                {t('shared.generic.cancel')}
              </Button>
              <Button
                primary
                disabled={!file || uploading || previewing}
                onClick={() => void checkFile()}
                className={{ root: 'h-9' }}
                data={{ cy: 'element-workbook-check' }}
              >
                {uploading
                  ? t('manage.elementWorkbook.uploading')
                  : previewing
                    ? t('manage.elementWorkbook.checking')
                    : t('manage.elementWorkbook.checkFile')}
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <Button
                onClick={() => setStep('upload')}
                disabled={importing}
                className={{ root: 'h-9' }}
              >
                {t('shared.generic.back')}
              </Button>
              <Button
                primary
                disabled={importing || previewing || counts.create === 0}
                onClick={() => void runImport()}
                className={{ root: 'h-9' }}
                data={{ cy: 'element-workbook-import-confirm' }}
              >
                {importing
                  ? t('manage.elementWorkbook.importing')
                  : t('manage.elementWorkbook.importButton', {
                      count: counts.create,
                    })}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button
              primary
              onClick={onClose}
              className={{ root: 'h-9' }}
              data={{ cy: 'element-workbook-done' }}
            >
              {t('manage.elementWorkbook.showElements')}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default ElementWorkbookImportModal
