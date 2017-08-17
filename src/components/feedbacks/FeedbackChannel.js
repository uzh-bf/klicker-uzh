// @flow

import * as React from 'react'
import { Checkbox } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { Helmet } from 'react-helmet'

import { createLinks } from '../../lib'

import Feedback from './Feedback'

type Props = {
  data: Array<{
    content: string,
    id: string,
    votes: number,
  }>,
  intl: $IntlShape,
  isActive: boolean,
  isPublic: boolean,
  handleActiveToggle: () => mixed,
  handlePublicToggle: () => mixed,
}

const defaultProps = {
  isActive: false,
  isPublic: false,
}

const FeedbackChannel = ({
  data,
  intl,
  isActive,
  isPublic,
  handleActiveToggle,
  handlePublicToggle,
}: Props) =>
  (<div className="feedbackChannel">
    <Helmet>
      {createLinks(['checkbox'])}
    </Helmet>

    <h2>
      <FormattedMessage
        defaultMessage="Feedback-Channel"
        id="runningSession.feedbackChannel.string.title"
      />
    </h2>
    <div className="toggle">
      <Checkbox
        toggle
        defaultChecked={isActive}
        label={intl.formatMessage({
          defaultMessage: 'Activated',
          id: 'common.string.activated',
        })}
        value={isActive}
        onChange={handleActiveToggle}
      />
    </div>
    <div className="toggle publicationToggle">
      <Checkbox
        toggle
        className="publishCheckbox"
        defaultChecked={isPublic}
        disabled={!isActive}
        label={intl.formatMessage({
          defaultMessage: 'Publish questions',
          id: 'runningSession.feedbackChannel.string.publishQuestions',
        })}
        value={isPublic}
        onChange={handlePublicToggle}
      />
    </div>

    {isActive &&
      <div className="feedbacks">
        {data.map(({ content, id, votes }) =>
          (<div className="feedback">
            <Feedback key={id} content={content} votes={votes} />
          </div>),
        )}
      </div>}

    <style jsx>{`
      .feedbackChannel {
        display: flex;
        flex-direction: column;
      }

      h2,
      .toggle,
      .feedbacks {
        flex: 1;
      }

      h2 {
        margin-bottom: 1rem;
      }

      .publicationToggle {
        margin-top: 1rem;
      }

      .feedbacks {
        margin-top: 1rem;
      }

      .feedback:not(:last-child) {
        margin-bottom: 1rem;
      }

      @media all and (min-width: 768px) {
        .feedbackChannel {
          flex-flow: row wrap;
        }

        h2,
        .feedbacks {
          flex: 0 0 100%;
        }

        .toggle {
          flex: 0 0 auto;
        }

        .publicationToggle {
          margin: 0 0 0 2rem;
        }

        .feedback:not(:last-child) {
          margin-bottom: .5rem;
        }
      }
    `}</style>
  </div>)

FeedbackChannel.defaultProps = defaultProps

export default FeedbackChannel
