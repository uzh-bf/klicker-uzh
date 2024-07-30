import { useMutation } from '@apollo/client'
import {
  CreatePracticeQuizDocument,
  EditPracticeQuizDocument,
  Element,
  ElementOrderType,
  ElementType,
  GetSingleCourseDocument,
  PracticeQuiz,
} from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as yup from 'yup'
import ElementCreationErrorToast from '../../../toasts/ElementCreationErrorToast'
import { ElementSelectCourse } from '../ElementCreation'
import MultistepWizard, {
  ElementStackFormValues,
  PracticeQuizFormValues,
} from '../MultistepWizard'
import StackCreationStep from '../StackCreationStep'
import PracticeQuizDescriptionStep from './PracticeQuizDescriptionStep'
import PracticeQuizInformationStep from './PracticeQuizInformationStep'
import PracticeQuizSettingsStep from './PracticeQuizSettingsStep'

export interface PracticeQuizWizardStepProps {
  onSubmit?: () => void
  validationSchema: any
  gamifiedCourses?: ElementSelectCourse[]
  nonGamifiedCourses?: ElementSelectCourse[]
}

interface PracticeQuizWizardProps {
  title: string
  gamifiedCourses: ElementSelectCourse[]
  nonGamifiedCourses: ElementSelectCourse[]
  closeWizard: () => void
  initialValues?: PracticeQuiz
  selection: Record<number, Element>
  resetSelection: () => void
  conversion?: boolean
}

function PracticeQuizWizard({
  title,
  gamifiedCourses,
  nonGamifiedCourses,
  closeWizard,
  initialValues,
  selection,
  resetSelection,
  conversion = false,
}: PracticeQuizWizardProps) {
  const router = useRouter()
  const t = useTranslations()

  const [createPracticeQuiz] = useMutation(CreatePracticeQuizDocument)
  const [editPracticeQuiz] = useMutation(EditPracticeQuizDocument)
  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [editMode, setEditMode] = useState(!!initialValues && !conversion)
  const [selectedCourseId, setSelectedCourseId] = useState('')
  const [isWizardCompleted, setIsWizardCompleted] = useState(false)

  // TODO: add free text questions to accepted types?
  const acceptedTypes = [
    ElementType.Sc,
    ElementType.Mc,
    ElementType.Kprim,
    ElementType.Numerical,
    ElementType.Flashcard,
    ElementType.Content,
  ]

  const nameValidationSchema = yup.object().shape({
    name: yup.string().required(t('manage.sessionForms.sessionName')),
  })

  const descriptionValidationSchema = yup.object().shape({
    displayName: yup
      .string()
      .required(t('manage.sessionForms.sessionDisplayName')),
    description: yup.string(),
  })

  const stepTwoValidationSchema = yup.object().shape({
    multiplier: yup
      .string()
      .matches(/^[0-9]+$/, t('manage.sessionForms.validMultiplicator')),
    courseId: yup
      .string()
      .required(t('manage.sessionForms.practiceQuizSelectCourse')),
    order: yup
      .string()
      .required()
      .oneOf(
        Object.values(ElementOrderType),
        t('manage.sessionForms.practiceQuizOrder')
      ),
    availableFrom: yup.date(),
    resetTimeDays: yup
      .string()
      .required(t('manage.sessionForms.practiceQuizResetDays'))
      .matches(/^[0-9]+$/, t('manage.sessionForms.practiceQuizValidResetDays')),
  })

  const stackValiationSchema = yup.object().shape({
    stacks: yup
      .array()
      .of(
        yup.object().shape({
          displayName: yup.string(),
          description: yup.string(),
          elementIds: yup
            .array()
            .of(yup.number())
            .min(1, t('manage.sessionForms.minOneElementPerStack')),
          titles: yup.array().of(yup.string()),
          types: yup
            .array()
            .of(
              yup
                .string()
                .oneOf(
                  acceptedTypes,
                  t('manage.sessionForms.practiceQuizTypes')
                )
            ),
          hasSampleSolutions: yup
            .array()
            .of(
              yup.boolean().isTrue(t('manage.sessionForms.elementSolutionReq'))
            ),
        })
      )
      .min(1),
  })

  const onSubmit = async (values: PracticeQuizFormValues) => {
    try {
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

      if (initialValues && !conversion) {
        const result = await editPracticeQuiz({
          variables: {
            id: initialValues.id,
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

        if (result.data?.editPracticeQuiz) {
          setIsWizardCompleted(true)
        }
        setSelectedCourseId(values.courseId)
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

        if (result.data?.createPracticeQuiz) {
          setIsWizardCompleted(true)
        }
        setSelectedCourseId(values.courseId)
      }
    } catch (error) {
      console.log(error)
      setEditMode(!!initialValues && !conversion)
      setErrorToastOpen(true)
    }
  }

  return (
    <>
      <MultistepWizard
        title={title}
        onCloseWizard={closeWizard}
        completionSuccessMessage={(elementName) => (
          <div>
            {editMode
              ? t.rich('manage.sessionForms.practiceQuizUpdated', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })
              : t.rich('manage.sessionForms.practiceQuizCreated', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })}
          </div>
        )}
        initialValues={{
          name: initialValues?.name || '',
          displayName: initialValues?.displayName || '',
          description: initialValues?.description || '',
          stacks: initialValues?.stacks
            ? initialValues.stacks.map((stack) => {
                return {
                  displayName: stack.displayName,
                  description: stack.description,
                  ...stack.elements!.reduce(
                    (acc: ElementStackFormValues, element) => {
                      acc.elementIds.push(parseInt(element.elementData.id))
                      acc.titles.push(element.elementData.name)
                      acc.types.push(element.elementData.type)
                      acc.hasSampleSolutions.push(true) // TODO: get value from element instance
                      return acc
                    },
                    {
                      elementIds: [],
                      titles: [],
                      types: [],
                      hasSampleSolutions: [],
                    }
                  ),
                }
              })
            : [
                {
                  displayName: '',
                  description: '',
                  elementIds: [],
                  titles: [],
                  types: [],
                  hasSampleSolutions: [],
                },
              ],
          multiplier: initialValues?.pointsMultiplier
            ? String(initialValues?.pointsMultiplier)
            : '1',
          courseId: initialValues?.course?.id || undefined,
          order: initialValues?.orderType || ElementOrderType.SpacedRepetition,
          availableFrom: initialValues?.availableFrom
            ? dayjs(initialValues?.availableFrom)
                .local()
                .format('YYYY-MM-DDTHH:mm')
            : dayjs().local().format('YYYY-MM-DDTHH:mm'),
          resetTimeDays: initialValues?.resetTimeDays || '6',
        }}
        onSubmit={onSubmit}
        isCompleted={isWizardCompleted}
        editMode={!!initialValues && !conversion}
        initialValid={!!initialValues}
        onRestartForm={() => {
          setIsWizardCompleted(false)
        }}
        onViewElement={() => {
          router.push(`/courses/${selectedCourseId}?tab=practiceQuizzes`)
        }}
        workflowItems={[
          {
            title: t('shared.generic.information'),
            tooltip: t('manage.sessionForms.microLearningInformation'),
          },
          {
            title: t('shared.generic.description'),
            tooltip: t('manage.sessionForms.practiceQuizDescription'),
          },
          {
            title: t('shared.generic.settings'),
            tooltip: t('manage.sessionForms.practiceQuizSettings'),
            tooltipDisabled: t('manage.sessionForms.checkValues'),
          },
          {
            title: t('shared.generic.questions'),
            tooltip: t('manage.sessionForms.practiceQuizContent'),
            tooltipDisabled: t('manage.sessionForms.checkValues'),
          },
        ]}
      >
        <PracticeQuizInformationStep
          validationSchema={nameValidationSchema}
          gamifiedCourses={gamifiedCourses}
          nonGamifiedCourses={nonGamifiedCourses}
        />
        <PracticeQuizDescriptionStep
          validationSchema={descriptionValidationSchema}
        />
        <PracticeQuizSettingsStep
          validationSchema={stepTwoValidationSchema}
          gamifiedCourses={gamifiedCourses}
          nonGamifiedCourses={nonGamifiedCourses}
        />
        <StackCreationStep
          selection={selection}
          resetSelection={resetSelection}
          validationSchema={stackValiationSchema}
          acceptedTypes={acceptedTypes}
        />
      </MultistepWizard>
      <ElementCreationErrorToast
        open={errorToastOpen}
        setOpen={setErrorToastOpen}
        error={
          editMode
            ? t('manage.sessionForms.practiceQuizEditingFailed')
            : t('manage.sessionForms.practiceQuizCreationFailed')
        }
      />
    </>
  )
}

export default PracticeQuizWizard
