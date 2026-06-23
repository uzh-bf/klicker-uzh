import { faBookmark } from '@fortawesome/free-regular-svg-icons'
import { faBookmark as faBookmarkFilled } from '@fortawesome/free-solid-svg-icons'
import { Button, toast } from '@uzh-bf/design-system'
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
        const bookmarksPageQueryInput = { courseId: variables.courseId }
        const shouldUpdateBookmarksPage =
          !variables.bookmarked && typeof quizId === 'undefined'

        await Promise.all([
          utils.participant.practiceQuizBookmarks.cancel(bookmarkQueryInput),
          shouldUpdateBookmarksPage
            ? utils.participant.bookmarksPageData.cancel(
                bookmarksPageQueryInput
              )
            : Promise.resolve(),
        ])

        const previousBookmarks =
          utils.participant.practiceQuizBookmarks.getData(bookmarkQueryInput)
        const previousBookmarksPageData = shouldUpdateBookmarksPage
          ? utils.participant.bookmarksPageData.getData(bookmarksPageQueryInput)
          : undefined

        utils.participant.practiceQuizBookmarks.setData(
          bookmarkQueryInput,
          (current) => {
            const currentBookmarks = current ?? []
            return variables.bookmarked
              ? Array.from(new Set([...currentBookmarks, variables.stackId]))
              : currentBookmarks.filter((entry) => entry !== variables.stackId)
          }
        )

        if (shouldUpdateBookmarksPage) {
          utils.participant.bookmarksPageData.setData(
            bookmarksPageQueryInput,
            (current) => {
              if (!current) return current

              return {
                ...current,
                stacks:
                  current.stacks?.filter(
                    (entry) => entry.id !== variables.stackId
                  ) ?? [],
              }
            }
          )
        }

        return {
          bookmarkQueryInput,
          bookmarksPageQueryInput,
          previousBookmarks,
          previousBookmarksPageData,
          shouldUpdateBookmarksPage,
        }
      },
      onError: (_error, _variables, context) => {
        if (context) {
          utils.participant.practiceQuizBookmarks.setData(
            context.bookmarkQueryInput,
            context.previousBookmarks
          )

          if (context.shouldUpdateBookmarksPage) {
            utils.participant.bookmarksPageData.setData(
              context.bookmarksPageQueryInput,
              context.previousBookmarksPageData
            )
          }
        }

        toast({
          type: 'error',
          message: t('shared.generic.systemError'),
          options: { duration: 5000 },
        })
      },
      onSuccess: (result, variables) => {
        utils.participant.practiceQuizBookmarks.setData(
          { courseId: variables.courseId, quizId },
          result
        )
      },
      onSettled: (_result, _error, variables) => {
        utils.participant.bookmarksPageData
          .invalidate({ courseId: variables.courseId })
          .catch(console.error)
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
