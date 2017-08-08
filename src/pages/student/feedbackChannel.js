// @flow

import React, { Component } from 'react'
import { Button } from 'semantic-ui-react'
import Slider from 'react-rangeslider'

import StudentLayout from '../../components/layouts/StudentLayout'
import pageWithIntl from '../../lib/pageWithIntl'
import withData from '../../lib/withData'
import Feedback from '../../components/feedbacks/Feedback'
import withCSS from '../../lib/withCSS'

class FeedbackChannel extends Component {
  props: {
    head: 'next/head',
    intl: $IntlShape,
  }

  state = {
    difficulty: 0,
    speed: 0,
  }

  handleDifficultyChange = (difficulty) => {
    this.setState({ difficulty })
  }

  handleSpeedChange = (speed) => {
    this.setState({ speed })
  }

  render() {
    const { head, intl } = this.props

    return (
      <StudentLayout
        intl={intl}
        sidebar={{ activeItem: 'feedbackChannel' }}
        title={intl.formatMessage({
          defaultMessage: 'Feedback-Channel',
          id: 'student.feedbackChannel.title',
        })}
      >
        {head}

        <div className="feedbackChannel">
          <div className="confusionArea">
            <h2>Speed</h2>
            <div className="confusionSlider">
              <Slider
                min={-50}
                max={50}
                orientation="horizontal"
                value={this.state.speed}
                onChange={this.handleSpeedChange}
              />
            </div>
            <h2>Difficulty</h2>
            <div className="confusionSlider">
              <Slider
                min={-50}
                max={50}
                orientation="horizontal"
                value={this.state.difficulty}
                onChange={this.handleDifficultyChange}
              />
            </div>
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
          .feedbackChannel {
            display: flex;
            flex-direction: column;
          }

          .confusionArea {
            flex: 0 0 auto;

            background-color: lightgrey;
            border-bottom: 1px solid grey;
            border-top: 1px solid grey;
            padding: .5rem;
          }

          .confusionArea h2 {
            font-size: 1rem;
            margin: 0;
          }

          .feedbacks {
            flex: 1;

            padding: .5rem;
          }

          .feedback:not(:last-child) {
            margin-bottom: .5rem;
          }

          .actionButton {
            position: fixed;
            right: 1rem;
            bottom: 1rem;
          }
        `}</style>
      </StudentLayout>
    )
  }
}

export default withCSS(withData(pageWithIntl(FeedbackChannel)), [
  'https://unpkg.com/react-rangeslider@2.1.0/umd/randeslider.min.css',
])
