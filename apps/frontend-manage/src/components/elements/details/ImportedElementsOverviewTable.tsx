import { useMutation } from '@apollo/client'
import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons'
import {
  ElementStatus,
  ElementType,
  ImportElementPackageDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Badge,
  Button,
  FormikSwitchField,
  H4,
  ShadcnTable,
  ShadcnTableBody,
  ShadcnTableCell,
  ShadcnTableHead,
  ShadcnTableHeader,
  ShadcnTableRow,
  toast,
  Tooltip,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import StudentElementPreview from '../manipulation/StudentElementPreview'
import { ElementFormTypes } from '../manipulation/types'

type AnswerCollectionPreviewEntry = {
  id: number
  value: string
}

const StatusColors: Record<ElementStatus, string> = {
  [ElementStatus.Draft]: 'bg-slate-400 hover:bg-slate-500',
  [ElementStatus.Review]: 'bg-violet-400 hover:bg-violet-500',
  [ElementStatus.Ready]: 'bg-green-600 hover:bg-green-700',
}

const getElementDataType = (elementType: ElementType) => {
  if (
    elementType === ElementType.Sc ||
    elementType === ElementType.Mc ||
    elementType === ElementType.Kprim
  ) {
    return 'ChoicesElementData'
  } else if (elementType === ElementType.Numerical) {
    return 'NumericalElementData'
  } else if (elementType === ElementType.FreeText) {
    return 'FreeTextElementData'
  } else if (elementType === ElementType.Flashcard) {
    return 'FlashcardElementData'
  } else if (elementType === ElementType.Selection) {
    return 'SelectionElementData'
  } else if (elementType === ElementType.CaseStudy) {
    return 'CaseStudyElementData'
  } else {
    return 'ContentElementData'
  }
}

function ImportedElementsOverviewTable({
  elements,
  answerCollectionEntries,
  importToken,
  refetchElements,
  onClose,
}: {
  elements: Record<string, ElementFormTypes>
  answerCollectionEntries: Record<string, AnswerCollectionPreviewEntry[]>
  importToken: string
  refetchElements: () => Promise<void>
  onClose: () => void
}) {
  const t = useTranslations()

  const [previewedElementId, setPreviewedElementId] = useState<string | null>(
    null
  )

  const initialValues = useMemo(
    () =>
      Object.keys(elements).reduce(
        (acc, e) => ({
          ...acc,
          [e]: true,
        }),
        {} as Record<string, boolean>
      ),
    [elements]
  )
  const [importElementPackage] = useMutation(ImportElementPackageDocument)

  return (
    <Formik
      enableReinitialize
      initialValues={initialValues}
      onSubmit={async (values) => {
        const selectedElementKeys = Object.keys(elements).filter(
          (element) => values[element]
        )

        if (selectedElementKeys.length === 0) {
          toast({
            type: 'error',
            message: t('manage.elements.elementImportNoElementsSelected'),
            options: { duration: 4000 },
          })
          return
        }

        try {
          const result = await importElementPackage({
            variables: {
              importToken,
              selectedElementRefs: selectedElementKeys,
            },
          })
          const importedElements =
            result.data?.importElementPackage?.importedElements ?? 0

          await refetchElements()
          toast({
            type: 'success',
            message: t('manage.elements.elementImportSuccess', {
              number: importedElements,
            }),
            options: { duration: 3500 },
          })
          onClose()
        } catch (error) {
          console.error('Error while importing elements:', error)
          toast({
            type: 'error',
            message: t('manage.elements.elementImportError'),
            options: { duration: 5000 },
          })
        }
      }}
    >
      {({ values, isSubmitting }) => {
        const selectedCount = Object.values(values).filter(Boolean).length
        const previewedElement = previewedElementId
          ? elements[previewedElementId]
          : undefined
        const previewAnswerCollectionEntries = previewedElementId
          ? (answerCollectionEntries[previewedElementId] ?? [])
          : []
        const renderPreviewButton = (key: string, dataCy: string) => (
          <Tooltip tooltip={t('manage.activities.previewElement')}>
            <Button
              basic
              size="icon"
              type="button"
              aria-label={t('manage.activities.previewElement')}
              className={{ root: 'h-8 w-8' }}
              onClick={() => {
                setPreviewedElementId(key.toString())
              }}
              data={{ cy: dataCy }}
            >
              <Button.Icon icon={faMagnifyingGlass} />
            </Button>
          </Tooltip>
        )

        return (
          <Form className="flex h-[34rem] max-h-[calc(100vh-18rem)] min-h-0 flex-col gap-4 overflow-auto pr-1 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] lg:overflow-hidden lg:pr-0">
            <div className="flex min-h-[18rem] flex-col gap-3 overflow-hidden lg:min-h-0">
              <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-auto rounded-md border border-solid p-2 sm:hidden">
                {Object.entries(elements).map(([key, element], index) => (
                  <div
                    key={`element-card-${key}`}
                    className={twMerge(
                      'bg-muted/30 rounded-md p-2',
                      previewedElementId === key && 'bg-primary-20'
                    )}
                    data-cy={`element-import-${index}-mobile`}
                  >
                    <div className="flex items-start gap-3">
                      <FormikSwitchField
                        name={`${key}`}
                        id={`element-import-switch-${key}-mobile`}
                        size="sm"
                        data={{
                          cy: `element-${index}-import-mobile`,
                        }}
                        className={{ root: 'mt-0.5 flex-none' }}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="line-clamp-2 break-words text-sm font-bold">
                          {element.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                          <span>{t(`shared.${element.type}.typeLabel`)}</span>
                          <Badge
                            className={twMerge(
                              'text-white',
                              StatusColors[element.status]
                            )}
                          >
                            {t(`shared.${element.status}.statusLabel`)}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex-none">
                        {renderPreviewButton(
                          key,
                          `preview-imported-element-${index}-mobile`
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="hidden min-h-0 flex-1 overflow-auto rounded-md border border-solid sm:block">
                <ShadcnTable className="w-full table-fixed text-sm">
                  <ShadcnTableHeader>
                    <ShadcnTableRow>
                      <ShadcnTableHead className="w-16 whitespace-normal font-bold leading-tight">
                        {t('manage.elements.elementImport')}
                      </ShadcnTableHead>
                      <ShadcnTableHead className="whitespace-normal font-bold leading-tight">
                        {t('manage.elements.elementTitle')}
                      </ShadcnTableHead>
                      <ShadcnTableHead className="w-28 whitespace-normal font-bold leading-tight">
                        {t('manage.elements.elementTypeImportDescription')}
                      </ShadcnTableHead>
                      <ShadcnTableHead className="w-24 whitespace-normal font-bold leading-tight">
                        {t('manage.elements.elementStatusImportDescription')}
                      </ShadcnTableHead>
                      <ShadcnTableHead className="w-14 whitespace-normal text-center font-bold leading-tight">
                        {t('manage.elements.elementImportPreview')}
                      </ShadcnTableHead>
                    </ShadcnTableRow>
                  </ShadcnTableHeader>
                  <ShadcnTableBody>
                    {Object.entries(elements).map(([key, element], index) => (
                      <ShadcnTableRow
                        key={`element-${key}`}
                        className={twMerge(
                          'bg-muted/30 hover:bg-muted/80',
                          previewedElementId === key &&
                            'bg-primary-20 hover:bg-primary-20'
                        )}
                        data-cy={`element-import-${index}`}
                      >
                        <ShadcnTableCell className="w-16 py-1">
                          <FormikSwitchField
                            name={`${key}`}
                            id={`element-import-switch-${key}`}
                            size="sm"
                            data={{
                              cy: `element-${index}-import`,
                            }}
                            className={{ root: 'justify-center' }}
                          />
                        </ShadcnTableCell>
                        <ShadcnTableCell className="min-w-0 py-1">
                          <span className="line-clamp-2 break-words">
                            {element.name}
                          </span>
                        </ShadcnTableCell>
                        <ShadcnTableCell className="w-28 py-1">
                          <span className="line-clamp-2">
                            {t(`shared.${element.type}.typeLabel`)}
                          </span>
                        </ShadcnTableCell>
                        <ShadcnTableCell className="w-24 py-1">
                          <Badge
                            className={twMerge(
                              'text-white',
                              StatusColors[element.status]
                            )}
                          >
                            {t(`shared.${element.status}.statusLabel`)}
                          </Badge>
                        </ShadcnTableCell>
                        <ShadcnTableCell className="w-14 py-1 text-center">
                          {renderPreviewButton(
                            key,
                            `preview-imported-element-${index}`
                          )}
                        </ShadcnTableCell>
                      </ShadcnTableRow>
                    ))}
                  </ShadcnTableBody>
                </ShadcnTable>
              </div>

              <div className="flex flex-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-slate-600">
                  {t('manage.elements.elementImportSelectionSummary', {
                    selected: selectedCount,
                    total: Object.keys(elements).length,
                  })}
                </div>
                <Button
                  primary
                  type="submit"
                  disabled={isSubmitting || selectedCount === 0}
                  className={{ root: 'h-9' }}
                  data={{ cy: 'confirm-element-import' }}
                >
                  {t('manage.elements.importSelectedElements')}
                </Button>
              </div>
            </div>

            <section className="flex min-h-[22rem] min-w-0 flex-col overflow-hidden rounded-md border border-solid bg-white lg:min-h-0">
              <div className="flex h-12 flex-none items-center justify-between gap-3 border-b px-3">
                <H4 className={{ root: 'm-0 truncate text-base' }}>
                  {previewedElement
                    ? previewedElement.name
                    : t('manage.elements.elementImportPreview')}
                </H4>
                {previewedElement ? (
                  <Tooltip tooltip={t('shared.generic.close')}>
                    <Button
                      basic
                      size="icon"
                      type="button"
                      aria-label={t('shared.generic.close')}
                      className={{ root: 'h-8 w-8 flex-none' }}
                      onClick={() => setPreviewedElementId(null)}
                      data={{ cy: 'close-element-import-preview' }}
                    >
                      <Button.Icon withoutLabel icon={faXmark} />
                    </Button>
                  </Tooltip>
                ) : null}
              </div>

              <div
                className="min-h-0 flex-1 overflow-auto p-3"
                data-cy="element-import-preview-panel"
              >
                {previewedElement ? (
                  <div data-cy="element-import-preview-content">
                    <StudentElementPreview
                      values={previewedElement}
                      elementDataTypename={getElementDataType(
                        previewedElement.type
                      )}
                      answerCollectionEntries={previewAnswerCollectionEntries}
                    />
                  </div>
                ) : (
                  <div className="flex h-full min-h-48 items-center">
                    <UserNotification
                      message={t(
                        'manage.elements.elementImportPreviewEmptyState'
                      )}
                      className={{ root: 'w-full text-sm' }}
                    />
                  </div>
                )}
              </div>
            </section>
          </Form>
        )
      }}
    </Formik>
  )
}

export default ImportedElementsOverviewTable
