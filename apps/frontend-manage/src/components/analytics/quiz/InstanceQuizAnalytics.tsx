import { faThumbsDown, faThumbsUp } from '@fortawesome/free-regular-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { InstanceQuizAnalytics as InstanceQuizAnalyticsType } from '@klicker-uzh/graphql/dist/ops'
import { Collapsible, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import PerformanceRatesBarChart from '../performance/PerformanceRatesBarChart'

function InstanceQuizAnalytics({
  analytics,
  colors,
  initiallyOpen = false,
  showLegend = false,
}: {
  analytics: InstanceQuizAnalyticsType
  colors: {
    correct: string
    partial: string
    incorrect: string
  }
  initiallyOpen?: boolean
  showLegend?: boolean
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(initiallyOpen)

  return (
    <Collapsible
      open={open}
      onChange={() => setOpen((prev) => !prev)}
      staticContent={
        <PerformanceRatesBarChart
          title={analytics.elementName}
          rates={{
            correctRate: analytics.totalCorrectRate,
            partialRate: analytics.totalPartialRate,
            incorrectRate: analytics.totalErrorRate,
          }}
          colors={colors}
          className={{ title: 'font-bold' }}
        />
      }
      className={{ root: 'pb-0! pt-1! w-full' }}
    >
      <div className="flex w-full flex-col py-3 md:flex-row">
        <div className="flex w-full flex-col gap-1 md:w-1/2 md:border-r md:pr-4">
          <div>
            {t.rich('manage.analytics.totalAnswers', {
              number: analytics.numberOfAnswers,
              b: (children) => <span className="font-bold">{children}</span>,
            })}
          </div>
          <hr className="w-full border-t border-solid border-gray-300" />
          <div>
            {t.rich('manage.analytics.numberOfStudentsN', {
              number: analytics.uniqueParticipants,
              b: (children) => <span className="font-bold">{children}</span>,
            })}
          </div>
          <hr className="w-full border-t border-solid border-gray-300" />
          <div>
            {t.rich('manage.analytics.averageTimeSpentInstance', {
              min: Math.floor((analytics?.averageTimeSpent ?? 0) / 60),
              sec: Math.floor((analytics?.averageTimeSpent ?? 0) % 60)
                .toString()
                .padStart(2, '0'),
              b: (children) => <span className="font-bold">{children}</span>,
            })}
          </div>
        </div>
        <div className="w-full md:w-1/2 md:pl-4">
          {analytics.feedbackSuppressed ? (
            <UserNotification
              type="info"
              message={t('manage.analytics.feedbackSuppressed')}
            />
          ) : (
            <>
              <div className="font-bold">
                {t('manage.analytics.studentFeedback', {
                  numOfVotes: analytics.feedbackCount,
                })}
              </div>
              <div className="flex flex-row">
                <div
                  className="flex h-20 w-1/2 flex-row items-center gap-4"
                  style={{ color: colors.correct }}
                >
                  <FontAwesomeIcon icon={faThumbsUp} className="h-14" />
                  <div className="text-2xl">
                    {`${Math.round(analytics.upvoteRate * 100)} %`}
                  </div>
                </div>
                <div
                  className="flex h-20 w-1/2 flex-row items-center gap-4"
                  style={{ color: colors.incorrect }}
                >
                  <FontAwesomeIcon icon={faThumbsDown} className="h-14" />
                  <div className="text-2xl">
                    {`${Math.round(analytics.downvoteRate * 100)} %`}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </Collapsible>
  )
}

export default InstanceQuizAnalytics
