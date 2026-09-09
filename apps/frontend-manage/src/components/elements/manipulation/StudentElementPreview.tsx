import { ElementData } from '@klicker-uzh/graphql/dist/ops'
import React from 'react'
import StudentElementPreviewWrapper from './StudentElementPreviewWrapper'
import { ElementFormTypes } from './types'
import useArtificialElementInstance from './useArtificialElementInstance'

interface StudentElementPreviewProps {
  values: ElementFormTypes
  elementDataTypename?: ElementData['__typename']
  answerCollectionEntries?: readonly { id: number; value: string }[]
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
