// @flow

import React, { Component } from 'react'
import { Button, Icon } from 'semantic-ui-react'

import StudentLayout from '../../components/layouts/StudentLayout'
import pageWithIntl from '../../lib/pageWithIntl'
import withData from '../../lib/withData'

class ActiveQuestion extends Component {
  props: {
    intl: $IntlShape,
  }

  state = {
    contentExtended: false,
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
          <div
            className={
              this.state.contentExtended ? 'content contentExtended' : 'content contentCollapsed'
            }
          >
            <p>
              hello this is a very short question that is getting longer and longer as we speak. it
              is in fact very very long. the end is even hidden at the beginning.
            </p>
            <p>wow, is this a long question. i could never have imagined seeing such a question.</p>
          </div>
          <div className="collapser">
            <Icon
              name={this.state.contentExtended ? 'angle double up' : 'angle double down'}
              onClick={() =>
                this.setState(prevState => ({ contentExtended: !prevState.contentExtended }))}
            />
          </div>
          <div className="answers">
            <Button basic fluid className="option">
              answer 1
            </Button>
            <Button basic fluid className="option">
              answer two
            </Button>
            <Button basic fluid className="option">
              dritte antwort
            </Button>
            <Button basic fluid className="option">
              fourth option
            </Button>
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

          .contentCollapsed, .contentExtended {
            transition: linear max-height 1s 1s;
          }

          .content {
            line-height: 1.2rem;
            margin: .5rem;
            margin-bottom: .3rem;
          }

          .content p {
            margin-top: 0;
            margin-bottom: .6rem;
          }

          .content p:last-child {
            margin-bottom: 0;
          }

          .contentCollapsed {
            flex: 1;

            max-height: 4.2rem;
            overflow: hidden;
          }

          .contentExtended {
            flex: 0 0 auto;

            max-height: 100%;
          }

          .collapser {
            margin: auto;
            margin-bottom: .3rem;
          }

          .answers {
            border-top: 1px solid lightgrey;
            padding: .5rem;
          }

          :global(.option:not(:last-child)) {
            margin-bottom: .5rem;
          }

          .actionArea {
            align-self: flex-end;
            flex: 0 0 auto;
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
