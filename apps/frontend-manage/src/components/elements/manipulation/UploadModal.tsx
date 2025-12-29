import { useMutation } from '@apollo/client'
import {
  CheckExistingImportedElementsDocument,
  ElementExistsInfo,
  ElementImportInput,
  ElementStatus,
  ElementType,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Modal, SelectField, toast } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import Dropzone from 'react-dropzone'
import * as Yup from 'yup'
import ImportedElementsOverviewTable from '../details/ImportedElementsOverviewTable'
import { ElementFormTypes } from './types'

/**
 * Check if uploaded json is either an element or an answercollection
 * Depending on uploaded content,
 * send it to the backend and check if the element/answercollection exists (should return yes or no)
 *
 */

type ElementUpload = {
  id: number
  isArchived: boolean
  name: string
  content: string
  options: object
  type: string
  pointsMultiplier: number
  explanation: string | null
  originalId: number | null
  version: number
  status: string
  answerCollectionId: number | null
  basePoints: boolean
}

async function validateElements(content: any) {
  try {
    const schema = Yup.array()
      .of(
        Yup.object({
          id: Yup.number().required(),
          isArchived: Yup.boolean().required(),
          name: Yup.string().required(),
          content: Yup.string().required(),
          options: Yup.object().required(),
          type: Yup.string().required(),
          pointsMultiplier: Yup.number().required(),
          explanation: Yup.string().nullable(),
          originalId: Yup.number().nullable(),
          version: Yup.number().required(),
          status: Yup.string().required(),
          answerCollectionId: Yup.number().nullable(),
          basePoints: Yup.boolean().required(),
        })
          .noUnknown(true)
          .strict(true)
      )
      .required()
    return await schema.validate(content, { strict: true })
  } catch (err: any) {
    const elementIndex = Number(err.path.match(/\[(\d+)\]/)?.[1]) + 1
    switch (err.type) {
      case 'required':
        throw new Error(`Missing field(s) in ${elementIndex}. element.`)
      case 'noUnknown':
        throw new Error(`Unknown field(s) in ${elementIndex}. element.`)
      case 'typeError':
        throw new Error(`Wrong field type(s) in ${elementIndex}. element.`)
      default:
        throw new Error(`Invalid element(s).`)
    }
  }
}

async function validateAnswerCollections(content: any) {
  try {
    const schema = Yup.object({
      id: Yup.number().required(),
      name: Yup.string().required(),
      description: Yup.string().required(),
      version: Yup.number().required(),
      originalId: Yup.number().nullable(),
      entries: Yup.array(
        Yup.object({
          id: Yup.number().required(),
          value: Yup.string().required(),
        })
      ),
      catalogAssignments: Yup.array(
        Yup.object({
          id: Yup.number().required(),
          access: Yup.string().required(),
          catalogCollectionId: Yup.string().required(),
        })
      ).required(),
    })
      .noUnknown(true)
      .strict(true)

    return await schema.validate(content)
  } catch (err: any) {
    switch (err.type) {
      case 'required':
        throw new Error(`Missing field(s).`)
      case 'noUnknown':
        throw new Error(`Unknown field(s).`)
      case 'typeError':
        throw new Error(`Wrong field type(s).`)
      default:
        throw new Error(`Invalid answer collection.`)
    }
  }
}

const enum ImportType {
  ELEMENTS = 'ELEMENTS',
  ANSWER_COLLECTION = 'ANSWER_COLLECTION',
}
function UploadModal({ onClose }: { onClose: () => void }) {
  const t = useTranslations()

  const [isUploading, setIsUploading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [elementsToImport, setElementsToImport] = useState<ElementExistsInfo[]>(
    []
  )
  const [importType, setImportType] = useState<ImportType>(ImportType.ELEMENTS)
  const [checkExistingImportedElements] = useMutation(
    CheckExistingImportedElementsDocument
  )
  const elements: ElementImportInput[] = []
  const [elementsForPreview, setElementsForPreview] = useState<
    Record<string, ElementFormTypes>
  >({})

  const handleFileUpload = async (files: File[]) => {
    setIsUploading(true)
    const contents: any[] = []
    try {
      for (const file of files) {
        // so far only single file upload is supported
        const contentTxt = await file.text()
        const content = JSON.parse(contentTxt)
        contents.push(content)
      }
    } catch (err: any) {
      toast({
        type: 'error',
        message: 'Error while parsing file.',
        options: { duration: 4000 },
      })
    }
    const content = contents[0]
    try {
      if (importType === ImportType.ELEMENTS) {
        const els = await validateElements(content)
        for (const el of els) {
          const { options, type, status, ...rest } = el
          elements.push({
            ...rest,
            type: type as ElementType,
            status: status as ElementStatus,
            optionsChoices:
              type === ElementType.Sc ||
              type === ElementType.Mc ||
              type == ElementType.Kprim
                ? options
                : null,
            optionsNumerical: type === ElementType.Numerical ? options : null,
            optionsFreeText: type === ElementType.FreeText ? options : null,
            optionsSelection: type === ElementType.Selection ? options : null,
            optionsCaseStudy: type === ElementType.CaseStudy ? options : null,
            // flash cards and content have empty options
          })

          // TODO: two elements with same id
          const sharedQuestionForm = {
            name: el.name,
            status: el.status as ElementStatus,
            content: el.content,
            pointsMultiplier: String(el.pointsMultiplier),
            basePoints: el.basePoints,
            tags: [], // TODO: import tags?
          }
          const typeSpecificForm = {
            type: el.type as ElementType,
            explanation: el.explanation ?? '',
            options: el.options,
          }
          const elementFormType = {
            ...sharedQuestionForm,
            ...typeSpecificForm,
          } as ElementFormTypes
          setElementsForPreview((prev) => ({
            ...prev,
            [el.id]: elementFormType,
          }))
        }
        if (elements.length) {
          const { data } = await checkExistingImportedElements({
            variables: { elements: elements },
          })

          if (!data || !data.checkExistingImportedElements) {
            throw new Error('Failed to verify if elements exist.')
          }
          setElementsToImport(data.checkExistingImportedElements)
        }
      } else {
        const answerCollection = await validateAnswerCollections(content)
        console.log(answerCollection)
      }
    } catch (err: any) {
      toast({
        type: 'error',
        message: err.message,
        options: { duration: 4000 },
      })
    }

    setIsUploading(false)
  }
  return (
    <Modal
      open
      onClose={onClose}
      title={t('shared.generic.upload')}
      className={{
        content:
          'xl:w-320 h-[calc(100%-2rem)] w-[calc(100%-2rem)] overflow-hidden',
      }}
      dataCloseButton={{ cy: 'close-element-download-modal' }}
    >
      <div className="flex h-full w-full flex-col gap-6 md:flex-row md:gap-6 lg:h-full lg:max-h-full">
        <div className="divide-yo flex h-full w-full flex-1 flex-col gap-4">
          <div className="flex flex-1 flex-row gap-6 p-2">
            <SelectField
              required
              label="Import Type" // t('manage.elements.importElementsOrAnswerCollection')
              items={[
                {
                  value: ImportType.ELEMENTS,
                  label: t('shared.generic.elements'),
                },
                {
                  value: ImportType.ANSWER_COLLECTION,
                  label: t('shared.generic.answerCollection'),
                },
              ]}
              value={importType}
              onChange={(value) => setImportType(value as ImportType)}
              className={{
                root: 'w-full flex-1',
                select: { root: 'w-full', trigger: 'w-full' },
              }}
            />
            <Dropzone
              onDropAccepted={handleFileUpload}
              multiple={false}
              accept={{
                'application/image': ['.json'],
              }}
            >
              {({ getRootProps, getInputProps }) => (
                <>
                  {/* <Suspense fallback={<Loader />}></Suspense> */}

                  <div
                    className="flex-1 p-2 hover:cursor-pointer hover:bg-slate-100"
                    {...getRootProps()}
                  >
                    <div className="m-2">
                      {isUploading ? (
                        <Loader />
                      ) : (
                        <p>{t('manage.elements.uploadImageDescription')}</p>
                      )}
                    </div>
                    <input type="file" {...getInputProps()} />
                  </div>
                </>
              )}
            </Dropzone>
          </div>
          <div className="flex w-full flex-1 flex-col">
            {elementsToImport.length > 0 ? (
              <div className="flex flex-1 flex-col gap-2 p-4">
                <h3 className="m-0 p-0 font-bold">
                  {t('shared.generic.elements')}
                </h3>
                <ImportedElementsOverviewTable
                  elementsInfo={elementsToImport}
                  elementsForPreview={elementsForPreview}
                />
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default UploadModal
