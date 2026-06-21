import dayjs from 'dayjs'
import type { RouterInputs, RouterOutputs } from '../../../../lib/trpc'
import { GroupActivityFormValues } from '../WizardLayout'

type CreateGroupActivityInput = RouterInputs['activity']['createGroupActivity']
type CreateGroupActivityResult =
  RouterOutputs['activity']['createGroupActivity']
type EditGroupActivityInput = RouterInputs['activity']['editGroupActivity']
type EditGroupActivityResult = RouterOutputs['activity']['editGroupActivity']

interface GroupActivityFormSubmissionProps {
  id?: string
  previousCourseId?: string
  values: GroupActivityFormValues
  createGroupActivity: (
    input: CreateGroupActivityInput
  ) => Promise<CreateGroupActivityResult>
  editGroupActivity: (
    input: EditGroupActivityInput
  ) => Promise<EditGroupActivityResult>
  setIsWizardCompleted: (isCompleted: boolean) => void
  invalidateCourseDetail: (courseId: string) => Promise<void>
  invalidateActivities: () => Promise<void>
  onError: () => void
}

async function submitGroupActivityForm({
  id,
  previousCourseId,
  values,
  createGroupActivity,
  editGroupActivity,
  setIsWizardCompleted,
  invalidateCourseDetail,
  invalidateActivities,
  onError,
}: GroupActivityFormSubmissionProps) {
  try {
    let success = false
    const createUpdateJSON = {
      name: values.name,
      displayName: values.displayName,
      description: values.description,
      startDate: dayjs(values.startDate).utc().toDate(),
      endDate: dayjs(values.endDate).utc().toDate(),
      multiplier: parseInt(values.multiplier),
      courseId: values.courseId!,
      clues: values.clues as CreateGroupActivityInput['clues'],
      stack: {
        elements: values.stack.elements.map((element, ix) => ({
          elementId: element.id,
          order: ix,
          existingInstanceId: element.existingInstanceId,
          duplicateInstance: element.duplicateInstance,
        })),
        order: 0,
      },
    }

    if (id) {
      const result = await editGroupActivity({ id, ...createUpdateJSON })

      success = Boolean(result.editGroupActivity)
      if (result.editGroupActivity?.courseId) {
        const courseIds = new Set(
          [previousCourseId, result.editGroupActivity.courseId].filter(
            (courseId): courseId is string => Boolean(courseId)
          )
        )
        void Promise.all(
          Array.from(courseIds).map(invalidateCourseDetail)
        ).catch(console.error)
      }
    } else {
      const result = await createGroupActivity(createUpdateJSON)

      success = Boolean(result.createGroupActivity)
      if (result.createGroupActivity?.courseId) {
        void invalidateCourseDetail(result.createGroupActivity.courseId).catch(
          console.error
        )
      }
    }

    if (success) {
      void invalidateActivities().catch(console.error)
      setIsWizardCompleted(true)
    } else {
      onError()
    }
  } catch (error) {
    console.log(error)
    onError()
  }
}

export default submitGroupActivityForm
