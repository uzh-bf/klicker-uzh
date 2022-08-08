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
  feedbacks,
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
  const [showUnpublished, setShowUnpublished] = useState(showUnpublishedInitial ?? true)
  const [showOpen, setShowOpen] = useState(showOpenInitial ?? true)
  const [showUnpinned, setShowUnpinned] = useState(showUnpinnedInitial ?? true)
  const [sortBy, setSortBy] = useState(sortByInitial ?? 'votes')

  const [searchString, setSearchString] = useState('')
  const [searchIndex, setSearchIndex] = useState(null)

  useEffect(() => {
    if (withSearch) {
      const search = new JsSearch.Search('id')
      search.searchIndex = new JsSearch.TfIdfSearchIndex()
      search.indexStrategy = new JsSearch.AllSubstringsIndexStrategy()
      search.tokenizer = new JsSearch.StopWordsTokenizer(new JsSearch.SimpleTokenizer())
      search.addIndex('content')
      search.addDocuments(feedbacks)
      setSearchIndex(search)
    }
  }, [feedbacks, withSearch])

  useEffect(() => {
    let results = feedbacks
    if (withSearch && searchString.length > 0) {
      results = searchIndex.search(searchString)
    }
    setFilteredFeedbacks(
      results.filter((item) => {
        if (!showResolved && item.resolved === true) return false
        if (!showOpen && item.resolved === false) return false
        if (!showUnpublished && item.published === false) return false
        if (!showUnpinned && item.pinned === false) return false
        return true
      })
    )
  }, [feedbacks, searchIndex, searchString, showResolved, showOpen, showUnpinned, showUnpublished, withSearch])

  useEffect(() => {
    setSortedFeedbacks(
      _sortBy(
        filteredFeedbacks,
        (o) => {
          if (sortBy === 'recency') return dayjs(o.recency)
          return o[sortBy]
        },
        (o) => (o.pinned === true ? 1 : -1)
      ).reverse()
    )
  }, [filteredFeedbacks, sortBy])

  return [
    sortedFeedbacks,
    {
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
  ]
}

export default useFeedbackFilter
