import { useMutation } from '@apollo/client'
import {
  faDownload,
  faFileCsv,
  faUpload,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AssessmentParticipantInvitationImportStatus,
  type AssessmentParticipantInvitationInput,
  CreateAssessmentParticipantInvitationsDocument,
  type CreateAssessmentParticipantInvitationsMutation,
  GetAssessmentParticipantInvitationPageDocument,
  type GetAssessmentParticipantInvitationPageQueryVariables,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H2, toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { type ChangeEvent, useRef, useState } from 'react'

type ImportResult = NonNullable<
  CreateAssessmentParticipantInvitationsMutation['createAssessmentParticipantInvitations']
>

const MATRICULATION_NUMBER_HEADERS = new Set([
  'matriculationnumber',
  'matriculation',
  'matriculationno',
  'matriculationnr',
  'matrikelnummer',
  'studiid',
])
const CSV_TEMPLATE_FILENAME = 'assessment-participant-invitations-template.csv'
const CSV_TEMPLATE_CONTENT = 'email,matriculationNumber\r\n'
const MAX_INVITATION_ROWS = 200
const MAX_CSV_FILE_SIZE_BYTES = 1024 * 1024

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function detectDelimiter(csvText: string) {
  const headerLine = csvText.replace(/^\uFEFF/, '').split(/\r?\n/, 1)[0] ?? ''
  let isQuoted = false
  let commas = 0
  let semicolons = 0

  for (let index = 0; index < headerLine.length; index++) {
    const character = headerLine[index]
    if (character === '"') {
      if (isQuoted && headerLine[index + 1] === '"') {
        index++
      } else {
        isQuoted = !isQuoted
      }
    } else if (!isQuoted && character === ',') {
      commas++
    } else if (!isQuoted && character === ';') {
      semicolons++
    }
  }

  return semicolons > commas ? ';' : ','
}

function parseCsvRows(csvText: string) {
  const delimiter = detectDelimiter(csvText)
  const content = csvText.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let isQuoted = false
  let quotedFieldClosed = false

  function finishRow() {
    row.push(field.trim())
    if (row.some((value) => value.length > 0)) rows.push(row)
    row = []
    field = ''
    quotedFieldClosed = false
  }

  for (let index = 0; index < content.length; index++) {
    const character = content[index]

    if (character === '"') {
      if (isQuoted && content[index + 1] === '"') {
        field += '"'
        index++
      } else if (isQuoted) {
        isQuoted = false
        quotedFieldClosed = true
      } else if (field.length === 0 && !quotedFieldClosed) {
        isQuoted = true
      } else {
        throw new Error('Unexpected quote in CSV field')
      }
    } else if (!isQuoted && character === delimiter) {
      row.push(field.trim())
      field = ''
      quotedFieldClosed = false
    } else if (!isQuoted && (character === '\n' || character === '\r')) {
      finishRow()
      if (character === '\r' && content[index + 1] === '\n') index++
    } else if (quotedFieldClosed && !/\s/.test(character)) {
      throw new Error('Unexpected character after quoted CSV field')
    } else {
      field += character
    }
  }

  if (isQuoted) throw new Error('Unclosed quoted CSV field')
  if (field.length > 0 || row.length > 0) finishRow()

  return rows
}

function ParticipantInvitationCsvUpload({
  courseId,
  queryVariables,
  onImportCompleted,
}: {
  courseId: string
  queryVariables: GetAssessmentParticipantInvitationPageQueryVariables
  onImportCompleted: () => void
}) {
  const t = useTranslations()
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string>()
  const [invitations, setInvitations] = useState<
    AssessmentParticipantInvitationInput[]
  >([])
  const [parseError, setParseError] = useState<string>()
  const [importResult, setImportResult] = useState<ImportResult>()

  const [createInvitations, { loading: importing }] = useMutation(
    CreateAssessmentParticipantInvitationsDocument,
    {
      refetchQueries: [
        {
          query: GetAssessmentParticipantInvitationPageDocument,
          variables: queryVariables,
        },
      ],
      awaitRefetchQueries: true,
    }
  )

  function downloadCsvTemplate() {
    const url = URL.createObjectURL(
      new Blob([CSV_TEMPLATE_CONTENT], { type: 'text/csv;charset=utf-8' })
    )
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = CSV_TEMPLATE_FILENAME
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  async function handleFileSelection(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setParseError(undefined)
    setImportResult(undefined)
    setInvitations([])
    setFileName(file.name)

    if (file.size > MAX_CSV_FILE_SIZE_BYTES) {
      setParseError(t('manage.assessment.invitationCsvTooLarge'))
      return
    }

    try {
      const csvText = await file.text()
      const [sourceHeaders = [], ...recordRows] = parseCsvRows(csvText)
      if (recordRows.length > MAX_INVITATION_ROWS) {
        setParseError(
          t('manage.assessment.invitationCsvTooManyRows', {
            count: MAX_INVITATION_ROWS,
          })
        )
        return
      }
      const headers = sourceHeaders.map(normalizeHeader)

      const emailIndices = headers.flatMap((header, index) =>
        header === 'email' ? [index] : []
      )
      const matriculationNumberIndices = headers.flatMap((header, index) =>
        MATRICULATION_NUMBER_HEADERS.has(header) ? [index] : []
      )
      if (
        emailIndices.length === 0 ||
        matriculationNumberIndices.length === 0
      ) {
        setParseError(t('manage.assessment.invitationCsvMissingHeaders'))
        return
      }

      if (emailIndices.length > 1 || matriculationNumberIndices.length > 1) {
        setParseError(t('manage.assessment.invitationCsvInvalidHeaders'))
        return
      }

      if (recordRows.length === 0) {
        setParseError(t('manage.assessment.invitationCsvEmpty'))
        return
      }

      if (recordRows.some((record) => record.length !== sourceHeaders.length)) {
        setParseError(t('manage.assessment.invitationCsvInvalidRows'))
        return
      }

      const emailIndex = emailIndices[0]
      const matriculationNumberIndex = matriculationNumberIndices[0]
      setInvitations(
        recordRows.map((record) => ({
          email: record[emailIndex] ?? '',
          matriculationNumber: record[matriculationNumberIndex]?.trim() || null,
        }))
      )
    } catch (error) {
      console.error(error)
      setParseError(t('manage.assessment.invitationCsvParseError'))
    }
  }

  async function handleImport() {
    if (invitations.length > MAX_INVITATION_ROWS) {
      setParseError(
        t('manage.assessment.invitationCsvTooManyRows', {
          count: MAX_INVITATION_ROWS,
        })
      )
      return
    }

    try {
      const result = await createInvitations({
        variables: { courseId, invitations },
      })
      const payload = result.data?.createAssessmentParticipantInvitations
      if (!payload) throw new Error('Invitation import returned no result')

      setImportResult(payload)
      setInvitations([])
      setFileName(undefined)
      onImportCompleted()
      toast({
        type: payload.errors > 0 ? 'warning' : 'success',
        message: t('manage.assessment.invitationImportCompleted'),
      })
    } catch (error) {
      console.error(error)
      toast({
        type: 'error',
        message: t('manage.assessment.invitationImportFailed'),
      })
    }
  }

  const rowErrors =
    importResult?.results.filter(
      (result) =>
        result.status === AssessmentParticipantInvitationImportStatus.Error
    ) ?? []
  const rowErrorKeyCounts = new Map<string, number>()
  const rowErrorEntries = rowErrors.map((row) => {
    const baseKey = `${row.email}-${row.error ?? ''}`
    const occurrence = rowErrorKeyCounts.get(baseKey) ?? 0
    rowErrorKeyCounts.set(baseKey, occurrence + 1)

    return { key: `${baseKey}-${occurrence}`, row }
  })

  return (
    <section
      className="rounded-md border border-slate-200 bg-white p-5 shadow-sm"
      aria-labelledby="invitation-import-title"
    >
      <H2 id="invitation-import-title" className={{ root: 'mb-1' }}>
        {t('manage.assessment.invitationImportTitle')}
      </H2>
      <p className="mb-4 text-sm text-slate-600">
        {t('manage.assessment.invitationImportDescription')}
      </p>

      <div className="mb-4 flex flex-col items-start gap-3">
        <UserNotification
          type="warning"
          message={t('manage.assessment.invitationAffiliationWarning')}
          data={{ cy: 'assessment-invitations-affiliation-warning' }}
        />
        <Button
          onClick={downloadCsvTemplate}
          data={{ cy: 'assessment-invitations-download-template' }}
        >
          <Button.Icon icon={faDownload} />
          <Button.Label>
            {t('manage.assessment.invitationDownloadTemplate')}
          </Button.Label>
        </Button>
      </div>

      <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-slate-300 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="bg-uzh-blue/10 text-uzh-blue flex h-10 w-10 shrink-0 items-center justify-center rounded-full">
            <FontAwesomeIcon icon={faFileCsv} aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="font-medium">
              {fileName ?? t('manage.assessment.invitationCsvPrompt')}
            </p>
            <p className="text-sm text-slate-600">
              {invitations.length > 0
                ? t('manage.assessment.invitationCsvReady', {
                    count: invitations.length,
                  })
                : t('manage.assessment.invitationCsvHeaders')}
            </p>
          </div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={handleFileSelection}
          data-cy="assessment-invitations-csv-input"
        />
        <Button
          onClick={() => inputRef.current?.click()}
          disabled={importing}
          className={{ root: 'shrink-0' }}
          data={{ cy: 'assessment-invitations-select-csv' }}
        >
          <Button.Icon icon={faUpload} />
          <Button.Label>
            {t('manage.assessment.invitationSelectCsv')}
          </Button.Label>
        </Button>
      </div>

      {parseError ? (
        <UserNotification
          type="error"
          message={parseError}
          className={{ root: 'mt-3' }}
          data={{ cy: 'assessment-invitations-csv-error' }}
        />
      ) : null}

      {invitations.length > 0 ? (
        <div className="mt-3 flex justify-end">
          <Button
            primary
            onClick={handleImport}
            loading={importing}
            data={{ cy: 'assessment-invitations-import' }}
          >
            <Button.Icon icon={faUpload} />
            <Button.Label>
              {t('manage.assessment.invitationImportButton', {
                count: invitations.length,
              })}
            </Button.Label>
          </Button>
        </div>
      ) : null}

      {importResult ? (
        <div className="mt-4" data-cy="assessment-invitations-import-result">
          <UserNotification
            type={importResult.errors > 0 ? 'warning' : 'success'}
            message={t('manage.assessment.invitationImportSummary', {
              total: importResult.totalProcessed,
              created: importResult.created,
              accepted: importResult.autoAccepted,
              duplicates: importResult.duplicates,
              errors: importResult.errors,
            })}
          />
          {rowErrorEntries.length > 0 ? (
            <ul className="mt-2 list-disc pl-6 text-sm text-red-700">
              {rowErrorEntries.map(({ key, row }) => (
                <li key={key}>
                  {row.email}: {row.error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

export default ParticipantInvitationCsvUpload
