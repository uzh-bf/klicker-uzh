// @flow

import React, { Component } from 'react'
import { Button } from 'semantic-ui-react'

import Collapser from '../../components/common/Collapser'
import SingleChoiceOptions from '../../components/questionTypes/options/SingleChoiceOptions'
import StudentLayout from '../../components/layouts/StudentLayout'
import pageWithIntl from '../../lib/pageWithIntl'
import withData from '../../lib/withData'

class ActiveQuestion extends Component {
  props: {
    intl: $IntlShape,
  }

  state = {
    activeOption: -1,
    contentCollapsed: true,
  }

  handleCollapseToggle = () => {
    this.setState(prevState => ({ contentCollapsed: !prevState.contentCollapsed }))
  }

  handleOptionClick = index => () => {
    this.setState({ activeOption: index })
  }

  render() {
    const { intl } = this.props

    return (
      <StudentLayout
        intl={intl}
        sidebar={{ activeItem: 'activeQuestion' }}
        title={intl.formatMessage({
          defaultMessage: 'Active Question',
          id: 'student.activeQuestion.title',
        })}
      >
        <div className="activeQuestion">
          <div className="collapser">
            <Collapser
              collapsed={this.state.contentCollapsed}
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
              activeOption={this.state.activeOption}
              options={[
                { label: 'answer1' },
                { label: 'antwort 2' },
                { label: 'option 3' },
                { label: 'tschege' },
              ]}
              handleOptionClick={this.handleOptionClick}
            />
          </div>
          <div className="actionArea">
            <Button primary className="submitButton">
              Send
            </Button>
          </div>
        </div>

        <style jsx>{`
          .activeQuestion {
            display: flex;
            flex-direction: column;
          }

          .options {
            border-top: 1px solid lightgrey;
            padding: .5rem;
          }

          .actionArea {
            align-self: flex-end;
          }

          :global(.submitButton) {
            margin-right: .5rem !important;
          }
        `}</style>
      </StudentLayout>
    )
  }
}

export default withData(pageWithIntl(ActiveQuestion))
