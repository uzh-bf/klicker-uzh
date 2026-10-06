import { faChevronRight } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AdaptivePracticeQuizResultClassification,
  type AdaptiveResultConfidence,
} from '@klicker-uzh/graphql/dist/ops'
import { useTranslations } from 'next-intl'
import { type ReactNode, useState } from 'react'
import { getAdaptiveProfileNotTestedLabelKey } from './adaptiveLeafCoverage'
import {
  ADAPTIVE_LEVEL_MARKER_COLOR,
  getAdaptiveLevelBandColors,
} from './adaptiveLevelPalette'
import {
  type AdaptiveCertaintyLevel,
  type AdaptiveRoughEstimateDisplay,
  getAdaptiveMainLevelSegments,
  getAdaptiveProfileCertainty,
  getAdaptiveRangeWidth,
  getAdaptiveRoughEstimateDisplay,
  showsAdaptiveLevelTrack,
} from './adaptiveProfileCertainty'
import { getAdaptiveReportedLevelLabel } from './adaptiveReportedLevel'
import {
  getAdaptiveProfileIndication,
  isAdaptiveProfileNodeNotTested,
} from './adaptiveResultUncertainty'
import { createEqualLevelScale } from './equalLevelScale'

export type AdaptiveCompetenceProfileNode = {
  id: number
  name: string
  order: number
  responseCount: number
  classification: AdaptivePracticeQuizResultClassification
  levelLabel?: string | null
  roughLevelLabel?: string | null
  leadingLevelLabels: string[]
  classificationProbability?: number | null
  confidence: AdaptiveResultConfidence
  nearBoundary: boolean
  position?: number | null
  lowerPosition?: number | null
  upperPosition?: number | null
  coverageStatus?: string | null
  children?: AdaptiveCompetenceProfileNode[] | null
}

type ProfileEstimate = {
  name: string
  responseCount: number
  classification: AdaptivePracticeQuizResultClassification
  levelLabel?: string | null
  // Display-only level for nodes with answers but no reported level.
  roughLevelLabel?: string | null
  leadingLevelLabels: string[]
  classificationProbability?: number | null
  confidence: AdaptiveResultConfidence
  nearBoundary: boolean
  position?: number | null
  lowerPosition?: number | null
  upperPosition?: number | null
  // Engine leaf coverage status (IRT_V1 subcompetences only).
  coverageStatus?: string | null
}

type LevelBands = Array<{
  label: string
  order: number
  startPosition: number
  endPosition: number
  /** Lecturer-chosen band color; null uses the default palette. */
  color?: string | null
  hasElements?: boolean | null
}>

interface AdaptiveCompetenceProfileProps {
  isPlacementPilot?: boolean
  overall: ProfileEstimate
  levelBands: LevelBands
  nodes: AdaptiveCompetenceProfileNode[]
  // Quiz classification tolerance in level bands (0 = exact level).
  toleranceBands?: number
}

function AdaptiveCompetenceProfile({
  isPlacementPilot = false,
  overall,
  levelBands,
  nodes,
  toleranceBands = 0,
}: AdaptiveCompetenceProfileProps) {
  return (
    <div className="border-t" data-cy="adaptive-competence-profile">
      <ProfileRow
        estimate={overall}
        levelBands={levelBands}
        isPlacementPilot={isPlacementPilot}
        toleranceBands={toleranceBands}
        emphasized
      />
      <ProfileNodeList
        nodes={nodes}
        levelBands={levelBands}
        isPlacementPilot={isPlacementPilot}
        toleranceBands={toleranceBands}
        depth={0}
      />
    </div>
  )
}

/**
 * Tested nodes in their order, followed by one compact summary of the
 * untested siblings so the profile stays easy to scan.
 */
function ProfileNodeList({
  nodes,
  levelBands,
  isPlacementPilot,
  toleranceBands,
  depth,
}: {
  nodes: AdaptiveCompetenceProfileNode[]
  levelBands: LevelBands
  isPlacementPilot: boolean
  toleranceBands: number
  depth: number
}) {
  const sorted = nodes.slice().sort((a, b) => a.order - b.order)
  const tested = sorted.filter(
    (node) => !isAdaptiveProfileNodeNotTested(node.responseCount)
  )
  const untested = sorted.filter((node) =>
    isAdaptiveProfileNodeNotTested(node.responseCount)
  )
  return (
    <>
      {tested.map((node) => (
        <ProfileNode
          key={node.id}
          node={node}
          levelBands={levelBands}
          isPlacementPilot={isPlacementPilot}
          toleranceBands={toleranceBands}
          depth={depth}
        />
      ))}
      {untested.length > 0 && (
        <NotTestedSummary nodes={untested} depth={depth} />
      )}
    </>
  )
}

function rowIndent(depth: number) {
  return { paddingLeft: `${28 + depth * 12}px` }
}

function NotTestedSummary({
  nodes,
  depth,
}: {
  nodes: AdaptiveCompetenceProfileNode[]
  depth: number
}) {
  const t = useTranslations()
  const [open, setOpen] = useState(false)

  if (nodes.length === 1) {
    return (
      <div
        className="flex flex-wrap items-baseline gap-x-2 border-b py-2 pr-1 text-sm text-slate-500"
        style={rowIndent(depth)}
        data-cy="adaptive-profile-not-tested"
      >
        <span className="break-words">{nodes[0]!.name}</span>
        <span className="text-xs">
          {t(getAdaptiveProfileNotTestedLabelKey(nodes[0]!.coverageStatus))}
        </span>
      </div>
    )
  }

  return (
    <details
      className="min-w-0 border-b"
      onToggle={(event) => setOpen(event.currentTarget.open)}
      data-cy="adaptive-profile-not-tested-summary"
    >
      <summary
        className="focus-visible:outline-primary-80 relative cursor-pointer list-none rounded-sm py-2 pr-1 text-sm text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden"
        style={rowIndent(depth)}
      >
        <FontAwesomeIcon
          icon={faChevronRight}
          className={`absolute top-3 h-2.5 w-2.5 text-slate-400 transition-transform motion-reduce:transition-none ${
            open ? 'rotate-90' : ''
          }`}
          style={{ left: `${10 + depth * 12}px` }}
          aria-hidden="true"
        />
        {t(
          depth === 0
            ? 'pwa.practiceQuiz.adaptive.profile.notTestedCompetences'
            : 'pwa.practiceQuiz.adaptive.profile.notTestedSubcompetences',
          { count: nodes.length }
        )}
      </summary>
      <ul className="pb-2 pr-1 text-sm text-slate-500" style={rowIndent(depth)}>
        {nodes.map((node) => (
          <li
            key={node.id}
            className="break-words py-0.5"
            data-cy="adaptive-profile-not-tested"
          >
            {node.name}
            {node.coverageStatus === 'OUT_OF_RANGE' && (
              <span className="ml-2 text-xs">
                {t(getAdaptiveProfileNotTestedLabelKey(node.coverageStatus))}
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  )
}

function ProfileNode({
  node,
  levelBands,
  isPlacementPilot,
  toleranceBands,
  depth,
}: {
  node: AdaptiveCompetenceProfileNode
  levelBands: LevelBands
  isPlacementPilot: boolean
  toleranceBands: number
  depth: number
}) {
  const [open, setOpen] = useState(false)
  const children = node.children ?? []
  const hasChildren = children.length > 0
  const content = (
    <ProfileRow
      estimate={node}
      levelBands={levelBands}
      isPlacementPilot={isPlacementPilot}
      toleranceBands={toleranceBands}
      depth={depth}
    />
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
            className={`absolute top-5 h-3 w-3 text-slate-500 transition-transform motion-reduce:transition-none ${
              open ? 'rotate-90' : ''
            }`}
            style={{ left: `${6 + depth * 12}px` }}
            aria-hidden="true"
            data-cy={`adaptive-profile-chevron-${node.id}`}
          />
          {content}
        </div>
      </summary>
      <div className="border-l border-slate-200">
        <ProfileNodeList
          nodes={children}
          levelBands={levelBands}
          isPlacementPilot={isPlacementPilot}
          toleranceBands={toleranceBands}
          depth={Math.min(depth + 1, 4)}
        />
      </div>
    </details>
  )
}

function ProfileRow({
  estimate,
  levelBands,
  isPlacementPilot = false,
  toleranceBands = 0,
  depth = 0,
  emphasized = false,
}: {
  estimate: ProfileEstimate
  levelBands: LevelBands
  isPlacementPilot?: boolean
  toleranceBands?: number
  depth?: number
  emphasized?: boolean
}) {
  const t = useTranslations()
  const reportedLevel = (levelLabel: string, classified: boolean) => {
    const label = getAdaptiveReportedLevelLabel({
      levelLabel,
      levelBands,
      toleranceBands,
      classified,
    })
    return t(label.key, label.values)
  }
  const indication = getAdaptiveProfileIndication({ ...estimate, levelBands })
  const width = indication
    ? getAdaptiveRangeWidth({
        lowerPosition: estimate.lowerPosition,
        upperPosition: estimate.upperPosition,
        levelBands,
      })
    : null
  // Rough estimates: answers below the reporting minimum (never the overall).
  const rough: AdaptiveRoughEstimateDisplay | null =
    !emphasized &&
    indication &&
    estimate.classification ===
      AdaptivePracticeQuizResultClassification.InsufficientEvidence
      ? getAdaptiveRoughEstimateDisplay({
          levelLabel: estimate.roughLevelLabel ?? indication.levelLabel,
          width,
          levelBands,
        })
      : null
  const hidesEstimate = rough?.kind === 'notEnoughAnswers'
  const certainty = hidesEstimate
    ? null
    : getAdaptiveProfileCertainty({
        classification: estimate.classification,
        width,
      })
  const displayLabel = rough
    ? (() => {
        switch (rough.kind) {
          case 'level':
            return t('pwa.practiceQuiz.adaptive.profile.roughLevel', {
              level: reportedLevel(rough.levelLabel, false),
            })
          case 'mainLevel':
            return t('pwa.practiceQuiz.adaptive.profile.aroundLevel', {
              level: rough.levelLabel,
            })
          case 'notEnoughAnswers':
            return t('pwa.practiceQuiz.adaptive.profile.notEnoughAnswers', {
              count: estimate.responseCount,
            })
        }
      })()
    : isPlacementPilot
      ? (() => {
          switch (estimate.classification) {
            case AdaptivePracticeQuizResultClassification.Classified:
              return t(
                'pwa.practiceQuiz.adaptive.result.placementPilot.estimatedLevel',
                { level: estimate.levelLabel ?? '' }
              )
            case AdaptivePracticeQuizResultClassification.BetweenLevels:
              return t(
                'pwa.practiceQuiz.adaptive.result.placementPilot.adjacentRange',
                { levels: estimate.leadingLevelLabels.join(' / ') }
              )
            default:
              return t(
                'pwa.practiceQuiz.adaptive.result.placementPilot.noEvidence'
              )
          }
        })()
      : (() => {
          switch (estimate.classification) {
            case AdaptivePracticeQuizResultClassification.Classified:
              return estimate.levelLabel
                ? t('pwa.practiceQuiz.adaptive.profile.estimatedLevel', {
                    level: reportedLevel(estimate.levelLabel, true),
                  })
                : t('pwa.practiceQuiz.adaptive.profile.insufficientData')
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
  const rangeSentence =
    width && !hidesEstimate && width.lowerLevelLabel !== width.upperLevelLabel
      ? t('pwa.practiceQuiz.adaptive.profile.likelyRange', {
          lower: width.lowerLevelLabel,
          upper: width.upperLevelLabel,
        })
      : null
  const certaintyLabel = certainty
    ? t(`pwa.practiceQuiz.adaptive.profile.certainty.${certainty}`)
    : null
  const hasResponses = !isAdaptiveProfileNodeNotTested(estimate.responseCount)

  return (
    <div
      className={`grid min-w-0 gap-2 border-b py-4 pr-1 sm:grid-cols-[minmax(11rem,1fr)_minmax(14rem,1.2fr)] sm:items-center sm:gap-3 ${
        emphasized ? 'bg-primary-20 px-3' : ''
      }`}
      style={emphasized ? undefined : rowIndent(depth)}
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
          {/* Rough rows already explain the missing level on the right. */}
          {!isPlacementPilot && hasResponses && !rough ? (
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
          ) : null}
          {!isPlacementPilot &&
            hasResponses &&
            estimate.classification ===
              AdaptivePracticeQuizResultClassification.BetweenLevels && (
              <span>{t('pwa.practiceQuiz.adaptive.nearBoundary.label')}</span>
            )}
        </div>
      </div>
      <div className="min-w-0" data-cy="adaptive-profile-uncertainty">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={`text-sm ${hidesEstimate ? 'text-slate-600' : 'font-semibold text-slate-900'}`}
            data-cy={
              hidesEstimate
                ? 'adaptive-profile-not-enough-answers'
                : 'adaptive-profile-level'
            }
          >
            {displayLabel}
          </span>
          {certainty && certaintyLabel && (
            <CertaintyBadge level={certainty} label={certaintyLabel} />
          )}
        </div>
        {rangeSentence && (
          <p className="mt-1 text-xs text-slate-600">{rangeSentence}</p>
        )}
        {width && showsAdaptiveLevelTrack(certainty) && (
          <LevelTrack
            compact={!emphasized && depth > 0}
            estimate={estimate}
            levelBands={levelBands}
            ariaLabel={[
              estimate.name,
              displayLabel,
              rangeSentence,
              certaintyLabel,
            ]
              .filter(Boolean)
              .join('. ')}
          />
        )}
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

const CERTAINTY_BARS: Record<AdaptiveCertaintyLevel, number> = {
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
}

/** Three-step meter; the filled bar count and the text carry the meaning. */
function CertaintyBadge({
  level,
  label,
}: {
  level: AdaptiveCertaintyLevel
  label: string
}) {
  const filled = CERTAINTY_BARS[level]
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-700"
      data-cy="adaptive-profile-certainty"
      data-certainty={level}
    >
      <span className="flex h-3 items-end gap-0.5" aria-hidden="true">
        {[1, 2, 3].map((bar) => (
          <span
            key={bar}
            className={`w-1 rounded-sm ${
              bar <= filled
                ? 'bg-primary-100'
                : 'border border-slate-400 bg-white'
            }`}
            style={{ height: `${bar * 4}px` }}
          />
        ))}
      </span>
      {label}
    </span>
  )
}

/**
 * Simplified level track: one segment per main level (A2 | B1 | ...) with the
 * sublevels as subtle shading, a soft plausible range and a clear marker.
 */
function LevelTrack({
  estimate,
  levelBands,
  ariaLabel,
  compact,
}: {
  estimate: ProfileEstimate
  levelBands: LevelBands
  ariaLabel: string
  /** Nested rows: thinner track, no tick labels (the aria-label has the level). */
  compact: boolean
}) {
  const { bands, project } = createEqualLevelScale(levelBands)
  if (bands.length === 0) return null
  const bandColors = getAdaptiveLevelBandColors(bands)
  const segments = getAdaptiveMainLevelSegments(bands)
  const labelAll = segments.every((segment) => !segment.grouped)
  const lower = clamp(project(estimate.lowerPosition ?? 0))
  const upper = clamp(project(estimate.upperPosition ?? 0))
  const position =
    typeof estimate.position === 'number'
      ? clamp(project(estimate.position))
      : null
  const toPercent = (index: number) => `${(index / bands.length) * 100}%`

  return (
    <div
      className={compact ? 'mt-2 pb-1' : 'mt-2'}
      role="img"
      aria-label={ariaLabel}
      data-cy="adaptive-profile-track"
    >
      <div className={`relative ${compact ? 'h-1.5' : 'h-2.5'}`}>
        <div className="absolute inset-0 overflow-hidden rounded-full bg-slate-100">
          {bands.map((band, index) => (
            <span
              key={`${band.order}-${band.label}`}
              className="absolute inset-y-0"
              style={{
                left: toPercent(index),
                width: toPercent(1),
                backgroundColor: bandColors[index],
              }}
            />
          ))}
          {segments.slice(0, -1).map((segment) => (
            <span
              key={`separator-${segment.startIndex}`}
              className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white"
              style={{ left: toPercent(segment.endIndex + 1) }}
            />
          ))}
        </div>
        <span
          className={`bg-primary-100/15 border-primary-100/60 absolute rounded-full border ${compact ? '-inset-y-0.5' : '-inset-y-1'}`}
          style={{
            left: `${Math.min(lower, upper) * 100}%`,
            width: `${Math.abs(upper - lower) * 100}%`,
          }}
        />
        {position !== null && (
          <span
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow ${
              compact ? 'h-3 w-3' : 'h-4 w-4'
            }`}
            style={{
              left: `${position * 100}%`,
              backgroundColor: ADAPTIVE_LEVEL_MARKER_COLOR,
            }}
          />
        )}
      </div>
      {!compact && (
        <div className="relative mt-1.5 h-4 text-[11px] leading-4 text-slate-500">
          {segments.map((segment) =>
            segment.grouped || labelAll ? (
              <TickLabel
                key={`label-${segment.startIndex}`}
                left={toPercent(segment.startIndex)}
                width={toPercent(segment.endIndex - segment.startIndex + 1)}
              >
                {segment.label}
              </TickLabel>
            ) : null
          )}
        </div>
      )}
    </div>
  )
}

function TickLabel({
  left,
  width,
  children,
}: {
  left: string
  width: string
  children: ReactNode
}) {
  return (
    <span className="absolute truncate text-center" style={{ left, width }}>
      {children}
    </span>
  )
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value))
}

export default AdaptiveCompetenceProfile
