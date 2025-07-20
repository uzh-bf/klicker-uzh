import { GetSingleCourseDocument } from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import {
  ElementStackFormValues,
  MicroLearningFormValues,
} from '../WizardLayout'

interface MicroLearningFormProps {
  id?: string
  values: MicroLearningFormValues
  editMode: boolean
  createMicroLearning: any
  editMicroLearning: any
  setSelectedCourseId: (courseId?: string) => void
  setIsWizardCompleted: (isCompleted: boolean) => void
  onError: () => void
}

async function submitMicrolearningForm({
  id,
  values,
  editMode,
  createMicroLearning,
  editMicroLearning,
  setSelectedCourseId,
  setIsWizardCompleted,
  onError,
}: MicroLearningFormProps) {
  try {
    let success = false

    const createUpdateJSON = {
      name: values.name,
      displayName: values.displayName,
      description: values.description,
      stacks: values.stacks.map((stack: ElementStackFormValues, ix) => {
        return {
          order: ix,
          displayName:
            stack.displayName && stack.displayName.length > 0
              ? stack.displayName
              : undefined,
          description:
            stack.description && stack.description.length > 0
              ? stack.description
              : undefined,
          elements: stack.elements.map((element, ix) => {
            return {
              elementId: element.id,
              order: ix,
              existingInstanceId: element.existingInstanceId,
              duplicateInstance: element.duplicateInstance,
            }
          }),
        }
      }),
      startDate: dayjs(values.startDate).utc().format(),
      endDate: dayjs(values.endDate).utc().format(),
      multiplier: parseInt(values.multiplier),
      courseId: values.courseId,
    }

    if (editMode) {
      // TODO: extend this mutation to also update the flags for outdated instances
      const result = await editMicroLearning({
        variables: {
          id,
          ...createUpdateJSON,
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
      success = Boolean(result.data?.editMicroLearning)
    } else {
      const result = await createMicroLearning({
        variables: {
          ...createUpdateJSON,
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
      success = Boolean(result.data?.createMicroLearning)
    }

    if (success) {
      setSelectedCourseId(values.courseId)
      setIsWizardCompleted(true)
    } else {
      onError()
    }
  } catch (error) {
    console.log(error)
    onError()
  }
}

export default submitMicrolearningForm
