import { faClock } from '@fortawesome/free-regular-svg-icons'
import { faBan, faCheck } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  GroupActivityGrading,
  GroupActivityInstance,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface GroupActivitySubmissionProps {
  submission: GroupActivityInstance
  selectedSubmission: number | undefined
  selectSubmission: (submissionId: number) => void
  maxPoints: number
}

function GroupActivitySubmission({
  submission,
  selectedSubmission,
  selectSubmission,
  maxPoints,
}: GroupActivitySubmissionProps) {
  const t = useTranslations()

  const achievedPoints = useMemo(() => {
    if (!submission.results) return 0

    return submission.results.grading.reduce(
      (acc: number, answer: GroupActivityGrading) => {
        return acc + answer.score
      },
      0
    )
  }, [submission.results])

  return (
    <Button
      fluid
      active={submission.id === selectedSubmission}
      disabled={!submission.decisions}
      className={{
        root: twMerge(
          'bg-slate-200 justify-between',
          submission.results && submission.results.passed && 'bg-green-200',
          submission.results && !submission.results.passed && 'bg-red-200',
          submission.decisions && !submission.results && 'bg-orange-100'
        ),
        active: 'border-2 border-red-500',
      }}
      onClick={() => selectSubmission(submission.id)}
    >
      <div className="flex flex-col items-start">
        <div>
          {typeof submission.results?.passed !== 'undefined'
            ? `${submission.groupName} (${
                submission.results.passed
                  ? t('shared.generic.passed')
                  : t('shared.generic.failed')
              })`
            : `${submission.groupName}`}
        </div>
        {submission.decisions && (
          <div className="text-sm">
            {t('manage.groupActivity.submittedAt', {
              datetime: dayjs(submission.decisionsSubmittedAt).format(
                'DD.MM.YYYY, HH:mm'
              ),
            })}
          </div>
        )}
      </div>
      <div>
        {submission.results && (
          <div className="flex flex-col items-end">
            <div className="flex flex-row items-center gap-2">
              <FontAwesomeIcon icon={faCheck} />
              <div>{t('manage.groupActivity.graded')}</div>
            </div>
            <div className="text-sm">{`(${t(
              'manage.groupActivity.nOfTotalPoints',
              {
                number: achievedPoints,
                total: maxPoints,
              }
            )})`}</div>
          </div>
        )}
        {submission.decisions && !submission.results && (
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faClock} />
            <div>{t('manage.groupActivity.toGrade')}</div>
          </div>
        )}
        {!submission.decisions && (
          <div className="flex flex-row items-center gap-2">
            <FontAwesomeIcon icon={faBan} />
            <div>{t('manage.groupActivity.notSubmitted')}</div>
          </div>
        )}
      </div>
    </Button>
  )
}

export default GroupActivitySubmission
