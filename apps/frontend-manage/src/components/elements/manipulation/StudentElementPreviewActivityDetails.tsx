import { ElementInstance } from '@klicker-uzh/graphql/dist/ops'
import React from 'react'
import StudentElementPreviewWrapper from './StudentElementPreviewWrapper'

interface StudentElementPreviewActivityDetailsProps {
  instance: ElementInstance
}

function StudentElementPreviewActivityDetails({
  instance,
}: StudentElementPreviewActivityDetailsProps): React.ReactElement {
  return (
    <StudentElementPreviewWrapper
      values={instance.elementData}
      instance={instance}
    />
  )
}

export default StudentElementPreviewActivityDetails
