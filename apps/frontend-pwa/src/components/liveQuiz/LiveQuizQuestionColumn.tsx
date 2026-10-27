import { faCheck, faClock, faUsers } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  ElementBlockStatus,
  type ElementType,
  type GetRunningLiveQuizQuery,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import { H2, StepProgress, UserNotification } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import QuestionArea from './QuestionArea'

type LiveQuizData = NonNullable<GetRunningLiveQuizQuery['studentLiveQuiz']>

interface LiveQuizQuestionColumnProps {
  quizId: string
  blocks?: LiveQuizData['blocks']
  activeBlock?: LiveQuizData['activeBlock'] | null
  beforeFirstBlock?: boolean | null
  displayName: string
  description?: string | null
  selectedBlock: number | null
  onSelectBlock: (value: number) => void
  isGamificationEnabled: boolean
  handleNewResponse: (params: {
    liveQuizId: string
    instanceId: number
    type: ElementType
    answer: any
    correlationKey?: string | null
    submissionId: string
  }) => Promise<{
    statusCode: number
    responseTimestamp?: number
    submissionId?: string
    hatchetEventId?: string
  }>
  className?: string
}

function LiveQuizQuestionColumn({
  quizId,
  blocks,
  activeBlock,
  beforeFirstBlock,
  displayName,
  description,
  selectedBlock,
  onSelectBlock,
  isGamificationEnabled,
  handleNewResponse,
  className,
}: LiveQuizQuestionColumnProps) {
  const t = useTranslations()
  const router = useRouter()

  return (
    <div
      className={twMerge('flex h-full min-w-0 flex-col bg-white', className)}
    >
      {blocks && blocks.length > 0 ? (
        <StepProgress
          value={
            selectedBlock !== null
              ? selectedBlock
              : blocks![0]?.status !== ElementBlockStatus.Scheduled
                ? 0
                : -1
          }
          items={blocks!.map((block, ix) => ({
            id: block?.id,
            ix,
            label: t('shared.generic.blockN', { number: ix + 1 }),
            blockStatus: block?.status,
            disabled: block?.status === ElementBlockStatus.Scheduled,
            className: twMerge(
              block?.id === activeBlock?.id &&
                'bg-primary-100! hover:bg-primary-100 text-white hover:text-white'
            ),
          }))}
          displayOffsetLeft={1}
          displayOffsetRight={1}
          formatter={({ element }) => (
            <span className="w-full space-x-2">
              <FontAwesomeIcon
                icon={
                  element.blockStatus === ElementBlockStatus.Scheduled
                    ? faClock
                    : element.blockStatus === ElementBlockStatus.Active
                      ? faUsers
                      : faCheck
                }
              />
              <span>{element.label}</span>
            </span>
          )}
          onItemClick={(_, item) => {
            if (!item?.disabled) {
              onSelectBlock(Number(item?.ix))
            }
          }}
          className={{ root: 'md:mt-0.25 mt-5 text-sm' }}
        />
      ) : null}

      {beforeFirstBlock ? (
        <div data-cy="live-quiz-description" className="mt-1.5 pt-4 md:pt-2">
          <H2>{displayName}</H2>
          {description !== null &&
          typeof description !== 'undefined' &&
          description !== '' &&
          !description?.match(/^(<br>(\n)*)$/g) ? (
            <Markdown content={description} />
          ) : (
            <UserNotification
              type="info"
              className={{ root: 'mt-1.5 md:text-base' }}
            >
              {t.rich('pwa.liveQuiz.noActiveQuestion', {
                reload: (text) => (
                  <span
                    className="cursor-pointer underline"
                    onClick={() => router.reload()}
                    data-cy="reload-live-quiz"
                  >
                    {text}
                  </span>
                ),
              })}
            </UserNotification>
          )}
        </div>
      ) : null}

      {activeBlock &&
      selectedBlock === blocks?.findIndex((b) => b?.id === activeBlock.id) ? (
        <QuestionArea
          key={`question-area-${activeBlock.id}-${activeBlock.status}-active`}
          isBlockActive
          quizId={quizId}
          gamificationEnabled={isGamificationEnabled}
          expiresAt={activeBlock.expiresAt}
          instances={activeBlock.elements ?? []}
          handleNewResponse={handleNewResponse}
          timeLimit={activeBlock?.timeLimit ?? undefined}
          execution={activeBlock?.execution ?? 0}
        />
      ) : null}

      {selectedBlock !== null &&
      (!activeBlock ||
        selectedBlock !== blocks?.findIndex((b) => b?.id === activeBlock.id)) &&
      blocks?.[selectedBlock] ? (
        <QuestionArea
          key={`question-area-${blocks[selectedBlock]?.id}-inactive`}
          quizId={quizId}
          gamificationEnabled={isGamificationEnabled}
          instances={blocks[selectedBlock]?.elements ?? []}
          execution={blocks[selectedBlock]?.execution ?? 0}
          handleNewResponse={async () => ({ statusCode: 0 })}
        />
      ) : null}
    </div>
  )
}

export default LiveQuizQuestionColumn
