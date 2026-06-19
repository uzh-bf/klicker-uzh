// TODO: notifications

import useFeedbackFilter from '../../../lib/hooks/useFeedbackFilter'
// import { createNotification, requestNotificationPermissions } from '../../../lib/utils/notifications'
import FeedbacksPrintView from '../../evaluation/feedbacks/FeedbacksPrintView'
import type { AudienceFeedback } from '../types'
import FeedbackList from './FeedbackList'
import FeedbackOverviewFilters from './FeedbackOverviewFilters'
import FeedbackSearchBar from './FeedbackSearchBar'

interface Props {
  liveQuizName: string
  feedbacks?: AudienceFeedback[]
  handleDeleteFeedback: (feedbackId: number) => void
  handlePinFeedback: (feedbackId: number, isPinned: boolean) => void
  handlePublishFeedback: (feedbackId: number, isPublished: boolean) => void
  handleResolveFeedback: (feedbackId: number, resolvedState: boolean) => void
  handleRespondToFeedback: (feedbackId: number, response: string) => void
  handleDeleteFeedbackResponse: (responseId: number) => void
  isActive?: boolean
  isPublic?: boolean
}

function FeedbackChannel({
  liveQuizName,
  feedbacks = [],
  isActive = false,
  isPublic = false,
  handleDeleteFeedback,
  handlePinFeedback,
  handlePublishFeedback,
  handleResolveFeedback,
  handleRespondToFeedback,
  handleDeleteFeedbackResponse,
}: Props) {
  const { sortedFeedbacks, filterProps } = useFeedbackFilter(feedbacks, {
    withSearch: true,
  })

  // useEffect(() => {
  //   requestNotificationPermissions((permission) => {
  //     if (permission === 'granted') {
  //       setFeedbackLength(feedbacks.length)
  //     }
  //   })
  // }, [])

  // useEffect(() => {
  //   if (!sessionStorage?.getItem(`feedback ${feedbacks[feedbacks.length - 1]?.id}`)) {
  //     if (feedbacks.length > feedbackLength) {
  //       createNotification(intl.formatMessage(messages.notificationTitle), feedbacks[feedbacks.length - 1].content)
  //     }
  //     sessionStorage?.setItem(`feedback ${feedbacks[feedbacks.length - 1]?.id}`, 'notified')
  //   }
  //   setFeedbackLength(feedbacks.length)
  // }, [feedbacks.length])

  return (
    <>
      <FeedbacksPrintView
        feedbacks={sortedFeedbacks}
        liveQuizName={liveQuizName}
      />
      <div className="flex h-full flex-col gap-4 overflow-y-auto md:flex-row print:hidden">
        <div>
          <FeedbackOverviewFilters
            showResolved={filterProps.showResolved}
            showOpen={filterProps.showOpen}
            showPinned={filterProps.showPinned}
            showUnpinned={filterProps.showUnpinned}
            showPublished={filterProps.showPublished}
            showUnpublished={filterProps.showUnpublished}
            setShowResolved={filterProps.setShowResolved}
            setShowOpen={filterProps.setShowOpen}
            setShowPinned={filterProps.setShowPinned}
            setShowUnpinned={filterProps.setShowUnpinned}
            setShowPublished={filterProps.setShowPublished}
            setShowUnpublished={filterProps.setShowUnpublished}
            handleReset={filterProps.handleReset}
          />
        </div>
        <div className="flex w-full flex-1 flex-col overflow-auto">
          <div>
            <div className="mb-2 flex flex-row items-center gap-1">
              <FeedbackSearchBar
                searchString={filterProps.searchString}
                setSearchString={filterProps.setSearchString}
                sortBy={filterProps.sortBy}
                setSortBy={filterProps.setSortBy}
                disabled={{
                  search: feedbacks?.length === 0,
                  sorting: sortedFeedbacks?.length === 0,
                  print: sortedFeedbacks?.length === 0,
                }}
              />
            </div>
          </div>

          <div className="h-full overflow-y-auto">
            <FeedbackList
              feedbacks={sortedFeedbacks || []}
              noFeedbacks={feedbacks?.length === 0}
              isPublic={isPublic}
              handleDeleteFeedback={handleDeleteFeedback}
              handlePinFeedback={handlePinFeedback}
              handlePublishFeedback={
                !isPublic ? handlePublishFeedback : undefined
              }
              handleResolveFeedback={handleResolveFeedback}
              handleRespondToFeedback={handleRespondToFeedback}
              handleDeleteFeedbackResponse={handleDeleteFeedbackResponse}
            />
          </div>
        </div>
      </div>
    </>
  )
}

export default FeedbackChannel
