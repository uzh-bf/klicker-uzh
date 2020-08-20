import React, { useState, useEffect } from 'react'
import classNames from 'classnames'
import getConfig from 'next/config'
import { defineMessages, useIntl } from 'react-intl'
import { Button, Checkbox, Dropdown, Menu, Icon } from 'semantic-ui-react'

import CommonLayout from './CommonLayout'
import Info from '../evaluation/Info'
import Possibilities from '../evaluation/Possibilities'
import Statistics from '../evaluation/Statistics'
import VisualizationType from '../evaluation/VisualizationType'
import CsvExport from '../evaluation/CsvExport'
import { QUESTION_GROUPS, CHART_TYPES, QUESTION_TYPES } from '../../constants'
import QuestionFiles from '../sessions/join/QuestionFiles'

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
  children: React.ReactElement
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
  statistics?: { bins: number; onChangeBins: Function; mean: number; median: number }
  title: string
  totalResponses?: number
  type: string
  feedback: any[]
  showFeedback: boolean
  onChangeShowFeedback: (showFeedback: boolean) => void
  confusionTS: any[]
  onChangeShowConfusionTS: (showConfusionTS: boolean) => void
  showConfusionTS: boolean
  showQuestionLayout: boolean
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
}

function EvaluationLayout({
  activeVisualization,
  data,
  pageTitle,
  showGraph,
  showSolution,
  onToggleShowSolution,
  children,
  type,
  description,
  onChangeVisualizationType,
  totalResponses,
  options,
  activeInstance,
  activeInstances,
  onChangeActiveInstance,
  instanceSummary,
  statistics,
  sessionId,
  files,
  feedback,
  showFeedback,
  onChangeShowFeedback,
  confusionTS,
  onChangeShowConfusionTS,
  showConfusionTS,
  showQuestionLayout,
}: Props): React.ReactElement {
  const intl = useIntl()

  const [existsFeedback, setExistsFeedback] = useState(feedback.length > 0)
  const [existsConfusion, setExistsConfusion] = useState(confusionTS.length > 0)
  const [numberOfTabs, setNumberOfTabs] = useState(
    instanceSummary.length + (existsFeedback ? 1 : 0) + (existsConfusion ? 1 : 0)
  )
  const [currentIndex, setCurrentIndex] = useState(activeInstance)
  const [feedbackIndex, setFeedbackIndex] = useState(existsConfusion ? numberOfTabs - 2 : numberOfTabs - 1)
  const [confusionIndex, setConfusionIndex] = useState(numberOfTabs - 1)

  useEffect(() => {
    setExistsFeedback(feedback.length > 0)
  }, [feedback])

  useEffect(() => {
    setExistsConfusion(confusionTS.length > 0)
  }, [confusionTS])

  useEffect(() => {
    setNumberOfTabs(instanceSummary.length + (existsFeedback ? 1 : 0) + (existsConfusion ? 1 : 0))
  }, [existsFeedback, existsConfusion, instanceSummary])

  useEffect(() => {
    setFeedbackIndex(existsConfusion ? numberOfTabs - 2 : numberOfTabs - 1)
  }, [existsConfusion, numberOfTabs])

  useEffect(() => {
    setConfusionIndex(numberOfTabs - 1)
  }, [numberOfTabs])

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

  const feedbackOption = {
    icon: undefined,
    key: feedbackIndex,
    text: 'Feedback-Channel',
    value: feedbackIndex,
  }

  const confusionOption = {
    icon: undefined,
    key: confusionIndex,
    text: 'Confusion-Barometer',
    value: confusionIndex,
  }

  const dropdownOptions = instanceSummary.map(({ blockStatus, title, totalResponses: count }, index): {
    icon: string
    key: number
    text: string
    value: number
  } => ({
    icon: blockStatus === 'ACTIVE' ? 'comments' : 'checkmark',
    key: index,
    text: `${title} (${count})`,
    value: index,
  }))

  existsFeedback ? dropdownOptions.push(feedbackOption) : dropdownOptions
  existsConfusion ? dropdownOptions.push(confusionOption) : dropdownOptions

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
        className={classNames('evaluationLayout', {
          fullScreen: [CHART_TYPES.CLOUD_CHART, CHART_TYPES.TABLE].includes(activeVisualization),
        })}
      >
        {((): React.ReactElement => {
          if (instanceSummary.length <= 0) {
            return null
          }

          return (
            <>
              <div className="instanceDropdown">
                <Button
                  basic
                  className="hoverable"
                  disabled={currentIndex === 0}
                  icon="arrow left"
                  onClick={(): void => activateInstance(currentIndex - 1)}
                />
                <Button
                  basic
                  className="hoverable"
                  disabled={currentIndex + 1 === numberOfTabs}
                  icon="arrow right"
                  onClick={(): void => activateInstance(currentIndex + 1)}
                />
                <Dropdown
                  search
                  selection
                  options={dropdownOptions}
                  placeholder="Select Question"
                  value={currentIndex}
                  onChange={(_, { value }: { value: any }): void => {
                    activateInstance(value)
                  }}
                />
              </div>
              <div className="instanceChooser">
                <Menu fitted tabular>
                  <Menu.Item
                    className="hoverable"
                    disabled={currentIndex === 0}
                    icon="arrow left"
                    onClick={(): void => activateInstance(currentIndex - 1)}
                  />

                  <Menu.Item
                    className="hoverable"
                    disabled={currentIndex + 1 === numberOfTabs}
                    icon="arrow right"
                    onClick={(): void => activateInstance(currentIndex + 1)}
                  />

                  {instanceSummary.map(
                    ({ blockStatus, title, totalResponses: count }, index): React.ReactElement => (
                      <Menu.Item
                        fitted
                        active={index === currentIndex}
                        className={classNames('hoverable', {
                          executed: blockStatus === 'EXECUTED',
                        })}
                        onClick={(): void => {
                          activateInstance(index)
                        }}
                      >
                        <Icon name={blockStatus === 'ACTIVE' ? 'comments' : 'checkmark'} />
                        {title.length > 15 ? `${title.substring(0, 15)}...` : title} ({count})
                      </Menu.Item>
                    )
                  )}
                  {existsFeedback && (
                    <Menu.Item
                      fitted
                      active={showFeedback}
                      className={classNames('hoverable', 'feedback')}
                      onClick={(): void => {
                        activateInstance(existsConfusion ? numberOfTabs - 2 : numberOfTabs - 1) // if there is a confusion-tab, the tab is the second to last, otherwise the last
                      }}
                    >
                      Feedback-Channel
                    </Menu.Item>
                  )}
                  {existsConfusion && (
                    <Menu.Item
                      fitted
                      active={showConfusionTS}
                      className={classNames('hoverable', 'feedback')}
                      onClick={(): void => {
                        activateInstance(numberOfTabs - 1)
                      }}
                    >
                      Confusion-Barometer
                    </Menu.Item>
                  )}
                </Menu>
              </div>
            </>
          )
        })()}

        <div className="questionDetails">
          <p>
            {(showQuestionLayout && description) ||
              (showFeedback && 'Feedback-Channel') ||
              (showConfusionTS && 'Confusion-Barometer')}
          </p>
          {publicRuntimeConfig.s3root && files.length > 0 && (
            <div className="files">
              <QuestionFiles isCompact files={files} />
            </div>
          )}
        </div>

        <div className="info">
          <Info totalResponses={totalResponses} />
          {type !== QUESTION_TYPES.FREE &&
            type !== QUESTION_TYPES.FREE_RANGE &&
            activeVisualization !== CHART_TYPES.CLOUD_CHART &&
            showQuestionLayout && (
              <Checkbox
                toggle
                defaultChecked={showSolution}
                label={intl.formatMessage(messages.showSolutionLabel)}
                onChange={onToggleShowSolution}
              />
            )}
          {showQuestionLayout && (
            <div className="exportButtons">
              <CsvExport activeInstances={activeInstances} sessionId={sessionId} />
              <a href={`/sessions/print/${sessionId}`}>
                <Button content="Export PDF" icon="file" />
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
        </div>

        <div className="chart">{children}</div>

        {activeVisualization !== CHART_TYPES.CLOUD_CHART &&
          activeVisualization !== CHART_TYPES.TABLE &&
          showQuestionLayout && (
            <>
              {QUESTION_GROUPS.WITH_POSSIBILITIES.includes(type) && (
                <div className="optionDisplay">
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
                <div className="statistics">
                  <Statistics {...statistics} withBins={activeVisualization === CHART_TYPES.HISTOGRAM} />
                </div>
              )}
            </>
          )}

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

        <style jsx>
          {`
            @import 'src/theme';

            .evaluationLayout {
              display: flex;
              flex-direction: column;
              min-height: 100vh;

              .exportButtons {
                display: flex;
              }

              .instanceChooser {
                flex: 0 0 auto;
                order: 0;
                display: ${instanceSummary.length < 7 ? 'flex' : 'none'};

                @media all and (max-width: 600px) {
                  display: none;
                }
              }

              .instanceDropdown {
                flex: 0 0 auto;
                order: 0;
                display: ${instanceSummary.length >= 7 ? 'flex' : 'none'};

                @media all and (max-width: 600px) {
                  display: flex;
                }
              }

              .chart {
                flex: 1 0 50vh;
                order: 5;
              }

              .questionDetails,
              .feedbackDetails {
                flex: 0 0 auto;
                order: 1;

                background-color: $color-primary-background;
                border-bottom: 1px solid $color-primary;
                padding: 1rem;
                text-align: left;
              }

              .info {
                flex: 0 0 auto;
                order: 4;

                border-top: 1px solid lightgrey;
                background-color: #f3f3f3;
                padding: 0.5rem 1rem;
              }

              .chartType {
                flex: 0 0 auto;
                order: 4;

                padding: 1rem;
              }

              .optionDisplay,
              .statistics {
                padding: 1rem 1rem 1rem 0.5rem;
              }

              .optionDisplay {
                flex: 0 0 auto;
                order: 2;
              }

              .statistics {
                flex: 0 0 auto;
                order: 3;
              }

              @supports (grid-gap: 1rem) {
                @include desktop-tablet-only {
                  display: grid;
                  height: 100vh;
                  max-height: 100vh;
                  max-width: 100vw;

                  grid-template-columns: auto 14rem;
                  grid-template-rows:
                    auto
                    auto
                    auto
                    auto
                    minmax(auto, 100%)
                    auto;
                  grid-template-areas:
                    'instanceChooser instanceChooser'
                    'questionDetails questionDetails'
                    'graph optionDisplay'
                    'graph statistics'
                    'graph statistics'
                    'info info';

                  &.fullScreen {
                    grid-template-areas:
                      'instanceChooser instanceChooser'
                      'questionDetails questionDetails'
                      'graph graph'
                      'graph graph'
                      'graph graph'
                      'info info';
                  }

                  .instanceChooser {
                    grid-area: instanceChooser;
                    padding: 0.3rem;
                    padding-bottom: 0;
                    border-bottom: 1px solid $color-primary;

                    :global(.menu) {
                      min-height: 0;
                      margin-bottom: -1px;
                      border-bottom: 1px solid $color-primary;

                      :global(.item) {
                        font-size: 0.7rem;
                        padding: 0 0.6rem;
                        margin: 0 0 -1px 0;
                        height: 2rem;
                      }

                      :global(.item.active) {
                        border-color: $color-primary;
                        background-color: $color-primary-background;
                        border-bottom: 1px solid $color-primary-background;
                      }

                      :global(.item.hoverable:hover) {
                        background-color: $color-primary-10p;
                      }

                      :global(.item.executed) {
                        color: grey;
                      }

                      :global(.item.feedback) {
                        color: grey;
                      }
                    }
                  }

                  .instanceDropdown {
                    font-size: 0.8rem;
                  }

                  .questionDetails,
                  .feedbackDetails {
                    grid-area: questionDetails;
                    align-self: start;

                    h1 {
                      font-size: 1.5rem;
                      line-height: 1.5rem;
                      margin-bottom: 0.5rem;
                    }

                    p {
                      font-size: 1.2rem;
                      font-weight: bold;
                      line-height: 1.5rem;
                    }
                  }

                  .chart {
                    grid-area: graph;

                    height: 100%;
                    padding: 1rem 0.5rem 1rem 1rem;

                    :global(> *) {
                      border: 1px solid lightgrey;
                    }
                  }

                  .info {
                    grid-area: info;

                    align-self: end;

                    display: flex;
                    flex-direction: row;
                    align-items: center;
                    justify-content: space-between;
                  }

                  .optionDisplay {
                    grid-area: optionDisplay;

                    h2 {
                      font-size: 1.5rem;
                      line-height: 1.5rem;
                      margin-bottom: 0.5rem;
                    }
                  }

                  .statistics {
                    grid-area: statistics;
                  }
                }
              }
            }
          `}
        </style>
      </div>
    </CommonLayout>
  )
}

EvaluationLayout.defaultProps = defaultProps

export default EvaluationLayout
