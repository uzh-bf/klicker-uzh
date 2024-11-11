import { Feedback } from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import * as JsSearch from 'js-search'
import _sortBy from 'lodash/sortBy'
import { useEffect, useState } from 'react'

const defaultFilterParams = {
  showResolvedInitial: true,
  showUnpublishedInitial: true,
  showOpenInitial: true,
  showUnpinnedInitial: true,
  sortByInitial: 'votes',
  withSearch: false,
}

interface FilterParams {
  showResolvedInitial?: boolean
  showUnpublishedInitial?: boolean
  showOpenInitial?: boolean
  showUnpinnedInitial?: boolean
  withSearch?: boolean
  sortByInitial?: string
}

function useFeedbackFilter(
  feedbacks?: Feedback[],
  {
    showResolvedInitial,
    showUnpublishedInitial,
    showOpenInitial,
    showUnpinnedInitial,
    sortByInitial,
    withSearch,
  }: FilterParams = defaultFilterParams
) {
  const [filteredFeedbacks, setFilteredFeedbacks] = useState(feedbacks)
  const [sortedFeedbacks, setSortedFeedbacks] = useState(feedbacks)

  const [showResolved, setShowResolved] = useState(showResolvedInitial ?? true)
  const [showUnpublished, setShowUnpublished] = useState(
    showUnpublishedInitial ?? true
  )
  const [showOpen, setShowOpen] = useState(showOpenInitial ?? true)
  const [showUnpinned, setShowUnpinned] = useState(showUnpinnedInitial ?? true)
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
      results = searchIndex?.search(searchString) as Feedback[]
    }
    setFilteredFeedbacks(
      results?.filter((item) => {
        if (!showResolved && item.isResolved === true) return false
        if (!showOpen && item.isResolved === false) return false
        if (!showUnpublished && item.isPublished === false) return false
        if (!showUnpinned && item.isPinned === false) return false
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
    showUnpublished,
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
      setSortBy,
      setSearchString,
      searchString,
      sortBy,
      showUnpinned,
      showOpen,
      showResolved,
      showUnpublished,
      withSearch,
    },
  }
}

export default useFeedbackFilter
