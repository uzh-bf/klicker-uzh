import { GetSingleCourseDocument } from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { ElementStackFormValues, PracticeQuizFormValues } from '../WizardLayout'

interface PracticeQuizFormProps {
  id?: string
  conversion: boolean
  values: PracticeQuizFormValues
  createPracticeQuiz: any
  editPracticeQuiz: any
  setSelectedCourseId: (courseId?: string) => void
  setIsWizardCompleted: (isCompleted: boolean) => void
  setErrorToastOpen: (isOpen: boolean) => void
  setEditMode: (editMode: boolean) => void
}

async function submitPracticeQuizForm({
  id,
  conversion,
  values,
  createPracticeQuiz,
  editPracticeQuiz,
  setSelectedCourseId,
  setIsWizardCompleted,
  setErrorToastOpen,
  setEditMode,
}: PracticeQuizFormProps) {
  try {
    let success = false

    const createOrUpdateJSON = {
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
      multiplier: parseInt(values.multiplier),
      courseId: values.courseId,
      order: values.order,
      availableFrom: dayjs(values.availableFrom).utc().format(),
      resetTimeDays: parseInt(values.resetTimeDays),
    }

    if (id && !conversion) {
      const result = await editPracticeQuiz({
        variables: {
          id,
          ...createOrUpdateJSON,
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

      success = Boolean(result.data?.editPracticeQuiz)
    } else {
      const result = await createPracticeQuiz({
        variables: createOrUpdateJSON,
        refetchQueries: [
          {
            query: GetSingleCourseDocument,
            variables: {
              courseId: values.courseId,
            },
          },
        ],
      })

      success = Boolean(result.data?.createPracticeQuiz)
    }

    if (success) {
      setIsWizardCompleted(true)
      setSelectedCourseId(values.courseId)
    }
  } catch (error) {
    console.log(error)
    setEditMode(!!id && !conversion)
    setErrorToastOpen(true)
  }
}

export default submitPracticeQuizForm
