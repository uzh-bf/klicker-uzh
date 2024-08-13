import { useMutation } from '@apollo/client'
import {
  CreateGroupActivityDocument,
  EditGroupActivityDocument,
  Element,
  ElementType,
  GetSingleCourseDocument,
  GroupActivity,
  ParameterType,
  StackElementsInput,
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
  GroupActivityClueFormValues,
  GroupActivityFormValues,
} from '../MultistepWizard'
import GroupActivityDescriptionStep from './GroupActivityDescriptionStep'
import GroupActivityInformationStep from './GroupActivityInformationStep'
import GroupActivitySettingsStep from './GroupActivitySettingsStep'
import GroupActivityStackClues from './GroupActivityStackClues'

export interface GroupActivityWizardStepProps {
  onSubmit?: () => void
  validationSchema: any
  gamifiedCourses?: ElementSelectCourse[]
  nonGamifiedCourses?: ElementSelectCourse[]
}

interface GroupActivityWizardProps {
  title: string
  closeWizard: () => void
  gamifiedCourses: ElementSelectCourse[]
  nonGamifiedCourses: ElementSelectCourse[]
  selection: Record<number, Element>
  resetSelection: () => void
  initialValues?: GroupActivity
}

function GroupActivityWizard({
  title,
  closeWizard,
  gamifiedCourses,
  nonGamifiedCourses,
  selection,
  resetSelection,
  initialValues,
}: GroupActivityWizardProps) {
  const router = useRouter()
  const t = useTranslations()

  const [errorToastOpen, setErrorToastOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [isWizardCompleted, setIsWizardCompleted] = useState(false)
  const [selectedCourseId, setSelectedCourseId] = useState('')

  const [createGroupActivity] = useMutation(CreateGroupActivityDocument)
  const [editGroupActivity] = useMutation(EditGroupActivityDocument)

  const acceptedTypes = [
    ElementType.Sc,
    ElementType.Mc,
    ElementType.Kprim,
    ElementType.Numerical,
    ElementType.FreeText,
    ElementType.Content,
  ]

  const nameValidationSchema = yup.object().shape({
    name: yup
      .string()
      .required(t('manage.sessionForms.groupActivityNameError')),
  })

  const descriptionValidationSchema = yup.object().shape({
    displayName: yup
      .string()
      .required(t('manage.sessionForms.groupActivityDisplayNameError')),
    description: yup
      .string()
      .required(t('manage.sessionForms.groupActivityDescriptionError')),
  })

  const settingsValidationSchema = yup.object().shape({
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
      .required(t('manage.sessionForms.groupActivityCourse')),
  })

  const stackCluesValiationSchema = yup.object().shape({
    stack: yup.object().shape({
      elementIds: yup
        .array()
        .of(yup.number())
        .min(1, t('manage.sessionForms.minOneQuestionGroupActivity')),
      titles: yup.array().of(yup.string()),
      types: yup
        .array()
        .of(
          yup
            .string()
            .oneOf(acceptedTypes, t('manage.sessionForms.groupActivityTypes'))
        ),
    }),
    clues: yup
      .array()
      .of(
        yup.object().shape({
          name: yup
            .string()
            .required(t('manage.sessionForms.clueNameMissing'))
            .test({
              message: t('manage.sessionForms.groupActivityCluesUniqueNames'),
              test: function (value) {
                const { from } = this
                const clues = from?.[1].value
                  .clues as GroupActivityClueFormValues[]
                const isUnique =
                  clues.filter((clue) => clue.name === value).length <= 1
                return isUnique
              },
            }),
          displayName: yup
            .string()
            .required(t('manage.sessionForms.clueDisplayNameMissing')),
          type: yup
            .string()
            .oneOf([ParameterType.String, ParameterType.Number]),
          value: yup
            .string()
            .required(t('manage.sessionForms.clueValueMissing')),
          unit: yup.string(),
        })
      )
      .min(2, t('manage.sessionForms.groupActivityMin2Clues')),
  })

  const onSubmit = async (values: GroupActivityFormValues) => {
    try {
      let success = false
      if (initialValues) {
        const result = await editGroupActivity({
          variables: {
            id: initialValues?.id || '',
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
        setEditMode(!!initialValues)
        setIsWizardCompleted(true)
      }
    } catch (error) {
      console.log(error)
      setEditMode(!!initialValues)
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
              ? t.rich('manage.sessionForms.groupActivityEdited', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })
              : t.rich('manage.sessionForms.groupActivityCreated', {
                  b: (text) => <strong>{text}</strong>,
                  name: elementName,
                })}
          </div>
        )}
        initialValues={{
          name: initialValues?.name || '',
          displayName: initialValues?.displayName || '',
          description: initialValues?.description || '',
          clues:
            initialValues?.clues?.map((clue) => {
              return {
                name: clue.name,
                displayName: clue.displayName,
                type: clue.type,
                value: clue.value,
                unit: clue.unit ?? undefined,
              }
            }) ?? [],
          stack: initialValues?.stacks
            ? {
                displayName: initialValues?.stacks[0].displayName,
                description: initialValues?.stacks[0].description,
                ...initialValues?.stacks[0].elements!.reduce(
                  (acc: ElementStackFormValues, element) => {
                    acc.elementIds.push(parseInt(element.elementData.id))
                    acc.titles.push(element.elementData.name)
                    acc.types.push(element.elementData.type)
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
            : {
                displayName: '',
                description: '',
                elementIds: [],
                titles: [],
                types: [],
                hasSampleSolutions: [],
              },

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
        onRestartForm={() => {
          setIsWizardCompleted(false)
        }}
        onViewElement={() => {
          router.push(`/courses/${selectedCourseId}?tab=groupActivities`)
        }}
        workflowItems={[
          {
            title: t('shared.generic.information'),
            tooltip: t('manage.sessionForms.groupActivityInformation'),
          },
          {
            title: t('shared.generic.description'),
            tooltip: t('manage.sessionForms.groupActivityDescription'),
          },
          {
            title: t('shared.generic.settings'),
            tooltip: t('manage.sessionForms.groupActivitySettings'),
            tooltipDisabled: t('manage.sessionForms.checkValues'),
          },
          {
            title: t('shared.generic.questions'),
            tooltip: t('manage.sessionForms.groupActivityQuestions'),
            tooltipDisabled: t('manage.sessionForms.checkValues'),
          },
        ]}
      >
        <GroupActivityInformationStep
          validationSchema={nameValidationSchema}
          gamifiedCourses={gamifiedCourses}
          nonGamifiedCourses={nonGamifiedCourses}
        />
        <GroupActivityDescriptionStep
          validationSchema={descriptionValidationSchema}
        />
        <GroupActivitySettingsStep
          validationSchema={settingsValidationSchema}
          gamifiedCourses={gamifiedCourses}
          nonGamifiedCourses={nonGamifiedCourses}
        />
        <GroupActivityStackClues
          selection={selection}
          resetSelection={resetSelection}
          acceptedTypes={acceptedTypes}
          validationSchema={stackCluesValiationSchema}
        />
      </MultistepWizard>
      <ElementCreationErrorToast
        open={errorToastOpen}
        setOpen={setErrorToastOpen}
        error={
          editMode
            ? t('manage.sessionForms.groupActivityEditingFailed')
            : t('manage.sessionForms.groupActivityCreationFailed')
        }
      />
    </>
  )
}

export default GroupActivityWizard
