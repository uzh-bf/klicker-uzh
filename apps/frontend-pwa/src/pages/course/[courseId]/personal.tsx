import { useMutation, useQuery } from '@apollo/client'
import {
  FlashcardCorrectness,
  FlashcardCorrectnessType,
  GetBasicCourseInformationDocument,
  MDeletePersonalElementDocument,
  MRespondToPersonalElementDocument,
  QPersonalElementsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import Flashcard from '@klicker-uzh/shared-components/src/Flashcard'
import { Button, H1, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import Layout from '../../../components/Layout'

function PersonalElements() {
  const t = useTranslations()
  const router = useRouter()
  const courseId = router.query.courseId as string
  const [currentIx, setCurrentIx] = useState(0)
  const [responses, setResponses] = useState<
    Record<string, FlashcardCorrectness>
  >({})

  const {
    data: courseData,
    error: courseError,
    loading: courseLoading,
  } = useQuery(GetBasicCourseInformationDocument, {
    variables: { courseId },
    skip: !courseId,
  })
  const {
    data,
    error: elementsError,
    loading,
    refetch,
  } = useQuery(QPersonalElementsDocument, {
    variables: { courseId },
    skip: !courseId,
  })
  const [respond, { error: respondError }] = useMutation(
    MRespondToPersonalElementDocument
  )
  const [remove, { error: deleteError }] = useMutation(
    MDeletePersonalElementDocument
  )
  const [actionError, setActionError] = useState(false)

  const elements = data?.personalElements ?? []
  const dueCards = useMemo(
    () =>
      elements.filter(
        (element) =>
          !element.nextDueAt || new Date(element.nextDueAt) <= new Date()
      ),
    [elements]
  )
  const dueCount = dueCards.length
  const current = dueCards[currentIx]

  useEffect(() => {
    setCurrentIx((index) => Math.min(index, Math.max(dueCards.length - 1, 0)))
  }, [dueCards.length])

  const handleResponse = async (
    elementId: string,
    response: FlashcardCorrectness
  ) => {
    setActionError(false)
    setResponses((previous) => ({ ...previous, [elementId]: response }))
    try {
      await respond({
        variables: {
          id: elementId,
          response:
            response === FlashcardCorrectness.Correct
              ? FlashcardCorrectnessType.Correct
              : response === FlashcardCorrectness.Partial
                ? FlashcardCorrectnessType.Partial
                : FlashcardCorrectnessType.Incorrect,
        },
      })
      await refetch()
    } catch {
      setResponses((previous) => {
        const next = { ...previous }
        delete next[elementId]
        return next
      })
      setActionError(true)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('pwa.personalElements.deleteConfirm'))) return
    setActionError(false)
    try {
      await remove({ variables: { id } })
      await refetch()
    } catch {
      setActionError(true)
    }
  }

  const hasError =
    actionError ||
    Boolean(courseError || elementsError || respondError || deleteError)

  if (loading || courseLoading) {
    return (
      <Layout displayName={t('pwa.personalElements.title')}>
        <Loader />
      </Layout>
    )
  }

  return (
    <Layout
      course={courseData?.basicCourseInformation ?? undefined}
      displayName={t('pwa.personalElements.title')}
    >
      <div className="flex flex-col gap-4 md:mx-auto md:w-full md:max-w-2xl md:rounded md:border md:p-8">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <H1 className={{ root: 'text-xl' }}>
            {t('pwa.personalElements.title')}
          </H1>
          <span className="text-sm text-gray-600">
            {t('pwa.personalElements.dueCount', { count: dueCount })}
          </span>
        </div>

        {hasError ? (
          <UserNotification type="error">
            {t('pwa.personalElements.error')}
          </UserNotification>
        ) : null}

        {elements.length === 0 ? (
          <UserNotification type="info">
            {t('pwa.personalElements.empty')}
          </UserNotification>
        ) : (
          <>
            {dueCards.length > 0 && current ? (
              <div data-cy="personal-element-runner">
                <p className="mb-2 font-semibold">{current.name}</p>
                <Flashcard
                  key={current.id}
                  content={current.content}
                  explanation={current.explanation}
                  response={responses[current.id]}
                  setResponse={(response) =>
                    void handleResponse(current.id, response)
                  }
                  elementIx={currentIx}
                />
                <div className="mt-3 flex justify-between gap-2">
                  <Button
                    basic
                    disabled={currentIx === 0}
                    data={{ cy: 'personal-element-previous' }}
                    onClick={() =>
                      setCurrentIx((index) => Math.max(0, index - 1))
                    }
                  >
                    <Button.Label>
                      {t('pwa.personalElements.previous')}
                    </Button.Label>
                  </Button>
                  <Button
                    basic
                    disabled={currentIx >= dueCards.length - 1}
                    data={{ cy: 'personal-element-next' }}
                    onClick={() =>
                      setCurrentIx((index) =>
                        Math.min(dueCards.length - 1, index + 1)
                      )
                    }
                  >
                    <Button.Label>
                      {t('pwa.personalElements.next')}
                    </Button.Label>
                  </Button>
                </div>
              </div>
            ) : null}
            {dueCards.length === 0 ? (
              <UserNotification type="info">
                {t('pwa.personalElements.noDue')}
              </UserNotification>
            ) : null}

            <div
              className="mt-2 flex flex-col gap-3"
              data-cy="personal-element-list"
            >
              {elements.map((element) => (
                <article key={element.id} className="rounded border p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h2 className="font-semibold">{element.name}</h2>
                      <p className="text-sm text-gray-600">
                        {element.origin === 'AI_GENERATED'
                          ? t('pwa.personalElements.aiGenerated')
                          : t('pwa.personalElements.authored')}{' '}
                        ·{' '}
                        {element.verification === 'VERIFIED'
                          ? t('pwa.personalElements.verified')
                          : t('pwa.personalElements.unverified')}
                      </p>
                    </div>
                    <Button
                      basic
                      onClick={() => void handleDelete(element.id)}
                      data={{ cy: `delete-personal-element-${element.id}` }}
                    >
                      <Button.Label>
                        {t('pwa.personalElements.delete')}
                      </Button.Label>
                    </Button>
                  </div>
                  {element.sources?.length ? (
                    <ul className="mt-2 list-inside list-disc text-sm text-gray-600">
                      {element.sources.map((source) => (
                        <li key={`${source.sourceId}-${source.chunkId}`}>
                          {source.url ? (
                            <a
                              href={source.url}
                              target="_blank"
                              rel="noreferrer"
                              className="underline"
                            >
                              {source.title ?? source.sourceId}
                            </a>
                          ) : (
                            (source.title ?? source.sourceId)
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
    revalidate: 600,
  }
}

export function getStaticPaths() {
  return { paths: [], fallback: 'blocking' }
}

export default PersonalElements
