import type { GetBasicCourseInformationQuery } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H2, UserNotification } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import CourseDiscussionThreadCard from './CourseDiscussionThreadCard'
import useCourseDiscussion from './useCourseDiscussion'

type BasicCourseInformation = NonNullable<
  GetBasicCourseInformationQuery['basicCourseInformation']
>

interface CourseDiscussionPanelProps {
  courseId: string
  scopeKey?: string
  embedToken?: string
  embedded?: boolean
  course?: BasicCourseInformation | null
  className?: string
  compact?: boolean
  showTitle?: boolean
  idPrefix?: string
}

function CourseDiscussionPanel({
  courseId,
  scopeKey,
  embedToken,
  embedded = false,
  course,
  className,
  compact = false,
  showTitle = true,
  idPrefix = 'course-qa',
}: CourseDiscussionPanelProps) {
  const t = useTranslations()
  const {
    localizedThreads,
    loadingThreads,
    threadsError,
    refetchThreads,
    hasMore,
    canPost,
    canVote,
    mustPostAnonymously,
    canChooseAnonymity,
    isAccessible,
    showComposer,
    threadDraft,
    setThreadDraft,
    postThreadAnonymous,
    setPostThreadAnonymous,
    creatingThread,
    handleCreateThread,
    loadingMore,
    handleLoadMore,
  } = useCourseDiscussion({ courseId, scopeKey, embedToken, embedded })

  if (loadingThreads) {
    return <Loader />
  }

  if (threadsError) {
    return (
      <UserNotification
        type="error"
        message={t('shared.generic.systemError')}
      />
    )
  }

  if (!embedded && course?.isCourseQARolloutEnabled === false) {
    return (
      <UserNotification
        type="warning"
        message={t('pwa.courseQA.accessDenied')}
        data={{ cy: 'course-qa-access-denied' }}
      />
    )
  }

  if (
    !embedded &&
    course?.isCourseQARolloutEnabled === true &&
    course?.isCourseQAEnabled === false
  ) {
    return (
      <UserNotification
        type="info"
        message={t('pwa.courseQA.disabled')}
        data={{ cy: 'course-qa-disabled-notice' }}
      />
    )
  }

  if (!isAccessible) {
    return (
      <UserNotification
        type="warning"
        message={t('pwa.courseQA.accessDenied')}
        data={{ cy: 'course-qa-access-denied' }}
      />
    )
  }

  const threadInputId = `${idPrefix}-thread-content`

  return (
    <div
      className={twMerge(
        'mx-auto flex w-full max-w-5xl flex-col gap-4',
        compact && 'mx-0 max-w-none gap-3',
        className
      )}
    >
      {showTitle && !showComposer && (
        <H2 className={{ root: 'mb-2' }}>{t('pwa.courseQA.title')}</H2>
      )}

      {showComposer ? (
        <div
          className={twMerge(
            'rounded-lg border border-gray-200 bg-white p-4 shadow-sm',
            compact && 'p-3'
          )}
        >
          {showTitle && (
            <H2 className={{ root: 'mb-2' }}>{t('pwa.courseQA.title')}</H2>
          )}

          <div className="flex flex-col gap-2">
            <label
              className="text-sm font-semibold text-gray-700"
              htmlFor={threadInputId}
            >
              {t('pwa.courseQA.newThread')}
            </label>
            <textarea
              id={threadInputId}
              name={threadInputId}
              rows={3}
              maxLength={4000}
              value={threadDraft}
              onChange={(event) => setThreadDraft(event.target.value)}
              autoComplete="off"
              placeholder={t('pwa.courseQA.threadPlaceholder')}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              aria-label={t('pwa.courseQA.newThread')}
              data-cy="course-qa-thread-input"
            />

            {embedToken &&
              (canChooseAnonymity ? (
                <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                  <input
                    name={`${idPrefix}-thread-anonymous`}
                    type="checkbox"
                    checked={postThreadAnonymous}
                    onChange={(event) =>
                      setPostThreadAnonymous(event.target.checked)
                    }
                    data-cy="course-qa-thread-anonymous"
                  />
                  {t('pwa.courseQA.postAnonymously')}
                </label>
              ) : mustPostAnonymously ? (
                <p
                  className="text-sm text-gray-600"
                  data-cy="course-qa-thread-anonymous"
                >
                  {t('pwa.courseQA.postingAnonymously')}
                </p>
              ) : null)}

            <div className="flex justify-end">
              <Button
                primary
                loading={creatingThread}
                disabled={creatingThread || threadDraft.trim().length === 0}
                onClick={handleCreateThread}
                data={{ cy: 'course-qa-create-thread' }}
              >
                <Button.Label>{t('pwa.courseQA.postThread')}</Button.Label>
              </Button>
            </div>
          </div>
        </div>
      ) : embedded ? (
        <UserNotification
          type="info"
          message={t('pwa.courseQA.readOnly')}
          data={{ cy: 'course-qa-read-only' }}
        />
      ) : null}

      <div className="flex flex-col gap-3" data-cy="course-qa-threads-list">
        {localizedThreads.length === 0 ? (
          <UserNotification
            type="info"
            message={t('pwa.courseQA.noThreads')}
            data={{ cy: 'course-qa-empty' }}
          />
        ) : (
          localizedThreads.map((thread) => (
            <CourseDiscussionThreadCard
              key={thread.id}
              courseId={courseId}
              thread={thread}
              embedToken={embedToken}
              compact={compact}
              canPost={canPost}
              canVote={canVote}
              canChooseAnonymity={canChooseAnonymity}
              mustPostAnonymously={mustPostAnonymously}
              idPrefix={idPrefix}
              onReplyCreated={refetchThreads}
              onContentDeleted={refetchThreads}
            />
          ))
        )}

        {hasMore && (
          <div className="flex justify-center">
            <Button
              onClick={handleLoadMore}
              loading={loadingMore}
              disabled={loadingMore}
              data={{ cy: 'course-qa-load-more' }}
            >
              <Button.Label>{t('pwa.courseQA.loadMore')}</Button.Label>
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CourseDiscussionPanel
