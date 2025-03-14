import { faClock } from '@fortawesome/free-regular-svg-icons'
import {
  ActivityTemplate,
  ElementInstance,
} from '@klicker-uzh/graphql/dist/ops'
import { useLocalStorage } from '@uidotdev/usehooks'
import { Button, H3, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { ElementFormTypes } from '../../questions/manipulation/types'
import ActivityRecoveryPrompt from './ActivityRecoveryPrompt'
import LiveQuizTemplateSettings from './liveQuiz/LiveQuizTemplateSettings'
import LiveQuizTimeLimitModal from './liveQuiz/LiveQuizTimeLimitModal'
import loadProgressFromLiveQuizData from './liveQuiz/loadProgressFromLiveQuizData'
import useInitialLiveQuizTemplateFormData from './liveQuiz/useInitialLiveQuizTemplateFormData'
import SectionCollapsible, {
  TemplateCollapsibleState,
  TemplateCollapsibleUIStates,
} from './SectionCollapsible'
import SettingsNotSavedToast from './SettingsNotSavedToast'
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
    timeLimit?: string
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

  // recovery prompt state in case a previous template state is still available for this activity
  const [showRecoveryPrompt, setShowRecoveryPrompt] = useState(false)

  // closing the settings step should be blocked unless the modified settings have been saved
  const [closingSettingsDisabled, setClosingSettingsDisabled] = useState(false)
  const [settingsTouchedToast, setSettingsTouchedToast] = useState(false)

  // time limit modal to set block time limit
  const [timeLimitModal, setTimeLimitModal] = useState({
    open: false,
    blockIx: 0,
  })

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

  // helper function to initialize quiz data from template
  const initialTemplateFormData = useInitialLiveQuizTemplateFormData({
    liveQuiz,
  })

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
      if (initialTemplateFormData) {
        setQuizData(initialTemplateFormData)
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
          if (initialTemplateFormData) {
            setQuizData(initialTemplateFormData)
          }
          setShowRecoveryPrompt(false)
        }}
        onRecovery={() => {
          // set collapsible states based on the loaded data
          const progress = loadProgressFromLiveQuizData({ quizData })
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
        <>
          <SectionCollapsible
            title={t('shared.generic.activitySettings')}
            status={collapsibles.settings.status}
            isOpen={collapsibles.settings.open}
            onOpenChange={() => {
              if (closingSettingsDisabled) {
                setSettingsTouchedToast(true)
                return
              }

              setCollapsibles((prev) => ({
                ...prev,
                settings: {
                  ...prev.settings,
                  open: !prev.settings.open,
                },
              }))
            }}
          >
            {quizData && collapsibles.settings.open && (
              <LiveQuizTemplateSettings
                quizData={quizData}
                setQuizData={setQuizData}
                setCollapsibles={setCollapsibles}
                setClosingSettingsDisabled={setClosingSettingsDisabled}
              />
            )}
          </SectionCollapsible>
          {closingSettingsDisabled && (
            <SettingsNotSavedToast
              open={settingsTouchedToast}
              onClose={() => setSettingsTouchedToast(false)}
            />
          )}
        </>

        {quizData?.blocks?.map((block, blockIx) => (
          <div key={`live-quiz-template-block-${blockIx}`} className="mt-4">
            <div className="flex flex-row items-center justify-between">
              <H3>{`${t('shared.generic.block')} ${blockIx + 1}`}</H3>
              <Button
                basic
                onClick={() => setTimeLimitModal({ open: true, blockIx })}
                className={{
                  root: 'text-primary-100 hover:text-primary-100 h-7',
                }}
              >
                <Button.Icon icon={faClock} />
                <Button.Label>
                  {block.timeLimit
                    ? `${t('manage.activityWizard.timeLimit')}: ${block.timeLimit} s`
                    : t('manage.activityWizard.noTimeLimit')}
                </Button.Label>
              </Button>
            </div>
            {block.elements?.map((element, elementIx) => (
              <SectionCollapsible
                key={`live-quiz-template-element-${blockIx}-${elementIx}`}
                title={`${t('shared.generic.element')} ${elementIx + 1}: ${t(`shared.types.${element.instance.elementType}`)}`}
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

            <LiveQuizTimeLimitModal
              open={timeLimitModal.open && timeLimitModal.blockIx === blockIx}
              onClose={() => setTimeLimitModal({ open: false, blockIx: 0 })}
              blockIx={blockIx}
              timeLimit={quizData.blocks[0]?.timeLimit}
              setTimeLimit={(newValue) => {
                setQuizData((prev) => {
                  if (!prev) {
                    return prev
                  }

                  const blocks = [...prev.blocks]
                  blocks[blockIx] = {
                    ...blocks[blockIx],
                    timeLimit: newValue,
                  }

                  return {
                    ...prev,
                    blocks,
                  }
                })
              }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export default LiveQuizTemplate
