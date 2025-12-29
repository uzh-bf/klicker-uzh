import {
  faCheck,
  faMagnifyingGlass,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { ElementExistsInfo, ElementType } from '@klicker-uzh/graphql/dist/ops'
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
  elementsInfo,
  elementsForPreview,
}: {
  elementsInfo: ElementExistsInfo[]
  elementsForPreview: Record<string, ElementFormTypes>
}) {
  const t = useTranslations()

  const [previewedElementId, setPreviewedElementId] = useState<string | null>(
    null
  )

  const initialValues = useMemo(
    () =>
      elementsInfo.reduce(
        (acc, e) => ({
          ...acc,
          [e.id]: true,
        }),
        {} as Record<string, boolean>
      ),
    [elementsInfo]
  )
  return (
    <div className="">
      <Formik
        initialValues={initialValues}
        onSubmit={(values) => {
          console.log(values)
        }}
        enableReinitialize
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
                      <ShadcnTableHead className="w-10 whitespace-normal text-center font-bold leading-tight">
                        {t('manage.elements.elementExists')}
                      </ShadcnTableHead>
                      <ShadcnTableHead className="w-10 whitespace-normal text-center font-bold leading-tight">
                        {t('manage.elements.elementImport')}
                      </ShadcnTableHead>
                      <ShadcnTableHead className="w-10 whitespace-normal text-center font-bold leading-tight"></ShadcnTableHead>
                    </ShadcnTableRow>
                  </ShadcnTableHeader>
                  <ShadcnTableBody>
                    {elementsInfo.map((element) => (
                      <>
                        <ShadcnTableRow
                          key={`element-${element.id}`}
                          className="bg-muted/30 hover:bg-muted/80"
                          data-cy={`element-import-${element.id}`}
                        >
                          <ShadcnTableCell className="py-1">
                            {element.name}
                          </ShadcnTableCell>
                          <ShadcnTableCell className="py-1 text-center">
                            <FontAwesomeIcon
                              icon={element.exists ? faCheck : faXmark}
                            />
                          </ShadcnTableCell>
                          <ShadcnTableCell className="flex items-center justify-center py-1">
                            <FormikSwitchField
                              name={`${element.id}`}
                              id={`${element.id}`}
                              data={{
                                cy: `element-${element.id}-import`,
                              }}
                            />
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
                                  setPreviewedElementId(element.id.toString())
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
                        </ShadcnTableRow>
                      </>
                    ))}
                  </ShadcnTableBody>
                </ShadcnTable>
              </div>
              <div className="max-h-[calc(100vh-18rem)] flex-1 overflow-auto">
                {previewedElementId &&
                  elementsForPreview[previewedElementId] && (
                    <StudentElementPreview
                      values={elementsForPreview[previewedElementId]}
                      elementDataTypename={getElementDataType(
                        elementsForPreview[previewedElementId]?.type
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
