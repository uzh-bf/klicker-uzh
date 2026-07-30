import { useMutation, useQuery } from '@apollo/client'
import {
  GetOwnLearningAnalyticsChoiceDocument,
  LearningAnalyticsChoice,
  LearningAnalyticsParticipationStatus,
  SetOwnLearningAnalyticsChoiceDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, Modal, toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import { learningAnalyticsRolloutEnabled } from '../../lib/learningAnalytics'
import LearningAnalyticsChoiceField from './LearningAnalyticsChoiceField'

function LearningAnalyticsChoiceControl({ courseId }: { courseId: string }) {
  const t = useTranslations()
  const prompted = useRef(false)
  const [isOpen, setIsOpen] = useState(false)
  const [selectedChoice, setSelectedChoice] = useState<
    LearningAnalyticsChoice | ''
  >('')

  const { data, refetch } = useQuery(GetOwnLearningAnalyticsChoiceDocument, {
    variables: { courseId },
    skip: !learningAnalyticsRolloutEnabled,
  })
  const [setChoice, { loading: saving }] = useMutation(
    SetOwnLearningAnalyticsChoiceDocument
  )

  const choice = data?.getOwnLearningAnalyticsChoice
  const requiresDecision =
    choice?.status === LearningAnalyticsParticipationStatus.Undecided ||
    choice?.isCurrent === false

  useEffect(() => {
    if (choice && requiresDecision && !prompted.current) {
      prompted.current = true
      setSelectedChoice('')
      setIsOpen(true)
    }
  }, [choice, requiresDecision])

  if (!learningAnalyticsRolloutEnabled || !choice) {
    return null
  }

  const openSettings = () => {
    setSelectedChoice(
      choice.isCurrent &&
        choice.status !== LearningAnalyticsParticipationStatus.Undecided
        ? choice.status === LearningAnalyticsParticipationStatus.Included
          ? LearningAnalyticsChoice.Included
          : LearningAnalyticsChoice.Excluded
        : ''
    )
    setIsOpen(true)
  }

  const saveChoice = async () => {
    if (!selectedChoice) {
      return
    }

    try {
      const result = await setChoice({
        variables: {
          courseId,
          status: selectedChoice,
        },
      })

      if (!result.data?.setOwnLearningAnalyticsChoice) {
        throw new Error('Learning analytics choice was not returned')
      }

      await refetch()
      setIsOpen(false)
      toast({
        type: 'success',
        message: t('pwa.learningAnalytics.saveSuccess'),
      })
    } catch {
      toast({
        type: 'error',
        message: t('pwa.learningAnalytics.saveError'),
      })
    }
  }

  return (
    <>
      <UserNotification
        type={requiresDecision ? 'warning' : 'info'}
        className={{ root: 'mb-4' }}
      >
        <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
          <span>
            {requiresDecision
              ? t('pwa.learningAnalytics.reminder')
              : choice.status === LearningAnalyticsParticipationStatus.Included
                ? t('pwa.learningAnalytics.currentlyIncluded')
                : t('pwa.learningAnalytics.currentlyExcluded')}
          </span>
          <Button
            onClick={openSettings}
            className={{ root: 'h-8 shrink-0 py-0' }}
            data={{ cy: 'learning-analytics-choice-open' }}
          >
            <Button.Label>
              {requiresDecision
                ? t('pwa.learningAnalytics.chooseNow')
                : t('pwa.learningAnalytics.changeChoice')}
            </Button.Label>
          </Button>
        </div>
      </UserNotification>

      <Modal
        open={isOpen}
        title={t('pwa.learningAnalytics.title')}
        primaryLabel={t('shared.generic.save')}
        primaryDisabled={!selectedChoice || saving}
        onPrimaryAction={saveChoice}
        dataPrimaryAction={{ cy: 'learning-analytics-choice-save' }}
        secondaryLabel={
          requiresDecision
            ? t('pwa.learningAnalytics.decideLater')
            : t('shared.generic.cancel')
        }
        onSecondaryAction={() => setIsOpen(false)}
        dataSecondaryAction={{ cy: 'learning-analytics-choice-later' }}
        onClose={() => setIsOpen(false)}
        className={{ content: 'max-w-2xl', title: 'self-start' }}
      >
        <LearningAnalyticsChoiceField
          value={selectedChoice}
          onChange={setSelectedChoice}
          idPrefix="course-learning-analytics"
        />
      </Modal>
    </>
  )
}

export default LearningAnalyticsChoiceControl
