import React from 'react'
import type { ActivityElementInstance } from '../../../lib/constants/activityEnums'
import StudentElementPreviewWrapper from './StudentElementPreviewWrapper'

type StudentElementPreviewWrapperProps = Parameters<
  typeof StudentElementPreviewWrapper
>[0]

interface StudentElementPreviewActivityDetailsProps {
  instance: ActivityElementInstance
}

function StudentElementPreviewActivityDetails({
  instance,
}: StudentElementPreviewActivityDetailsProps): React.ReactElement {
  return (
    <StudentElementPreviewWrapper
      values={
        instance.elementData as StudentElementPreviewWrapperProps['values']
      }
      instance={instance as StudentElementPreviewWrapperProps['instance']}
    />
  )
}

export default StudentElementPreviewActivityDetails
