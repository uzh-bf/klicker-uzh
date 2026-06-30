import React from 'react'
import { ElementData } from '../../../lib/constants/elementTypes'
import StudentElementPreviewWrapper from './StudentElementPreviewWrapper'
import { ElementFormTypes } from './types'
import useArtificialElementInstance from './useArtificialElementInstance'

interface StudentElementPreviewProps {
  values: ElementFormTypes
  elementDataTypename?: ElementData['__typename']
  answerCollectionEntries?: { id: number; value: string }[]
}

function StudentElementPreview({
  values,
  elementDataTypename,
  answerCollectionEntries,
}: StudentElementPreviewProps): React.ReactElement {
  // generate artificial instance from form content
  const artificialInstance = useArtificialElementInstance({
    values,
    elementDataTypename,
    answerCollectionEntries,
  })

  return (
    <StudentElementPreviewWrapper
      values={values}
      instance={artificialInstance}
    />
  )
}

export default StudentElementPreview
