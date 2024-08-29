import { useEffect } from 'react'
import { CourseCreationFormData } from './CourseCreationModal'

function GamificationSettingMonitor({
  values,
  setFieldValue,
}: {
  values: CourseCreationFormData
  setFieldValue: (
    field: string,
    value: any,
    shouldValidate?: boolean
  ) => Promise<void | any>
}) {
  // if the gamification or group creation are disabled, reset the group setting to their default values
  useEffect(() => {
    if (!values.isGamificationEnabled || !values.isGroupCreationEnabled) {
      setFieldValue('groupCreationDeadline', values.endDate)
      setFieldValue('maxGroupSize', 5)
      setFieldValue('preferredGroupSize', 3)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    values.isGamificationEnabled,
    values.isGroupCreationEnabled,
    values.maxGroupSize,
    values.preferredGroupSize,
  ])

  return null
}

export default GamificationSettingMonitor
