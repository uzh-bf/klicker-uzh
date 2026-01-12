import { useMutation } from '@apollo/client'
import { faMagnifyingGlass } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  CaseStudySolutionInput,
  ElementType,
  GetUserTagsDocument,
  ManipulateCaseStudyQuestionDocument,
  ManipulateChoicesQuestionDocument,
  ManipulateContentElementDocument,
  ManipulateFlashcardElementDocument,
  ManipulateFreeTextQuestionDocument,
  ManipulateNumericalQuestionDocument,
  ManipulateSelectionQuestionDocument,
} from '@klicker-uzh/graphql/dist/ops'
import {
  Button,
  FormikSwitchField,
  ShadcnTable,
  ShadcnTableBody,
  ShadcnTableCell,
  ShadcnTableHead,
  ShadcnTableHeader,
  ShadcnTableRow,
  Tooltip,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import {
  prepareCaseStudyArgs,
  prepareChoicesArgs,
  prepareContentArgs,
  prepareFlashcardArgs,
  prepareFreeTextArgs,
  prepareNumericalArgs,
  prepareSelectionArgs,
} from '../manipulation/helpers'
import StudentElementPreview from '../manipulation/StudentElementPreview'
import { ElementFormTypes } from '../manipulation/types'

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
  refetchElements,
  onClose,
}: {
  elements: Record<string, ElementFormTypes>
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
  const [manipulateContentElement] = useMutation(
    ManipulateContentElementDocument
  )
  const [manipulateFlashcardElement] = useMutation(
    ManipulateFlashcardElementDocument
  )
  const [manipulateChoicesQuestion] = useMutation(
    ManipulateChoicesQuestionDocument
  )
  const [manipulateNumericalQuestion] = useMutation(
    ManipulateNumericalQuestionDocument
  )
  const [manipulateFreeTextQuestion] = useMutation(
    ManipulateFreeTextQuestionDocument
  )
  const [manipulateSelectionQuestion] = useMutation(
    ManipulateSelectionQuestionDocument
  )
  const [manipulateCaseStudyQuestion] = useMutation(
    ManipulateCaseStudyQuestionDocument
  )

  return (
    <div className="">
      <Formik
        initialValues={initialValues}
        onSubmit={async (values) => {
          for (const element of Object.keys(elements)) {
            if (!values[element]) {
              continue
            }
            const elementData = elements[element]
            try {
              switch (elementData.type) {
                case ElementType.Content: {
                  const args = prepareContentArgs({
                    isDuplication: false,
                    values: elementData,
                  })

                  const result = await manipulateContentElement({
                    variables: args,
                    refetchQueries: [{ query: GetUserTagsDocument }],
                  })
                  await refetchElements()

                  const data = result.data?.manipulateContentElement
                  if (data?.__typename !== 'ContentElement' || !data.id) {
                    return false
                  }

                  break
                }

                case ElementType.Flashcard: {
                  const args = prepareFlashcardArgs({
                    isDuplication: false,
                    values: elementData,
                  })

                  const result = await manipulateFlashcardElement({
                    variables: args,
                    refetchQueries: [{ query: GetUserTagsDocument }],
                  })
                  await refetchElements()

                  const data = result.data?.manipulateFlashcardElement
                  if (data?.__typename !== 'FlashcardElement' || !data.id) {
                    return false
                  }

                  break
                }

                case ElementType.Sc:
                case ElementType.Mc:
                case ElementType.Kprim: {
                  const args = prepareChoicesArgs({
                    isDuplication: false,
                    values: elementData,
                  })

                  const result = await manipulateChoicesQuestion({
                    variables: args,
                    refetchQueries: [{ query: GetUserTagsDocument }],
                  })
                  await refetchElements()

                  const data = result.data?.manipulateChoicesQuestion
                  if (data?.__typename !== 'ChoicesElement' || !data.id) {
                    return false
                  }

                  break
                }

                case ElementType.Numerical: {
                  const args = prepareNumericalArgs({
                    isDuplication: false,
                    values: elementData,
                  })

                  const result = await manipulateNumericalQuestion({
                    variables: args,
                    refetchQueries: [{ query: GetUserTagsDocument }],
                  })
                  await refetchElements()

                  const data = result.data?.manipulateNumericalQuestion
                  if (data?.__typename !== 'NumericalElement' || !data.id) {
                    return false
                  }

                  break
                }

                case ElementType.FreeText: {
                  const args = prepareFreeTextArgs({
                    isDuplication: false,
                    values: elementData,
                  })

                  const result = await manipulateFreeTextQuestion({
                    variables: args,
                    refetchQueries: [{ query: GetUserTagsDocument }],
                  })
                  await refetchElements()

                  const data = result.data?.manipulateFreeTextQuestion
                  if (data?.__typename !== 'FreeTextElement' || !data.id) {
                    return false
                  }

                  break
                }

                case ElementType.Selection: {
                  // TODO: test this for existing and non-existing answer collections
                  const args = prepareSelectionArgs({
                    isDuplication: false,
                    values: elementData,
                  })

                  const result = await manipulateSelectionQuestion({
                    variables: args,
                    refetchQueries: [{ query: GetUserTagsDocument }],
                  })
                  await refetchElements()

                  const data = result.data?.manipulateSelectionQuestion
                  if (data?.__typename !== 'SelectionElement' || !data.id) {
                    return false
                  }

                  break
                }

                case ElementType.CaseStudy: {
                  // TODO: test this for existing and non-existing answer collections
                  let args = prepareCaseStudyArgs({
                    isDuplication: false,
                    values: elementData,
                  })
                  const { options, ...rest } = args
                  const { cases, ...restOptions } = options
                  const updatedCases = []
                  for (const caseItem of elementData.options.cases) {
                    const caseId = caseItem.id
                    const caseArgs = cases.find((c) => c.id === caseId)
                    if (!caseArgs) continue
                    const { solutions, ...restCaseArgs } = caseArgs

                    const updatedSolutions: CaseStudySolutionInput[] =
                      Object.entries(caseItem.solutions ?? {}).map(
                        ([itemId, criteriaSolutions]) => ({
                          itemId: parseInt(
                            (criteriaSolutions as any)['itemId']
                          ),
                          criteriaSolutions: Object.entries(
                            (criteriaSolutions as any)['criteriaSolutions']
                          ).map(([criterionId, criterionValues]) => ({
                            criterionId: (criterionValues as any)[
                              'criterionId'
                            ],
                            min: parseFloat((criterionValues as any)['min']),
                            max: parseFloat((criterionValues as any)['max']),
                          })),
                        })
                      )
                    const updatedCase = {
                      ...restCaseArgs,
                      solutions: updatedSolutions,
                    }
                    updatedCases.push(updatedCase)
                  }
                  const finalArgs = {
                    ...rest,
                    options: {
                      ...restOptions,
                      cases: updatedCases,
                    },
                  }

                  const result = await manipulateCaseStudyQuestion({
                    variables: finalArgs,
                    refetchQueries: [{ query: GetUserTagsDocument }],
                  })

                  await refetchElements()

                  const data = result.data?.manipulateCaseStudyQuestion
                  if (data?.__typename !== 'CaseStudyElement' || !data.id) {
                    return false
                  }

                  break
                }

                default:
                  break
              }
              onClose()
            } catch (error) {
              console.error(
                'Error while importing element:',
                elementData,
                error
              )
            }
          }
        }}
      >
        {({ values }) => (
          <Form className="flex flex-col gap-4 overflow-auto">
            <div className="flex flex-1 flex-row">
              <div className="max-h-[calc(100vh-18rem)] flex-1 overflow-scroll">
                <ShadcnTable className="mt-2 text-sm">
                  <ShadcnTableHeader>
                    <ShadcnTableRow>
                      <ShadcnTableHead className="w-20 whitespace-normal text-center font-bold leading-tight">
                        {t('manage.elements.elementTitle')}
                      </ShadcnTableHead>
                      <ShadcnTableHead className="w-10 whitespace-normal text-center font-bold leading-tight"></ShadcnTableHead>

                      <ShadcnTableHead className="w-10 whitespace-normal text-center font-bold leading-tight">
                        {t('manage.elements.elementImport')}
                      </ShadcnTableHead>
                    </ShadcnTableRow>
                  </ShadcnTableHeader>
                  <ShadcnTableBody>
                    {Object.entries(elements).map(([key, element]) => {
                      return (
                        <ShadcnTableRow
                          key={`element-${key}`}
                          className="bg-muted/30 hover:bg-muted/80"
                          data-cy={`element-import-${key}`}
                        >
                          <ShadcnTableCell className="py-1">
                            {element.name}
                          </ShadcnTableCell>

                          <ShadcnTableCell className="py-1">
                            <Tooltip
                              tooltip={t('manage.activities.previewElement')}
                            >
                              <Button
                                basic
                                size="icon"
                                className={{ root: 'h-8 w-8' }}
                                onClick={() => {
                                  setPreviewedElementId(key.toString())
                                }}
                                data-cy={`preview-instance-${element.name}`}
                              >
                                <FontAwesomeIcon
                                  icon={faMagnifyingGlass}
                                  size="sm"
                                />
                              </Button>
                            </Tooltip>
                          </ShadcnTableCell>
                          <ShadcnTableCell className="flex items-center justify-center py-1">
                            <FormikSwitchField
                              name={`${key}`}
                              id={`${key}`}
                              data={{
                                cy: `element-${key}-import`,
                              }}
                            />
                          </ShadcnTableCell>
                        </ShadcnTableRow>
                      )
                    })}
                  </ShadcnTableBody>
                </ShadcnTable>
              </div>
              <div className="max-h-[calc(100vh-18rem)] flex-1 overflow-auto">
                {previewedElementId && elements[previewedElementId] && (
                  <StudentElementPreview
                    values={elements[previewedElementId]}
                    elementDataTypename={getElementDataType(
                      elements[previewedElementId]?.type
                    )}
                    answerCollectionEntries={[]}
                  />
                )}
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="submit">Import</Button>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  )
}

export default ImportedElementsOverviewTable
