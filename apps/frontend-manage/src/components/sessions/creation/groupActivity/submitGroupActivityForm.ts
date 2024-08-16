import {
  GetSingleCourseDocument,
  StackElementsInput,
} from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { GroupActivityFormValues } from '../WizardLayout'

interface GroupActivityFormSubmissionProps {
  id?: string
  values: GroupActivityFormValues
  createGroupActivity: any
  editGroupActivity: any
  setEditMode: (editMode: boolean) => void
  setIsWizardCompleted: (isCompleted: boolean) => void
  setErrorToastOpen: (isOpen: boolean) => void
  setSelectedCourseId: (courseId: string | undefined) => void
}

async function submitGroupActivityForm({
  id,
  values,
  createGroupActivity,
  editGroupActivity,
  setEditMode,
  setIsWizardCompleted,
  setErrorToastOpen,
  setSelectedCourseId,
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
            elements: values.stack.elementIds.map<StackElementsInput>(
              (id, ix) => ({
                elementId: id,
                order: ix,
              })
            ),
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
            elements: values.stack.elementIds.map<StackElementsInput>(
              (id, ix) => ({
                elementId: id,
                order: ix,
              })
            ),
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
      setEditMode(!!id)
      setIsWizardCompleted(true)
    }
  } catch (error) {
    console.log(error)
    setEditMode(!!id)
    setErrorToastOpen(true)
  }
}

export default submitGroupActivityForm
