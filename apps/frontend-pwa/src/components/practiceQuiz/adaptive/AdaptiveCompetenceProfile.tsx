import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AdaptivePracticeQuizResultClassification,
  AdaptiveResultConfidence,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { ADAPTIVE_BAND_COLORS } from './AdaptiveResultTrajectoryChart'

export type AdaptiveCompetenceProfileNode = {
  id: number
  name: string
  order: number
  responseCount: number
  classification: AdaptivePracticeQuizResultClassification
  levelLabel?: string | null
  leadingLevelLabels: string[]
  classificationProbability?: number | null
  confidence: AdaptiveResultConfidence
  nearBoundary: boolean
  position?: number | null
  lowerPosition?: number | null
  upperPosition?: number | null
  children?: AdaptiveCompetenceProfileNode[] | null
}

type ProfileEstimate = {
  name: string
  responseCount: number
  classification: AdaptivePracticeQuizResultClassification
  levelLabel?: string | null
  leadingLevelLabels: string[]
  classificationProbability?: number | null
  confidence: AdaptiveResultConfidence
  nearBoundary: boolean
  position?: number | null
  lowerPosition?: number | null
  upperPosition?: number | null
}

interface AdaptiveCompetenceProfileProps {
  overall: ProfileEstimate
  levelBands: Array<{
    label: string
    order: number
    startPosition: number
    endPosition: number
  }>
  nodes: AdaptiveCompetenceProfileNode[]
}

function AdaptiveCompetenceProfile({
  overall,
  levelBands,
  nodes,
}: AdaptiveCompetenceProfileProps) {
  return (
    <div className="border-t" data-cy="adaptive-competence-profile">
      <ProfileRow estimate={overall} levelBands={levelBands} emphasized />
      {nodes
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((node) => (
          <ProfileNode
            key={node.id}
            node={node}
            levelBands={levelBands}
            depth={0}
          />
        ))}
    </div>
  )
}

function ProfileNode({
  node,
  levelBands,
  depth,
}: {
  node: AdaptiveCompetenceProfileNode
  levelBands: AdaptiveCompetenceProfileProps['levelBands']
  depth: number
}) {
  const [open, setOpen] = useState(false)
  const children = node.children ?? []
  const hasChildren = children.length > 0
  const content = (
    <ProfileRow estimate={node} levelBands={levelBands} depth={depth} />
  )

  if (!hasChildren) return content

  return (
    <details
      className="min-w-0"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      data-cy={`adaptive-profile-disclosure-${node.id}`}
    >
      <summary
        className="focus-visible:outline-primary-80 cursor-pointer list-none rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden"
        data-cy={`adaptive-profile-node-${node.id}`}
      >
        <div className="relative">
          <FontAwesomeIcon
            icon={faChevronRight}
            className={`absolute left-1.5 top-5 h-3 w-3 text-slate-500 transition-transform motion-reduce:transition-none ${
              open ? 'rotate-90' : ''
            }`}
            aria-hidden="true"
            data-cy={`adaptive-profile-chevron-${node.id}`}
          />
          {content}
        </div>
      </summary>
      <div className="border-l border-slate-200">
        {children
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((child) => (
            <ProfileNode
              key={child.id}
              node={child}
              levelBands={levelBands}
              depth={Math.min(depth + 1, 4)}
            />
          ))}
      </div>
    </details>
  )
}

function ProfileRow({
  estimate,
  levelBands,
  depth = 0,
  emphasized = false,
}: {
  estimate: ProfileEstimate
  levelBands: AdaptiveCompetenceProfileProps['levelBands']
  depth?: number
  emphasized?: boolean
}) {
  const t = useTranslations()
  const displayLabel = (() => {
    switch (estimate.classification) {
      case AdaptivePracticeQuizResultClassification.Classified:
        return (
          estimate.levelLabel ??
          t('pwa.practiceQuiz.adaptive.profile.insufficientData')
        )
      case AdaptivePracticeQuizResultClassification.BetweenLevels:
        return t('pwa.practiceQuiz.adaptive.profile.betweenLevels', {
          levels: estimate.leadingLevelLabels.join(' / '),
        })
      case AdaptivePracticeQuizResultClassification.PoolLimited:
        return t('pwa.practiceQuiz.adaptive.profile.poolLimited')
      case AdaptivePracticeQuizResultClassification.ResearchOnly:
        return t('pwa.practiceQuiz.adaptive.profile.researchOnly')
      case AdaptivePracticeQuizResultClassification.InsufficientEvidence:
        return t('pwa.practiceQuiz.adaptive.profile.insufficientData')
    }
  })()

  return (
    <div
      className={`grid min-w-0 gap-3 border-b py-4 pr-1 sm:grid-cols-[minmax(11rem,1fr)_minmax(14rem,1.2fr)] sm:items-center ${
        emphasized ? 'bg-primary-20 px-3' : 'pl-7'
      }`}
      style={emphasized ? undefined : { paddingLeft: `${28 + depth * 12}px` }}
      data-cy={emphasized ? 'adaptive-profile-overall' : undefined}
    >
      <div className="min-w-0">
        <div className={emphasized ? 'font-bold' : 'font-semibold'}>
          <span className="break-words">{estimate.name}</span>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
          <span>
            {t('pwa.practiceQuiz.adaptive.profile.responses', {
              count: estimate.responseCount,
            })}
          </span>
          <span>
            {t(CLASSIFICATION_LABEL_KEYS[estimate.classification])}
            {typeof estimate.classificationProbability === 'number' && (
              <>
                {' '}
                {t('pwa.practiceQuiz.adaptive.result.probability', {
                  probability: Math.round(
                    estimate.classificationProbability * 100
                  ),
                })}
              </>
            )}
          </span>
          {estimate.classification ===
            AdaptivePracticeQuizResultClassification.BetweenLevels && (
            <span>{t('pwa.practiceQuiz.adaptive.nearBoundary.label')}</span>
          )}
        </div>
      </div>
      <div className="min-w-0">
        <div className="mb-1 text-sm font-semibold">{displayLabel}</div>
        <BandTrack estimate={estimate} levelBands={levelBands} />
      </div>
    </div>
  )
}

const CLASSIFICATION_LABEL_KEYS = {
  [AdaptivePracticeQuizResultClassification.Classified]:
    'pwa.practiceQuiz.adaptive.result.classification.CLASSIFIED.label',
  [AdaptivePracticeQuizResultClassification.BetweenLevels]:
    'pwa.practiceQuiz.adaptive.result.classification.BETWEEN_LEVELS.label',
  [AdaptivePracticeQuizResultClassification.InsufficientEvidence]:
    'pwa.practiceQuiz.adaptive.result.classification.INSUFFICIENT_EVIDENCE.label',
  [AdaptivePracticeQuizResultClassification.PoolLimited]:
    'pwa.practiceQuiz.adaptive.result.classification.POOL_LIMITED.label',
  [AdaptivePracticeQuizResultClassification.ResearchOnly]:
    'pwa.practiceQuiz.adaptive.result.classification.RESEARCH_ONLY.label',
} as const

function BandTrack({
  estimate,
  levelBands,
}: {
  estimate: ProfileEstimate
  levelBands: AdaptiveCompetenceProfileProps['levelBands']
}) {
  const t = useTranslations()
  const hasEstimate =
    typeof estimate.position === 'number' &&
    typeof estimate.lowerPosition === 'number' &&
    typeof estimate.upperPosition === 'number'
  const lower = clamp(estimate.lowerPosition ?? 0)
  const upper = clamp(estimate.upperPosition ?? 0)
  const position = clamp(estimate.position ?? 0)

  return (
    <div
      className="relative h-3 w-full overflow-hidden border border-slate-300 bg-slate-100"
      role="img"
      aria-label={
        hasEstimate && estimate.levelLabel
          ? `${estimate.name}: ${t(
              'pwa.practiceQuiz.adaptive.result.headline',
              {
                level: estimate.levelLabel,
              }
            )}`
          : `${estimate.name}: ${t('pwa.practiceQuiz.adaptive.profile.insufficientData')}`
      }
    >
      {levelBands.map((band, index) => (
        <span
          key={`${band.order}-${band.label}`}
          className="absolute inset-y-0"
          style={{
            left: `${clamp(band.startPosition) * 100}%`,
            width: `${Math.max(0, clamp(band.endPosition) - clamp(band.startPosition)) * 100}%`,
            backgroundColor:
              ADAPTIVE_BAND_COLORS[index % ADAPTIVE_BAND_COLORS.length],
          }}
          aria-hidden="true"
        />
      ))}
      {hasEstimate && (
        <>
          <span
            className="bg-primary-100/25 absolute inset-y-0"
            style={{
              left: `${Math.min(lower, upper) * 100}%`,
              width: `${Math.abs(upper - lower) * 100}%`,
            }}
            aria-hidden="true"
          />
          <span
            className="bg-primary-100 absolute inset-y-0 w-0.5"
            style={{ left: `calc(${position * 100}% - 1px)` }}
            aria-hidden="true"
          />
        </>
      )}
    </div>
  )
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}

export default AdaptiveCompetenceProfile
