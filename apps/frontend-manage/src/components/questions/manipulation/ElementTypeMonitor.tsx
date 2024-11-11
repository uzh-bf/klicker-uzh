import { ElementData, ElementType } from '@klicker-uzh/graphql/dist/ops'
import { useEffect } from 'react'

interface ElementTypeMonitorProps {
  elementType: ElementType
  setElementDataTypename: (typename: ElementData['__typename']) => void
}

function ElementTypeMonitor({
  elementType,
  setElementDataTypename,
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
    } else {
      setElementDataTypename('ContentElementData')
    }
  }, [elementType])

  return null
}

export default ElementTypeMonitor
