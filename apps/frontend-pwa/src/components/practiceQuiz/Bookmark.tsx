import { useMutation } from '@apollo/client'
import { faBookmark } from '@fortawesome/free-regular-svg-icons'
import { faBookmark as faBookmarkFilled } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
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
      update(cache) {
        const data = cache.readQuery({
          query: GetBookmarksPracticeQuizDocument,
          variables: {
            courseId: router.query.courseId as string,
            quizId: quizId,
          },
        })
        cache.writeQuery({
          query: GetBookmarksPracticeQuizDocument,
          variables: { courseId: router.query.courseId as string, quizId },
          data: {
            getBookmarksPracticeQuiz: isBookmarked
              ? (data?.getBookmarksPracticeQuiz ?? []).filter(
                  (entry) => entry !== stackId
                )
              : [...(data?.getBookmarksPracticeQuiz ?? []), stackId],
          },
        })
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
      onClick={() => bookmarkElementStack()}
      data={{ cy: 'bookmark-element-stack' }}
      className={{
        root: twMerge(
          'flex flex-row items-center text-sm shadow-none',
          bookmarks === null || typeof bookmarks === 'undefined'
            ? 'hidden'
            : undefined
        ),
      }}
    >
      <Button.Label>
        <div>{t('shared.generic.bookmark')}</div>
      </Button.Label>
      <Button.Icon>
        {isBookmarked ? (
          <FontAwesomeIcon
            className="text-red-600 hover:text-red-500"
            icon={faBookmarkFilled}
          />
        ) : (
          <FontAwesomeIcon className="hover:text-red-400" icon={faBookmark} />
        )}
      </Button.Icon>
    </Button>
  )
}

export default Bookmark
