import dayjs from 'dayjs'
import { useTranslations } from 'next-intl'
import React from 'react'
import type { InstanceEvaluation } from '../elementTypes'

interface PracticeQuizPointsProps {
  evaluation: InstanceEvaluation
}

function PracticeQuizPoints({ evaluation }: PracticeQuizPointsProps) {
  const t = useTranslations()
  const newPointsFrom = evaluation.newPointsFrom ?? null
  const newXpFrom = evaluation.newXpFrom ?? null
  const pointsAwarded = evaluation.pointsAwarded ?? null
  const xpAwarded = evaluation.xpAwarded ?? null

  return (
    <div className="block">
      {typeof evaluation.pointsMultiplier === 'number' && (
        <div className="mb-2">
          {t.rich('pwa.practiceQuiz.multiplicatorEval', {
            mult: evaluation.pointsMultiplier,
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
        {(pointsAwarded !== null || xpAwarded !== null) && (
          <div className="mb-2">
            <div className="font-bold">{t('shared.leaderboard.collected')}</div>
            <div>
              {pointsAwarded !== null && (
                <div className="text-lg">
                  {pointsAwarded} {t('shared.leaderboard.points')}
                </div>
              )}
              {xpAwarded !== null && (
                <div className="text-lg">{xpAwarded} XP</div>
              )}
            </div>
          </div>
        )}
      </div>

      {(newPointsFrom !== null || newXpFrom !== null) && (
        <div>
          <div className="font-bold">{t('pwa.practiceQuiz.newPointsFrom')}</div>
          {newPointsFrom !== null && (
            <div className="text-lg">
              {dayjs(newPointsFrom).format('DD.MM.YYYY HH:mm')}
            </div>
          )}
          {newXpFrom !== null && (
            <div className="text-lg">
              {dayjs(newXpFrom).format('DD.MM.YYYY HH:mm')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default PracticeQuizPoints
