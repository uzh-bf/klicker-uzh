import { useMutation } from '@apollo/client'
import {
  faDownload,
  faFileExcel,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementWorkbookUnsupportedReason,
  ExportElementWorkbookDocument,
  type ExportElementWorkbookMutation,
} from '@klicker-uzh/graphql/dist/ops'
import {
  downloadWorkbookUrl,
  ELEMENT_WORKBOOK_MAX_EXPORT,
} from '@lib/elementWorkbookFiles'
import { Button, Modal, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'

const WORKBOOK_TYPES = [
  'SC',
  'MC',
  'KPRIM',
  'NUMERICAL',
  'FREE_TEXT',
  'CONTENT',
  'FLASHCARD',
]

type ExportResult = ExportElementWorkbookMutation['exportElementWorkbook']

interface ElementWorkbookExportModalProps {
  selectedElements: { id: number; name: string; type: string }[]
  onClose: () => void
}

function ElementWorkbookExportModal({
  selectedElements,
  onClose,
}: ElementWorkbookExportModalProps) {
  const t = useTranslations()
  const [exportWorkbook] = useMutation(ExportElementWorkbookDocument)
  const [includeTags, setIncludeTags] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ExportResult | null>(null)

  // Types without a template tab are known up front; content that can't
  // round-trip is only known after the server builds the file.
  const typeUnsupported = selectedElements.filter(
    (element) => !WORKBOOK_TYPES.includes(element.type)
  )
  const unsupported = result
    ? result.unsupported
    : typeUnsupported.map((element) => ({
        ...element,
        reason: ElementWorkbookUnsupportedReason.TypeNotSupported,
      }))
  const exportableCount = result
    ? result.exportedIds.length
    : selectedElements.length - typeUnsupported.length
  const tooMany = selectedElements.length > ELEMENT_WORKBOOK_MAX_EXPORT

  async function runExport() {
    setExporting(true)
    setError(null)
    try {
      const { data } = await exportWorkbook({
        variables: {
          elementIds: selectedElements.map((element) => element.id),
          includeTags,
        },
      })
      const exported = data?.exportElementWorkbook
      if (!exported) throw new Error('Export failed')
      setResult(exported)
      if (exported.downloadUrl) downloadWorkbookUrl(exported.downloadUrl)
    } catch (error) {
      setError(
        error instanceof Error && error.message === 'RATE_LIMITED'
          ? t('manage.elementWorkbook.errors.RATE_LIMITED')
          : t('manage.elementWorkbook.exportFailed')
      )
    } finally {
      setExporting(false)
    }
  }

  const done = result !== null && result.exportedIds.length > 0

  return (
    <Modal
      open
      onClose={exporting ? () => undefined : onClose}
      title={t('manage.elementWorkbook.exportTitle')}
      className={{ content: 'h-max w-[calc(100%-2rem)] md:w-160' }}
      dataCloseButton={{ cy: 'close-element-workbook-export' }}
    >
      <div className="flex flex-col gap-4" data-cy="element-workbook-export">
        {done ? (
          <div className="flex flex-col items-center gap-1 py-4 text-center">
            <FontAwesomeIcon
              icon={faFileExcel}
              className="text-primary-100 text-4xl"
            />
            <div className="mt-1 text-base font-bold">{result.filename}</div>
            <div className="text-sm text-slate-600">
              {t('manage.elementWorkbook.exportedDescription', {
                count: result.exportedIds.length,
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-md bg-slate-50 p-3">
            <FontAwesomeIcon
              icon={faFileExcel}
              className="text-primary-100 text-2xl"
            />
            <div className="flex-1">
              <div className="font-bold" data-cy="element-workbook-summary">
                {t('manage.elementWorkbook.exportSummary', {
                  exported: exportableCount,
                  total: selectedElements.length,
                })}
              </div>
              <div className="text-sm text-slate-600">
                {t('manage.elementWorkbook.exportDescription')}
              </div>
            </div>
          </div>
        )}

        {unsupported.length > 0 && (
          <UserNotification type="warning" className={{ root: 'text-sm' }}>
            <div data-cy="element-workbook-unsupported">
              <div className="mb-1 font-bold">
                <FontAwesomeIcon
                  icon={faTriangleExclamation}
                  className="mr-1.5"
                />
                {t('manage.elementWorkbook.exportUnsupportedTitle', {
                  count: unsupported.length,
                })}
              </div>
              <ul className="list-inside list-disc">
                {unsupported.map((element) => (
                  <li key={element.id}>
                    {element.name} ·{' '}
                    {t(
                      `manage.elementWorkbook.unsupportedReason.${element.reason}`
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </UserNotification>
        )}

        {tooMany && (
          <p className="text-sm text-red-600" role="alert">
            {t('manage.elementWorkbook.tooManyElements')}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}

        {!done && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeTags}
              onChange={(event) => setIncludeTags(event.target.checked)}
              data-cy="element-workbook-include-tags"
            />
            {t('manage.elementWorkbook.includeTags')}
          </label>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-200 pt-3">
          {done ? (
            <Button
              primary
              onClick={onClose}
              className={{ root: 'h-9' }}
              data={{ cy: 'element-workbook-export-done' }}
            >
              {t('shared.generic.close')}
            </Button>
          ) : (
            <>
              <Button onClick={onClose} className={{ root: 'h-9' }}>
                {t('shared.generic.cancel')}
              </Button>
              <Button
                primary
                disabled={exporting || tooMany || exportableCount === 0}
                onClick={() => void runExport()}
                className={{ root: 'h-9' }}
                data={{ cy: 'element-workbook-export-confirm' }}
              >
                <Button.Icon icon={faDownload} />
                <Button.Label>
                  {exporting
                    ? t('manage.elementWorkbook.preparingExport')
                    : t('manage.elementWorkbook.downloadElements', {
                        count: exportableCount,
                      })}
                </Button.Label>
              </Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}

export default ElementWorkbookExportModal
