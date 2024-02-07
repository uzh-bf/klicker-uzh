import { useMutation, useQuery } from '@apollo/client'
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
  quizId: string
  stackId: number
}

function Bookmark({ quizId, stackId }: BookmarkProps) {
  const router = useRouter()
  const t = useTranslations()

  const { data: bookmarksData } = useQuery(GetBookmarksPracticeQuizDocument, {
    variables: {
      courseId: router.query.courseId as string,
      quizId: quizId,
    },
    skip: !router.query.courseId,
  })

  const isBookmarked = useMemo(() => {
    if (!bookmarksData || !bookmarksData.getBookmarksPracticeQuiz) {
      return false
    }

    return bookmarksData.getBookmarksPracticeQuiz.includes(stackId)
  }, [bookmarksData, stackId])

  const [bookmarkQuestion] = useMutation(BookmarkElementStackDocument, {
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
        ? bookmarksData?.getBookmarksPracticeQuiz?.filter(
            (entry) => entry !== stackId
          )
        : [...(bookmarksData?.getBookmarksPracticeQuiz ?? []), stackId],
    },
  })

  return (
    <div
      className={twMerge(
        'flex flex-row gap-2',
        !(bookmarksData?.getBookmarksPracticeQuiz !== null) && 'hidden'
      )}
    >
      <div>{t('shared.generic.bookmark')}</div>
      <Button
        basic
        onClick={() => bookmarkQuestion()}
        data={{ cy: 'bookmark-element-stack' }}
      >
        {isBookmarked ? (
          <FontAwesomeIcon
            className="text-red-600 sm:hover:text-red-500"
            icon={faBookmarkFilled}
          />
        ) : (
          <FontAwesomeIcon
            className="sm:hover:text-red-400"
            icon={faBookmark}
          />
        )}
      </Button>
    </div>
  )
}

export default Bookmark
