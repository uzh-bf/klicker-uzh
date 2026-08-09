import { useEffect } from 'react'
import { CourseManipulationFormData } from './CourseManipulationModal'

function GamificationSettingMonitor({
  values,
  setFieldValue,
}: {
  values: CourseManipulationFormData
  setFieldValue: (
    field: string,
    value: any,
    shouldValidate?: boolean
  ) => Promise<void | any>
}) {
  // If gamification or group creation are disabled, reset the group setting to
  // their default values. The size fields remain trigger-only dependencies so
  // edits made while disabled are restored immediately.
  // biome-ignore lint/correctness/useExhaustiveDependencies: size values intentionally trigger restoration while settings are disabled
  useEffect(() => {
    if (!values.isGamificationEnabled || !values.isGroupCreationEnabled) {
      setFieldValue('isGroupCreationEnabled', false)
      setFieldValue('groupCreationDeadline', values.endDate)
      setFieldValue('maxGroupSize', 5)
      setFieldValue('preferredGroupSize', 3)
    }
  }, [
    setFieldValue,
    values.endDate,
    values.isGamificationEnabled,
    values.isGroupCreationEnabled,
    values.maxGroupSize,
    values.preferredGroupSize,
  ])

  return null
}

export default GamificationSettingMonitor
