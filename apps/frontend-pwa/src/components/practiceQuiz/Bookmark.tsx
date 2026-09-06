import { useMutation } from '@apollo/client'
import { faBookmark } from '@fortawesome/free-regular-svg-icons'
import { faBookmark as faBookmarkFilled } from '@fortawesome/free-solid-svg-icons'
import {
  BookmarkElementStackDocument,
  GetBookmarksPracticeQuizDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'

interface BookmarkProps {
  bookmarks?: number[] | null
  quizId?: string
  stackId: number
}

function Bookmark({ bookmarks, quizId, stackId }: BookmarkProps) {
  const router = useRouter()
  const t = useTranslations()

  const isBookmarked = useMemo(() => {
    if (!bookmarks) {
      return false
    }

    return bookmarks.includes(stackId)
  }, [bookmarks, stackId])

  const [bookmarkElementStack, { loading: bookmarkingStack }] = useMutation(
    BookmarkElementStackDocument,
    {
      variables: {
        stackId: stackId,
        courseId: router.query.courseId as string,
        bookmarked: !isBookmarked,
      },
      update(cache, { data }) {
        // verify that the bookmarking was successful
        if (!data?.bookmarkElementStack) return

        // update the cached bookmarks (mutation directly returns updated stack ids)
        cache.updateQuery(
          {
            query: GetBookmarksPracticeQuizDocument,
            variables: { courseId: router.query.courseId as string, quizId },
          },
          () => ({ getBookmarksPracticeQuiz: data.bookmarkElementStack! })
        )
      },
      optimisticResponse: {
        bookmarkElementStack: isBookmarked
          ? (bookmarks || []).filter((entry) => entry !== stackId)
          : [...(bookmarks || []), stackId],
      },
    }
  )

  return (
    <Button
      disabled={bookmarkingStack}
      aria-pressed={isBookmarked}
      onClick={() => bookmarkElementStack()}
      data={{ cy: 'bookmark-element-stack' }}
      className={{
        root: twMerge(
          'h-11 text-sm',
          bookmarks === null || typeof bookmarks === 'undefined'
            ? 'hidden'
            : undefined
        ),
      }}
    >
      <Button.Icon
        icon={isBookmarked ? faBookmarkFilled : faBookmark}
        className={{ root: twMerge(isBookmarked && 'text-red-600') }}
      />
      <Button.Label>{t('shared.generic.bookmark')}</Button.Label>
    </Button>
  )
}

export default Bookmark
