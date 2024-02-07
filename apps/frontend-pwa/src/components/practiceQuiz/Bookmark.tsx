import { useQuery } from '@apollo/client'
import { faBookmark } from '@fortawesome/free-regular-svg-icons'
import { faBookmark as faBookmarkFilled } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { GetBookmarksPracticeQuizDocument } from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useRouter } from 'next/router'
import { twMerge } from 'tailwind-merge'

interface BookmarkProps {
  quizId: string
}

function Bookmark({ quizId }: BookmarkProps) {
  const router = useRouter()
  const { data: bookmarksData } = useQuery(GetBookmarksPracticeQuizDocument, {
    variables: {
      courseId: router.query.courseId as string,
      quizId: quizId,
    },
    skip: !router.query.courseId,
  })

  // TODO
  const isBookmarked = false

  // TODO
  const bookmarkQuestion = () => {}

  return (
    <div
      className={twMerge(
        'flex flex-row gap-2',
        !bookmarksData?.getBookmarksPracticeQuiz && 'hidden'
      )}
    >
      <div>Bookmark</div>
      <Button basic onClick={() => bookmarkQuestion()}>
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
