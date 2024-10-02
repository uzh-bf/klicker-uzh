import { useMutation } from '@apollo/client'
import {
  ExtendGroupActivityDocument,
  ExtendMicroLearningDocument,
  GetSingleCourseDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, DateChanger, Modal } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface ExtensionModalProps {
  type: 'microLearning' | 'groupActivity'
  id: string
  currentEndDate: Date
  courseId: string
  title: string
  description: string
  open: boolean
  setOpen: (value: boolean) => void
}

function ExtensionModal({
  type,
  id,
  currentEndDate,
  courseId,
  title,
  description,
  open,
  setOpen,
}: ExtensionModalProps) {
  const t = useTranslations()
  const [endDate, setEndDate] = useState(currentEndDate)
  const [editing, setEditing] = useState(false)
  const [extendMicroLearning, { loading: submittingMicroLearning }] =
    useMutation(ExtendMicroLearningDocument, {
      refetchQueries: [
        { query: GetSingleCourseDocument, variables: { courseId: courseId } },
      ],
    })
  const [extendGroupActivity, { loading: submittingGroupActivity }] =
    useMutation(ExtendGroupActivityDocument, {
      refetchQueries: [
        { query: GetSingleCourseDocument, variables: { courseId: courseId } },
      ],
    })

  return (
    <Modal
      onPrimaryAction={
        <Button
          loading={submittingMicroLearning || submittingGroupActivity}
          disabled={
            dayjs(endDate).isSame(currentEndDate) ||
            dayjs(endDate).isBefore(dayjs())
          }
          onClick={async () => {
            if (
              !dayjs(endDate).isSame(currentEndDate) &&
              !dayjs(endDate).isBefore(dayjs())
            ) {
              const utcEndDate = dayjs(endDate).utc().format()

              if (type === 'microLearning') {
                await extendMicroLearning({
                  variables: {
                    id,
                    endDate: utcEndDate,
                  },
                  optimisticResponse: {
                    __typename: 'Mutation',
                    extendMicroLearning: {
                      __typename: 'MicroLearning',
                      id,
                      scheduledEndAt: utcEndDate,
                    },
                  },
                })
              } else if (type === 'groupActivity') {
                await extendGroupActivity({
                  variables: {
                    id,
                    endDate: utcEndDate,
                  },
                  optimisticResponse: {
                    __typename: 'Mutation',
                    extendGroupActivity: {
                      __typename: 'GroupActivity',
                      id,
                      scheduledEndAt: utcEndDate,
                    },
                  },
                })
              }
            }
            setOpen(false)
          }}
          className={{
            root: twMerge(
              'bg-primary-100 font-bold text-white',
              (dayjs(endDate).isSame(currentEndDate) ||
                dayjs(endDate).isBefore(dayjs())) &&
                'bg-primary-40 cursor-not-allowed'
            ),
          }}
          data={{ cy: 'extend-activity-confirm' }}
        >
          {t('shared.generic.confirm')}
        </Button>
      }
      onSecondaryAction={
        <Button
          onClick={(): void => setOpen(false)}
          data={{ cy: 'extend-activity-cancel' }}
        >
          {t('shared.generic.cancel')}
        </Button>
      }
      onClose={(): void => setOpen(false)}
      open={open}
      hideCloseButton={true}
      title={title}
      className={{
        content: 'h-max min-h-max w-[40rem] self-center pt-0',
        title: 'text-xl',
      }}
    >
      <div className="space-y-3">
        <div>{description}</div>
        <DateChanger
          required
          error={
            dayjs(endDate).isBefore(dayjs())
              ? t('manage.course.futureEndDateRequired')
              : undefined
          }
          date={endDate.toString()}
          label={t('manage.course.newEndDate')}
          labelType="large"
          edit={editing}
          onEdit={() => setEditing(true)}
          onSave={(date: string) => setEndDate(new Date(date))}
          data={{ cy: 'extend-activity-date' }}
        />
      </div>
    </Modal>
  )
}

export default ExtensionModal
