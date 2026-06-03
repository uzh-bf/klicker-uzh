import React from 'react'
import LevelBadge from './LevelBadge'
import type { AdaptiveCompetenceScore, AdaptiveLevel } from './types'
import {
  ADAPTIVE_COMPETENCE_COLORS,
  formatTheta,
  thetaToPercent,
} from './utils'

interface CompetenceBarsProps {
  competences: AdaptiveCompetenceScore[]
  levels?: AdaptiveLevel[]
  thetaMin?: number
  thetaMax?: number
  compact?: boolean
}

function CompetenceBars({
  competences,
  thetaMin = -3,
  thetaMax = 3,
  compact = false,
}: CompetenceBarsProps) {
  return (
    <div className="flex flex-col gap-4">
      {competences.map((competence, index) => {
        const color =
          ADAPTIVE_COMPETENCE_COLORS[index % ADAPTIVE_COMPETENCE_COLORS.length]
        const percent =
          competence.theta == null
            ? 0
            : thetaToPercent(competence.theta, thetaMin, thetaMax)

        return (
          <div
            key={`${competence.competenceName}-${index}`}
            className="grid gap-2"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 font-semibold text-slate-700">
                {competence.competenceName}
              </div>
              <div className="flex flex-none items-center gap-2">
                <span className="font-mono font-semibold" style={{ color }}>
                  {formatTheta(competence.theta)}
                </span>
                {!compact && <LevelBadge label={competence.levelLabel} />}
              </div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${percent}%`, backgroundColor: color }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default CompetenceBars
