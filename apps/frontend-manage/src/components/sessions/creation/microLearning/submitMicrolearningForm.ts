import { GetSingleCourseDocument } from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import {
  ElementStackFormValues,
  MicroLearningFormValues,
} from '../WizardLayout'

interface MicroLearningFormProps {
  id?: string
  values: MicroLearningFormValues
  createMicroLearning: any
  editMicroLearning: any
  setSelectedCourseId: (courseId?: string) => void
  setIsWizardCompleted: (isCompleted: boolean) => void
  setErrorToastOpen: (isOpen: boolean) => void
  editMode: boolean
}

async function submitMicrolearningForm({
  id,
  values,
  createMicroLearning,
  editMicroLearning,
  setSelectedCourseId,
  setIsWizardCompleted,
  setErrorToastOpen,
  editMode,
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
          elements: stack.elementIds.map((elementId, ix) => {
            return { elementId, order: ix }
          }),
        }
      }),
      startDate: dayjs(values.startDate).utc().format(),
      endDate: dayjs(values.endDate).utc().format(),
      multiplier: parseInt(values.multiplier),
      courseId: values.courseId,
    }

    if (editMode) {
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
    }
  } catch (error) {
    console.log(error)
    setErrorToastOpen(true)
  }
}

export default submitMicrolearningForm
