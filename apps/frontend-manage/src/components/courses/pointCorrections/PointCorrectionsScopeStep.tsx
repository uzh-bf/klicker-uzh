import {
  faClipboardQuestion,
  faListCheck,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { PointCorrectionType } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, FormikSelectField } from '@uzh-bf/design-system'
import { useField } from 'formik'
import { useTranslations } from 'next-intl'
import { Suspense, useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import SuspendedPreviousCorrections from './SuspendedPreviousCorrections'
import type { CorrectionScope, PointCorrectionsFormValues } from './types'

function PointCorrectionsScopeStep({
  quizzes,
  disabledLiveQuizSelection,
  disabledInstanceSelection,
}: {
  quizzes: {
    id: string
    name: string
    displayName: string
    instances: { id: string; name: string }[]
  }[]
  disabledLiveQuizSelection: boolean
  disabledInstanceSelection: boolean
}) {
  const t = useTranslations()
  const [scopeField, , scopeHelpers] =
    useField<PointCorrectionsFormValues['scopeType']>('scopeType')
  const [quizField, , quizHelpers] = useField('quizId')
  const [instanceField, , instanceHelpers] = useField('instanceId')
  const [participantScopeField, , participantScopeHelpers] =
    useField<PointCorrectionsFormValues['participantScope']>('participantScope')

  const selectedQuiz = quizzes.find((quiz) => quiz.id === quizField.value)
  const quizOptions = quizzes.map((quiz) => ({
    label: `${quiz.name} (${quiz.displayName})`,
    shortLabel: quiz.name,
    value: quiz.id,
  }))
  const instanceOptions = (selectedQuiz?.instances ?? []).map((instance) => ({
    label: instance.name,
    value: instance.id,
  }))

  useEffect(() => {
    // the quiz-participant audience only applies to a single instance
    if (
      scopeField.value !== 'instance' &&
      participantScopeField.value === PointCorrectionType.ParticipatingQuiz
    ) {
      participantScopeHelpers.setValue('')
    }

    // if scope is not 'instance', clear instance selection
    if (scopeField.value !== 'instance' && instanceField.value) {
      instanceHelpers.setValue('')
      return
    }

    // if no quiz is selected, clear instance selection
    if (!quizField.value) {
      instanceHelpers.setValue('')
      return
    }

    // if selected quiz is invalid, clear quiz and instance selection
    if (!selectedQuiz) {
      quizHelpers.setValue('')
      instanceHelpers.setValue('')
      return
    }

    // if selected instance is not part of the selected quiz, clear instance selection
    if (
      instanceField.value &&
      !selectedQuiz.instances.some(
        (instance) => instance.id === instanceField.value
      )
    ) {
      instanceHelpers.setValue('')
    }
  }, [
    scopeField.value,
    instanceField.value,
    quizField.value,
    quizHelpers,
    selectedQuiz,
    instanceHelpers,
    participantScopeField.value,
    participantScopeHelpers,
  ])

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm text-gray-700">
        {t('manage.pointCorrections.scopeDescription')}
      </div>

      <div className="flex flex-col gap-2">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            {
              value: 'instance',
              icon: faClipboardQuestion,
              title: t('manage.pointCorrections.scopeOptionInstanceTitle'),
              description: t(
                'manage.pointCorrections.scopeOptionInstanceDescription'
              ),
              className: 'disabled:opacity-100',
              data: { cy: 'point-corrections-scope-instance' },
            },
            {
              value: 'quiz',
              icon: faListCheck,
              title: t('manage.pointCorrections.scopeOptionQuizTitle'),
              description: t(
                'manage.pointCorrections.scopeOptionQuizDescription'
              ),
              data: { cy: 'point-corrections-scope-quiz' },
            },
          ].map((option) => (
            <Button
              key={option.value}
              type="button"
              disabled={disabledInstanceSelection}
              onClick={() =>
                scopeHelpers.setValue(option.value as CorrectionScope)
              }
              className={{
                root: twMerge(
                  'flex h-full flex-col gap-2 rounded-lg border-2 p-4 text-left focus:outline-none',
                  scopeField.value === option.value &&
                    'border-primary-100 bg-primary-50',
                  option.className
                ),
              }}
              aria-pressed={scopeField.value === option.value}
              data={{ cy: option.data.cy }}
            >
              <FontAwesomeIcon
                icon={option.icon}
                className="text-primary-200 text-2xl"
              />
              <div className="text-base font-semibold text-gray-900">
                {option.title}
              </div>
              <div className="text-sm text-gray-600">{option.description}</div>
            </Button>
          ))}
        </div>
      </div>

      <div className="my-2 border-t border-gray-200" />

      <div className="-mb-1 text-sm text-gray-700">
        {t('manage.pointCorrections.selectQuizAndInstanceDescription')}
      </div>
      <div className="flex flex-col gap-2 md:flex-row md:gap-4">
        <div className="flex-1">
          <FormikSelectField
            required
            name="quizId"
            disabled={disabledLiveQuizSelection}
            label={t('manage.pointCorrections.quizLabel')}
            placeholder={t('manage.pointCorrections.quizPlaceholder')}
            items={quizOptions}
            className={{ select: { trigger: 'h-9' } }}
            data={{ cy: 'point-corrections-quiz-select' }}
          />
        </div>

        {scopeField.value === 'instance' ? (
          <div className="flex-1">
            <FormikSelectField
              required
              disabled={
                disabledInstanceSelection || instanceOptions.length === 0
              }
              label={t('manage.pointCorrections.instanceLabel')}
              name="instanceId"
              placeholder={t('manage.pointCorrections.instancePlaceholder')}
              items={instanceOptions}
              className={{ select: { trigger: 'h-9' } }}
              data={{ cy: 'point-corrections-instance-select' }}
            />
          </div>
        ) : null}
      </div>

      <div className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-4">
        <div className="mb-2 text-sm font-semibold text-gray-900">
          {t('manage.pointCorrections.historyTitle')}
        </div>
        <Suspense fallback={<Loader />}>
          <SuspendedPreviousCorrections
            instanceScope={scopeField.value === 'instance'}
            liveQuizId={quizField.value}
            instanceId={instanceField.value}
          />
        </Suspense>
      </div>
    </div>
  )
}

export default PointCorrectionsScopeStep
