// @flow

import React from 'react'
import classNames from 'classnames'
import { Button } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import { withData, pageWithIntl } from '../../lib'

import Collapser from '../../components/common/Collapser'
import ConfusionSlider from '../../components/confusion/ConfusionSlider'
import Feedback from '../../components/feedbacks/Feedback'
import SingleChoiceOptions from '../../components/questionTypes/SingleChoiceOptions'
import StudentLayout from '../../components/layouts/StudentLayout'

class Session extends React.Component {
  props: {
    head: 'next/head',
    intl: $IntlShape,
  }

  state: {
    feedbackDifficulty: number | null,
    feedbackSpeed: number | null,
    questionActiveOption: number,
    questionCollapsed: boolean,
    sidebarActiveItem: string,
  }

  constructor(props) {
    super(props)
    this.state = {
      feedbackDifficulty: null,
      feedbackSpeed: null,
      questionActiveOption: -1,
      questionCollapsed: true,
      sidebarActiveItem: 'activeQuestion',
    }
  }

  handleCollapseToggle = () => {
    this.setState(prevState => ({ questionCollapsed: !prevState.questionCollapsed }))
  }

  handleDifficultyChange = (feedbackDifficulty: number) => {
    this.setState({ feedbackDifficulty })
  }

  handleOptionClick = (questionActiveOption: number) => () => {
    this.setState({ questionActiveOption })
  }

  handleSidebarItemChange = (sidebarActiveItem: string) => {
    this.setState({ sidebarActiveItem })
  }

  handleSpeedChange = (feedbackSpeed: number) => {
    this.setState({ feedbackSpeed })
  }

  render() {
    const { head, intl } = this.props

    const title =
      this.state.sidebarActiveItem === 'activeQuestion'
        ? intl.formatMessage({
          defaultMessage: 'Active Question',
          id: 'student.activeQuestion.title',
        })
        : intl.formatMessage({
          defaultMessage: 'Feedback-Channel',
          id: 'student.feedbackChannel.title',
        })

    return (
      <StudentLayout
        sidebar={{
          activeItem: this.state.sidebarActiveItem,
          handleItemChange: this.handleSidebarItemChange,
        }}
        title={title}
      >
        <div className="student">
          {head}

          {process.env.SENTRY}

          <div
            className={classNames('questionArea', {
              active: this.state.sidebarActiveItem === 'activeQuestion',
            })}
          >
            <div className="collapser">
              <Collapser
                collapsed={this.state.questionCollapsed}
                handleCollapseToggle={this.handleCollapseToggle}
              >
                <p>
                  hello this is a very short question that is getting longer and longer as we speak.
                  it is in fact very very long. the end is even hidden at the beginning.
                </p>
                <p>
                  wow, is this a long question. i could never have imagined seeing such a question.
                </p>
                <p>
                  hello this is a very short question that is getting longer and longer as we speak.
                  it is in fact very very long. the end is even hidden at the beginning.
                </p>
                <p>
                  wow, is this a long question. i could never have imagined seeing such a question.
                </p>
              </Collapser>
            </div>

            <div className="options">
              <SingleChoiceOptions
                activeOption={this.state.questionActiveOption}
                options={[
                  { label: 'answer1' },
                  { label: 'antwort 2' },
                  { label: 'option 3' },
                  { label: 'tschege' },
                ]}
                handleOptionClick={this.handleOptionClick}
              />
            </div>

            <div className="actionButton">
              <Button primary className="submitButton">
                <FormattedMessage id="common.string.send" defaultMessage="Send" />
              </Button>
            </div>
          </div>

          <div
            className={classNames('feedbackArea', {
              active: this.state.sidebarActiveItem === 'feedbackChannel',
            })}
          >
            <div className="confusion">
              <ConfusionSlider
                title={
                  <h2>
                    <FormattedMessage id="common.string.speed" defaultMessage="Speed" />
                  </h2>
                }
                value={this.state.feedbackSpeed}
                handleChange={this.handleSpeedChange}
              />

              <ConfusionSlider
                title={
                  <h2>
                    <FormattedMessage id="common.string.difficulty" defaultMessage="Difficulty" />
                  </h2>
                }
                value={this.state.feedbackDifficulty}
                handleChange={this.handleDifficultyChange}
              />
            </div>

            <div className="feedbacks">
              <div className="feedback">
                <Feedback content="hello world" showDelete={false} votes={100} />
              </div>
              <div className="feedback">
                <Feedback content="blablbla" showDelete={false} votes={50} />
              </div>
              <div className="feedback">
                <Feedback content="hello" showDelete={false} votes={25} />
              </div>
              <div className="feedback">
                <Feedback content="hooi" showDelete={false} votes={10} />
              </div>
            </div>

            <div className="actionButton">
              <Button circular primary icon="plus" size="large" />
            </div>
          </div>

          <style jsx>{`
            .student {
              display: flex;
            }

            .questionArea,
            .feedbackArea {
              display: none;
              flex-direction: column;

              flex: 1;

              padding: .5rem;
            }

            .questionArea.active,
            .feedbackArea.active {
              display: flex;
            }

            .confusion {
              margin-bottom: .5rem;
              padding: .5rem;

              border: 1px solid grey;
            }

            .feedback:not(:last-child) {
              margin-bottom: .5rem;
            }

            .actionButton {
              position: fixed;

              bottom: 1rem;
              right: 1rem;
            }

            .actionButton :global(button) {
              margin-right: 0;
            }

            @media all and (min-width: 768px) {
              .questionArea,
              .feedbackArea {
                display: flex;
              }

              .actionButton {
                align-self: flex-end;
                position: inherit;

                margin-top: 1rem;
              }
            }
          `}</style>
        </div>
      </StudentLayout>
    )
  }
}

export default withData(pageWithIntl(Session))
