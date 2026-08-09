import { useMutation } from '@apollo/client'
import { faClock } from '@fortawesome/free-regular-svg-icons'
import {
  faDeleteLeft,
  faDownLeftAndUpRightToCenter,
  faUpRightAndDownLeftFromCenter,
} from '@fortawesome/free-solid-svg-icons'
import {
  ActivityTemplate,
  CreateLiveQuizFromTemplateDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { useLocalStorage } from '@uidotdev/usehooks'
import { Button, H3, toast, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import goToNextTemplateElement from './goToNextTemplateElement'
import LiveQuizTemplateSettings from './liveQuiz/LiveQuizTemplateSettings'
import LiveQuizTemplateSubmissionButton from './liveQuiz/LiveQuizTemplateSubmissionButton'
import LiveQuizTemplateTimeLimitModal from './liveQuiz/LiveQuizTemplateTimeLimitModal'
import loadProgressFromLiveQuizData from './liveQuiz/loadProgressFromLiveQuizData'
import useInitialLiveQuizTemplateFormData from './liveQuiz/useInitialLiveQuizTemplateFormData'
import useProcessLiveQuizTemplateBlocksData from './liveQuiz/useProcessLiveQuizTemplateBlocksData'
import markTemplateElementAsProcessed from './markTemplateElementAsProcessed'
import SectionCollapsible, {
  TemplateCollapsibleState,
  TemplateCollapsibleUIStates,
} from './SectionCollapsible'
import TemplateElementContent from './TemplateElementContent'
import TemplateInfo from './TemplateInfo'
import TemplateResetConfirmationPrompt from './TemplateResetConfirmationPrompt'
import { LiveQuizTemplateFormValues } from './types'

function LiveQuizTemplate({ template }: { template: ActivityTemplate }) {
  const t = useTranslations()
  const router = useRouter()
  const liveQuiz = template.liveQuiz

  // get processing function that creates the required answer collections
  // and prepares the element data for submission
  const { processLiveQuizTemplateBlocksData } =
    useProcessLiveQuizTemplateBlocksData()

  // mutation for submission
  const [createLiveQuizFromTemplate, { loading: creatingLiveQuiz }] =
    useMutation(CreateLiveQuizFromTemplateDocument)

  // reset modal and information toast if previous information was loaded into the template
  const [resetTemplatePrompt, setResetTemplatePrompt] = useState(false)

  // closing the settings step should be blocked unless the modified settings have been saved
  const [closingSettingsDisabled, setClosingSettingsDisabled] = useState(false)

  // submission error toast
  const onSubmissionError = () =>
    toast({
      type: 'error',
      message: t('manage.template.errorCreatingLiveQuizFromTemplate'),
      options: { duration: 6000 },
    })

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

  // `liveQuiz` is the lifecycle trigger for this one-time initialization. The
  // other values are read at that point; including persisted `quizData` would
  // replay the recovery toast and reset collapsible state on every edit.
  // biome-ignore lint/correctness/useExhaustiveDependencies: initialization intentionally runs only when the live quiz arrives
  useEffect(() => {
    // if live quiz template has not been loaded yet, return early
    if (liveQuiz === null || typeof liveQuiz === 'undefined') {
      return
    }

    // check if the data is already defined in local storage -> load data & set information toast
    if (quizData) {
      // set collapsible states based on the loaded data
      const progress = loadProgressFromLiveQuizData({ quizData })
      setCollapsibles(progress)

      // the saved data has already been loaded -> set toast
      toast({
        type: 'success',
        message: t('manage.template.recoveredTemplateData'),
        options: { duration: 8000 },
      })
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
          onOpenChange={() => {
            if (closingSettingsDisabled) {
              toast({
                type: 'error',
                message: t('manage.template.settingsNotSaved'),
                options: { duration: 4000 },
              })
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
          data={{ cy: 'live-quiz-template-settings' }}
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

        {quizData?.blocks?.map((block, blockIx) => (
          <div
            // Formik template blocks have no persisted identity; the field index is their controlled identity.
            // biome-ignore lint/suspicious/noArrayIndexKey: index is the only stable identity available for this controlled Formik array
            key={`live-quiz-template-block-${blockIx}`}
            className="mt-4"
          >
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
                key={`live-quiz-template-element-${element.instance.id}`}
                title={
                  element.useTemplateInstance ||
                  element.useExistingElement ||
                  element.useNewElement
                    ? `${t('shared.generic.element')} ${elementIx + 1}: ${element.formValues?.name ?? element.elementName ?? element.instance.elementData.name} (${element.useTemplateInstance ? t('manage.template.reusingElement') : ''}${element.useExistingElement ? t('manage.template.replacingElement') : ''}${element.useNewElement ? t('manage.template.creatingElement') : ''})`
                    : `${t('shared.generic.element')} ${elementIx + 1}: ${t(`shared.types.${element.instance.elementType}`)}`
                }
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
                data={{
                  cy: `live-quiz-template-element-${blockIx}-${elementIx}`,
                }}
              >
                <TemplateElementContent
                  blockIx={blockIx}
                  elementIx={elementIx}
                  templateId={template.id}
                  templateElement={element}
                  acceptTemplateElement={() => {
                    // store decision in form data
                    setQuizData((prev) => {
                      if (!prev) {
                        return prev
                      }

                      const blocks = [...prev.blocks]
                      const elements = [...blocks[blockIx].elements]
                      elements[elementIx] = {
                        processed: true,
                        useTemplateInstance: true,
                        useExistingElement: false,
                        useNewElement: false,
                        instance: elements[elementIx].instance,
                        formValues: null,
                        elementId: null,
                        elementName: null, // auxilary attribute for UI display when existing element is chosen
                      }
                      blocks[blockIx] = {
                        ...blocks[blockIx],
                        elements,
                      }

                      return {
                        ...prev,
                        blocks,
                      }
                    })

                    // update the collapsible state and open the next collapsible (if available)
                    markTemplateElementAsProcessed({
                      collapsibles,
                      setCollapsibles,
                      blockIx,
                      elementIx,
                    })
                  }}
                  replaceWithExistingElement={(elementId, elementName) => {
                    // store decision and element id in form data
                    setQuizData((prev) => {
                      if (!prev) {
                        return prev
                      }

                      const blocks = [...prev.blocks]
                      const elements = [...blocks[blockIx].elements]
                      elements[elementIx] = {
                        processed: true,
                        useTemplateInstance: false,
                        useExistingElement: true,
                        useNewElement: false,
                        instance: elements[elementIx].instance,
                        formValues: null,
                        elementId,
                        elementName,
                      }
                      blocks[blockIx] = {
                        ...blocks[blockIx],
                        elements,
                      }

                      return {
                        ...prev,
                        blocks,
                      }
                    })

                    // update the collapsible state and open the next collapsible (if available)
                    markTemplateElementAsProcessed({
                      collapsibles,
                      setCollapsibles,
                      blockIx,
                      elementIx,
                    })
                  }}
                  saveNewElement={(formValues) => {
                    setQuizData((prev) => {
                      if (!prev) {
                        return prev
                      }

                      const blocks = [...prev.blocks]
                      const elements = [...blocks[blockIx].elements]
                      elements[elementIx] = {
                        processed: true,
                        useTemplateInstance: false,
                        useExistingElement: false,
                        useNewElement: true,
                        instance: elements[elementIx].instance,
                        formValues,
                        elementId: null,
                        elementName: null,
                      }
                      blocks[blockIx] = {
                        ...blocks[blockIx],
                        elements,
                      }

                      return {
                        ...prev,
                        blocks,
                      }
                    })

                    // update the collapsible state and open the next collapsible (if available)
                    markTemplateElementAsProcessed({
                      collapsibles,
                      setCollapsibles,
                      blockIx,
                      elementIx,
                    })
                  }}
                  onNextElement={() => {
                    goToNextTemplateElement({
                      collapsibles,
                      setCollapsibles,
                      blockIx,
                      elementIx,
                    })
                  }}
                />
              </SectionCollapsible>
            ))}

            {timeLimitModal.open && timeLimitModal.blockIx === blockIx ? (
              <LiveQuizTemplateTimeLimitModal
                onClose={() => setTimeLimitModal({ open: false, blockIx: 0 })}
                blockIx={blockIx}
                timeLimit={quizData.blocks[blockIx]?.timeLimit}
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
            ) : null}
          </div>
        ))}

        <div className="mt-5 flex w-full justify-between">
          <div>
            <Button
              className={{ root: 'mr-2' }}
              onClick={() => {
                setCollapsibles((prev) => {
                  const newState = Object.entries(
                    prev
                  ).reduce<TemplateCollapsibleUIStates>(
                    (acc, [key, value]) => {
                      if (key === 'settings') {
                        acc[key] = {
                          ...(value as TemplateCollapsibleState),
                          open: true,
                        }
                      } else {
                        const blockIx = Number(key)
                        acc[blockIx] = Object.entries(value).reduce<{
                          [elementIx: number]: TemplateCollapsibleState
                        }>((blockAcc, [elementKey, elementValue]) => {
                          const elementIx = Number(elementKey)
                          blockAcc[elementIx] = { ...elementValue, open: true }
                          return blockAcc
                        }, {})
                      }
                      return acc
                    },
                    { settings: { ...prev.settings } }
                  )

                  return newState
                })
              }}
              data={{ cy: 'expand-all-sections' }}
            >
              <Button.Icon icon={faUpRightAndDownLeftFromCenter} />
              <Button.Label>{t('manage.template.expandAll')}</Button.Label>
            </Button>
            <Button
              onClick={() => {
                setCollapsibles((prev) => {
                  const newState = Object.entries(
                    prev
                  ).reduce<TemplateCollapsibleUIStates>(
                    (acc, [key, value]) => {
                      if (key === 'settings') {
                        acc[key] = {
                          ...(value as TemplateCollapsibleState),
                          open: false,
                        }
                      } else {
                        const blockIx = Number(key)
                        acc[blockIx] = Object.entries(value).reduce<{
                          [elementIx: number]: TemplateCollapsibleState
                        }>((blockAcc, [elementKey, elementValue]) => {
                          const elementIx = Number(elementKey)
                          blockAcc[elementIx] = { ...elementValue, open: false }
                          return blockAcc
                        }, {})
                      }
                      return acc
                    },
                    { settings: { ...prev.settings } }
                  )

                  return newState
                })
              }}
              data={{ cy: 'collapse-all-sections' }}
            >
              <Button.Icon icon={faDownLeftAndUpRightToCenter} />
              <Button.Label>{t('manage.template.collapseAll')}</Button.Label>
            </Button>
          </div>
          <div className="flex flex-row gap-2">
            <Button
              destructive
              disabled={creatingLiveQuiz || !initialTemplateFormData}
              onClick={() => {
                setResetTemplatePrompt(true)
              }}
              data={{ cy: 'reset-template-data' }}
            >
              <Button.Icon icon={faDeleteLeft} />
              <Button.Label>
                {t('manage.template.resetTemplateData')}
              </Button.Label>
            </Button>
            <LiveQuizTemplateSubmissionButton
              quizData={quizData}
              loading={creatingLiveQuiz}
              onSubmit={async () => {
                const inputsInvalid =
                  !quizData?.settingsProcessed ||
                  !quizData?.blocks?.every(
                    (block) =>
                      block.elements?.every((element) => element.processed) ??
                      false
                  )

                if (inputsInvalid) {
                  console.log(
                    'Template inputs were invalid, but submission was triggered'
                  )
                  onSubmissionError()
                  return
                }

                try {
                  const processedBlocks =
                    await processLiveQuizTemplateBlocksData({
                      data: quizData,
                    })

                  const { data: res } = await createLiveQuizFromTemplate({
                    variables: {
                      templateId: template.id,
                      name: quizData.name,
                      displayName: quizData.displayName,
                      description: quizData.description,
                      courseId: quizData.courseId,
                      isGamificationEnabled: quizData.isGamificationEnabled,
                      blocks: processedBlocks,
                    },
                  })

                  const quizId = res?.createLiveQuizFromTemplate
                  if (quizId) {
                    // remove local storage entry
                    localStorage.removeItem(
                      `live-quiz-template-inputs-${template.id}`
                    )

                    // redirect to live quiz overview and highlight newly created element
                    router.push({
                      pathname: '/activities',
                      query: { highlight: quizId },
                    })
                  } else {
                    console.log(
                      'An error occurred while creating the live quiz from the template'
                    )
                    onSubmissionError()
                  }
                } catch (error) {
                  console.log(error)
                  onSubmissionError()
                }
              }}
            />
          </div>
        </div>
      </div>

      {resetTemplatePrompt && (
        <TemplateResetConfirmationPrompt
          onClose={() => setResetTemplatePrompt(false)}
          onConfirm={() => {
            if (initialTemplateFormData) {
              // reset the form inputs
              setQuizData(initialTemplateFormData)

              // reset the progress parameters
              const progress = loadProgressFromLiveQuizData({
                quizData: initialTemplateFormData,
              })
              setCollapsibles(progress)

              // unset touched state for settings collapsible
              setClosingSettingsDisabled(false)

              // close the modal
              setResetTemplatePrompt(false)
            }
          }}
        />
      )}
    </div>
  )
}

export default LiveQuizTemplate
