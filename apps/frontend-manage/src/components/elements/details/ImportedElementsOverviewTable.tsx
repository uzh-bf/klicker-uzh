import { faMagnifyingGlass, faXmark } from '@fortawesome/free-solid-svg-icons'
import { ElementStatus, ElementType } from '@klicker-uzh/graphql/dist/ops'
import {
  Badge,
  Button,
  Checkbox,
  H4,
  toast,
  UserNotification,
} from '@uzh-bf/design-system'
import { Form, Formik, type FormikProps } from 'formik'
import { useTranslations } from 'next-intl'
import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import type { PackagePreviewElementMeta } from '~/lib/elementImportPreview'
import PackageAnswerCollectionOverview, {
  OverviewAnswerCollection,
} from '../manipulation/PackageAnswerCollectionOverview'
import StudentElementPreview from '../manipulation/StudentElementPreview'
import { ElementFormTypes } from '../manipulation/types'
import ImportedElementDidacticReview from './ImportedElementDidacticReview'

type AnswerCollectionPreviewEntry = {
  id: number
  value: string
}

const ImportSelectionCheckbox = memo(function ImportSelectionCheckbox({
  name,
  id,
  label,
  checked,
  disabled,
  dataCy,
  setFieldValue,
  setFieldTouched,
}: {
  name: string
  id: string
  label: string
  checked: boolean
  disabled: boolean
  dataCy: string
  setFieldValue: FormikProps<Record<string, boolean>>['setFieldValue']
  setFieldTouched: FormikProps<Record<string, boolean>>['setFieldTouched']
}) {
  return (
    <div className="mt-1 flex-none">
      <Checkbox
        id={id}
        checked={checked}
        disabled={disabled}
        size="sm"
        data={{ cy: dataCy }}
        onCheck={() => {
          void setFieldValue(name, !checked, false)
          void setFieldTouched(name, true, false)
        }}
        label={
          <label htmlFor={id} className="sr-only">
            {label}
          </label>
        }
      />
    </div>
  )
})

const StatusColors: Record<ElementStatus, string> = {
  [ElementStatus.Draft]: 'bg-slate-600 hover:bg-slate-700',
  [ElementStatus.Review]: 'bg-violet-600 hover:bg-violet-700',
  [ElementStatus.Ready]: 'bg-green-700 hover:bg-green-800',
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
  elementMeta,
  answerCollectionEntries,
  answerCollectionsForOverview = [],
  importing,
  commitError,
  onImport,
}: {
  elements: Record<string, ElementFormTypes>
  elementMeta: Record<string, PackagePreviewElementMeta>
  answerCollectionEntries: Record<
    string,
    readonly AnswerCollectionPreviewEntry[]
  >
  answerCollectionsForOverview?: readonly OverviewAnswerCollection[]
  importing: boolean
  commitError: string | null
  onImport: (selectedElementRefs: string[]) => Promise<void>
}) {
  const t = useTranslations()
  const commitErrorRef = useRef<HTMLDivElement | null>(null)
  const [previewedElementId, setPreviewedElementId] = useState<string | null>(
    null
  )
  const elementEntries = useMemo(() => Object.entries(elements), [elements])
  const initialValues = useMemo(
    () =>
      Object.fromEntries(
        elementEntries.map(([elementRef]) => [elementRef, true])
      ),
    [elementEntries]
  )

  useEffect(() => {
    if (commitError) commitErrorRef.current?.focus()
  }, [commitError])

  return (
    <Formik
      enableReinitialize
      initialValues={initialValues}
      onSubmit={async (values) => {
        const selectedElementKeys = elementEntries
          .filter(([elementRef]) => values[elementRef])
          .map(([elementRef]) => elementRef)

        if (selectedElementKeys.length === 0) {
          toast({
            type: 'error',
            message: t('manage.elements.elementImportNoElementsSelected'),
            options: { duration: 4000 },
          })
          return
        }

        await onImport(selectedElementKeys)
      }}
    >
      {({
        values,
        isSubmitting,
        setFieldTouched,
        setFieldValue,
        setValues,
      }) => {
        const busy = isSubmitting || importing
        const selectedElementKeys: string[] = []
        const requiredCollectionRefs = new Set<string>()
        const selectedElementNamesByCollectionRef = new Map<string, string[]>()
        let selectedDuplicateCount = 0

        for (const [elementRef, element] of elementEntries) {
          if (!values[elementRef]) continue

          selectedElementKeys.push(elementRef)
          const meta = elementMeta[elementRef]
          if (meta?.alreadyImported) selectedDuplicateCount += 1

          if (meta?.answerCollectionRef) {
            requiredCollectionRefs.add(meta.answerCollectionRef)
            const names =
              selectedElementNamesByCollectionRef.get(
                meta.answerCollectionRef
              ) ?? []
            names.push(element.name)
            selectedElementNamesByCollectionRef.set(
              meta.answerCollectionRef,
              names
            )
          }
        }

        const collectionsWithSelectedElements =
          answerCollectionsForOverview.map((collection) => ({
            ...collection,
            elementNames:
              selectedElementNamesByCollectionRef.get(collection.ref) ?? [],
          }))
        const selectedCount = selectedElementKeys.length
        const previewedElement = previewedElementId
          ? elements[previewedElementId]
          : undefined
        const previewAnswerCollectionEntries = previewedElementId
          ? (answerCollectionEntries[previewedElementId] ?? [])
          : []
        const replaceSelection = (selectElement: (key: string) => boolean) =>
          setValues(
            Object.fromEntries(
              elementEntries.map(([elementRef]) => [
                elementRef,
                selectElement(elementRef),
              ])
            ),
            false
          )
        const renderPreviewButton = (
          key: string,
          elementName: string,
          index: number
        ) => {
          const label = t('manage.elements.elementImportPreviewElement', {
            name: elementName,
          })

          return (
            <Button
              basic
              size="icon"
              type="button"
              title={label}
              aria-label={label}
              disabled={busy}
              className={{ root: 'h-9 w-9 flex-none' }}
              onClick={() => setPreviewedElementId(key)}
              data={{ cy: `preview-imported-element-${index}` }}
            >
              <Button.Icon icon={faMagnifyingGlass} />
            </Button>
          )
        }

        return (
          <Form
            className="flex h-[38rem] max-h-[calc(100vh-16rem)] min-h-0 flex-col gap-4 overflow-auto pr-1 lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.95fr)] lg:overflow-hidden lg:pr-0"
            aria-busy={busy}
            data-cy="element-import-review-form"
          >
            <div className="flex min-h-[18rem] flex-col gap-3 overflow-hidden lg:min-h-0">
              <div
                className="flex flex-col gap-2"
                data-cy="element-import-review-disclosures"
              >
                <UserNotification
                  type="warning"
                  message={t(
                    'manage.elements.elementImportCopyrightSolutionsDisclosure'
                  )}
                  className={{
                    root: 'text-sm',
                    icon: 'text-red-900',
                    message: 'text-red-900',
                  }}
                />
                <UserNotification
                  message={t(
                    'manage.elements.elementImportPsychometricDisclosure'
                  )}
                  className={{ root: 'text-sm' }}
                />
              </div>
              {commitError ? (
                <div
                  ref={commitErrorRef}
                  tabIndex={-1}
                  className="outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  data-cy="element-import-commit-error"
                >
                  <UserNotification
                    type="error"
                    message={commitError}
                    className={{ root: 'text-sm' }}
                  />
                </div>
              ) : null}
              {selectedDuplicateCount > 0 ? (
                <div data-cy="element-import-duplicate-summary">
                  <UserNotification
                    type="warning"
                    message={t(
                      'manage.elements.elementImportDuplicateSummary',
                      { count: selectedDuplicateCount }
                    )}
                    className={{
                      root: 'text-sm',
                      icon: 'text-red-900',
                      message: 'text-red-900',
                    }}
                  />
                </div>
              ) : null}

              <PackageAnswerCollectionOverview
                mode="import"
                collections={collectionsWithSelectedElements}
                selectedCollectionRefs={requiredCollectionRefs}
                dataCy="element-import-answer-collections-overview"
              />

              <div className="flex flex-none flex-wrap items-center gap-2">
                <Button
                  basic
                  type="button"
                  disabled={busy || selectedCount === elementEntries.length}
                  onClick={() => replaceSelection(() => true)}
                  data={{ cy: 'element-import-select-all' }}
                >
                  {t('manage.elements.elementImportSelectAll')}
                </Button>
                <Button
                  basic
                  type="button"
                  disabled={busy || selectedCount === 0}
                  onClick={() => replaceSelection(() => false)}
                  data={{ cy: 'element-import-select-none' }}
                >
                  {t('manage.elements.elementImportSelectNone')}
                </Button>
                <Button
                  basic
                  type="button"
                  disabled={busy || selectedDuplicateCount === 0}
                  onClick={() =>
                    replaceSelection(
                      (elementRef) =>
                        Boolean(values[elementRef]) &&
                        !elementMeta[elementRef]?.alreadyImported
                    )
                  }
                  data={{ cy: 'element-import-exclude-duplicates' }}
                >
                  {t('manage.elements.elementImportExcludeDuplicates')}
                </Button>
              </div>

              <ul
                className="m-0 flex min-h-0 flex-1 list-none flex-col gap-2 overflow-auto rounded-md border border-solid p-2"
                aria-label={t('manage.elements.reviewElementsBeforeImport')}
                data-cy="element-import-selection-list"
              >
                {elementEntries.map(([key, element], index) => {
                  const meta = elementMeta[key]

                  return (
                    <li
                      key={key}
                      className={twMerge(
                        'bg-muted/30 grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 rounded-md p-2 [contain-intrinsic-size:0_4rem] [content-visibility:auto] sm:gap-3',
                        previewedElementId === key &&
                          'bg-primary-20 ring-primary-80 ring-1'
                      )}
                      data-cy={`element-import-${index}`}
                    >
                      <ImportSelectionCheckbox
                        name={key}
                        id={`element-import-switch-${key}`}
                        checked={Boolean(values[key])}
                        disabled={busy}
                        label={t(
                          'manage.elements.elementImportSelectionToggle',
                          { name: element.name }
                        )}
                        dataCy={`element-${index}-import`}
                        setFieldValue={setFieldValue}
                        setFieldTouched={setFieldTouched}
                      />
                      <div className="min-w-0">
                        <div className="break-words text-sm font-bold">
                          {element.name}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-700 sm:gap-2">
                          <span>{t(`shared.${element.type}.typeLabel`)}</span>
                          <Badge
                            className={twMerge(
                              'text-white',
                              StatusColors[ElementStatus.Review]
                            )}
                          >
                            {t(`shared.${ElementStatus.Review}.statusLabel`)}
                          </Badge>
                          {meta?.alreadyImported ? (
                            <span
                              className="min-w-0"
                              data-cy={`element-import-duplicate-${index}`}
                            >
                              <Badge className="border-amber-400 bg-amber-50 text-amber-900 hover:bg-amber-100">
                                {t('manage.elements.elementImportDuplicate')}
                              </Badge>
                              {meta.existingElementName ? (
                                <span className="ml-1 break-words text-xs text-amber-900">
                                  {t(
                                    'manage.elements.elementImportDuplicateExisting',
                                    { name: meta.existingElementName }
                                  )}
                                </span>
                              ) : null}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {renderPreviewButton(key, element.name, index)}
                    </li>
                  )
                })}
              </ul>

              <div className="flex flex-none flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div
                  className="text-sm text-slate-700"
                  aria-live="polite"
                  data-cy="element-import-selection-summary"
                >
                  {t('manage.elements.elementImportSelectionSummary', {
                    selected: selectedCount,
                    total: elementEntries.length,
                  })}
                </div>
                <Button
                  primary
                  type="submit"
                  disabled={busy || selectedCount === 0}
                  loading={busy}
                  className={{ root: 'h-9' }}
                  data={{ cy: 'confirm-element-import' }}
                >
                  {t('manage.elements.importSelectedElements')}
                </Button>
                <div
                  role="status"
                  aria-live="polite"
                  className="sr-only"
                  data-cy="element-import-submit-status"
                >
                  {busy
                    ? t('manage.elements.elementImportSubmittingStatus')
                    : ''}
                </div>
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
                  <Button
                    basic
                    size="icon"
                    type="button"
                    title={t('shared.generic.close')}
                    aria-label={t('shared.generic.close')}
                    disabled={busy}
                    className={{ root: 'h-8 w-8 flex-none' }}
                    onClick={() => setPreviewedElementId(null)}
                    data={{ cy: 'close-element-import-preview' }}
                  >
                    <Button.Icon withoutLabel icon={faXmark} />
                  </Button>
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
                    <ImportedElementDidacticReview
                      element={previewedElement}
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
