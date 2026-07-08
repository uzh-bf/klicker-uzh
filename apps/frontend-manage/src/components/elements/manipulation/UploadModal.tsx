import { useMutation } from '@apollo/client'
import {
  ElementType,
  PrepareElementImportPackageUploadDocument,
  ValidateElementImportPackageDocument,
  ValidateElementImportPackageMutation,
} from '@klicker-uzh/graphql/dist/ops'
import {
  ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES,
  type ElementOptionsNumerical,
} from '@klicker-uzh/types'
import { H4, Modal, toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { MediaUploadDropzone } from '../../common/MediaLibrary'
import ImportedElementsOverviewTable from '../details/ImportedElementsOverviewTable'
import PackageAnswerCollectionOverview from './PackageAnswerCollectionOverview'
import { ElementFormTypes } from './types'

type AnswerCollectionPreviewEntry = {
  id: number
  value: string
}

type PackagePreview = NonNullable<
  ValidateElementImportPackageMutation['validateElementImportPackage']
>
type PackagePreviewElement = PackagePreview['elements'][number]
type PackagePreviewAnswerCollection =
  PackagePreview['answerCollections'][number]
type PackagePreviewElementMeta = {
  tags: string[]
  alreadyImported: boolean
  existingElementId?: number | null
}

function formatPackageSize(bytes: number) {
  return `${Math.round(bytes / 1024 / 1024)} MB`
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function translatePackageMessage(t: any, code: string) {
  switch (code) {
    case 'IMPORT_STATUS_NORMALIZED_TO_REVIEW':
      return t('manage.elements.elementImportStatusNormalizedWarning')
    case 'IMPORT_TAGS_OMITTED':
      return t('manage.elements.elementImportTagsOmittedWarning')
    case 'IMPORT_EXTERNAL_MEDIA_NOT_PACKAGED':
      return t('manage.elements.elementImportExternalMediaWarning')
    case 'IMPORT_MEDIA_NOT_INCLUDED':
      return t('manage.elements.elementImportMediaMissingWarning')
    case 'IMPORT_INVALID_OPTIONS':
      return t('manage.elements.elementImportInvalidOptions')
    case 'IMPORT_ELEMENT_TAGS_IN_MANIFEST':
      return t('manage.elements.elementImportTagsInManifest')
    case 'IMPORT_MANIFEST_NOT_AT_ROOT':
      return t('manage.elements.elementImportManifestNotAtRoot')
    case 'IMPORT_PACKAGE_TOO_LARGE':
      return t('manage.elements.elementImportFileTooLarge', {
        size: formatPackageSize(ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES),
      })
    case 'IMPORT_PACKAGE_NOT_FOUND':
      return t('manage.elements.elementImportPackageNotFound')
    case 'IMPORT_INVALID_PACKAGE':
      return t('manage.elements.elementImportInvalidFile')
    default:
      return code
  }
}

function convertPackagePreviewElementToFormValues(
  element: PackagePreviewElement
): ElementFormTypes {
  const options = isRecord(element.options) ? element.options : {}
  const sharedQuestionForm = {
    name: element.name,
    status: element.status,
    content: element.content,
    pointsMultiplier: String(element.pointsMultiplier),
    basePoints: element.basePoints,
    tags: element.tags ?? [],
  }

  const typeSpecificForm = {
    type: element.type,
    explanation: element.explanation ?? '',
    options: {
      ...options,
    },
  }

  if (element.type === ElementType.Numerical) {
    const numericalOptions = options as ElementOptionsNumerical
    const solutionType = numericalOptions.solutionRanges
      ? 'range'
      : numericalOptions.exactSolutions
        ? 'exact'
        : undefined
    Object.assign(typeSpecificForm.options, { solutionType })
  } else if (element.type === ElementType.Selection) {
    Object.assign(typeSpecificForm.options, {
      itemSelectionMode: 'existing',
      answerCollection:
        typeof element.answerCollectionId === 'number'
          ? String(element.answerCollectionId)
          : undefined,
      correctAnswers:
        element.answerCollectionItems?.map((item: any) => item.id) ?? [],
    })
  } else if (element.type === ElementType.CaseStudy) {
    const hasSampleSolution = options.hasSampleSolution ?? false
    const criteria = Array.isArray(options.criteria) ? options.criteria : []
    const cases = Array.isArray(options.cases) ? options.cases : []

    Object.assign(typeSpecificForm.options, {
      itemSelectionMode: 'existing',
      answerCollection:
        typeof element.answerCollectionId === 'number'
          ? String(element.answerCollectionId)
          : undefined,
      selectedItems:
        element.answerCollectionItems?.map((item: any) => item.id) ?? [],
      manuallyCreatedItems: [],
      criteria:
        criteria.map((criterion: any) => ({
          ...criterion,
          mode: criterion.labels ? 'steps' : 'range',
          step: String(criterion.step),
        })) ?? [],
      cases:
        cases.map((caseItem: any) => ({
          ...caseItem,
          solutions:
            hasSampleSolution && Array.isArray(caseItem.solutions)
              ? Object.fromEntries(
                  caseItem.solutions.map((solution: any) => [
                    `itemId-${solution.itemId}`,
                    Object.fromEntries(
                      Array.isArray(solution.criteriaSolutions)
                        ? solution.criteriaSolutions.map((criterion: any) => [
                            criterion.criterionId,
                            {
                              min: String(criterion.min),
                              max: String(criterion.max),
                            },
                          ])
                        : []
                    ),
                  ])
                )
              : caseItem.solutions,
        })) ?? [],
    })
  }

  return {
    ...sharedQuestionForm,
    ...typeSpecificForm,
  } as ElementFormTypes
}

function UploadModal({
  onClose,
  refetchElements,
}: {
  onClose: () => void
  refetchElements: () => Promise<void>
}) {
  const t = useTranslations()

  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null)
  const [importToken, setImportToken] = useState<string | null>(null)
  const [packageWarnings, setPackageWarnings] = useState<string[]>([])
  const [uploadError, setUploadError] = useState('')
  const [elementsForPreview, setElementsForPreview] = useState<
    Record<string, ElementFormTypes>
  >({})
  const [elementMetaForPreview, setElementMetaForPreview] = useState<
    Record<string, PackagePreviewElementMeta>
  >({})
  const [
    answerCollectionEntriesForPreview,
    setAnswerCollectionEntriesForPreview,
  ] = useState<Record<string, AnswerCollectionPreviewEntry[]>>({})
  const [answerCollectionsForOverview, setAnswerCollectionsForOverview] =
    useState<PackagePreviewAnswerCollection[]>([])

  const [preparePackageUpload, { loading: preparingUpload }] = useMutation(
    PrepareElementImportPackageUploadDocument
  )
  const [validatePackageUpload, { loading: validatingPackage }] = useMutation(
    ValidateElementImportPackageDocument
  )

  const resetPreview = () => {
    setImportToken(null)
    setPackageWarnings([])
    setUploadError('')
    setElementsForPreview({})
    setElementMetaForPreview({})
    setAnswerCollectionEntriesForPreview({})
    setAnswerCollectionsForOverview([])
  }

  const handleFileUpload = async (files: File[]) => {
    const file = files[0]
    if (!file) {
      return
    }

    setIsUploading(true)
    setUploadedFileName(file.name)
    setUploadError('')
    resetPreview()

    try {
      if (!file.name.toLowerCase().endsWith('.zip')) {
        throw new Error(t('manage.elements.elementImportInvalidFile'))
      }
      if (file.size > ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES) {
        throw new Error(
          t('manage.elements.elementImportFileTooLarge', {
            size: formatPackageSize(ELEMENT_IMPORT_EXPORT_PACKAGE_MAX_BYTES),
          })
        )
      }

      const uploadResult = await preparePackageUpload({
        variables: { filename: file.name },
      })
      const upload =
        uploadResult.data?.prepareElementImportPackageUpload ?? null

      if (!upload) {
        throw new Error(t('manage.elements.elementImportInvalidFile'))
      }

      const response = await fetch(upload.uploadSasURL, {
        method: 'PUT',
        headers: {
          'x-ms-blob-type': 'BlockBlob',
          'Content-Type': 'application/zip',
        },
        body: file,
      })

      if (!response.ok) {
        throw new Error(t('manage.elements.elementImportUploadFailed'))
      }

      const validationResult = await validatePackageUpload({
        variables: { blobName: upload.blobName },
      })
      const preview =
        validationResult.data?.validateElementImportPackage ?? null

      if (!preview) {
        throw new Error(t('manage.elements.elementImportInvalidFile'))
      }

      if (preview.errors.length > 0 || !preview.importToken) {
        const errorMessages = preview.errors.map((code: string) =>
          translatePackageMessage(t, code)
        )
        throw new Error(
          errorMessages.join(' ') ||
            t('manage.elements.elementImportInvalidFile')
        )
      }

      const nextElementsForPreview: Record<string, ElementFormTypes> = {}
      const nextElementMetaForPreview: Record<
        string,
        PackagePreviewElementMeta
      > = {}
      const nextAnswerCollectionEntriesForPreview: Record<
        string,
        AnswerCollectionPreviewEntry[]
      > = {}

      for (const element of preview.elements) {
        nextElementsForPreview[element.ref] =
          convertPackagePreviewElementToFormValues(element)
        nextElementMetaForPreview[element.ref] = {
          tags: element.tags ?? [],
          alreadyImported: element.alreadyImported,
          existingElementId: element.existingElementId,
        }
        nextAnswerCollectionEntriesForPreview[element.ref] =
          element.answerCollectionEntries ?? []
      }

      setImportToken(preview.importToken)
      setPackageWarnings(
        preview.warnings.map((code: string) => translatePackageMessage(t, code))
      )
      setElementsForPreview(nextElementsForPreview)
      setElementMetaForPreview(nextElementMetaForPreview)
      setAnswerCollectionEntriesForPreview(
        nextAnswerCollectionEntriesForPreview
      )
      setAnswerCollectionsForOverview([...preview.answerCollections])
      toast({
        type: 'success',
        message: t('manage.elements.elementImportValidationSuccess', {
          number: preview.elements.length,
        }),
        options: { duration: 3000 },
      })
    } catch (err: any) {
      setUploadedFileName(null)
      resetPreview()
      const message =
        err.message || t('manage.elements.elementImportInvalidFile')
      setUploadError(message)
      toast({
        type: 'error',
        message,
        options: { duration: 5000 },
      })
    } finally {
      setIsUploading(false)
    }
  }

  const hasElementsForPreview =
    Boolean(importToken) && Object.keys(elementsForPreview).length > 0
  const processingFile = isUploading || preparingUpload || validatingPackage
  const renderUploadDropzone = ({
    compact = false,
  }: { compact?: boolean } = {}) => (
    <MediaUploadDropzone
      accept={{
        'application/zip': ['.zip'],
        'application/x-zip-compressed': ['.zip'],
      }}
      title={t('manage.elements.uploadElementsFile')}
      description={
        <>
          <p>{t('manage.elements.uploadElementsZipDescription')}</p>
          {uploadedFileName ? (
            <div
              className="mt-2 break-all text-xs text-slate-600"
              data-cy="element-import-file-name"
            >
              {uploadedFileName}
            </div>
          ) : null}
        </>
      }
      activeDescription={t('manage.elements.dropElementsZip')}
      compact={compact}
      isUploading={processingFile}
      inputAriaLabel={t('manage.elements.uploadElementsFile')}
      onDropAccepted={handleFileUpload}
      data={{ cy: 'element-import-dropzone' }}
      className={{
        root: compact
          ? 'h-10 rounded-md border border-solid bg-white px-3 text-sm'
          : 'min-h-40 rounded-md border border-solid bg-white px-4 py-6 text-sm',
        title: compact ? 'w-full truncate text-center' : undefined,
        description: 'text-slate-600',
      }}
    />
  )

  return (
    <Modal
      open
      onClose={onClose}
      title={t('manage.elements.importElements')}
      className={{
        content:
          'xl:w-300 max-h-[calc(100%-2rem)] w-[calc(100%-2rem)] overflow-hidden',
      }}
      secondaryLabel={t('shared.generic.cancel')}
      onSecondaryAction={onClose}
      dataCloseButton={{ cy: 'close-element-upload-modal' }}
      dataSecondaryAction={{ cy: 'cancel-element-upload-modal' }}
    >
      <div className="flex max-h-[calc(100vh-8rem)] min-h-0 flex-col gap-4">
        <UserNotification type="info" className={{ root: 'text-sm' }}>
          {t('manage.elements.importElementsInfo')}
        </UserNotification>

        {hasElementsForPreview && importToken ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <H4>{t('manage.elements.reviewElementsBeforeImport')}</H4>
                {uploadedFileName ? (
                  <div
                    className="mt-1 truncate text-sm text-slate-600"
                    data-cy="element-import-file-name"
                  >
                    {uploadedFileName}
                  </div>
                ) : null}
              </div>
              <div className="w-full sm:w-56">
                {renderUploadDropzone({ compact: true })}
              </div>
            </div>

            {packageWarnings.length > 0 ? (
              <div data-cy="element-import-package-warning">
                <UserNotification
                  type="warning"
                  message={packageWarnings.join(' ')}
                  className={{ root: 'text-sm' }}
                />
              </div>
            ) : null}

            <PackageAnswerCollectionOverview
              mode="import"
              collections={answerCollectionsForOverview}
              dataCy="element-import-answer-collections-overview"
            />

            <ImportedElementsOverviewTable
              elements={elementsForPreview}
              elementMeta={elementMetaForPreview}
              answerCollectionEntries={answerCollectionEntriesForPreview}
              importToken={importToken}
              refetchElements={refetchElements}
              onClose={onClose}
            />
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(18rem,0.85fr)_minmax(0,1.15fr)]">
            <div className="flex min-h-0 flex-col gap-3 overflow-auto">
              <H4>{t('manage.elements.uploadElementsFile')}</H4>
              {renderUploadDropzone()}
              {uploadError ? (
                <div data-cy="element-import-package-error">
                  <UserNotification
                    type="error"
                    message={uploadError}
                    className={{ root: 'text-sm' }}
                  />
                </div>
              ) : null}
            </div>

            <div className="flex min-h-0 flex-col gap-3 overflow-hidden">
              <H4>{t('manage.elements.reviewElementsBeforeImport')}</H4>
              <UserNotification
                message={t('manage.elements.elementImportEmptyState')}
                className={{ root: 'text-sm' }}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

export default UploadModal
