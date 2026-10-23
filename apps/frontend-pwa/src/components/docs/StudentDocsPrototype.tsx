import {
  faArrowDown,
  faArrowLeft,
  faArrowUpRightFromSquare,
  faChartLine,
  faCheck,
  faCommentDots,
  faTrophy,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { type ReactNode, useEffect, useRef, useState } from 'react'

type FeatureKind = 'live' | 'practice' | 'chat'
type Mode = 'tutor' | 'explainer' | 'quizzer'
type DocsView = 'guide' | 'progress'

export type StudentDocsPrototypeProps = {
  gamificationEnabled: boolean
  learningAnalyticsEnabled: boolean
  previewChatbot?: boolean
  preview?: boolean
  chatbots?: Array<{
    id: string
    name: string
    href: string
    embeddedHref: string
  }>
}

const chatbotModes: Mode[] = ['tutor', 'explainer', 'quizzer']

const progressSectionIds = ['gamification', 'learning-analytics']

const analyticsDayKeys = [
  ['mon', 'h-8'],
  ['tue', 'h-14'],
  ['wed', 'h-10'],
  ['thu', 'h-20'],
  ['fri', 'h-12'],
  ['sat', 'h-6'],
  ['sun', 'h-16'],
] as const

const featureCards: Array<{ href: string; kind: FeatureKind }> = [
  { href: '#live-quizzes', kind: 'live' },
  { href: '#practice', kind: 'practice' },
  { href: '#ai-tutor', kind: 'chat' },
]

function FeatureIllustration({ kind }: { kind: FeatureKind }) {
  const t = useTranslations()

  if (kind === 'live') {
    return (
      <div className="flex h-20 w-full items-center justify-center gap-2">
        <div className="w-32 rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-2 h-1.5 w-12 rounded-full bg-slate-200" />
          <div className="space-y-1.5">
            <span className="block h-2 rounded-full bg-slate-200" />
            <span className="block h-2 rounded-full bg-primary-60" />
            <span className="block h-2 w-4/5 rounded-full bg-slate-200" />
          </div>
        </div>
        <FontAwesomeIcon
          icon={faCheck}
          aria-hidden="true"
          className="text-primary-100"
        />
      </div>
    )
  }

  if (kind === 'practice') {
    return (
      <div className="flex h-20 items-center justify-center">
        <div className="relative h-14 w-24 rounded-lg border border-primary-60 bg-white p-2.5">
          <div className="absolute -left-1.5 -top-1.5 h-14 w-24 rounded-lg border border-slate-200 bg-primary-20" />
          <div className="relative flex h-full items-center justify-center text-3xl font-semibold text-primary-100">
            ?
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-20 w-full flex-col justify-center gap-2 px-4">
      <span className="ml-7 block max-w-36 rounded-lg border border-primary-20 bg-primary-20 px-2.5 py-1.5 text-left text-[11px] text-slate-800">
        {t('pwa.studentGuide.featureIllustration.hint')}
      </span>
      <span className="block max-w-40 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-[11px] text-slate-700">
        {t('pwa.studentGuide.featureIllustration.reply')}
      </span>
    </div>
  )
}

function TutorialLink({ slug, children }: { slug: string; children: string }) {
  return (
    <a
      href={`https://www.klicker.uzh.ch/student_tutorials/${slug}/`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
    >
      {children}
      <FontAwesomeIcon icon={faArrowUpRightFromSquare} aria-hidden="true" />
    </a>
  )
}

function GuideSectionHeading({
  label,
  title,
}: {
  label: string
  title: string
}) {
  return (
    <div className="mb-5">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <h2 className="mt-2 text-xl font-bold tracking-tight text-slate-800">
        {title}
      </h2>
    </div>
  )
}

function Step({
  number,
  title,
  children,
}: {
  number: string
  title: string
  children: ReactNode
}) {
  return (
    <li className="rounded-lg border border-slate-200 bg-white p-4">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-100 text-sm font-semibold text-white">
        {number}
      </span>
      <strong className="mt-4 block font-semibold text-slate-800">
        {title}
      </strong>
      <p className="mt-2 text-sm leading-6 text-slate-500">{children}</p>
    </li>
  )
}

function ProgressItem({
  icon,
  title,
  children,
}: {
  icon: typeof faCommentDots
  title: string
  children: string
}) {
  return (
    <div className="flex gap-3 rounded-lg bg-white p-3.5">
      <FontAwesomeIcon
        icon={icon}
        aria-hidden="true"
        className="mt-1 w-4 flex-none text-slate-500"
      />
      <div>
        <strong className="text-sm font-semibold text-slate-800">
          {title}
        </strong>
        <p className="mt-0.5 text-sm leading-5 text-slate-500">{children}</p>
      </div>
    </div>
  )
}

function SectionNavigation({
  items,
  label,
}: {
  items: Array<[string, string, string]>
  label: string
}) {
  return (
    <nav
      className="sticky top-0 z-20 border-b border-slate-200 bg-white py-2"
      aria-label={label}
    >
      <div className="flex gap-1 overflow-x-auto pb-1">
        {items.map(([href, itemLabel, name]) => (
          <a
            key={href}
            href={href}
            data-cy={`docs-prototype-nav-${name}`}
            className="flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
          >
            {itemLabel}
            <FontAwesomeIcon
              icon={faArrowDown}
              aria-hidden="true"
              className="h-3 w-3 text-slate-400"
            />
          </a>
        ))}
      </div>
    </nav>
  )
}

function ViewNavigation({
  activeView,
  onChange,
  progressAvailable,
}: {
  activeView: DocsView
  onChange: (view: DocsView) => void
  progressAvailable: boolean
}) {
  const t = useTranslations()

  return (
    <nav
      className="flex flex-wrap gap-2"
      aria-label={t('pwa.studentGuide.viewsAriaLabel')}
    >
      <Button
        type="button"
        active={activeView === 'guide'}
        aria-pressed={activeView === 'guide'}
        data-cy="docs-prototype-view-guide"
        onClick={() => onChange('guide')}
        className={{ root: 'min-h-11 rounded-lg' }}
      >
        {t('pwa.studentGuide.guideViewLabel')}
      </Button>
      {progressAvailable && (
        <Button
          type="button"
          active={activeView === 'progress'}
          aria-pressed={activeView === 'progress'}
          data-cy="docs-prototype-view-progress"
          onClick={() => onChange('progress')}
          className={{ root: 'min-h-11 rounded-lg' }}
        >
          {t('pwa.studentGuide.progressViewLabel')}
        </Button>
      )}
    </nav>
  )
}

export default function StudentDocsPrototype({
  gamificationEnabled,
  learningAnalyticsEnabled,
  previewChatbot = false,
  preview = false,
  chatbots = [],
}: StudentDocsPrototypeProps) {
  const t = useTranslations()
  const router = useRouter()
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false)
  const [selectedMode, setSelectedMode] = useState<Mode>('tutor')
  const [selectedChatbotId, setSelectedChatbotId] = useState<string>()
  const [isChatbotOpen, setIsChatbotOpen] = useState(false)
  const [activeView, setActiveView] = useState<DocsView>('guide')
  const viewHeadingRef = useRef<HTMLHeadingElement>(null)
  const prototypeRef = useRef<HTMLElement>(null)
  const previousViewRef = useRef<DocsView>('guide')
  const initialViewResolvedRef = useRef(false)
  const progressDeepLinkHashRef = useRef<string | null>(null)
  const chatbotEnabled = chatbots.length > 0 || previewChatbot
  const progressAvailable = gamificationEnabled || learningAnalyticsEnabled
  const selectedChatbot =
    chatbots.find((chatbot) => chatbot.id === selectedChatbotId) ?? chatbots[0]
  const chatbotIds = chatbots.map((chatbot) => chatbot.id).join('|')
  const courseContext =
    typeof router.query.courseId === 'string' ? router.query.courseId : ''
  const modeExamples: Record<
    Mode,
    { label: string; prompt: string; response: string }
  > = {
    tutor: {
      label: t('pwa.studentGuide.chatbot.modes.tutor'),
      prompt: t('pwa.studentGuide.chatbot.examples.tutor.prompt'),
      response: t('pwa.studentGuide.chatbot.examples.tutor.response'),
    },
    explainer: {
      label: t('pwa.studentGuide.chatbot.modes.explainer'),
      prompt: t('pwa.studentGuide.chatbot.examples.explainer.prompt'),
      response: t('pwa.studentGuide.chatbot.examples.explainer.response'),
    },
    quizzer: {
      label: t('pwa.studentGuide.chatbot.modes.quizzer'),
      prompt: t('pwa.studentGuide.chatbot.examples.quizzer.prompt'),
      response: t('pwa.studentGuide.chatbot.examples.quizzer.response'),
    },
  }
  const selectedExample = modeExamples[selectedMode]
  const featureCardLabels: Record<
    FeatureKind,
    { title: string; description: string; linkLabel: string }
  > = {
    live: {
      title: t('pwa.studentGuide.features.live.title'),
      description: t('pwa.studentGuide.features.live.description'),
      linkLabel: t('pwa.studentGuide.features.live.linkLabel'),
    },
    practice: {
      title: t('pwa.studentGuide.features.practice.title'),
      description: t('pwa.studentGuide.features.practice.description'),
      linkLabel: t('pwa.studentGuide.features.practice.linkLabel'),
    },
    chat: {
      title: t('pwa.studentGuide.features.chat.title'),
      description: t('pwa.studentGuide.features.chat.description'),
      linkLabel: t('pwa.studentGuide.features.chat.linkLabel'),
    },
  }
  const progressTopics = [
    ...(gamificationEnabled
      ? [t('pwa.studentGuide.progressTopics.gamification')]
      : []),
    ...(learningAnalyticsEnabled
      ? [t('pwa.studentGuide.progressTopics.analytics')]
      : []),
    t('pwa.studentGuide.progressTopics.privacyHelp'),
  ].join(', ')
  const progressIntro = t('pwa.studentGuide.heroProgressIntro', {
    topics: progressTopics,
  })
  const selectedChatbotIframeTitle = selectedChatbot
    ? t('pwa.studentGuide.chatbot.iframeTitle', { name: selectedChatbot.name })
    : ''
  const selectedChatbotLinkLabel = selectedChatbot
    ? t('pwa.studentGuide.chatbot.openInNewTab', { name: selectedChatbot.name })
    : ''
  const chatbotIllustrationAriaLabel = t(
    'pwa.studentGuide.chatbot.illustrationAriaLabel'
  )
  const exampleResponseLabel = t(
    'pwa.studentGuide.chatbot.exampleResponseLabel',
    { mode: selectedExample.label }
  )
  const leaderboardYou = t('pwa.studentGuide.progress.leaderboardYou')
  const pointsLabel = (points: number) =>
    t('pwa.studentGuide.progress.pointsValue', { points })
  const rankedName = (rank: number, name: string) =>
    t('pwa.studentGuide.progress.leaderboardRow', { rank, name })
  const analyticsDayLabels: Record<string, string> = {
    mon: t('pwa.studentGuide.analytics.dayMon'),
    tue: t('pwa.studentGuide.analytics.dayTue'),
    wed: t('pwa.studentGuide.analytics.dayWed'),
    thu: t('pwa.studentGuide.analytics.dayThu'),
    fri: t('pwa.studentGuide.analytics.dayFri'),
    sat: t('pwa.studentGuide.analytics.daySat'),
    sun: t('pwa.studentGuide.analytics.daySun'),
  }
  const visibleFeatureCards = featureCards.filter((feature) => {
    if (feature.kind === 'chat') return chatbotEnabled
    return true
  })
  const guideNavItems: Array<[string, string, string]> = [
    ['#get-started', t('pwa.studentGuide.nav.getStarted'), 'get-started'],
    ['#live-quizzes', t('pwa.studentGuide.nav.liveQuizzes'), 'live-quizzes'],
    ['#practice', t('pwa.studentGuide.nav.practice'), 'practice'],
  ]
  if (chatbotEnabled) {
    guideNavItems.push([
      '#ai-tutor',
      t('pwa.studentGuide.nav.aiTutor'),
      'ai-tutor',
    ])
  }
  guideNavItems.push([
    '#progress-help',
    t('pwa.studentGuide.nav.privacyHelp'),
    'progress-help',
  ])
  guideNavItems.push([
    '#common-questions-title',
    t('pwa.studentGuide.nav.faqs'),
    'common-questions',
  ])
  const progressNavItems: Array<[string, string, string]> = [
    ['#progress-help', t('pwa.studentGuide.nav.privacyHelp'), 'progress-help'],
  ]
  if (learningAnalyticsEnabled) {
    progressNavItems.unshift([
      '#learning-analytics',
      t('pwa.studentGuide.nav.learningAnalytics'),
      'learning-analytics',
    ])
  }
  if (gamificationEnabled) {
    progressNavItems.unshift([
      '#gamification',
      t('pwa.studentGuide.nav.gamification'),
      'gamification',
    ])
  }

  // A changed course or chatbot list invalidates the selected and mounted bot
  // biome-ignore lint/correctness/useExhaustiveDependencies: Changed course and chatbot identities invalidate the open conversation.
  useEffect(() => {
    setSelectedChatbotId(undefined)
    setIsChatbotOpen(false)
  }, [chatbotIds, courseContext])

  // Only after mount, capture a progress deep link without reading the URL
  // during server rendering. A course capability may still be loading, so the
  // captured hash is applied below once a progress view becomes available.
  useEffect(() => {
    if (!router.isReady || initialViewResolvedRef.current) return

    initialViewResolvedRef.current = true
    const hash = window.location.hash.replace(/^#/, '')
    if (progressSectionIds.includes(hash)) {
      progressDeepLinkHashRef.current = hash
    }
  }, [router.isReady])

  // Reveal a captured progress deep link as soon as progress is available,
  // and keep the view in sync with ?view=progress
  useEffect(() => {
    if (!router.isReady || !initialViewResolvedRef.current) return

    const deepLinkHash = progressDeepLinkHashRef.current
    if (deepLinkHash !== null && progressAvailable) {
      progressDeepLinkHashRef.current = null
      setActiveView('progress')
      router.replace(
        {
          pathname: router.pathname,
          query: { ...router.query, view: 'progress' },
          hash: `#${deepLinkHash}`,
        },
        undefined,
        { shallow: true }
      )
      return
    }

    const urlView: DocsView =
      router.query.view === 'progress' && progressAvailable
        ? 'progress'
        : 'guide'
    setActiveView((view) => (view === urlView ? view : urlView))
  }, [progressAvailable, router, router.isReady])

  useEffect(() => {
    if (!progressAvailable && activeView === 'progress') {
      setActiveView('guide')
    }
  }, [activeView, progressAvailable])

  const currentView = progressAvailable ? activeView : 'guide'

  useEffect(() => {
    if (previousViewRef.current === currentView) return
    previousViewRef.current = currentView
    const scrollContainer = document.getElementById('layout-scroll-container')
    if (scrollContainer) {
      scrollContainer.scrollTo({ top: 0, behavior: 'auto' })
    } else {
      prototypeRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' })
    }
    viewHeadingRef.current?.focus({ preventScroll: true })
  }, [currentView])

  const handleViewChange = (view: DocsView) => {
    if (view === 'progress' && !progressAvailable) return
    setActiveView(view)
    const query = { ...router.query }
    if (view === 'progress') {
      query.view = 'progress'
    } else {
      delete query.view
    }
    router.push({ pathname: router.pathname, query }, undefined, {
      shallow: true,
    })
  }

  return (
    <main
      id="student-docs-prototype"
      ref={prototypeRef}
      className="mx-auto w-full max-w-5xl text-slate-700"
    >
      <section
        className="border-b border-slate-200 pb-8 pt-6 sm:pb-10 sm:pt-8"
        aria-labelledby={
          currentView === 'guide' ? 'guide-hero-title' : 'progress-hero-title'
        }
      >
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <div className="mb-3 text-sm font-semibold text-slate-500">
              {currentView === 'guide'
                ? t('pwa.studentGuide.guideViewLabel')
                : t('pwa.studentGuide.progressViewLabel')}
            </div>
            {currentView === 'guide' ? (
              <>
                <h1
                  id="guide-hero-title"
                  ref={viewHeadingRef}
                  tabIndex={-1}
                  className="max-w-[44ch] text-balance text-2xl font-bold leading-tight tracking-tight text-slate-800"
                >
                  {t('pwa.studentGuide.heroGuideTitle')}
                </h1>
                <p className="mt-3 max-w-[44ch] text-base leading-7 text-slate-600">
                  {chatbotEnabled
                    ? t('pwa.studentGuide.heroGuideIntroChatbot')
                    : t('pwa.studentGuide.heroGuideIntro')}
                </p>
                <p className="mt-3 max-w-[44ch] text-sm leading-6 text-slate-500">
                  {t('pwa.studentGuide.heroGuideAvailability')}
                </p>
              </>
            ) : (
              <>
                <h1
                  id="progress-hero-title"
                  ref={viewHeadingRef}
                  tabIndex={-1}
                  className="max-w-[44ch] text-balance text-2xl font-bold leading-tight tracking-tight text-slate-800"
                >
                  {t('pwa.studentGuide.heroProgressTitle')}
                </h1>
                <p className="mt-3 max-w-[44ch] text-base leading-7 text-slate-600">
                  {progressIntro}
                </p>
              </>
            )}
          </div>
          <ViewNavigation
            activeView={currentView}
            onChange={handleViewChange}
            progressAvailable={progressAvailable}
          />
        </div>

        {currentView === 'guide' ? (
          <div className="mt-8 flex flex-col gap-3 md:block">
            <div className="order-2 grid gap-3 md:grid-cols-3">
              {visibleFeatureCards.map((feature) => {
                const labels = featureCardLabels[feature.kind]

                return (
                  <a
                    key={feature.href}
                    href={feature.href}
                    data-cy={`docs-prototype-feature-${feature.kind}`}
                    className="group min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-primary-60 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100 focus-visible:ring-offset-2"
                  >
                    <div className="flex items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white text-slate-800">
                      <FeatureIllustration kind={feature.kind} />
                    </div>
                    <h2 className="mt-3 text-base font-bold tracking-tight text-slate-800">
                      {labels.title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {labels.description}
                    </p>
                    <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary-100 group-hover:text-primary-100">
                      {labels.linkLabel}
                      <FontAwesomeIcon icon={faArrowDown} aria-hidden="true" />
                    </span>
                  </a>
                )
              })}
            </div>
            <div className="order-1 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between md:mt-6">
              <div>
                <strong className="font-semibold text-slate-800">
                  {t('pwa.studentGuide.setup.title')}
                </strong>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {t('pwa.studentGuide.setup.description')}
                </p>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
                <a
                  href="#get-started"
                  data-cy="docs-prototype-first-visit"
                  className="inline-flex min-h-11 items-center gap-1.5 text-slate-700 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                >
                  {t('pwa.studentGuide.setup.firstVisit')}
                  <FontAwesomeIcon icon={faArrowDown} aria-hidden="true" />
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=ch.uzh.bf.klicker.pwa"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cy="docs-prototype-android-app"
                  className="inline-flex min-h-11 items-center gap-1.5 text-slate-700 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                >
                  {t('pwa.studentGuide.setup.android')}
                  <FontAwesomeIcon
                    icon={faArrowUpRightFromSquare}
                    aria-hidden="true"
                  />
                </a>
                <a
                  href="https://www.klicker.uzh.ch/student_tutorials/klickeruzh_app/#ios"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cy="docs-prototype-iphone-guide"
                  className="inline-flex min-h-11 items-center gap-1.5 text-slate-700 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                >
                  {t('pwa.studentGuide.setup.iphone')}
                  <FontAwesomeIcon
                    icon={faArrowUpRightFromSquare}
                    aria-hidden="true"
                  />
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm leading-6 text-slate-600">
              {t('pwa.studentGuide.progressSetup.description')}
            </p>
            <Button
              type="button"
              data-cy="docs-prototype-back-to-guide"
              onClick={() => handleViewChange('guide')}
              className={{ root: 'min-h-11 rounded-lg' }}
            >
              <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
              <span>{t('pwa.studentGuide.progressSetup.backToGuide')}</span>
            </Button>
          </div>
        )}
      </section>

      <SectionNavigation
        items={currentView === 'guide' ? guideNavItems : progressNavItems}
        label={
          currentView === 'guide'
            ? t('pwa.studentGuide.inGuideAriaLabel')
            : t('pwa.studentGuide.inProgressAriaLabel')
        }
      />
      <div
        className={currentView === 'guide' ? 'block' : 'hidden'}
        aria-hidden={currentView !== 'guide'}
      >
        <section
          id="get-started"
          className="scroll-mt-20 border-b border-slate-200 py-10"
        >
          <GuideSectionHeading
            label={t('pwa.studentGuide.getStarted.label')}
            title={t('pwa.studentGuide.getStarted.title')}
          />
          <div className="space-y-6">
            <div className="grid gap-4 text-base leading-7 text-slate-600 sm:grid-cols-2">
              <p>{t('pwa.studentGuide.getStarted.access')}</p>
              <p>
                {chatbotEnabled
                  ? t('pwa.studentGuide.getStarted.accountChatbot')
                  : t('pwa.studentGuide.getStarted.account')}{' '}
                {t('pwa.studentGuide.getStarted.guestNote')}
              </p>
            </div>
            <TutorialLink slug="student_accounts">
              {t('pwa.studentGuide.getStarted.tutorialLink')}
            </TutorialLink>

            <figure className="rounded-lg bg-slate-50 p-4 sm:p-5">
              <div className="mb-3 text-xs font-semibold text-slate-600">
                {t('pwa.studentGuide.getStarted.firstVisit')}
              </div>
              <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
                <Step
                  number="1"
                  title={t('pwa.studentGuide.getStarted.stepOpenTitle')}
                >
                  {t('pwa.studentGuide.getStarted.stepOpenBody')}
                </Step>
                <Step
                  number="2"
                  title={t('pwa.studentGuide.getStarted.stepSignInTitle')}
                >
                  {t('pwa.studentGuide.getStarted.stepSignInBody')}
                </Step>
                <Step
                  number="3"
                  title={t('pwa.studentGuide.getStarted.stepChooseTitle')}
                >
                  {chatbotEnabled
                    ? t('pwa.studentGuide.getStarted.stepChooseBodyChatbot')
                    : t('pwa.studentGuide.getStarted.stepChooseBody')}
                </Step>
              </ol>
              <figcaption className="mt-4 text-xs leading-5 text-slate-500">
                {t('pwa.studentGuide.getStarted.firstVisitCaption')}
              </figcaption>
            </figure>
          </div>
        </section>

        <section
          id="live-quizzes"
          className="scroll-mt-20 border-b border-slate-200 py-10"
        >
          <GuideSectionHeading
            label={t('pwa.studentGuide.live.label')}
            title={t('pwa.studentGuide.live.title')}
          />
          <div className="grid gap-6 lg:grid-cols-[1fr_0.94fr] lg:items-start lg:gap-10">
            <ul className="m-0 list-none space-y-4 p-0 text-base leading-7 text-slate-600">
              <li>
                <strong className="text-slate-800">
                  {t('pwa.studentGuide.live.quizTitle')}
                </strong>{' '}
                {t('pwa.studentGuide.live.quizBody')}
              </li>
              <li>
                <strong className="text-slate-800">
                  {t('pwa.studentGuide.live.feedbackTitle')}
                </strong>{' '}
                {t('pwa.studentGuide.live.feedbackBody')}
              </li>
              <li>
                <strong className="text-slate-800">
                  {t('pwa.studentGuide.live.rulesTitle')}
                </strong>{' '}
                {t('pwa.studentGuide.live.rulesBody')}
              </li>
              <li>
                <TutorialLink slug="live_quiz">
                  {t('pwa.studentGuide.live.tutorialLink')}
                </TutorialLink>
              </li>
            </ul>

            <figure className="rounded-lg bg-slate-50 p-4 sm:p-5">
              <div className="mb-3 text-xs font-semibold text-slate-600">
                {t('pwa.studentGuide.live.illustrationLabel')}
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3.5 py-2.5 text-xs text-slate-500">
                  <strong className="text-slate-800">
                    {t('pwa.studentGuide.live.mock.header')}
                  </strong>
                  <span>{t('pwa.studentGuide.live.mock.status')}</span>
                </div>
                <div className="p-4">
                  <h3 className="text-base font-bold text-slate-800">
                    {t('pwa.studentGuide.live.mock.question')}
                  </h3>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="rounded-md border border-slate-200 px-3 py-2.5 text-slate-600">
                      {t('pwa.studentGuide.live.mock.optionSpent')}
                    </div>
                    <div className="rounded-md border border-primary-100 bg-slate-50 px-3 py-2.5 text-slate-800">
                      <span aria-hidden="true">◉ </span>
                      {t('pwa.studentGuide.live.mock.optionBest')}
                    </div>
                    <div className="rounded-md border border-slate-200 px-3 py-2.5 text-slate-600">
                      {t('pwa.studentGuide.live.mock.optionAll')}
                    </div>
                  </div>
                  <div className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-500">
                    <strong className="text-slate-700">
                      {t('pwa.studentGuide.live.mock.unclear')}
                    </strong>{' '}
                    {t('pwa.studentGuide.live.mock.askQa')}
                  </div>
                </div>
              </div>
              <figcaption className="mt-3 text-xs leading-5 text-slate-500">
                {t('pwa.studentGuide.live.illustrationCaption')}
              </figcaption>
            </figure>
          </div>
        </section>

        <section
          id="practice"
          className="scroll-mt-20 border-b border-slate-200 py-10"
        >
          <GuideSectionHeading
            label={t('pwa.studentGuide.practice.label')}
            title={t('pwa.studentGuide.practice.title')}
          />
          <div className="grid gap-6 lg:grid-cols-[1fr_0.94fr] lg:items-start lg:gap-10">
            <ul className="m-0 list-none space-y-4 p-0 text-base leading-7 text-slate-600">
              <li>
                <strong className="text-slate-800">
                  {t('pwa.studentGuide.practice.quizTitle')}
                </strong>{' '}
                {t('pwa.studentGuide.practice.quizBody')}
              </li>
              <li>
                <strong className="text-slate-800">
                  {t('pwa.studentGuide.practice.flashcardsTitle')}
                </strong>{' '}
                {t('pwa.studentGuide.practice.flashcardsBody')}
              </li>
              <li>
                <strong className="text-slate-800">
                  {t('pwa.studentGuide.practice.coursePoolTitle')}
                </strong>{' '}
                {t('pwa.studentGuide.practice.coursePoolBody')}
              </li>
              <li>
                <strong className="text-slate-800">
                  {t('pwa.studentGuide.practice.bookmarksTitle')}
                </strong>{' '}
                {t('pwa.studentGuide.practice.bookmarksBody')}
              </li>
              <li>
                <strong className="text-slate-800">
                  {t('pwa.studentGuide.practice.microlearningTitle')}
                </strong>{' '}
                {t('pwa.studentGuide.practice.microlearningBody')}
              </li>
              <li>
                <strong className="text-slate-800">
                  {t('pwa.studentGuide.practice.groupTitle')}
                </strong>{' '}
                {t('pwa.studentGuide.practice.groupBody')}
              </li>
              <li>
                <strong className="text-slate-800">
                  {t('pwa.studentGuide.practice.flagTitle')}
                </strong>{' '}
                {t('pwa.studentGuide.practice.flagBody')}
              </li>
              <li className="flex flex-wrap gap-x-5 gap-y-2">
                <TutorialLink slug="practice_quiz">
                  {t('pwa.studentGuide.practice.tutorialPractice')}
                </TutorialLink>
                <TutorialLink slug="microlearning">
                  {t('pwa.studentGuide.practice.tutorialMicrolearning')}
                </TutorialLink>
                <TutorialLink slug="groups_activities">
                  {t('pwa.studentGuide.practice.tutorialGroups')}
                </TutorialLink>
              </li>
            </ul>

            <figure className="rounded-lg bg-slate-50 p-4 sm:p-5">
              <div className="mb-3 text-xs font-semibold text-slate-600">
                {t('pwa.studentGuide.practice.illustrationLabel')}
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3.5 py-2.5 text-xs text-slate-500">
                  <strong className="text-slate-800">
                    {t('pwa.studentGuide.practice.flashcardLabel')}
                  </strong>
                  <span className="rounded bg-slate-100 px-2 py-1">
                    {t('pwa.studentGuide.practice.flashcardTag')}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex min-h-32 flex-col justify-center gap-2">
                    <span className="text-sm text-slate-500">
                      {t('pwa.studentGuide.practice.flashcardHint')}
                    </span>
                    <h3 className="text-base font-bold text-slate-800">
                      {t('pwa.studentGuide.practice.flashcardQuestion')}
                    </h3>
                    <div
                      id="flashcard-answer"
                      aria-live="polite"
                      hidden={!isAnswerRevealed}
                      className="border-t border-slate-200 pt-3 text-sm leading-6 text-slate-600"
                    >
                      <p>{t('pwa.studentGuide.practice.flashcardAnswer')}</p>
                      <p className="mt-2 text-slate-500">
                        {t('pwa.studentGuide.practice.flashcardExample')}
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    data-cy="docs-prototype-flashcard-reveal"
                    aria-controls="flashcard-answer"
                    aria-expanded={isAnswerRevealed}
                    onClick={() => setIsAnswerRevealed((revealed) => !revealed)}
                    primary
                    className={{ root: 'mt-4 min-h-11' }}
                  >
                    {isAnswerRevealed
                      ? t('pwa.studentGuide.practice.hideAnswer')
                      : t('pwa.studentGuide.practice.revealAnswer')}
                  </Button>
                </div>
              </div>
              <figcaption className="mt-3 text-xs leading-5 text-slate-500">
                {t('pwa.studentGuide.practice.illustrationCaption')}
              </figcaption>
            </figure>
          </div>
        </section>

        {chatbotEnabled && (
          <section
            id="ai-tutor"
            className="scroll-mt-20 border-b border-slate-200 py-10"
          >
            <GuideSectionHeading
              label={t('pwa.studentGuide.chatbot.label')}
              title={t('pwa.studentGuide.chatbot.title')}
            />
            <div className="grid gap-6 lg:grid-cols-[1fr_0.94fr] lg:items-start lg:gap-10">
              <div className="space-y-4 text-base leading-7 text-slate-600">
                <p>{t('pwa.studentGuide.chatbot.intro')}</p>
                <ul className="m-0 list-none space-y-3 p-0">
                  <li>
                    <strong className="text-slate-800">
                      {t('pwa.studentGuide.chatbot.tutorTitle')}
                    </strong>{' '}
                    {t('pwa.studentGuide.chatbot.tutorBody')}
                  </li>
                  <li>
                    <strong className="text-slate-800">
                      {t('pwa.studentGuide.chatbot.explainerTitle')}
                    </strong>{' '}
                    {t('pwa.studentGuide.chatbot.explainerBody')}
                  </li>
                  <li>
                    <strong className="text-slate-800">
                      {t('pwa.studentGuide.chatbot.quizzerTitle')}
                    </strong>{' '}
                    {t('pwa.studentGuide.chatbot.quizzerBody')}
                  </li>
                </ul>
                <p>{t('pwa.studentGuide.chatbot.guidance')}</p>
                <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800">
                  {t('pwa.studentGuide.chatbot.conditions')}
                </p>
                <TutorialLink slug="chatbot">
                  {t('pwa.studentGuide.chatbot.tutorialLink')}
                </TutorialLink>
              </div>

              <figure className="rounded-lg bg-slate-50 p-4 sm:p-5">
                {chatbots.length > 0 ? (
                  <>
                    {chatbots.length > 1 && (
                      <div className="mb-3">
                        <label
                          htmlFor="docs-prototype-chatbot-select"
                          className="text-xs font-semibold text-slate-600"
                        >
                          {t('pwa.studentGuide.chatbot.selectLabel')}
                        </label>
                        <select
                          id="docs-prototype-chatbot-select"
                          data-cy="docs-prototype-chatbot-select"
                          value={selectedChatbot?.id ?? ''}
                          onChange={(event) => {
                            setSelectedChatbotId(event.target.value)
                            setIsChatbotOpen(false)
                          }}
                          className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                        >
                          {chatbots.map((courseChatbot) => (
                            <option
                              key={courseChatbot.id}
                              value={courseChatbot.id}
                            >
                              {courseChatbot.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    {chatbots.length === 1 && (
                      <div className="mb-3 text-xs font-semibold text-slate-600">
                        {selectedChatbot?.name}
                      </div>
                    )}
                    {selectedChatbot && (
                      <>
                        {!isChatbotOpen ? (
                          <div className="rounded-lg border border-slate-200 bg-white p-4">
                            <p className="text-sm leading-6 text-slate-600">
                              {t('pwa.studentGuide.chatbot.tryPrompt')}
                            </p>
                            <Button
                              type="button"
                              data-cy="docs-prototype-chatbot-try"
                              onClick={() => setIsChatbotOpen(true)}
                              primary
                              className={{ root: 'mt-4 min-h-11' }}
                            >
                              {t('pwa.studentGuide.chatbot.tryButton')}
                            </Button>
                          </div>
                        ) : (
                          <iframe
                            src={selectedChatbot.embeddedHref}
                            title={selectedChatbotIframeTitle}
                            className="h-[32rem] w-full rounded-lg border border-slate-200 bg-white"
                          />
                        )}
                        <a
                          href={selectedChatbot.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                        >
                          {selectedChatbotLinkLabel}
                          <FontAwesomeIcon
                            icon={faArrowUpRightFromSquare}
                            aria-hidden="true"
                          />
                        </a>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="mb-3 text-xs font-semibold text-slate-600">
                      {t('pwa.studentGuide.chatbot.illustrationLabel')}
                    </div>
                    <fieldset
                      className="mb-4 flex flex-wrap gap-2"
                      aria-label={chatbotIllustrationAriaLabel}
                    >
                      {chatbotModes.map((mode) => (
                        <Button
                          key={mode}
                          type="button"
                          data-cy={`docs-prototype-mode-${mode}`}
                          aria-pressed={selectedMode === mode}
                          onClick={() => setSelectedMode(mode)}
                          active={selectedMode === mode}
                          className={{ root: 'min-h-11' }}
                        >
                          {modeExamples[mode].label}
                        </Button>
                      ))}
                    </fieldset>
                    <div aria-live="polite">
                      <div className="ml-6 rounded-lg bg-primary-20 p-3 text-sm leading-6 text-slate-800">
                        <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
                          {t('pwa.studentGuide.chatbot.examplePromptLabel')}
                        </div>
                        {selectedExample.prompt}
                      </div>
                      <div className="mt-3 rounded-lg bg-white p-3 text-sm leading-6 text-slate-700 shadow-sm">
                        <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
                          {exampleResponseLabel}
                        </div>
                        {selectedExample.response}
                      </div>
                    </div>
                    <figcaption className="mt-3 text-xs leading-5 text-slate-500">
                      {t('pwa.studentGuide.chatbot.illustrationCaption')}
                    </figcaption>
                  </>
                )}
              </figure>
            </div>
          </section>
        )}
      </div>

      <div
        className={currentView === 'progress' ? 'block' : 'hidden'}
        aria-hidden={currentView !== 'progress'}
      >
        {gamificationEnabled && (
          <section
            id="gamification"
            className="scroll-mt-20 border-b border-slate-200 py-10"
          >
            <GuideSectionHeading
              label={t('pwa.studentGuide.progress.label')}
              title={t('pwa.studentGuide.progress.title')}
            />
            <div className="grid gap-6 lg:grid-cols-[1fr_0.94fr] lg:items-start lg:gap-10">
              <div className="space-y-4 text-base leading-7 text-slate-600">
                <p>{t('pwa.studentGuide.progress.body')}</p>
                <p>{t('pwa.studentGuide.progress.xp')}</p>
                <p>{t('pwa.studentGuide.progress.achievements')}</p>
                <TutorialLink slug="course_leaderboard">
                  {t('pwa.studentGuide.progress.tutorialLink')}
                </TutorialLink>
              </div>

              <figure className="rounded-lg bg-slate-50 p-4 sm:p-5">
                <div className="mb-3 text-xs font-semibold text-slate-600">
                  {t('pwa.studentGuide.progress.illustrationLabel')}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">
                      {t('pwa.studentGuide.progress.thisCourse')}
                    </div>
                    <div className="mt-1 text-2xl font-bold text-slate-800">
                      {pointsLabel(420)}
                    </div>

                    <div className="mt-2 text-xs text-slate-500">
                      {t('pwa.studentGuide.progress.coursePointsSynthetic')}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-800 p-3 text-white shadow-sm">
                    <div className="text-xs font-semibold text-slate-300">
                      {t('pwa.studentGuide.progress.acrossAccount')}
                    </div>
                    <div className="mt-1 text-2xl font-bold">
                      {t('pwa.studentGuide.progress.levelValue', { level: 4 })}
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-slate-600">
                      <div className="h-2 w-2/5 rounded-full bg-primary-60" />
                    </div>
                    <div className="mt-2 text-xs text-slate-300">
                      {t('pwa.studentGuide.progress.globalXpSynthetic')}
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-white text-primary-100 shadow-sm">
                      <FontAwesomeIcon icon={faTrophy} aria-hidden="true" />
                    </span>
                    <div>
                      <div className="text-sm font-bold text-slate-800">
                        {t('pwa.studentGuide.progress.practiceMilestone')}
                      </div>
                      <div className="text-xs text-slate-600">
                        {t('pwa.studentGuide.progress.practiceMilestoneBody')}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <strong className="text-slate-800">
                      {t('pwa.studentGuide.progress.leaderboardTitle')}
                    </strong>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                      {t('pwa.studentGuide.progress.exampleTag')}
                    </span>
                  </div>
                  <ol className="mt-3 space-y-2 text-xs text-slate-600">
                    <li className="flex justify-between gap-3">
                      <span>{rankedName(1, 'Alex')}</span>
                      <span>{pointsLabel(510)}</span>
                    </li>
                    <li className="flex justify-between gap-3 rounded-md bg-primary-20 px-2 py-1.5 text-slate-800">
                      <span>{rankedName(2, leaderboardYou)}</span>
                      <span>{pointsLabel(420)}</span>
                    </li>
                    <li className="flex justify-between gap-3">
                      <span>{rankedName(3, 'Sam')}</span>
                      <span>{pointsLabel(390)}</span>
                    </li>
                  </ol>
                </div>
                <figcaption className="mt-3 text-xs leading-5 text-slate-500">
                  {t('pwa.studentGuide.progress.illustrationCaption')}
                </figcaption>
              </figure>
            </div>
          </section>
        )}

        {learningAnalyticsEnabled && (
          <section
            id="learning-analytics"
            className="scroll-mt-20 border-b border-slate-200 py-10"
          >
            {preview && (
              <div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                {t('pwa.studentGuide.analytics.plannedBadge')}
              </div>
            )}
            <GuideSectionHeading
              label={t('pwa.studentGuide.analytics.label')}
              title={t('pwa.studentGuide.analytics.title')}
            />
            <div className="grid gap-6 lg:grid-cols-[1fr_0.94fr] lg:items-start lg:gap-10">
              <div className="space-y-4 text-base leading-7 text-slate-600">
                <p>{t('pwa.studentGuide.analytics.intro')}</p>
                <p>{t('pwa.studentGuide.analytics.accountChoice')}</p>
                <p>{t('pwa.studentGuide.analytics.optOutNote')}</p>
              </div>

              <div className="space-y-4">
                <figure className="rounded-lg bg-slate-50 p-4 sm:p-5">
                  <div className="mb-3 text-xs font-semibold text-slate-600">
                    {t('pwa.studentGuide.analytics.chartLabel')}
                  </div>
                  <div className="flex h-32 items-end justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 pb-4 pt-5">
                    {analyticsDayKeys.map(([day, height]) => (
                      <div
                        key={day}
                        className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                      >
                        <span
                          className={`w-full max-w-7 rounded-t bg-primary-60 ${height}`}
                        />
                        <span className="text-[10px] text-slate-500">
                          {analyticsDayLabels[day]}
                        </span>
                      </div>
                    ))}
                  </div>
                  <figcaption className="mt-3 text-xs leading-5 text-slate-500">
                    {t('pwa.studentGuide.analytics.chartCaption')}
                  </figcaption>
                </figure>

                {preview && (
                  <fieldset
                    disabled
                    className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
                  >
                    <legend className="px-1 text-sm font-bold text-slate-800">
                      {t('pwa.studentGuide.analytics.plannedLegend')}
                    </legend>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {t('pwa.studentGuide.analytics.plannedBody')}
                    </p>
                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        disabled
                        className={{ root: 'min-h-11' }}
                      >
                        {t('pwa.studentGuide.analytics.optIn')}
                      </Button>
                      <Button
                        type="button"
                        disabled
                        className={{ root: 'min-h-11' }}
                      >
                        {t('pwa.studentGuide.analytics.optOut')}
                      </Button>
                    </div>
                  </fieldset>
                )}
              </div>
            </div>
          </section>
        )}
      </div>

      <section
        id="progress-help"
        className="scroll-mt-20 border-b border-slate-200 py-10"
      >
        <GuideSectionHeading
          label={t('pwa.studentGuide.privacyHelp.label')}
          title={t('pwa.studentGuide.privacyHelp.title')}
        />
        <div className="grid gap-6 lg:grid-cols-[1fr_0.94fr] lg:items-start lg:gap-10">
          <div className="space-y-4 text-base leading-7 text-slate-600">
            <p>{t('pwa.studentGuide.privacyHelp.profileNote')}</p>
            <p>{t('pwa.studentGuide.privacyHelp.contactNote')}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
              <Link
                href="/editProfile"
                data-cy="docs-prototype-edit-profile"
                className="inline-flex min-h-11 items-center gap-2 text-slate-700 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
              >
                {t('pwa.studentGuide.privacyHelp.editProfileLink')}
              </Link>
              <Link
                href="/account/data-use"
                data-cy="docs-prototype-data-use-settings"
                className="inline-flex min-h-11 items-center gap-2 text-slate-700 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
              >
                {t('pwa.studentGuide.privacyHelp.dataUseLink')}
              </Link>
              <a
                href={t('auth.privacyUrl')}
                target="_blank"
                rel="noopener noreferrer"
                data-cy="docs-prototype-privacy-policy"
                className="inline-flex min-h-11 items-center gap-2 text-slate-700 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
              >
                {t('pwa.studentGuide.privacyHelp.privacyPolicyLink')}
                <FontAwesomeIcon
                  icon={faArrowUpRightFromSquare}
                  aria-hidden="true"
                />
              </a>
            </div>
          </div>

          <figure className="rounded-lg bg-slate-50 p-4 sm:p-5">
            <div className="mb-3 text-xs font-semibold text-slate-600">
              {t('pwa.studentGuide.privacyHelp.illustrationLabel')}
            </div>
            <div className="grid gap-2">
              <ProgressItem
                icon={faCommentDots}
                title={t('pwa.studentGuide.privacyHelp.feedbackTitle')}
              >
                {t('pwa.studentGuide.privacyHelp.feedbackBody')}
              </ProgressItem>
              <ProgressItem
                icon={faChartLine}
                title={t('pwa.studentGuide.privacyHelp.supportTitle')}
              >
                {t('pwa.studentGuide.privacyHelp.supportBody')}
              </ProgressItem>
            </div>
            <figcaption className="mt-3 text-xs leading-5 text-slate-500">
              {t('pwa.studentGuide.privacyHelp.illustrationCaption')}
            </figcaption>
          </figure>
        </div>
      </section>

      <section
        className="scroll-mt-20 py-8 sm:py-10"
        aria-labelledby="common-questions-title"
        hidden={currentView !== 'guide'}
      >
        <h2
          id="common-questions-title"
          className="text-xl font-bold text-slate-800 sm:text-2xl"
        >
          {t('pwa.studentGuide.faq.title')}
        </h2>
        <div className="mt-4">
          <details className="border-t border-slate-200">
            <summary
              data-cy="docs-prototype-help-sign-in"
              className="cursor-pointer py-4 pr-8 text-base font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
            >
              {t('pwa.studentGuide.faq.signIn.question')}
            </summary>
            <p className="pb-4 text-sm leading-6 text-slate-600">
              {t('pwa.studentGuide.faq.signIn.answer')}
            </p>
          </details>
          <details className="border-t border-slate-200">
            <summary
              data-cy="docs-prototype-help-missing-activity"
              className="cursor-pointer py-4 pr-8 text-base font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
            >
              {t('pwa.studentGuide.faq.missingActivity.question')}
            </summary>
            <p className="pb-4 text-sm leading-6 text-slate-600">
              {t('pwa.studentGuide.faq.missingActivity.answer')}
            </p>
          </details>
          {chatbotEnabled && (
            <details className="border-t border-slate-200">
              <summary
                data-cy="docs-prototype-help-chatbot"
                className="cursor-pointer py-4 pr-8 text-base font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
              >
                {t('pwa.studentGuide.faq.chatbot.question')}
              </summary>
              <p className="pb-4 text-sm leading-6 text-slate-600">
                {t('pwa.studentGuide.faq.chatbot.answer')}
              </p>
            </details>
          )}
          <details className="border-t border-slate-200">
            <summary
              data-cy="docs-prototype-help-install"
              className="cursor-pointer py-4 pr-8 text-base font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
            >
              {t('pwa.studentGuide.faq.install.question')}
            </summary>
            <p className="pb-4 text-sm leading-6 text-slate-600">
              {t('pwa.studentGuide.faq.install.answer')}
            </p>
            <div className="pb-4">
              <TutorialLink slug="klickeruzh_app">
                {t('pwa.studentGuide.faq.install.linkLabel')}
              </TutorialLink>
            </div>
          </details>
          {gamificationEnabled && (
            <details className="border-t border-slate-200">
              <summary
                data-cy="docs-prototype-help-points"
                className="cursor-pointer py-4 pr-8 text-base font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
              >
                {t('pwa.studentGuide.faq.points.question')}
              </summary>
              <p className="pb-4 text-sm leading-6 text-slate-600">
                {t('pwa.studentGuide.faq.points.answer')}
              </p>
            </details>
          )}
          {gamificationEnabled && (
            <details className="border-y border-slate-200">
              <summary
                data-cy="docs-prototype-help-leaderboard"
                className="cursor-pointer py-4 pr-8 text-base font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
              >
                {t('pwa.studentGuide.faq.leaderboard.question')}
              </summary>
              <p className="pb-4 text-sm leading-6 text-slate-600">
                {t('pwa.studentGuide.faq.leaderboard.answer')}
              </p>
            </details>
          )}
        </div>
        {progressAvailable && (
          <button
            type="button"
            data-cy="docs-prototype-progress-teaser"
            onClick={() => handleViewChange('progress')}
            className="mt-3 flex w-full items-center gap-3 rounded-lg border border-primary-20 bg-primary-20/40 p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
          >
            <span className="grid h-10 w-10 flex-none place-items-center rounded-lg bg-white text-primary-100">
              <FontAwesomeIcon icon={faChartLine} aria-hidden="true" />
            </span>
            <span>
              <strong className="block font-semibold text-slate-800">
                {t('pwa.studentGuide.faq.progressTeaserTitle')}
              </strong>
              <span className="text-sm leading-6 text-slate-700">
                {progressIntro}
              </span>
            </span>
          </button>
        )}
        {preview && (
          <p className="pt-6 text-xs leading-5 text-slate-500">
            {t('pwa.studentGuide.previewFooter')}
          </p>
        )}
      </section>
    </main>
  )
}
