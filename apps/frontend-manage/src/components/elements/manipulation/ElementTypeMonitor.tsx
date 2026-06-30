import { FormikErrors } from 'formik'
import { useEffect } from 'react'
import { ElementData, ElementType } from '../../../lib/constants/elementTypes'
import { ElementFormTypes } from './types'

interface ElementTypeMonitorProps {
  elementType: ElementType
  setElementDataTypename: (typename: ElementData['__typename']) => void
  validateForm: () => Promise<FormikErrors<ElementFormTypes>>
}

function ElementTypeMonitor({
  elementType,
  setElementDataTypename,
  validateForm,
}: ElementTypeMonitorProps) {
  useEffect(() => {
    if (
      elementType === ElementType.Sc ||
      elementType === ElementType.Mc ||
      elementType === ElementType.Kprim
    ) {
      setElementDataTypename('ChoicesElementData')
    } else if (elementType === ElementType.Numerical) {
      setElementDataTypename('NumericalElementData')
    } else if (elementType === ElementType.FreeText) {
      setElementDataTypename('FreeTextElementData')
    } else if (elementType === ElementType.Flashcard) {
      setElementDataTypename('FlashcardElementData')
    } else if (elementType === ElementType.Selection) {
      setElementDataTypename('SelectionElementData')
    } else if (elementType === ElementType.CaseStudy) {
      setElementDataTypename('CaseStudyElementData')
    } else {
      setElementDataTypename('ContentElementData')
    }

    validateForm()
  }, [elementType, setElementDataTypename, validateForm])

  return null
}

export default ElementTypeMonitor
