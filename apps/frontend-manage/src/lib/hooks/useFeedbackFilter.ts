import dayjs from 'dayjs'
import * as JsSearch from 'js-search'
import _sortBy from 'lodash/sortBy'
import { useEffect, useState } from 'react'

type FeedbackFilterItem = {
  id: number
  content: string
  createdAt: unknown
  isPinned: boolean
  isPublished: boolean
  isResolved: boolean
  votes: number
}

const defaultFilterParams = {
  showResolvedInitial: true,
  showUnpublishedInitial: false,
  showOpenInitial: true,
  showUnpinnedInitial: false,
  showPublishedInitial: false,
  showPinnedInitial: false,
  sortByInitial: 'votes',
  withSearch: false,
}

interface FilterParams {
  showResolvedInitial?: boolean
  showUnpublishedInitial?: boolean
  showOpenInitial?: boolean
  showUnpinnedInitial?: boolean
  showPublishedInitial?: boolean
  showPinnedInitial?: boolean
  withSearch?: boolean
  sortByInitial?: string
}

function useFeedbackFilter<TFeedback extends FeedbackFilterItem>(
  feedbacks?: TFeedback[],
  {
    showResolvedInitial,
    showUnpublishedInitial,
    showOpenInitial,
    showUnpinnedInitial,
    showPublishedInitial,
    showPinnedInitial,
    sortByInitial,
    withSearch,
  }: FilterParams = defaultFilterParams
) {
  const [filteredFeedbacks, setFilteredFeedbacks] = useState(feedbacks)
  const [sortedFeedbacks, setSortedFeedbacks] = useState(feedbacks)

  const [showResolved, setShowResolved] = useState(showResolvedInitial ?? true)
  const [showUnpublished, setShowUnpublished] = useState(
    showUnpublishedInitial ?? false
  )
  const [showOpen, setShowOpen] = useState(showOpenInitial ?? true)
  const [showUnpinned, setShowUnpinned] = useState(showUnpinnedInitial ?? false)
  const [showPublished, setShowPublished] = useState(
    showPublishedInitial ?? false
  )
  const [showPinned, setShowPinned] = useState(showPinnedInitial ?? false)
  const [sortBy, setSortBy] = useState(sortByInitial ?? 'votes')

  const [searchString, setSearchString] = useState('')
  const [searchIndex, setSearchIndex] = useState(new JsSearch.Search('id'))

  useEffect(() => {
    if (withSearch) {
      const search = new JsSearch.Search('id')
      search.searchIndex = new JsSearch.TfIdfSearchIndex('id')
      search.indexStrategy = new JsSearch.AllSubstringsIndexStrategy()
      search.addIndex('content')
      search.addDocuments(feedbacks ?? [])
      setSearchIndex(search)
    }
  }, [feedbacks, withSearch])

  useEffect(() => {
    let results = feedbacks
    if (withSearch && searchString.length > 0) {
      results = searchIndex?.search(searchString) as TFeedback[]
    }
    setFilteredFeedbacks(
      results?.filter((item) => {
        // status filters (resolved/open can be shown independently)
        if (!showResolved && !showOpen) {
          return false
        }
        if (!showResolved && item.isResolved) return false
        if (!showOpen && !item.isResolved) return false

        // publication filters (mutually exclusive)
        if (showPublished || showUnpublished) {
          if (showPublished && !item.isPublished) return false
          if (showUnpublished && item.isPublished) return false
        }

        // pinning filters (mutually exclusive)
        if (showPinned || showUnpinned) {
          if (showPinned && !item.isPinned) return false
          if (showUnpinned && item.isPinned) return false
        }

        return true
      })
    )
  }, [
    feedbacks,
    searchIndex,
    searchString,
    showResolved,
    showOpen,
    showUnpinned,
    showPinned,
    showUnpublished,
    showPublished,
    withSearch,
  ])

  useEffect(() => {
    setSortedFeedbacks(
      _sortBy(
        filteredFeedbacks,
        (o: any) => {
          if (sortBy === 'recency') return dayjs(o.createdAt)
          return o[sortBy]
        },
        (o) => (o.isPinned === true ? 1 : -1)
      ).reverse()
    )
  }, [filteredFeedbacks, sortBy])

  return {
    sortedFeedbacks: sortedFeedbacks,
    filterProps: {
      setShowResolved,
      setShowUnpublished,
      setShowUnpinned,
      setShowOpen,
      setShowPublished,
      setShowPinned,
      setSortBy,
      setSearchString,
      searchString,
      sortBy,
      showUnpinned,
      showPinned,
      showOpen,
      showResolved,
      showUnpublished,
      showPublished,
      withSearch,
      handleReset: () => {
        setShowResolved(true)
        setShowOpen(true)
        setShowUnpinned(false)
        setShowPinned(false)
        setShowUnpublished(false)
        setShowPublished(false)
        setSearchString('')
        setSortBy('votes')
      },
    },
  }
}

export default useFeedbackFilter
