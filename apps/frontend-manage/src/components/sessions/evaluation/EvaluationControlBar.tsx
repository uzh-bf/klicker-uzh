import {
  faArrowLeft,
  faArrowRight,
  faCheck,
  faChevronLeft,
  faChevronRight,
  faComment,
  faFaceSmile,
  faGamepad,
  faSync,
  IconDefinition,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ConfusionTimestep,
  Feedback,
  InstanceResult,
  SessionBlockStatus,
} from '@klicker-uzh/graphql/dist/ops'
import { EvaluationTabData } from '@pages/sessions/[id]/evaluation'
import { Button, Select } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import useEvaluationTabs from '../../../lib/hooks/useEvaluationTabs'

const INSTANCE_STATUS_ICON: Record<string, IconDefinition> = {
  EXECUTED: faCheck,
  ACTIVE: faSync,
}

interface EvaluationControlBarProps {
  blocks: {
    blockIx: number
    blockStatus: SessionBlockStatus
    tabData: EvaluationTabData[]
  }[]
  selectedBlock: number
  setSelectedBlock: (block: number) => void
  setSelectedInstanceIndex: (index: number) => void
  selectedInstanceIndex: number
  instanceResults: InstanceResult[]
  setLeaderboard: (leaderboard: boolean) => void
  setFeedbacks: (feedbacks: boolean) => void
  setConfusion: (confusion: boolean) => void
  showLeaderboard: boolean
  showFeedbacks: boolean
  showConfusion: boolean
  status: string
  feedbacks: Feedback[]
  confusionFeedbacks: ConfusionTimestep[]
  isGamificationEnabled: boolean
}

function EvaluationControlBar({
  blocks,
  selectedBlock,
  setSelectedBlock,
  setSelectedInstanceIndex,
  selectedInstanceIndex,
  instanceResults,
  setLeaderboard,
  setFeedbacks,
  setConfusion,
  showLeaderboard,
  showFeedbacks,
  showConfusion,
  status,
  feedbacks,
  confusionFeedbacks,
  isGamificationEnabled,
}: EvaluationControlBarProps) {
  const t = useTranslations()
  const width = 1
  const tabs = useEvaluationTabs({
    blocks: blocks,
    selectedBlock,
    width,
  })

  const selectData = useMemo(() => {
    if (!blocks || !blocks[selectedBlock]) return []
    return blocks[selectedBlock].tabData?.map((question) => {
      return {
        label:
          question?.name.length > 120
            ? `${question?.name.substring(0, 120)}...`
            : question?.name,
        shortLabel:
          question?.name.length > 40
            ? `${question?.name.substring(0, 40)}...`
            : undefined,
        value: String(question?.ix),
        data: { cy: `evaluate-question-${question?.ix}` },
      }
    })
  }, [blocks, selectedBlock])

  return (
    <div className="flex w-full flex-row justify-between border-b-2 border-solid bg-white px-3 print:hidden">
      <div>
        {blocks && blocks[selectedBlock] && (
          <div className="flex flex-row items-center gap-2">
            <Button
              basic
              onClick={() => {
                setSelectedInstanceIndex(selectedInstanceIndex - 1)
              }}
              disabled={selectedInstanceIndex === 0}
              className={{
                root: twMerge(
                  selectedInstanceIndex === 0 &&
                    'text-uzh-grey-80 cursor-not-allowed'
                ),
              }}
              data={{ cy: 'evaluate-previous-question' }}
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </Button>
            <Button
              basic
              onClick={() => {
                setSelectedInstanceIndex(selectedInstanceIndex + 1)
              }}
              disabled={selectedInstanceIndex === instanceResults.length - 1}
              className={{
                root: twMerge(
                  selectedInstanceIndex === instanceResults.length - 1 &&
                    'text-uzh-grey-80 cursor-not-allowed'
                ),
              }}
              data={{ cy: 'evaluate-next-question' }}
            >
              <FontAwesomeIcon icon={faArrowRight} />
            </Button>

            <div className="ml-2 font-bold">
              {t('shared.generic.question')}:
            </div>

            <Select
              items={selectData || []}
              onChange={(newValue) => {
                setSelectedInstanceIndex(Number(newValue))
              }}
              className={{
                root: 'z-20 h-[2.65rem]',
                trigger:
                  'm-0 h-full w-max rounded-none border-none shadow-none',
              }}
              value={String(selectedInstanceIndex)}
              data={{ cy: 'evaluate-question-select' }}
            />
          </div>
        )}
      </div>
      <div className="flex flex-row">
        <Button
          basic
          onClick={() => {
            setSelectedInstanceIndex(blocks[selectedBlock - 1].tabData[0].ix)
            setLeaderboard(false)
            setFeedbacks(false)
            setConfusion(false)
            selectedBlock === 0 ? null : setSelectedBlock(selectedBlock - 1)
          }}
          disabled={
            blocks.length <= 2 * width + 1 || selectedBlock - width <= 0
          }
          data={{ cy: 'evaluate-previous-block' }}
        >
          <div
            className={twMerge(
              'hover:bg-primary-20 flex h-full flex-row items-center px-2',
              (blocks.length <= 2 * width + 1 || selectedBlock - width <= 0) &&
                'text-uzh-grey-80 cursor-not-allowed hover:bg-white'
            )}
          >
            <FontAwesomeIcon icon={faChevronLeft} size="lg" />
          </div>
        </Button>

        {tabs.map((tab) => (
          <Button
            basic
            key={tab.value}
            onClick={() => {
              setSelectedBlock(tab.value)
              setLeaderboard(false)
              setFeedbacks(false)
              setConfusion(false)
              setSelectedInstanceIndex(blocks[tab.value].tabData[0].ix)
            }}
            className={{
              root: twMerge(
                'hover:bg-primary-20 w-[7rem] border-b-2 border-transparent px-3 py-2 text-center',
                !showLeaderboard &&
                  !showFeedbacks &&
                  !showConfusion &&
                  tab.value === selectedBlock &&
                  `border-primary-80 border-solid`
              ),
            }}
            data={{ cy: `evaluate-block-${tab.value}` }}
          >
            <div className="flex w-full flex-row items-center justify-center gap-2">
              <FontAwesomeIcon
                size="xs"
                icon={INSTANCE_STATUS_ICON[blocks[tab.value].blockStatus]}
              />
              <div>{tab.label}</div>
            </div>
          </Button>
        ))}

        <Button
          basic
          onClick={() => {
            setSelectedInstanceIndex(blocks[selectedBlock + 1].tabData[0].ix)
            setLeaderboard(false)
            setFeedbacks(false)
            setConfusion(false)
            selectedBlock === blocks.length - 1
              ? null
              : setSelectedBlock(selectedBlock + 1)
          }}
          disabled={
            blocks.length <= 2 * width + 1 ||
            selectedBlock + width >= blocks.length - 1
          }
          data={{ cy: 'evaluate-next-block' }}
        >
          <div
            className={twMerge(
              'hover:bg-primary-20 flex h-full flex-row items-center px-2',
              (blocks.length <= 2 * width + 1 ||
                selectedBlock + width >= blocks.length - 1) &&
                'text-uzh-grey-80 cursor-not-allowed hover:bg-white'
            )}
          >
            <FontAwesomeIcon icon={faChevronRight} size="lg" />
          </div>
        </Button>
        {isGamificationEnabled && (
          <Button
            basic
            className={{
              root: twMerge(
                'hover:bg-primary-20 border-b-2 border-transparent px-3 py-2',
                showLeaderboard && `border-primary-80 border-solid`
              ),
            }}
            onClick={() => {
              setLeaderboard(true)
              setFeedbacks(false)
              setConfusion(false)
              setSelectedBlock(-1)
              setSelectedInstanceIndex(-1)
            }}
            data={{ cy: 'evaluation-leaderboard' }}
          >
            <div className="flex flex-row items-center gap-2">
              <div>
                <FontAwesomeIcon icon={faGamepad} />
              </div>
              <div>{t('shared.generic.leaderboard')}</div>
            </div>
          </Button>
        )}

        {status === 'COMPLETED' && feedbacks?.length !== 0 && (
          <Button
            basic
            className={{
              root: twMerge(
                'hover:bg-primary-20 border-b-2 border-transparent px-3 py-2',
                showFeedbacks && `border-primary-80 border-solid`
              ),
            }}
            onClick={() => {
              setFeedbacks(true)
              setLeaderboard(false)
              setConfusion(false)
              setSelectedBlock(-1)
              setSelectedInstanceIndex(-1)
            }}
            data={{ cy: 'evaluation-feedbacks' }}
          >
            <div className="flex flex-row items-center gap-2">
              <div>
                <FontAwesomeIcon icon={faComment} />
              </div>
              <div>{t('shared.generic.feedbacks')}</div>
            </div>
          </Button>
        )}
        {status === 'COMPLETED' && confusionFeedbacks?.length !== 0 && (
          <Button
            basic
            className={{
              root: twMerge(
                'hover:bg-primary-20 border-b-2 border-transparent px-3 py-2',
                showConfusion && `border-primary-80 border-solid`
              ),
            }}
            onClick={() => {
              setConfusion(true)
              setLeaderboard(false)
              setFeedbacks(false)
              setSelectedBlock(-1)
              setSelectedInstanceIndex(-1)
            }}
            data={{ cy: 'evaluation-confusion' }}
          >
            <div className="flex flex-row items-center gap-2">
              <div>
                <FontAwesomeIcon icon={faFaceSmile} />
              </div>
              <div>{t('manage.evaluation.confusion')}</div>
            </div>
          </Button>
        )}
      </div>
    </div>
  )
}

export default EvaluationControlBar
