import {
  ActivityTemplate,
  ElementInstance,
} from '@klicker-uzh/graphql/dist/ops'
import {
  LQ_DEFAULT_CORRECT_POINTS,
  LQ_DEFAULT_POINTS,
  LQ_MAX_BONUS_POINTS,
  LQ_TIME_TO_ZERO_BONUS,
} from '@klicker-uzh/shared-components/src/constants'
import { useLocalStorage } from '@uidotdev/usehooks'
import { H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { ElementFormTypes } from '../../questions/manipulation/types'
import ActivityRecoveryPrompt from './ActivityRecoveryPrompt'
import LiveQuizTemplateSettings from './liveQuiz/LiveQuizTemplateSettings'
import SectionCollapsible, {
  TemplateCollapsibleState,
  TemplateCollapsibleUIStates,
} from './SectionCollapsible'
import TemplateInfo from './TemplateInfo'

export type LiveQuizTemplateFormValues = {
  // common form values relevant for live quiz
  name: string
  displayName: string
  description?: string
  courseId?: string
  multiplier: string // ! fixed (but shown)
  settingsProcessed: boolean // boolean to signal that the settings have been processed / adapted if desired

  // live quiz settings (same as in wizard)
  isGamificationEnabled: boolean // ! irrelevant = hidden
  isConfusionFeedbackEnabled: boolean // ! irrelevant = hidden
  isLiveQAEnabled: boolean // ! irrelevant = hidden
  isModerationEnabled: boolean // ! irrelevant = hidden
  defaultPoints: number // ! fixed (but illustrated)
  defaultCorrectPoints: number // ! fixed (but illustrated)
  maxBonusPoints: number // ! fixed (but illustrated)
  timeToZeroBonus: number // ! fixed (but illustrated)

  // blocks with optionally identical or modified elements
  blocks: {
    timeLimit?: number // ! fixed (but shown)
    elements: {
      unmodifiedInstance: boolean // boolean to signal that this instance should be directly copied from the template
      processed: boolean // boolean to signal that this instance has been processed / adapted if desired
      instance: ElementInstance // original instance information from the template
      formValues: ElementFormTypes | null // form values for the element, if the user has chosen to insert their own content
    }[]
  }[]
}

function LiveQuizTemplate({ template }: { template: ActivityTemplate }) {
  const t = useTranslations()
  const liveQuiz = template.liveQuiz

  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false)

  // track states and validity of collapsibles
  const [collapsibles, setCollapsibles] = useState<TemplateCollapsibleUIStates>(
    {
      settings: {
        open: false,
        status: 'due',
      },
      ...liveQuiz?.blocks?.reduce<{
        [blockIx: number]: {
          [elementIx: number]: TemplateCollapsibleState
        }
      }>((acc, block, blockIx) => {
        acc[blockIx] =
          block.elements?.reduce<{
            [elementIx: number]: TemplateCollapsibleState
          }>((acc, _, elementIx) => {
            acc[elementIx] = {
              open: false,
              status: 'due',
            }
            return acc
          }, {}) ?? {}

        return acc
      }, {}),
    }
  )

  // initialize local storage object for data tracking
  const [quizData, setQuizData] = useLocalStorage<LiveQuizTemplateFormValues>(
    `live-quiz-template-inputs-${template.id}`,
    undefined
  )

  // TODO: extract to separate component / custom hook
  // helper function to initialize quiz data from template
  const initialLiveQuizTemplateFormData = () => {
    if (!liveQuiz) {
      return
    }

    const initialData: LiveQuizTemplateFormValues = {
      name: liveQuiz.name,
      displayName: liveQuiz.displayName,
      description: liveQuiz.description ?? undefined,
      courseId: undefined,
      multiplier: String(liveQuiz.pointsMultiplier),
      settingsProcessed: false,

      isGamificationEnabled: liveQuiz.isGamificationEnabled,
      isConfusionFeedbackEnabled: liveQuiz.isConfusionFeedbackEnabled,
      isLiveQAEnabled: liveQuiz.isLiveQAEnabled,
      isModerationEnabled: liveQuiz.isModerationEnabled,
      defaultPoints: liveQuiz.defaultPoints ?? LQ_DEFAULT_POINTS,
      defaultCorrectPoints:
        liveQuiz.defaultCorrectPoints ?? LQ_DEFAULT_CORRECT_POINTS,
      maxBonusPoints: liveQuiz.maxBonusPoints ?? LQ_MAX_BONUS_POINTS,
      timeToZeroBonus: liveQuiz.timeToZeroBonus ?? LQ_TIME_TO_ZERO_BONUS,

      blocks:
        liveQuiz.blocks?.map((block) => ({
          timeLimit: block.timeLimit ?? undefined,
          elements:
            block.elements?.map((element) => ({
              unmodifiedInstance: false,
              processed: false,
              instance: element,
              formValues: null,
            })) ?? [],
        })) ?? [],
    }

    return initialData
  }

  // TODO: extract to separate component / custom hook
  const loadProgressFromData = ({
    quizData,
  }: {
    quizData: LiveQuizTemplateFormValues
  }): TemplateCollapsibleUIStates => {
    const progress: TemplateCollapsibleUIStates = {
      settings: {
        open: false,
        status: quizData.settingsProcessed ? 'success' : 'due',
      },
    }

    // Create the block and element states with numeric indices as keys
    quizData.blocks.forEach((block, blockIx) => {
      progress[blockIx] = {}

      block.elements.forEach((element, elementIx) => {
        progress[blockIx][elementIx] = {
          open: false,
          status: element.processed ? 'success' : 'due',
        }
      })
    })

    return progress
  }

  useEffect(() => {
    // if live quiz template has not been loaded yet, return early
    if (liveQuiz === null || typeof liveQuiz === 'undefined') {
      return
    }

    // check if the data is already defined in local storage
    if (quizData) {
      setShowRecoveryPrompt(true)
    }
    // initialize live quiz template form data based on the loaded live quiz data
    else {
      const initialData = initialLiveQuizTemplateFormData()
      if (initialData) {
        setQuizData(initialData)
      }
    }
  }, [liveQuiz])

  if (!liveQuiz) {
    return (
      <UserNotification
        type="error"
        message={t('manage.template.errorLoadingTemplate')}
      />
    )
  }

  return (
    <div>
      <ActivityRecoveryPrompt
        open={showRecoveryPrompt}
        onDiscard={() => {
          const initialData = initialLiveQuizTemplateFormData()
          if (initialData) {
            setQuizData(initialData)
          }
          setShowRecoveryPrompt(false)
        }}
        onRecovery={() => {
          // set collapsible states based on the loaded data
          const progress = loadProgressFromData({ quizData })
          setCollapsibles(progress)

          // the saved data has already been loaded -> close modal
          setShowRecoveryPrompt(false)
        }}
      />

      <TemplateInfo
        activityType={template.activityType}
        name={liveQuiz.name}
        instructions={template.instructions}
      />
      <div className="mt-6 flex flex-col">
        <SectionCollapsible
          title={t('shared.generic.activitySettings')}
          status={collapsibles.settings.status}
          isOpen={collapsibles.settings.open}
          onOpenChange={() =>
            setCollapsibles((prev) => ({
              ...prev,
              settings: {
                ...prev.settings,
                open: !prev.settings.open,
              },
            }))
          }
        >
          {quizData && collapsibles.settings.open && (
            <LiveQuizTemplateSettings
              quizData={quizData}
              setQuizData={setQuizData}
              setCollapsibles={setCollapsibles}
            />
          )}
        </SectionCollapsible>

        {liveQuiz?.blocks?.map((block, blockIx) => (
          <div key={`block-${blockIx}`} className="mt-4">
            <H3>{`${t('shared.generic.block')} ${blockIx + 1}`}</H3>
            {block.elements?.map((element, elementIx) => (
              <SectionCollapsible
                key={`element-${blockIx}-${elementIx}`}
                title={`${t('shared.generic.element')} ${elementIx + 1}: ${t(`shared.types.${element.elementType}`)}`}
                status={collapsibles[blockIx]?.[elementIx]?.status || 'due'}
                isOpen={collapsibles[blockIx]?.[elementIx]?.open || false}
                onOpenChange={() =>
                  setCollapsibles((prev) => ({
                    ...prev,
                    [blockIx]: {
                      ...prev[blockIx],
                      [elementIx]: {
                        ...prev[blockIx]?.[elementIx],
                        open: !prev[blockIx]?.[elementIx]?.open,
                      },
                    },
                  }))
                }
              >
                {/* Element content */}
                <div>
                  Content for element {elementIx + 1} in block {blockIx + 1}
                </div>
              </SectionCollapsible>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default LiveQuizTemplate
