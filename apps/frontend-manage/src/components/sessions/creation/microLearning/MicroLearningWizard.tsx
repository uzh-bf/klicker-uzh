import { useMutation } from '@apollo/client'
import {
  CreateMicroLearningDocument,
  EditMicroLearningDocument,
  Element,
  ElementType,
  GetSingleCourseDocument,
  MicroLearning,
} from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useState } from 'react'
import * as yup from 'yup'
import ElementCreationErrorToast from '../../../toasts/ElementCreationErrorToast'
import StackCreationStep from '../StackCreationStep'
import { ElementSelectCourse } from './../ElementCreation'
import MultistepWizard, {
  ElementStackFormValues,
  MicroLearningFormValues,
} from './../MultistepWizard'
import MicroLearningDescriptionStep from './MicroLearningDescriptionStep'
import MicroLearningInformationStep from './MicroLearningInformationStep'
import MicroLearningSettingsStep from './MicroLearningSettingsStep'

export interface MicroLearningWizardStepProps {
  onSubmit?: () => void
  validationSchema: any
  gamifiedCourses?: ElementSelectCourse[]
  nonGamifiedCourses?: ElementSelectCourse[]
}

interface MicroLearningWizardProps {
  title: string
  gamifiedCourses: ElementSelectCourse[]
  nonGamifiedCourses: ElementSelectCourse[]
  initialValues?: MicroLearning
  selection: Record<number, Element>
  resetSelection: () => void
  closeWizard: () => void
  editMode: boolean
}

function MicroLearningWizard({
  title,
  gamifiedCourses,
  nonGamifiedCourses,
  initialValues,
  selection,
  resetSelection,
  closeWizard,
  editMode,
}: MicroLearningWizardProps) {
  const router = useRouter()
  const t = useTranslations()

  console.log(initialValues)

  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [isWizardCompleted, setIsWizardCompleted] = useState(false)

  const [createMicroLearning] = useMutation(CreateMicroLearningDocument)
  const [editMicroLearning] = useMutation(EditMicroLearningDocument)

  const [selectedCourseId, setSelectedCourseId] = useState('')

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
    startDate: yup.date().required(t('manage.sessionForms.startDate')),
    endDate: yup
      .date()
      .min(yup.ref('startDate'), t('manage.sessionForms.endAfterStart'))
      .required(t('manage.sessionForms.endDate')),
    multiplier: yup
      .string()
      .matches(/^[0-9]+$/, t('manage.sessionForms.validMultiplicator')),
    courseId: yup
      .string()
      .required(t('manage.sessionForms.microlearningCourse')),
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
                  t('manage.sessionForms.microlearningTypes')
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

  const onSubmit = async (values: MicroLearningFormValues) => {
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

      if (initialValues) {
        const result = await editMicroLearning({
          variables: {
            id: initialValues?.id || '',
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

  return (
    <>
      <MultistepWizard
        title={title}
        onCloseWizard={closeWizard}
        completionSuccessMessage={(elementName) => (
          <div>
            {editMode
              ? t.rich('manage.sessionForms.microlearningCreated', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })
              : t.rich('manage.sessionForms.microlearningEdited', {
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
                console.log(stack)

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
          startDate: initialValues?.scheduledStartAt
            ? dayjs(initialValues?.scheduledStartAt)
                .local()
                .format('YYYY-MM-DDTHH:mm')
            : dayjs().local().format('YYYY-MM-DDTHH:mm'),
          endDate: initialValues?.scheduledEndAt
            ? dayjs(initialValues?.scheduledEndAt)
                .local()
                .format('YYYY-MM-DDTHH:mm')
            : dayjs().add(1, 'days').format('YYYY-MM-DDTHH:mm'),
          multiplier: initialValues?.pointsMultiplier
            ? String(initialValues?.pointsMultiplier)
            : '1',
          courseId: initialValues?.course?.id || undefined,
        }}
        onSubmit={onSubmit}
        isCompleted={isWizardCompleted}
        editMode={!!initialValues}
        initialValid={!!initialValues}
        onRestartForm={() => {
          setIsWizardCompleted(false)
        }}
        onViewElement={() => {
          router.push(`/courses/${selectedCourseId}?tab=microLearnings`)
        }}
        workflowItems={[
          {
            title: t('shared.generic.information'),
            tooltip: t('manage.sessionForms.microLearningInformation'),
          },
          {
            title: t('shared.generic.description'),
            tooltip: t('manage.sessionForms.microlearningDescription'),
          },
          {
            title: t('shared.generic.settings'),
            tooltip: t('manage.sessionForms.microlearningSettings'),
            tooltipDisabled: t('manage.sessionForms.checkValues'),
          },
          {
            title: t('shared.generic.questions'),
            tooltip: t('manage.sessionForms.microlearningQuestions'),
            tooltipDisabled: t('manage.sessionForms.checkValues'),
          },
        ]}
        continueDisabled={
          gamifiedCourses?.length === 0 && nonGamifiedCourses?.length === 0
        }
      >
        <MicroLearningInformationStep
          validationSchema={nameValidationSchema}
          gamifiedCourses={gamifiedCourses}
          nonGamifiedCourses={nonGamifiedCourses}
        />
        <MicroLearningDescriptionStep
          validationSchema={descriptionValidationSchema}
        />
        <MicroLearningSettingsStep
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
            ? t('manage.sessionForms.microlearningEditingFailed')
            : t('manage.sessionForms.microlearningCreationFailed')
        }
      />
    </>
  )
}

export default MicroLearningWizard
