import { GetSingleCourseDocument } from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { GroupActivityFormValues } from '../WizardLayout'

interface GroupActivityFormSubmissionProps {
  id?: string
  values: GroupActivityFormValues
  createGroupActivity: any
  editGroupActivity: any
  setIsWizardCompleted: (isCompleted: boolean) => void
  setSelectedCourseId: (courseId: string | undefined) => void
  onError: () => void
}

async function submitGroupActivityForm({
  id,
  values,
  createGroupActivity,
  editGroupActivity,
  setIsWizardCompleted,
  setSelectedCourseId,
  onError,
}: GroupActivityFormSubmissionProps) {
  try {
    let success = false
    if (id) {
      const result = await editGroupActivity({
        variables: {
          id: id,
          name: values.name,
          displayName: values.displayName,
          description: values.description,
          startDate: dayjs(values.startDate).utc().format(),
          endDate: dayjs(values.endDate).utc().format(),
          multiplier: parseInt(values.multiplier),
          courseId: values.courseId,
          clues: values.clues,
          stack: {
            elements: values.stack.elements.map((element, ix) => ({
              elementId: element.id,
              order: ix,
              existingInstanceId: element.existingInstanceId,
              duplicateInstance: element.duplicateInstance,
            })),
            order: 0,
          },
        },
        refetchQueries: [
          {
            query: GetSingleCourseDocument,
            variables: {
              courseId: values.courseId,
            },
          },
        ],
      })

      success = Boolean(result.data?.editGroupActivity)
    } else {
      const result = await createGroupActivity({
        variables: {
          name: values.name,
          displayName: values.displayName,
          description: values.description,
          startDate: dayjs(values.startDate).utc().format(),
          endDate: dayjs(values.endDate).utc().format(),
          multiplier: parseInt(values.multiplier),
          courseId: values.courseId,
          clues: values.clues,
          stack: {
            elements: values.stack.elements.map((element, ix) => ({
              elementId: element.id,
              order: ix,
              existingInstanceId: element.existingInstanceId,
              duplicateInstance: element.duplicateInstance,
            })),
            order: 0,
          },
        },
        refetchQueries: [
          {
            query: GetSingleCourseDocument,
            variables: {
              courseId: values.courseId,
            },
          },
        ],
      })
      success = Boolean(result.data?.createGroupActivity)
    }

    if (success) {
      setSelectedCourseId(values.courseId)
      setIsWizardCompleted(true)
    }
  } catch (error) {
    console.log(error)
    onError()
  }
}

export default submitGroupActivityForm
