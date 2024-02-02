import { InstanceEvaluationOld } from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'

interface LearningElementPointsProps {
  evaluation: InstanceEvaluationOld
  pointsMultiplier?: number
}

function LearningElementPoints({
  evaluation,
  pointsMultiplier,
}: LearningElementPointsProps) {
  const t = useTranslations()

  return (
    <div className="block">
      {typeof pointsMultiplier === 'number' && (
        <div className="mb-2">
          {t.rich('pwa.learningElement.multiplicatorEval', {
            mult: pointsMultiplier,
            b: (text) => <span className="font-bold">{text}</span>,
          })}
        </div>
      )}
      <div className="flex flex-row gap-4 md:flex-wrap">
        <div>
          <div className="font-bold">{t('shared.leaderboard.computed')}</div>
          <div className="float-left text-lg">
            {evaluation.score} {t('shared.leaderboard.points')}
          </div>
        </div>
        {(evaluation.pointsAwarded !== null ||
          evaluation.xpAwarded !== null) && (
          <div>
            <div className="font-bold">{t('shared.leaderboard.collected')}</div>
            <div>
              {evaluation.pointsAwarded !== null && (
                <div className="text-lg">
                  {evaluation.pointsAwarded} {t('shared.leaderboard.points')}
                </div>
              )}
              {evaluation.xpAwarded !== null && (
                <div className="text-lg">{evaluation.xpAwarded} XP</div>
              )}
            </div>
          </div>
        )}
      </div>

      {(evaluation.newPointsFrom !== null || evaluation.newXpFrom !== null) && (
        <div>
          <div className="font-bold">
            {t('pwa.learningElement.newPointsFrom')}
          </div>
          {evaluation.newPointsFrom !== null && (
            <div className="text-lg">
              {dayjs(evaluation.newPointsFrom).format('DD.MM.YYYY HH:mm')}
            </div>
          )}
          {evaluation.newXpFrom !== null && (
            <div className="text-lg">
              {dayjs(evaluation.newXpFrom).format('DD.MM.YYYY HH:mm')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default LearningElementPoints
