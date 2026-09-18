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
import { type ReactNode, useEffect, useRef, useState } from 'react'

type FeatureKind = 'live' | 'practice' | 'chat'
type Mode = 'tutor' | 'explainer' | 'quizzer'
type DocsView = 'guide' | 'progress'

export type StudentDocsPrototypeProps = {
  gamificationEnabled: boolean
  learningAnalyticsEnabled: boolean
  chatbot?: { name: string; href: string }
  previewChatbot?: boolean
}

const modeExamples: Record<
  Mode,
  { label: string; prompt: string; response: string }
> = {
  tutor: {
    label: 'Tutor',
    prompt:
      'I think opportunity cost is the price I pay. Can you give me a hint?',
    response:
      'Imagine you spend a free hour studying instead of working. What have you given up?',
  },
  explainer: {
    label: 'Explainer',
    prompt: 'Explain opportunity cost using an example with my time.',
    response:
      'Opportunity cost is the value of the next-best alternative you give up. An hour spent studying cannot also be spent working.',
  },
  quizzer: {
    label: 'Quizzer',
    prompt: 'Ask me a question to check my understanding of opportunity cost.',
    response:
      'You spend an hour studying instead of earning CHF 25 at work. What is the opportunity cost of that hour?',
  },
}

const featureCards: {
  href: string
  kind: FeatureKind
  title: string
  description: string
  linkLabel: string
}[] = [
  {
    href: '#live-quizzes',
    kind: 'live',
    title: 'Participate in class',
    description: 'Answer live questions and discuss the results.',
    linkLabel: 'About live quizzes',
  },
  {
    href: '#practice',
    kind: 'practice',
    title: 'Practise between sessions',
    description: 'Use quizzes and flashcards to check what you know.',
    linkLabel: 'About practice activities',
  },
  {
    href: '#ai-tutor',
    kind: 'chat',
    title: 'Work through questions',
    description: 'Ask the AI tutor for hints, explanations, or practice.',
    linkLabel: 'About the AI tutor',
  },
]

function FeatureIllustration({ kind }: { kind: FeatureKind }) {
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
        A hint?
      </span>
      <span className="block max-w-40 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-[11px] text-slate-700">
        What have you tried?
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
  return (
    <nav className="flex flex-wrap gap-2" aria-label="Documentation views">
      <Button
        type="button"
        active={activeView === 'guide'}
        aria-pressed={activeView === 'guide'}
        data-cy="docs-prototype-view-guide"
        onClick={() => onChange('guide')}
        className={{ root: 'min-h-11 rounded-lg' }}
      >
        Student guide
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
          Progress &amp; data
        </Button>
      )}
    </nav>
  )
}

export default function StudentDocsPrototype({
  gamificationEnabled,
  learningAnalyticsEnabled,
  chatbot,
  previewChatbot = false,
}: StudentDocsPrototypeProps) {
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false)
  const [selectedMode, setSelectedMode] = useState<Mode>('tutor')
  const [isChatbotOpen, setIsChatbotOpen] = useState(false)
  const [activeView, setActiveView] = useState<DocsView>('guide')
  const viewHeadingRef = useRef<HTMLHeadingElement>(null)
  const prototypeRef = useRef<HTMLElement>(null)
  const previousViewRef = useRef<DocsView>('guide')
  const selectedExample = modeExamples[selectedMode]
  const chatbotEnabled = chatbot !== undefined || previewChatbot
  const progressAvailable = gamificationEnabled || learningAnalyticsEnabled
  const progressTopics = [
    ...(gamificationEnabled ? ['course points and global XP'] : []),
    ...(learningAnalyticsEnabled ? ['Learning Analytics'] : []),
    'privacy and support',
  ].join(', ')
  const visibleFeatureCards = featureCards.filter((feature) => {
    if (feature.kind === 'chat') return chatbotEnabled
    return true
  })
  const guideNavItems: Array<[string, string, string]> = [
    ['#get-started', 'Get started', 'get-started'],
    ['#live-quizzes', 'In class', 'live-quizzes'],
    ['#practice', 'Practise', 'practice'],
    ['#common-questions-title', 'FAQs', 'common-questions'],
  ]
  if (!progressAvailable) {
    guideNavItems.push(['#progress-help', 'Privacy & help', 'progress-help'])
  }
  if (chatbotEnabled) {
    guideNavItems.splice(3, 0, ['#ai-tutor', 'AI tutor', 'ai-tutor'])
  }
  const progressNavItems: Array<[string, string, string]> = [
    ['#progress-help', 'Privacy & help', 'progress-help'],
  ]
  if (learningAnalyticsEnabled) {
    progressNavItems.unshift([
      '#learning-analytics',
      'Learning analytics',
      'learning-analytics',
    ])
  }
  if (gamificationEnabled) {
    progressNavItems.unshift(['#gamification', 'Points & XP', 'gamification'])
  }

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
              {currentView === 'guide' ? 'Student guide' : 'Progress & data'}
            </div>
            {currentView === 'guide' ? (
              <>
                <h1
                  id="guide-hero-title"
                  ref={viewHeadingRef}
                  tabIndex={-1}
                  className="max-w-[44ch] text-balance text-2xl font-bold leading-tight tracking-tight text-slate-800"
                >
                  KlickerUZH in your course
                </h1>
                <p className="mt-3 max-w-[44ch] text-base leading-7 text-slate-600">
                  Participate in class and practise course material
                  {chatbotEnabled
                    ? ', then work through questions with AI support.'
                    : '.'}
                </p>
                <p className="mt-3 max-w-[44ch] text-sm leading-6 text-slate-500">
                  Available activities and tools depend on your course.
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
                  Understand progress and data
                </h1>
                <p className="mt-3 max-w-[44ch] text-base leading-7 text-slate-600">
                  Learn about {progressTopics}.
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
          <>
            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {visibleFeatureCards.map((feature) => (
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
                    {feature.title}
                  </h2>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {feature.description}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary-100 group-hover:text-primary-100">
                    {feature.linkLabel}
                    <FontAwesomeIcon icon={faArrowDown} aria-hidden="true" />
                  </span>
                </a>
              ))}
            </div>
            <div className="mt-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <strong className="font-semibold text-slate-800">
                  Set up access
                </strong>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Open your course link, sign in, and install the app only if
                  you want it on your phone.
                </p>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-semibold">
                <a
                  href="#get-started"
                  data-cy="docs-prototype-first-visit"
                  className="inline-flex min-h-11 items-center gap-1.5 text-slate-700 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                >
                  First visit? Account setup
                  <FontAwesomeIcon icon={faArrowDown} aria-hidden="true" />
                </a>
                <a
                  href="https://play.google.com/store/apps/details?id=ch.uzh.bf.klicker.pwa"
                  target="_blank"
                  rel="noopener noreferrer"
                  data-cy="docs-prototype-android-app"
                  className="inline-flex min-h-11 items-center gap-1.5 text-slate-700 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                >
                  Android app
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
                  iPhone setup
                  <FontAwesomeIcon
                    icon={faArrowUpRightFromSquare}
                    aria-hidden="true"
                  />
                </a>
              </div>
            </div>
          </>
        ) : (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm leading-6 text-slate-600">
              Available sections reflect this course and account’s enabled
              capabilities.
            </p>
            <Button
              type="button"
              data-cy="docs-prototype-back-to-guide"
              onClick={() => handleViewChange('guide')}
              className={{ root: 'min-h-11 rounded-lg' }}
            >
              <FontAwesomeIcon icon={faArrowLeft} aria-hidden="true" />
              <span>Back to student guide</span>
            </Button>
          </div>
        )}
      </section>

      <SectionNavigation
        items={currentView === 'guide' ? guideNavItems : progressNavItems}
        label={
          currentView === 'guide' ? 'In this guide' : 'In progress and data'
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
            label="Get started"
            title="Course access and accounts"
          />
          <div className="space-y-6">
            <div className="grid gap-4 text-base leading-7 text-slate-600 sm:grid-cols-2">
              <p>
                Open the course link shared by your teaching team or learning
                platform, then sign in or follow the registration steps. You may
                need a course PIN.
              </p>
              <p>
                An account is needed for personal bookmarks and repetition
                {chatbotEnabled ? ', and for course chatbots.' : '.'} Some
                activities allow guest participation. Use KlickerUZH in your
                browser; phone installation is optional.
              </p>
            </div>
            <TutorialLink slug="student_accounts">
              Account and sign-in guide
            </TutorialLink>

            <figure className="rounded-lg bg-slate-50 p-4 sm:p-5">
              <div className="mb-3 text-xs font-semibold text-slate-600">
                Your first visit
              </div>
              <ol className="m-0 grid list-none gap-3 p-0 md:grid-cols-3">
                <Step number="1" title="Open your course">
                  Use the course link or learning platform provided to you.
                </Step>
                <Step number="2" title="Sign in when prompted">
                  Use an existing account or follow the registration steps.
                </Step>
                <Step number="3" title="Choose an activity">
                  Open a live quiz or practice material
                  {chatbotEnabled ? ', or the AI tutor' : ''} when available.
                </Step>
              </ol>
              <figcaption className="mt-4 text-xs leading-5 text-slate-500">
                Your teaching team provides the course link and any required
                PIN.
              </figcaption>
            </figure>
          </div>
        </section>

        <section
          id="live-quizzes"
          className="scroll-mt-20 border-b border-slate-200 py-10"
        >
          <GuideSectionHeading
            label="In class"
            title="Live quizzes and feedback"
          />
          <div className="grid gap-6 lg:grid-cols-[1fr_0.94fr] lg:items-start lg:gap-10">
            <ul className="m-0 list-none space-y-4 p-0 text-base leading-7 text-slate-600">
              <li>
                <strong className="text-slate-800">Live quizzes.</strong> Open
                the session shared by your lecturer and submit your answer while
                the question is open. Anonymous answers may be available.
              </li>
              <li>
                <strong className="text-slate-800">
                  Questions and feedback.
                </strong>{' '}
                Use live Q&amp;A or rate pace and difficulty when those features
                are enabled.
              </li>
              <li>
                <strong className="text-slate-800">
                  Follow the activity rules.
                </strong>{' '}
                Your teaching team decides the timing, attempts, and available
                feedback for each activity.
              </li>
              <li>
                <TutorialLink slug="live_quiz">Live quiz guide</TutorialLink>
              </li>
            </ul>

            <figure className="rounded-lg bg-slate-50 p-4 sm:p-5">
              <div className="mb-3 text-xs font-semibold text-slate-600">
                Illustrative live quiz
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3.5 py-2.5 text-xs text-slate-500">
                  <strong className="text-slate-800">Live quiz</strong>
                  <span>Question open</span>
                </div>
                <div className="p-4">
                  <h3 className="text-base font-bold text-slate-800">
                    What is opportunity cost?
                  </h3>
                  <div className="mt-3 space-y-2 text-sm">
                    <div className="rounded-md border border-slate-200 px-3 py-2.5 text-slate-600">
                      The money already spent on a choice
                    </div>
                    <div className="rounded-md border border-primary-100 bg-slate-50 px-3 py-2.5 text-slate-800">
                      <span aria-hidden="true">◉ </span>
                      The value of the next-best alternative forgone
                    </div>
                    <div className="rounded-md border border-slate-200 px-3 py-2.5 text-slate-600">
                      The sum of all available alternatives
                    </div>
                  </div>
                  <div className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-500">
                    <strong className="text-slate-700">
                      Something unclear?
                    </strong>{' '}
                    Ask in Q&amp;A: “Could you show another example?”
                  </div>
                </div>
              </div>
              <figcaption className="mt-3 text-xs leading-5 text-slate-500">
                An example of answering a question and asking for clarification.
              </figcaption>
            </figure>
          </div>
        </section>

        <section
          id="practice"
          className="scroll-mt-20 border-b border-slate-200 py-10"
        >
          <GuideSectionHeading
            label="Independent practice"
            title="Practice quizzes and repetition"
          />
          <div className="grid gap-6 lg:grid-cols-[1fr_0.94fr] lg:items-start lg:gap-10">
            <ul className="m-0 list-none space-y-4 p-0 text-base leading-7 text-slate-600">
              <li>
                <strong className="text-slate-800">Practice quizzes.</strong>{' '}
                Answer course questions, read the feedback, and repeat available
                quizzes. Points depend on the activity rules.
              </li>
              <li>
                <strong className="text-slate-800">Flashcards.</strong> Recall
                an answer, reveal it, then assess how well you knew it.
              </li>
              <li>
                <strong className="text-slate-800">Bookmarks.</strong> Logged-in
                participants can save questions for a private study pool.
              </li>
              <li>
                <strong className="text-slate-800">Microlearnings.</strong>{' '}
                Complete short activities within their availability window. Each
                is intended for one attempt.
              </li>
              <li>
                <strong className="text-slate-800">Group activities.</strong>{' '}
                Work through tasks with your group when your course offers them.
              </li>
              <li className="flex flex-wrap gap-x-5 gap-y-2">
                <TutorialLink slug="practice_quiz">Practice guide</TutorialLink>
                <TutorialLink slug="microlearning">Microlearnings</TutorialLink>
                <TutorialLink slug="groups_activities">
                  Group activities
                </TutorialLink>
              </li>
            </ul>

            <figure className="rounded-lg bg-slate-50 p-4 sm:p-5">
              <div className="mb-3 text-xs font-semibold text-slate-600">
                Try the example
              </div>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-3.5 py-2.5 text-xs text-slate-500">
                  <strong className="text-slate-800">Flashcard</strong>
                  <span className="rounded bg-slate-100 px-2 py-1">
                    Illustration
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex min-h-32 flex-col justify-center gap-2">
                    <span className="text-sm text-slate-500">
                      Think of an answer before revealing it.
                    </span>
                    <h3 className="text-base font-bold text-slate-800">
                      What does opportunity cost mean?
                    </h3>
                    <div
                      id="flashcard-answer"
                      aria-live="polite"
                      hidden={!isAnswerRevealed}
                      className="border-t border-slate-200 pt-3 text-sm leading-6 text-slate-600"
                    >
                      <p>
                        The value of the next-best alternative you give up when
                        making a choice.
                      </p>
                      <p className="mt-2 text-slate-500">
                        For example, an hour spent studying cannot also be spent
                        working.
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
                    {isAnswerRevealed ? 'Hide answer' : 'Reveal answer'}
                  </Button>
                </div>
              </div>
              <figcaption className="mt-3 text-xs leading-5 text-slate-500">
                Reveal the answer after making your own attempt.
              </figcaption>
            </figure>
          </div>
        </section>

        {chatbotEnabled && (
          <section
            id="ai-tutor"
            className="scroll-mt-20 border-b border-slate-200 py-10"
          >
            <GuideSectionHeading label="AI study support" title="AI tutor" />
            <div className="grid gap-6 lg:grid-cols-[1fr_0.94fr] lg:items-start lg:gap-10">
              <div className="space-y-4 text-base leading-7 text-slate-600">
                <p>
                  Open the course chatbot when it is available. You need a
                  KlickerUZH account and Participation in the course; joining a
                  leaderboard is not required.
                </p>
                <ul className="m-0 list-none space-y-3 p-0">
                  <li>
                    <strong className="text-slate-800">Tutor</strong> guides you
                    with questions, hints, and feedback.
                  </li>
                  <li>
                    <strong className="text-slate-800">Explainer</strong>{' '}
                    explains a concept directly with examples.
                  </li>
                  <li>
                    <strong className="text-slate-800">Quizzer</strong> asks
                    practice questions to check your understanding.
                  </li>
                </ul>
                <p>
                  Modes vary by course. Include your own attempt when asking for
                  help, and check answers against course material because AI can
                  be wrong or incomplete.
                </p>
                <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800">
                  Your existing account, credits, and privacy arrangements
                  apply. The balance shows allowance and refill information;
                  cost depends on the configured model and conversation length.
                  Avoid sensitive personal information.
                </p>
                <TutorialLink slug="chatbot">Chatbot guide</TutorialLink>
              </div>

              <figure className="rounded-lg bg-slate-50 p-4 sm:p-5">
                {chatbot ? (
                  <>
                    <div className="mb-3 text-xs font-semibold text-slate-600">
                      {chatbot.name}
                    </div>
                    {!isChatbotOpen ? (
                      <div className="rounded-lg border border-slate-200 bg-white p-4">
                        <p className="text-sm leading-6 text-slate-600">
                          Open the embedded course chatbot when you are ready to
                          try it.
                        </p>
                        <Button
                          type="button"
                          data-cy="docs-prototype-chatbot-try"
                          onClick={() => setIsChatbotOpen(true)}
                          primary
                          className={{ root: 'mt-4 min-h-11' }}
                        >
                          Try the course chatbot
                        </Button>
                      </div>
                    ) : (
                      <iframe
                        src={chatbot.href}
                        title={`${chatbot.name} course chatbot`}
                        className="h-[32rem] w-full rounded-lg border border-slate-200 bg-white"
                      />
                    )}
                    <a
                      href={chatbot.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-700 underline decoration-slate-300 underline-offset-4 hover:decoration-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
                    >
                      Open {chatbot.name} in a new tab
                      <FontAwesomeIcon
                        icon={faArrowUpRightFromSquare}
                        aria-hidden="true"
                      />
                    </a>
                  </>
                ) : (
                  <>
                    <div className="mb-3 text-xs font-semibold text-slate-600">
                      Illustration — select a course to try its chatbot
                    </div>
                    <fieldset
                      className="mb-4 flex flex-wrap gap-2"
                      aria-label="Illustrative chatbot mode"
                    >
                      {(Object.keys(modeExamples) as Mode[]).map((mode) => (
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
                          Example student prompt
                        </div>
                        {selectedExample.prompt}
                      </div>
                      <div className="mt-3 rounded-lg bg-white p-3 text-sm leading-6 text-slate-700 shadow-sm">
                        <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-500">
                          Illustrative response · {selectedExample.label}
                        </div>
                        {selectedExample.response}
                      </div>
                    </div>
                    <figcaption className="mt-3 text-xs leading-5 text-slate-500">
                      Synthetic illustration only; no chatbot is running here.
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
              label="Learning progress"
              title="Course points, global XP, and milestones"
            />
            <div className="grid gap-6 lg:grid-cols-[1fr_0.94fr] lg:items-start lg:gap-10">
              <div className="space-y-4 text-base leading-7 text-slate-600">
                <p>
                  Course points show your progress in this course. When the
                  course offers a leaderboard, joining it is optional; leaving
                  the leaderboard does not remove your course access or
                  collected points.
                </p>
                <p>
                  Global XP and levels are a separate participant-wide track. XP
                  can accrue independently of course leaderboard opt-in, with
                  award rules depending on the activities available to you.
                </p>
                <p>
                  Achievements mark milestones such as completing a practice
                  goal. These examples are synthetic and do not show your data.
                </p>
                <TutorialLink slug="course_leaderboard">
                  Leaderboards and achievements
                </TutorialLink>
              </div>

              <figure className="rounded-lg bg-slate-50 p-4 sm:p-5">
                <div className="mb-3 text-xs font-semibold text-slate-600">
                  Illustrative progress view
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="text-xs font-semibold text-slate-500">
                      This course
                    </div>
                    <div className="mt-1 text-2xl font-bold text-slate-800">
                      420 points
                    </div>

                    <div className="mt-2 text-xs text-slate-500">
                      Course points · synthetic
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-800 p-3 text-white shadow-sm">
                    <div className="text-xs font-semibold text-slate-300">
                      Across your account
                    </div>
                    <div className="mt-1 text-2xl font-bold">Level 4</div>
                    <div className="mt-3 h-2 rounded-full bg-slate-600">
                      <div className="h-2 w-2/5 rounded-full bg-primary-60" />
                    </div>
                    <div className="mt-2 text-xs text-slate-300">
                      Global XP · synthetic
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
                        Practice milestone
                      </div>
                      <div className="text-xs text-slate-600">
                        Complete 5 practice activities · illustrative
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <strong className="text-slate-800">
                      Optional course leaderboard
                    </strong>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">
                      Example
                    </span>
                  </div>
                  <ol className="mt-3 space-y-2 text-xs text-slate-600">
                    <li className="flex justify-between gap-3">
                      <span>1 · Alex</span>
                      <span>510 points</span>
                    </li>
                    <li className="flex justify-between gap-3 rounded-md bg-primary-20 px-2 py-1.5 text-slate-800">
                      <span>2 · You</span>
                      <span>420 points</span>
                    </li>
                    <li className="flex justify-between gap-3">
                      <span>3 · Sam</span>
                      <span>390 points</span>
                    </li>
                  </ol>
                </div>
                <figcaption className="mt-3 text-xs leading-5 text-slate-500">
                  Illustrative cards only; values and names are synthetic.
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
            <div className="mb-3 text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
              Planned behavior · no preference is saved here
            </div>
            <GuideSectionHeading
              label="Learning analytics"
              title="Turn activity into useful next steps"
            />
            <div className="grid gap-6 lg:grid-cols-[1fr_0.94fr] lg:items-start lg:gap-10">
              <div className="space-y-4 text-base leading-7 text-slate-600">
                <p>
                  Learning analytics can help you spot practice gaps, reflect on
                  your study activity, and help the teaching team identify
                  topics that may need support.
                </p>
                <p>
                  Your course must offer analytics, and you choose whether to
                  take part across your account.
                </p>
                <p>
                  If you opt out, individual derived Learning Analytics data is
                  removed and future aggregates exclude you. Existing aggregate
                  results are not promised to be recomputed or removed.
                </p>
              </div>

              <div className="space-y-4">
                <figure className="rounded-lg bg-slate-50 p-4 sm:p-5">
                  <div className="mb-3 text-xs font-semibold text-slate-600">
                    Illustrative weekly activity
                  </div>
                  <div className="flex h-32 items-end justify-between gap-2 rounded-lg border border-slate-200 bg-white px-4 pb-4 pt-5">
                    {[
                      ['Mon', 'h-8'],
                      ['Tue', 'h-14'],
                      ['Wed', 'h-10'],
                      ['Thu', 'h-20'],
                      ['Fri', 'h-12'],
                      ['Sat', 'h-6'],
                      ['Sun', 'h-16'],
                    ].map(([day, height]) => (
                      <div
                        key={day}
                        className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                      >
                        <span
                          className={`w-full max-w-7 rounded-t bg-primary-60 ${height}`}
                        />
                        <span className="text-[10px] text-slate-500">
                          {day}
                        </span>
                      </div>
                    ))}
                  </div>
                  <figcaption className="mt-3 text-xs leading-5 text-slate-500">
                    Illustrative pattern only — this is not real student data or
                    a measurement of your activity.
                  </figcaption>
                </figure>

                <fieldset
                  disabled
                  className="rounded-lg border border-slate-200 bg-white p-4 sm:p-5"
                >
                  <legend className="px-1 text-sm font-bold text-slate-800">
                    Planned choice controls — no preference is saved here
                  </legend>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    This future choice will apply account-wide and remains
                    separate from whether each course offers Learning Analytics.
                    These controls are disabled in this prototype; no choice is
                    recorded.
                  </p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <Button
                      type="button"
                      disabled
                      className={{ root: 'min-h-11' }}
                    >
                      Opt in
                    </Button>
                    <Button
                      type="button"
                      disabled
                      className={{ root: 'min-h-11' }}
                    >
                      Opt out
                    </Button>
                  </div>
                </fieldset>
              </div>
            </div>
          </section>
        )}
      </div>

      <section
        id="progress-help"
        hidden={currentView === 'guide' && progressAvailable}
        className="scroll-mt-20 border-b border-slate-200 py-10"
      >
        <GuideSectionHeading
          label="Progress & help"
          title="Feedback, privacy, and support"
        />
        <div className="grid gap-6 lg:grid-cols-[1fr_0.94fr] lg:items-start lg:gap-10">
          <div className="space-y-4 text-base leading-7 text-slate-600">
            <p>
              Manage visibility in your profile privacy settings. Course
              notifications and feedback are available when supported by the
              activity.
            </p>
            <p>
              Contact your teaching team about access, deadlines, and course
              rules.
            </p>
          </div>

          <figure className="rounded-lg bg-slate-50 p-4 sm:p-5">
            <div className="mb-3 text-xs font-semibold text-slate-600">
              Feedback and support
            </div>
            <div className="grid gap-2">
              <ProgressItem icon={faCommentDots} title="Activity feedback">
                Feedback on your answers when provided.
              </ProgressItem>
              <ProgressItem icon={faChartLine} title="Course support">
                Ask your teaching team about course rules and access.
              </ProgressItem>
            </div>
            <figcaption className="mt-3 text-xs leading-5 text-slate-500">
              Available support depends on the course.
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
          Common questions
        </h2>
        <div className="mt-4">
          <details className="border-t border-slate-200">
            <summary
              data-cy="docs-prototype-help-sign-in"
              className="cursor-pointer py-4 pr-8 text-base font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
            >
              I cannot sign in or find my course.
            </summary>
            <p className="pb-4 text-sm leading-6 text-slate-600">
              Use the original course link and your existing account. Ask your
              teaching team for a missing PIN or access instructions. Use the
              recovery option on the sign-in page when it is offered.
            </p>
          </details>
          {chatbotEnabled && (
            <details className="border-t border-slate-200">
              <summary
                data-cy="docs-prototype-help-missing-activity"
                className="cursor-pointer py-4 pr-8 text-base font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
              >
                An activity or the course chatbot is missing.
              </summary>
              <p className="pb-4 text-sm leading-6 text-slate-600">
                The activity may be unpublished, closed, or require sign-in.
                Check your course instructions. For the chatbot, sign in and
                join its course. If credits are exhausted, check the displayed
                refill information.
              </p>
            </details>
          )}
          <details className="border-t border-slate-200">
            <summary
              data-cy="docs-prototype-help-install"
              className="cursor-pointer py-4 pr-8 text-base font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
            >
              How do I install KlickerUZH and enable notifications?
            </summary>
            <p className="pb-4 text-sm leading-6 text-slate-600">
              Look for “Install app” or “Add to Home Screen” in your browser’s
              menu or share menu. Enable notifications in your course when
              available, and allow them on your device. Support varies by device
              and browser.
            </p>
            <div className="pb-4">
              <TutorialLink slug="klickeruzh_app">
                Installation and notifications guide
              </TutorialLink>
            </div>
          </details>
          {gamificationEnabled && (
            <details className="border-t border-slate-200">
              <summary
                data-cy="docs-prototype-help-points"
                className="cursor-pointer py-4 pr-8 text-base font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
              >
                Why did I receive different points this time?
              </summary>
              <p className="pb-4 text-sm leading-6 text-slate-600">
                Points can depend on correctness, response time, multipliers,
                and repetition rules. Check the activity instructions or ask
                your teaching team.
              </p>
            </details>
          )}
          {gamificationEnabled && (
            <details className="border-y border-slate-200">
              <summary
                data-cy="docs-prototype-help-leaderboard"
                className="cursor-pointer py-4 pr-8 text-base font-semibold text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-100"
              >
                Do I have to appear on the leaderboard?
              </summary>
              <p className="pb-4 text-sm leading-6 text-slate-600">
                No. Course leaderboards are opt-in. Leaving a leaderboard does
                not remove course access. Check your profile privacy settings
                for visibility options.
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
                Progress &amp; data
              </strong>
              <span className="text-sm leading-6 text-slate-700">
                Learn about {progressTopics}.
              </span>
            </span>
          </button>
        )}
        <p className="pt-6 text-xs leading-5 text-slate-500">
          Student guide prototype · Examples are synthetic and illustrate
          concepts rather than exact current screens.
        </p>
      </section>
    </main>
  )
}
