import { useMutation, useQuery } from '@apollo/client'
import {
  ElementOrderType,
  FlashcardCorrectness,
  FlashcardCorrectnessType,
  GetBasicCourseInformationDocument,
  MDeletePersonalElementDocument,
  MRespondToPersonalElementDocument,
  QPersonalElementsDocument,
  type QPersonalElementsQuery,
} from '@klicker-uzh/graphql/dist/ops'
import Flashcard from '@klicker-uzh/shared-components/src/Flashcard'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  type ElementSourceLocator,
  type ElementSourceReference,
  getElementSourceLocatorTarget,
} from '@klicker-uzh/types'
import { Button, H1, UserNotification } from '@uzh-bf/design-system'
import type { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import StepProgressWithScoring from '../../../components/common/StepProgressWithScoring'
import Layout from '../../../components/Layout'
import PracticeQuizOverview from '../../../components/practiceQuiz/PracticeQuizOverview'

type PersonalCard = NonNullable<
  QPersonalElementsQuery['personalElements']
>[number]

const RESPONSE_STATUS: Record<
  FlashcardCorrectness,
  'correct' | 'partial' | 'incorrect'
> = {
  [FlashcardCorrectness.Correct]: 'correct',
  [FlashcardCorrectness.Partial]: 'partial',
  [FlashcardCorrectness.Incorrect]: 'incorrect',
}

function PersonalCardSources({ card }: { card: PersonalCard }) {
  const t = useTranslations()

  if (!card.sources?.length) return null

  return (
    <div
      className="mt-3 rounded border bg-slate-50 p-3 text-sm"
      data-cy="personal-element-sources"
    >
      <p className="mb-1 font-semibold">
        {t('pwa.personalElements.generationSources')}
      </p>
      <ul className="space-y-2">
        {card.sources.map((rawSource) => {
          const source = rawSource as ElementSourceReference
          const actions = source.locators.flatMap((locator) => {
            const url = getElementSourceLocatorTarget(source, locator)
            return url ? [{ locator, url }] : []
          })
          return (
            <li key={source.sourceId} className="rounded border bg-white p-2">
              <span className="block font-medium">{source.title}</span>
              {source.locators.length > 0 ? (
                <span className="text-xs text-gray-600">
                  {source.locators
                    .map((locator) => sourceLocatorLabel(locator, t))
                    .join(', ')}
                </span>
              ) : null}
              {actions.length > 0 ? (
                <span className="mt-1 flex flex-wrap gap-1">
                  {actions.map(({ locator, url }) => (
                    <a
                      key={url}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded border px-1.5 py-0.5 text-xs underline"
                      data-cy="personal-element-source-action"
                    >
                      {sourceLocatorLabel(locator, t)}
                    </a>
                  ))}
                </span>
              ) : (
                <span className="mt-1 block text-xs text-gray-500">
                  {t('chat.sources.unavailable')}
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

type Translate = ReturnType<typeof useTranslations<never>>

function pageRangeLabel(
  from: string | number,
  to: string | number,
  t: Translate,
  pdf = false
) {
  return String(from) === String(to)
    ? t(pdf ? 'chat.sources.pdfPage' : 'chat.sources.page', { page: from })
    : t(pdf ? 'chat.sources.pdfPages' : 'chat.sources.pages', { from, to })
}

function sourceLocatorLabel(locator: ElementSourceLocator, t: Translate) {
  if (locator.type === 'WEB_ANCHOR') return locator.label ?? locator.url

  const labelFrom = locator.labelFrom
  const labelTo = locator.labelTo ?? labelFrom
  if (!labelFrom || !labelTo) {
    return pageRangeLabel(locator.pageFrom, locator.pageTo, t)
  }
  const labelled = pageRangeLabel(labelFrom, labelTo, t)
  return String(labelFrom) === String(locator.pageFrom) &&
    String(labelTo) === String(locator.pageTo)
    ? labelled
    : `${labelled} (${pageRangeLabel(locator.pageFrom, locator.pageTo, t, true)})`
}

function PersonalElements() {
  const t = useTranslations()
  const router = useRouter()
  const courseId = router.query.courseId as string
  const [currentIx, setCurrentIx] = useState(-1)
  const [sessionCards, setSessionCards] = useState<PersonalCard[]>([])
  const [responses, setResponses] = useState<
    Record<string, FlashcardCorrectness>
  >({})
  const [selectedResponses, setSelectedResponses] = useState<
    Record<string, FlashcardCorrectness>
  >({})
  const [actionError, setActionError] = useState(false)
  const [revealedCards, setRevealedCards] = useState<string[]>([])

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
  const [respond, { error: respondError, loading: responding }] = useMutation(
    MRespondToPersonalElementDocument
  )
  const [remove, { error: deleteError, loading: removing }] = useMutation(
    MDeletePersonalElementDocument
  )

  const elements = useMemo(
    () => data?.personalElements ?? [],
    [data?.personalElements]
  )
  const dueCards = useMemo(
    () =>
      elements.filter(
        (element) =>
          !element.nextDueAt || new Date(element.nextDueAt) <= new Date()
      ),
    [elements]
  )
  const current = currentIx >= 0 ? sessionCards[currentIx] : undefined

  const startPractice = () => {
    setSessionCards(dueCards)
    setResponses({})
    setSelectedResponses({})
    setActionError(false)
    setRevealedCards([])
    setCurrentIx(dueCards.length > 0 ? 0 : -1)
  }

  const selectResponse = (
    elementId: string,
    response: FlashcardCorrectness
  ) => {
    setActionError(false)
    setSelectedResponses((previous) => ({ ...previous, [elementId]: response }))
  }

  const handleSubmit = async () => {
    if (!current) return
    const response = selectedResponses[current.id]
    if (!response || responses[current.id]) return

    setActionError(false)
    try {
      await respond({
        variables: {
          id: current.id,
          expectedVersion: current.version,
          response:
            response === FlashcardCorrectness.Correct
              ? FlashcardCorrectnessType.Correct
              : response === FlashcardCorrectness.Partial
                ? FlashcardCorrectnessType.Partial
                : FlashcardCorrectnessType.Incorrect,
        },
      })
      setResponses((previous) => ({ ...previous, [current.id]: response }))
      await refetch()
    } catch {
      setActionError(true)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('pwa.personalElements.deleteConfirm'))) return
    setActionError(false)

    try {
      await remove({ variables: { id } })

      const removedIndex = sessionCards.findIndex((card) => card.id === id)
      const nextSessionCards = sessionCards.filter((card) => card.id !== id)
      setSessionCards(nextSessionCards)
      setResponses((previous) => {
        const next = { ...previous }
        delete next[id]
        return next
      })
      setSelectedResponses((previous) => {
        const next = { ...previous }
        delete next[id]
        return next
      })

      if (currentIx >= 0 && removedIndex >= 0) {
        if (nextSessionCards.length === 0) {
          setCurrentIx(-1)
        } else if (removedIndex < currentIx) {
          setCurrentIx((index) => index - 1)
        } else if (removedIndex === currentIx) {
          setCurrentIx((index) => Math.min(index, nextSessionCards.length - 1))
        }
      }

      await refetch()
    } catch {
      setActionError(true)
    }
  }

  const handleNext = () => {
    if (currentIx < sessionCards.length - 1) {
      window.scrollTo(0, 0)
      setCurrentIx((index) => index + 1)
      return
    }

    window.scrollTo(0, 0)
    setCurrentIx(-1)
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
      <div className="flex flex-1 flex-col gap-4 md:mx-auto md:mb-4 md:w-full md:max-w-6xl md:rounded md:border md:p-8 md:pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <H1 className={{ root: 'text-xl' }}>
            {t('pwa.personalElements.title')}
          </H1>
          <span className="text-sm text-gray-600">
            {t('pwa.personalElements.dueCount', { count: dueCards.length })}
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
            {dueCards.length === 0 && currentIx === -1 ? (
              <UserNotification type="info">
                {t('pwa.personalElements.noDue')}
              </UserNotification>
            ) : null}

            {dueCards.length > 0 || currentIx !== -1 ? (
              <>
                <StepProgressWithScoring
                  items={sessionCards.map((card) => {
                    const response = responses[card.id]
                    return {
                      status: response
                        ? RESPONSE_STATUS[response]
                        : ('unanswered' as const),
                    }
                  })}
                  currentIx={currentIx}
                  setCurrentIx={setCurrentIx}
                />

                {currentIx === -1 ? (
                  <PracticeQuizOverview
                    displayName={t('pwa.personalElements.title')}
                    description={t('pwa.personalElements.practiceDescription')}
                    numOfStacks={dueCards.length}
                    orderType={ElementOrderType.Sequential}
                    setCurrentIx={startPractice}
                    previewOnly={false}
                  />
                ) : current ? (
                  <div data-cy="personal-element-runner">
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <h2 className="font-semibold">{current.name}</h2>
                        <p className="text-sm text-gray-600">
                          {current.origin === 'AI_GENERATED'
                            ? t('pwa.personalElements.aiGenerated')
                            : t('pwa.personalElements.authored')}{' '}
                          {current.sources?.length
                            ? ` · ${t('pwa.personalElements.sourceLinked')}`
                            : ''}{' '}
                          · {t('pwa.personalElements.notReviewed')}
                        </p>
                      </div>
                      <Button
                        basic
                        disabled={removing}
                        onClick={() => void handleDelete(current.id)}
                        data={{ cy: `delete-personal-element-${current.id}` }}
                      >
                        <Button.Label>
                          {t('pwa.personalElements.delete')}
                        </Button.Label>
                      </Button>
                    </div>
                    <Flashcard
                      key={current.id}
                      content={current.content}
                      explanation={current.explanation}
                      response={
                        selectedResponses[current.id] ?? responses[current.id]
                      }
                      existingResponse={responses[current.id]}
                      setResponse={(response) =>
                        selectResponse(current.id, response)
                      }
                      elementIx={currentIx}
                      onReveal={() =>
                        setRevealedCards((previous) =>
                          previous.includes(current.id)
                            ? previous
                            : [...previous, current.id]
                        )
                      }
                    />
                    {revealedCards.includes(current.id) ? (
                      <PersonalCardSources card={current} />
                    ) : null}
                    <div className="mt-3 flex flex-wrap justify-between gap-2">
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
                      <div className="flex gap-2">
                        <Button
                          primary
                          loading={responding}
                          disabled={
                            !selectedResponses[current.id] ||
                            Boolean(responses[current.id])
                          }
                          data={{ cy: 'personal-element-submit' }}
                          onClick={() => void handleSubmit()}
                        >
                          <Button.Label>
                            {t('shared.generic.submit')}
                          </Button.Label>
                        </Button>
                        <Button
                          primary
                          disabled={!responses[current.id]}
                          data={{ cy: 'personal-element-next' }}
                          onClick={handleNext}
                        >
                          <Button.Label>
                            {currentIx === sessionCards.length - 1
                              ? t('shared.generic.finish')
                              : t('shared.generic.continue')}
                          </Button.Label>
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {currentIx === -1 ? (
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
                          {element.sources?.length
                            ? ` · ${t('pwa.personalElements.sourceLinked')}`
                            : ''}{' '}
                          · {t('pwa.personalElements.notReviewed')}
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
                    <PersonalCardSources card={element} />
                  </article>
                ))}
              </div>
            ) : null}
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
