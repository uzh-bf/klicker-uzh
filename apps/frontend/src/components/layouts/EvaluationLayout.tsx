import React, { useState, useEffect } from 'react'
import clsx from 'clsx'
import getConfig from 'next/config'
import { defineMessages, useIntl } from 'react-intl'
import { Checkbox, Dropdown, Menu, Icon } from 'semantic-ui-react'
import { Button } from '@uzh-bf/design-system'
import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/outline'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFile } from '@fortawesome/free-solid-svg-icons'

import useMarkdown from '../../lib/hooks/useMarkdown'
import CommonLayout from './CommonLayout'
import Info from '../evaluation/Info'
import Possibilities from '../evaluation/Possibilities'
import Statistics from '../evaluation/Statistics'
import VisualizationType from '../evaluation/VisualizationType'
import CsvExport from '../evaluation/CsvExport'
import { QUESTION_GROUPS, CHART_TYPES, QUESTION_TYPES, SESSION_STATUS } from '../../constants'
import QuestionFiles from '../sessions/join/QuestionFiles'

/* eslint-disable no-unused-vars */
const { publicRuntimeConfig } = getConfig()

const messages = defineMessages({
  showSolutionLabel: {
    defaultMessage: 'Show solution',
    id: 'evaluation.showSolution.label',
  },
})

interface Props {
  activeInstance?: number
  activeInstances: any[]
  activeVisualization: string
  children: React.ReactNode
  choices?: {
    correct?: boolean
    name: string
  }[]
  data: any[]
  description?: string
  files?: []
  instanceSummary?: any[]
  onChangeActiveInstance: (index: number) => void
  onChangeVisualizationType: (questionType: string, visualizationType: string) => void
  onToggleShowSolution: () => void
  options: any
  pageTitle?: string
  sessionId: string
  showGraph?: boolean
  showSolution?: boolean
  statistics?: { bins: number; onChangeBins: any; mean: number; median: number }
  title: string
  totalResponses?: number
  type: string
  feedbacks?: any[]
  showFeedback: boolean
  onChangeShowFeedback: (showFeedback: boolean) => void
  confusionTS?: any[]
  onChangeShowConfusionTS: (showConfusionTS: boolean) => void
  showConfusionTS: boolean
  showQuestionLayout: boolean
  sessionStatus: string
}

const defaultProps = {
  activeInstance: 0,
  description: undefined,
  instanceSummary: [],
  pageTitle: 'EvaluationLayout',
  showGraph: false,
  showSolution: false,
  statistics: undefined,
  totalResponses: undefined,
  choices: undefined,
  files: [],
  feedbacks: [],
  confusionTS: [],
}

function EvaluationLayout({
  activeInstance,
  activeInstances,
  activeVisualization,
  children,
  confusionTS,
  data,
  description,
  feedbacks,
  files,
  instanceSummary,
  onChangeActiveInstance,
  onChangeShowConfusionTS,
  onChangeShowFeedback,
  onChangeVisualizationType,
  onToggleShowSolution,
  options,
  pageTitle,
  sessionId,
  sessionStatus,
  showConfusionTS,
  showFeedback,
  showGraph,
  showQuestionLayout,
  showSolution,
  statistics,
  totalResponses,
  type,
}: Props): React.ReactElement {
  const intl = useIntl()

  const [currentIndex, setCurrentIndex] = useState(activeInstance)
  const [questionCollapsed, setQuestionCollapsed] = useState(true)
  const [showExtensibleButton, setExtensibleButton] = useState(false)

  const existsFeedback = feedbacks?.length > 0
  const existsConfusion = confusionTS?.length > 0
  const numberOfTabs = instanceSummary.length + (existsFeedback ? 1 : 0) + (existsConfusion ? 1 : 0)
  const feedbackIndex = existsConfusion ? numberOfTabs - 2 : numberOfTabs - 1
  const confusionIndex = numberOfTabs - 1

  useEffect(() => {
    const indexToSet = (): number => {
      if (showConfusionTS) {
        return confusionIndex
      }
      if (showFeedback) {
        return feedbackIndex
      }
      return currentIndex
    }
    setCurrentIndex(indexToSet)
  })

  useEffect(() => {
    setCurrentIndex(activeInstance)
    setQuestionCollapsed(true)
  }, [activeInstance, showFeedback, showConfusionTS])

  useEffect(() => {
    const questionElem = document.getElementById('question')
    if (questionElem.scrollHeight > questionElem.clientHeight || questionCollapsed === false) {
      setExtensibleButton(true)
    } else {
      setExtensibleButton(false)
    }
  }, [questionCollapsed, activeInstance, showFeedback, showConfusionTS])

  const dropdownOptions = instanceSummary.map(
    (
      { blockStatus, title, totalResponses: count },
      index
    ): {
      icon: string
      key: number
      text: string
      value: number
    } => ({
      icon: blockStatus === 'ACTIVE' ? 'comments' : 'checkmark',
      key: index,
      text: `${title} (${count})`,
      value: index,
    })
  )

  const activateInstance = (index: number): void => {
    const activateConfusion =
      (existsFeedback && existsConfusion && index === numberOfTabs - 1) ||
      (!existsFeedback && existsConfusion && index === numberOfTabs - 1)
    const activateFeedback =
      (existsFeedback && existsConfusion && index === numberOfTabs - 2) ||
      (existsFeedback && !existsConfusion && index === numberOfTabs - 1)
    const activateIndex = !(activateConfusion || activateFeedback)

    if (activateIndex) {
      onChangeShowFeedback(false)
      onChangeShowConfusionTS(false)
      onChangeActiveInstance(index)
    } else if (activateConfusion) {
      onChangeShowFeedback(false)
      onChangeShowConfusionTS(true)
    } else if (activateFeedback) {
      onChangeShowFeedback(true)
      onChangeShowConfusionTS(false)
    }

    setCurrentIndex(index)
  }

  return (
    <CommonLayout baseFontSize={20} nextHeight="100%" pageTitle={pageTitle}>
      <div
        className={clsx(
          'flex flex-col print:h-auto print:max-h-auto min-h-screen md:h-screen md:max-h-screen md:max-w-full evaluationLayout',
          {
            fullScreen: [CHART_TYPES.CLOUD_CHART, CHART_TYPES.TABLE].includes(activeVisualization),
          }
        )}
      >
        {((): React.ReactElement => {
          if (instanceSummary.length <= 0 && !existsFeedback && !existsConfusion) {
            return null
          }

          return (
            <div className="instanceChooser md:border-0 md:border-b md:border-primary md:border-solid md:pb-0 md:p-1.5 hidden md:flex flex-[0_0_auto] print:!hidden">
              <Menu
                fitted
                tabular
                className="md:!min-h-0 md:!mb-[-1px] md:!border-0 md:!border-b md:!border-solid md:!border-primary"
              >
                <Menu.Item
                  className="hoverable md:!text-[0.7rem] md:!py-0 md:!px-[0.6rem] md:!mx-0 md:!mt-0 md:!mb-[-1px] md:!h-8"
                  disabled={currentIndex === 0}
                  icon="arrow left"
                  onClick={(): void => activateInstance(currentIndex - 1)}
                />

                <Menu.Item
                  className="hoverable md:!text-[0.7rem] md:!py-0 md:!px-[0.6rem] md:!mx-0 md:!mt-0 md:!mb-[-1px] md:!h-8"
                  disabled={currentIndex + 1 === numberOfTabs}
                  icon="arrow right"
                  onClick={(): void => activateInstance(currentIndex + 1)}
                />

                <div className={clsx('instanceDropdown', instanceSummary.length >= 7 ? 'block' : 'hidden')}>
                  <Menu.Item
                    fitted
                    active={showQuestionLayout}
                    className="md:!p-[3px] md:!mx-0 md:!mt-0 md:!mb-[-1px] md:!h-8"
                  >
                    <Dropdown
                      search
                      selection
                      className="md:!text-[0.6rem] md:!leading-[0.6rem]"
                      options={dropdownOptions}
                      placeholder="Select Question"
                      value={currentIndex}
                      onChange={(_, { value }: { value: any }): void => {
                        activateInstance(value)
                      }}
                    />
                  </Menu.Item>
                </div>

                {instanceSummary.length < 7 &&
                  instanceSummary.map(
                    ({ id, blockStatus, title, totalResponses: count }, index): React.ReactElement => (
                      <Menu.Item
                        fitted
                        active={index === currentIndex}
                        className={clsx(
                          'hoverable',
                          'md:!text-[0.7rem] md:!py-0 md:!px-[0.6rem] md:!mx-0 md:!mt-0 md:!mb-[-1px] md:!h-8',
                          {
                            executed: blockStatus === 'EXECUTED',
                          }
                        )}
                        key={id}
                        onClick={(): void => {
                          activateInstance(index)
                        }}
                      >
                        <Icon name={blockStatus === 'ACTIVE' ? 'comments' : 'checkmark'} />
                        {title.length > 15 ? `${title.substring(0, 15)}...` : title} ({count})
                      </Menu.Item>
                    )
                  )}

                {sessionStatus === SESSION_STATUS.COMPLETED && existsFeedback && (
                  <Menu.Item
                    fitted
                    active={showFeedback}
                    className={clsx(
                      'hoverable',
                      'feedback',
                      'md:!text-[0.7rem] md:!py-0 md:!px-[0.6rem] md:!mx-0 md:!mt-0 md:!mb-[-1px] md:!h-8'
                    )}
                    onClick={(): void => {
                      // TODO: dont go with instance index, use showFeedback
                      activateInstance(existsConfusion ? numberOfTabs - 2 : numberOfTabs - 1) // if there is a confusion-tab, the tab is the second to last, otherwise the last
                    }}
                  >
                    Feedback-Channel
                  </Menu.Item>
                )}

                {sessionStatus === SESSION_STATUS.COMPLETED && existsConfusion && (
                  <Menu.Item
                    fitted
                    active={showConfusionTS}
                    className={clsx(
                      'hoverable',
                      'feedback',
                      'md:!text-[0.7rem] md:!py-0 md:!px-[0.6rem] md:!mx-0 md:!mt-0 md:!mb-[-1px] md:!h-8'
                    )}
                    onClick={(): void => {
                      // TODO: dont go with instance index, use showConfusionTS
                      activateInstance(numberOfTabs - 1)
                    }}
                  >
                    Confusion-Barometer
                  </Menu.Item>
                )}
              </Menu>
            </div>
          )
        })()}

        <div className="bg-primary-bg">
          <div
            className={clsx(
              questionCollapsed ? 'md:max-h-[7rem]' : 'md:max-h-content',
              !showExtensibleButton && 'border-solid border-b-only border-primary',
              showExtensibleButton &&
                questionCollapsed &&
                'md:bg-clip-text md:bg-gradient-to-b md:from-black md:via-black md:to-white md:text-transparent',
              'questionDetails w-full md:overflow-y-hidden md:self-start flex-[0_0_auto] p-4 text-left print:!text-xl print:!font-bold print:!ml-0 print:!pl-0 print:text-inherit print:border-solid print:border-b-only print:border-primary'
            )}
            id="question"
          >
            <p>
              {(showQuestionLayout && <Description formatted content={description} />) ||
                (showFeedback && 'Feedback-Channel') ||
                (showConfusionTS && 'Confusion-Barometer')}
            </p>
            {showQuestionLayout && publicRuntimeConfig.s3root && files?.length > 0 && (
              <div className="files">
                <QuestionFiles isCompact files={files} />
              </div>
            )}
          </div>
        </div>
        {showExtensibleButton && (
          <button
            className="hidden w-full h-4 text-xs text-center border-solid md:block bg-slate-200 border-b-only border-primary hover:bg-slate-300 print:hidden"
            type="button"
            onClick={() => setQuestionCollapsed(!questionCollapsed)}
          >
            {questionCollapsed ? (
              <ChevronDownIcon className="!m-0 -mt-1 h-3" />
            ) : (
              <ChevronUpIcon className="!m-0 -mt-1 h-3" />
            )}
          </button>
        )}

        <div className="flex flex-col flex-1 max-w-full max-h-full md:flex-row md:py-4 md:px-4">
          {activeVisualization !== CHART_TYPES.CLOUD_CHART &&
          activeVisualization !== CHART_TYPES.TABLE &&
          !showFeedback &&
          !showConfusionTS ? (
            <div
              className={clsx(
                'w-full h-[20rem] print:h-max-content md:w-[calc(100vw_-_18rem)] md:h-[calc(100vh-16.5rem)]',
                showQuestionLayout ? 'md:border md:border-solid md:border-gray-300' : '0'
              )}
            >
              {children}
            </div>
          ) : (
            <div
              className={clsx(
                'h-full w-full',
                showQuestionLayout ? 'md:border md:border-solid md:border-gray-300' : '0'
              )}
            >
              {children}
            </div>
          )}
          {activeVisualization !== CHART_TYPES.CLOUD_CHART &&
            activeVisualization !== CHART_TYPES.TABLE &&
            showQuestionLayout &&
            !showFeedback &&
            !showConfusionTS && (
              <div className="flex flex-col print:h-auto print:!mt-[20rem] md:h-full md:w-[18rem] py-4 px-4 md:pl-6 md:px-0 md:-pr-2 overflow-y-hidden print:!overflow-y-visible">
                <>
                  {QUESTION_GROUPS.WITH_POSSIBILITIES.includes(type) && (
                    <div>
                      <Possibilities
                        data={data}
                        questionOptions={options}
                        questionType={type}
                        showGraph={showGraph}
                        showSolution={showSolution}
                      />
                    </div>
                  )}

                  {QUESTION_GROUPS.WITH_STATISTICS.includes(type) && statistics && !showFeedback && (
                    <div className="mt-6">
                      <Statistics {...statistics} withBins={activeVisualization === CHART_TYPES.HISTOGRAM} />
                    </div>
                  )}
                </>
              </div>
            )}
        </div>

        <div>
          <div className="px-4 py-2 bg-gray-100 border-0 print:!border-0 border-t border-gray-300 border-solid md:flex md:flex-row md:items-center md:justify-between flex-[0_0_auto]">
            {showQuestionLayout && Info}
            <Info
              totalResponses={
                (showQuestionLayout && totalResponses) ||
                (showFeedback && feedbacks.length) ||
                (showConfusionTS && confusionTS.length) ||
                0
              }
            />
            {type !== QUESTION_TYPES.FREE &&
              type !== QUESTION_TYPES.FREE_RANGE &&
              activeVisualization !== CHART_TYPES.CLOUD_CHART &&
              showQuestionLayout && (
                <Checkbox
                  toggle
                  className="print:!hidden"
                  defaultChecked={showSolution}
                  label={intl.formatMessage(messages.showSolutionLabel)}
                  onChange={onToggleShowSolution}
                />
              )}
            {showQuestionLayout && (
              <div className="flex print:hidden">
                <CsvExport activeInstances={activeInstances} sessionId={sessionId} />
                <a href={`/sessions/print/${sessionId}`}>
                  <Button className="px-3 py-1">
                    <Button.Icon>
                      <FontAwesomeIcon icon={faFile} />
                    </Button.Icon>
                    <Button.Label>Export PDF</Button.Label>
                  </Button>
                </a>
              </div>
            )}
            {showQuestionLayout && (
              <VisualizationType
                activeVisualization={activeVisualization}
                questionType={type}
                onChangeType={onChangeVisualizationType}
              />
            )}
            {showFeedback && (
              <div className="print:hidden">
                <Button onClick={() => window.print()}>
                  <Button.Icon>
                    <FontAwesomeIcon icon={faFile} />
                  </Button.Icon>
                  <Button.Label>Print / PDF</Button.Label>
                </Button>
              </div>
            )}
          </div>
        </div>

        <style jsx>
          {`
            @import 'src/theme';

            .evaluationLayout {
              .questionDetails {
                :global(.description p:not(:last-child)) {
                  margin-bottom: 0.7rem;
                  line-height: 1;
                }

                :global(.description code) {
                  background: lightgrey;
                  padding: 0.1rem 0.3rem;
                }

                :global(.description blockquote) {
                  padding: 0.1rem 0.5rem;
                  color: gray;
                  font-style: italic;
                  border-left: 4px solid grey;
                }

                :global(.description ul:not(:last-child), .description ol:not(:last-child)) {
                  margin-bottom: 0.7rem;
                }

                :global(.description ul:not(:first-child), .description ol:not(:first-child)) {
                  margin-top: 0.7rem;
                }
              }
              @include desktop-tablet-only {
                .instanceChooser {
                  :global(> .menu) {
                    :global(> .item.active) {
                      border-color: $color-primary;
                      background-color: $color-primary-background;
                      border-bottom: 1px solid $color-primary-background;
                    }

                    :global(> .item.hoverable:hover) {
                      background-color: $color-primary-10p;
                    }

                    :global(> .item.executed) {
                      color: grey;
                    }

                    :global(> .item.feedback) {
                      color: grey;
                    }
                  }
                }

                .instanceDropdown {
                  :global(> .item.active) {
                    border-color: $color-primary;
                    background-color: $color-primary-background;
                    border-bottom: 1px solid $color-primary-background;
                  }

                  :global(.dropdown) {
                    :global(.item) {
                      min-height: 0;
                    }
                  }
                }
              }
            }
          `}
        </style>
        <style global jsx>{`
          html {
            font-size: 12px !important;
          }

          @media all and (min-width: 600px) {
            html {
              font-size: 14px !important;
            }
          }

          @media all and (min-width: 800px) {
            html {
              font-size: 16px !important;
            }
          }

          @media all and (min-width: 1000px) {
            html {
              font-size: 18px !important;
            }
          }

          @media all and (min-width: 1200px) {
            html {
              font-size: 20px !important;
            }
          }
        `}</style>
      </div>
    </CommonLayout>
  )
}

EvaluationLayout.defaultProps = defaultProps

function Description({ content, formatted }: any) {
  const parsedContent = useMarkdown({ content })
  return (
    <>
      <div className="description">{formatted ? parsedContent : content}</div>
    </>
  )
}

export default EvaluationLayout
