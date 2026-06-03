import { faBookmark } from '@fortawesome/free-regular-svg-icons'
import { faBookmark as faBookmarkFilled } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { twMerge } from 'tailwind-merge'
import { trpc } from '../../lib/trpc'

interface BookmarkProps {
  bookmarks?: number[] | null
  quizId?: string
  stackId: number
}

function Bookmark({ bookmarks, quizId, stackId }: BookmarkProps) {
  const router = useRouter()
  const t = useTranslations()
  const utils = trpc.useUtils()
  const courseId =
    typeof router.query.courseId === 'string' ? router.query.courseId : ''
  const bookmarkElementStack =
    trpc.participant.bookmarkElementStack.useMutation({
      onMutate: async (variables) => {
        const bookmarkQueryInput = { courseId: variables.courseId, quizId }
        await utils.participant.practiceQuizBookmarks.cancel(bookmarkQueryInput)

        const previousBookmarks =
          utils.participant.practiceQuizBookmarks.getData(bookmarkQueryInput)

        utils.participant.practiceQuizBookmarks.setData(
          bookmarkQueryInput,
          (current) => {
            const currentBookmarks = current ?? []
            return variables.bookmarked
              ? Array.from(new Set([...currentBookmarks, variables.stackId]))
              : currentBookmarks.filter((entry) => entry !== variables.stackId)
          }
        )

        return { bookmarkQueryInput, previousBookmarks }
      },
      onError: (_error, _variables, context) => {
        if (!context) return

        utils.participant.practiceQuizBookmarks.setData(
          context.bookmarkQueryInput,
          context.previousBookmarks
        )
      },
      onSuccess: (result, variables) => {
        utils.participant.practiceQuizBookmarks.setData(
          { courseId: variables.courseId, quizId },
          result
        )
      },
    })

  const isBookmarked = useMemo(() => {
    if (!bookmarks) {
      return false
    }

    return bookmarks.includes(stackId)
  }, [bookmarks, stackId])

  return (
    <Button
      disabled={bookmarkElementStack.isLoading || courseId === ''}
      onClick={() => {
        if (courseId === '') return

        bookmarkElementStack.mutate({
          stackId,
          courseId,
          bookmarked: !isBookmarked,
        })
      }}
      data={{ cy: 'bookmark-element-stack' }}
      className={{
        root: twMerge(
          'h-7 text-sm',
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
