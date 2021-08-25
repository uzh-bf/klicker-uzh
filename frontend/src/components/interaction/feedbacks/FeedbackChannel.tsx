import { useEffect, useState } from 'react'
import { Checkbox, Dropdown, Input } from 'semantic-ui-react'
import { defineMessages, FormattedMessage, useIntl } from 'react-intl'
import _sortBy from 'lodash/sortBy'
import * as JsSearch from 'js-search'

import Feedback from './Feedback'

const messages = defineMessages({
  activated: {
    defaultMessage: 'Activated',
    id: 'common.string.activated',
  },
  publishQuestions: {
    defaultMessage: 'Publish feedbacks',
    id: 'runningSession.feedbackChannel.publishFeedbacks',
  },
})

interface Props {
  feedbacks?: any[]
  handleActiveToggle: any
  handleDeleteFeedback: any
  handlePublicToggle: any
  handlePinFeedback: (id: string, pinState: boolean) => void
  handleResolveFeedback: (id: string, resolvedState: boolean) => void
  handleRespondToFeedback: (id: string, response: string) => void
  handleDeleteFeedbackResponse: (id: string, responseId: string) => void
  isActive?: boolean
  isPublic?: boolean
  subscribeToMore: any
}

const defaultProps = {
  feedbacks: [],
  isActive: false,
  isPublic: false,
}

function FeedbackChannel({
  feedbacks,
  isActive,
  isPublic,
  handleActiveToggle,
  handlePublicToggle,
  handleDeleteFeedback,
  handlePinFeedback,
  handleResolveFeedback,
  handleRespondToFeedback,
  handleDeleteFeedbackResponse,
  subscribeToMore,
}: Props) {
  useEffect((): void => {
    if (subscribeToMore) {
      subscribeToMore()
    }
  }, [])

  const [searchString, setSearchString] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const [showOpen, setShowOpen] = useState(true)
  const [showUnpinned, setShowUnpinned] = useState(true)
  const [sortBy, setSortBy] = useState('upvotes')

  const search = new JsSearch.Search('content')
  search.searchIndex = new JsSearch.TfIdfSearchIndex()
  search.indexStrategy = new JsSearch.AllSubstringsIndexStrategy()
  search.addDocuments(feedbacks)

  const sortedFeedbacks = _sortBy(
    feedbacks.filter((item) => {
      if (!showResolved && item.resolved) return false
      if (!showOpen && !item.resolved) return false
      if (!showUnpinned && !item.pinned) return false
      return true
    }),
    [sortBy]
  )

  const intl = useIntl()

  return (
    <div>
      {/* <div>
        <FormattedMessage
          defaultMessage="The Feedback-Channel allows you to get open feedback from your participants. If you publish the feedbacks, your participants will be able to see what other participants have already posted."
          id="runningSession.feedbackChannel.info"
        />
      </div> */}

      {/* <div className="flex flex-col mt-4 md:flex-row">
        <div>
          <Checkbox
            toggle
            checked={isActive}
            defaultChecked={isActive}
            label={intl.formatMessage(messages.activated)}
            onChange={handleActiveToggle}
          />
        </div>
        <div className="mt-4 md:ml-8 md:mt-0">
          <Checkbox
            toggle
            checked={isPublic}
            defaultChecked={isPublic}
            disabled={!isActive}
            label={intl.formatMessage(messages.publishQuestions)}
            onChange={handlePublicToggle}
          />
        </div>
      </div> */}

      <div className="flex flex-row items-end justify-between mt-4">
        <div>
          <Input placeholder="Search..." value={searchString} onChange={(_, { data }) => setSearchString(data)} />
          <Checkbox checked={showResolved} label="Resolved" onChange={() => setShowResolved((current) => !current)} />
          <Checkbox
            checked={showOpen}
            className="ml-4"
            label="Open"
            onChange={() => setShowOpen((current) => !current)}
          />
          <Checkbox
            checked={showUnpinned}
            className="ml-4"
            label="Unpinned"
            onChange={() => setShowUnpinned((current) => !current)}
          />
        </div>

        <Dropdown
          selection
          disabled={sortedFeedbacks?.length === 0}
          options={[
            { text: 'Sort by Recency', value: 'recency' },
            { text: 'Sort by Upvotes', value: 'upvotes' },
          ]}
          value={sortBy}
          onChange={(_, { value }) => setSortBy(value)}
        />
      </div>

      {isActive && (
        <div className="mt-4 overflow-y-auto">
          {sortedFeedbacks.map(({ id, content, createdAt, votes, resolved, pinned, responses }) => (
            <div className="mt-2 first:mt-0" key={id}>
              <Feedback
                content={content}
                createdAt={createdAt}
                pinned={pinned}
                resolved={resolved}
                responses={responses}
                votes={votes}
                onDeleteFeedback={() => handleDeleteFeedback(id)}
                onDeleteResponse={(responseId) => handleDeleteFeedbackResponse(id, responseId)}
                onPinFeedback={(pinState) => handlePinFeedback(id, pinState)}
                onResolveFeedback={(resolvedState) => handleResolveFeedback(id, resolvedState)}
                onRespondToFeedback={(response) => handleRespondToFeedback(id, response)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

FeedbackChannel.defaultProps = defaultProps

export default FeedbackChannel
