import { useMutation, useQuery } from '@apollo/client'
import {
  faArchive,
  faBullseye,
  faChartLine,
  faChevronDown,
  faChevronRight,
  faClipboardCheck,
  faEye,
  faInfoCircle,
  faLayerGroup,
  faPercent,
  faPlus,
  faRocket,
  faSave,
  faTrash,
  faUsers,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  AdaptiveOverviewAttemptMode,
  ElementType,
  FAdaptiveAssessmentConfigFragment,
  MArchiveAdaptiveAssessmentDocument,
  MPublishAdaptiveAssessmentDocument,
  MUpsertAdaptiveAssessmentDocument,
  PublicationStatus,
  QAdaptiveAssessmentResultsDocument,
  QAdaptiveAssessmentResultsQuery,
  QAdaptiveAssessmentsDocument,
  QAdaptiveLearningElementCandidatesDocument,
  QAdaptiveLearningElementCandidatesQuery,
  UpsertAdaptiveAssessmentInput,
} from '@klicker-uzh/graphql/dist/ops'
import AbilityHistogram from '@klicker-uzh/shared-components/src/adaptive/AbilityHistogram'
import AdaptiveMetricCard from '@klicker-uzh/shared-components/src/adaptive/AdaptiveMetricCard'
import ItemCharacteristicCurve from '@klicker-uzh/shared-components/src/adaptive/ItemCharacteristicCurve'
import LevelBadge from '@klicker-uzh/shared-components/src/adaptive/LevelBadge'
import {
  ADAPTIVE_COMPETENCE_COLORS,
  formatTheta,
  getLevelColor,
  thetaToPercent,
} from '@klicker-uzh/shared-components/src/adaptive/utils'
import DataTable from '@klicker-uzh/shared-components/src/DataTable'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import {
  Button,
  Checkbox,
  Tooltip,
  UserNotification,
} from '@uzh-bf/design-system'
import dayjs from 'dayjs'
import { GetStaticPropsContext } from 'next'
import { useRouter } from 'next/router'
import { ReactNode, useEffect, useMemo, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import Layout from '../../../components/Layout'

type Assessment = FAdaptiveAssessmentConfigFragment
type Results = NonNullable<
  QAdaptiveAssessmentResultsQuery['adaptiveAssessmentResults']
>
type StudentAttemptResult = Results['students'][number]
type ItemResult = Results['items'][number]
type SubCompetenceEstimate = {
  subCompetenceId: number
  subCompetenceName: string
  theta?: number | null
  standardError?: number | null
  levelLabel?: string | null
  answeredQuestions: number
}
type CompetenceWithSubCompetences = {
  competenceId: number
  competenceName: string
  theta?: number | null
  standardError?: number | null
  levelLabel?: string | null
  answeredQuestions?: number
  subCompetences?: SubCompetenceEstimate[]
}
type ElementCandidate = Extract<
  NonNullable<
    QAdaptiveLearningElementCandidatesQuery['userElements']
  >['elements'][number],
  { __typename: 'ChoicesElement' | 'FreeTextElement' }
>

type LevelFormValue = { label: string }
type SubCompetenceFormValue = {
  name: string
  enabled: boolean
  questionThreshold: number | null
  standardErrorThreshold: number | null
}
type CompetenceFormValue = {
  name: string
  enabled: boolean
  weight: number
  questionThreshold: number | null
  standardErrorThreshold: number | null
  subCompetences: SubCompetenceFormValue[]
}
type ElementMappingFormValue = {
  elementId: number
  elementName: string
  elementType: ElementType | null
  choiceCount: number | null
  competenceName: string
  subCompetenceName: string
  levelLabel: string
  enabled: boolean
  discrimination: number | null
}
type ResultMessageFormValue = {
  levelLabel: string
  minTheta: number | null
  maxTheta: number | null
  message: string
  isFallback: boolean
}
type AdaptiveFormValues = {
  id: string | null
  displayName: string
  description: string
  levels: LevelFormValue[]
  competences: CompetenceFormValue[]
  elements: ElementMappingFormValue[]
  resultMessages: ResultMessageFormValue[]
  questionThreshold: number
  standardErrorThreshold: number
  discrimination: number
  thetaMin: number
  thetaMax: number
  topInformationRatio: number
  showTimer: boolean
  showCompetenceNames: boolean
  showFinalResult: boolean
  showSolutions: boolean
}

const DEFAULT_THETA_MIN = -3
const DEFAULT_THETA_MAX = 3
const DEFAULT_COMPETENCE_QUESTION_THRESHOLD = 5
const DEFAULT_COMPETENCE_STANDARD_ERROR_THRESHOLD = 0.3
const DEFAULT_COMPLETION_INTERVAL_MESSAGES = [
  'Your estimate is in the entry range. Revisit the foundations before moving on to mixed practice.',
  'Your estimate is building steadily. Short focused practice on core procedures should help.',
  'Your estimate is close to the course midpoint. Keep alternating concept checks with worked examples.',
  'Your estimate is in the solid application range. Practice with mixed items to stabilize it.',
  'Your estimate is in the advanced range. Target the few uncertain areas with harder items.',
  'Your estimate is near the top of the scale. Use challenging transfer items to confirm mastery.',
]

function defaultSubCompetence(name = 'Sub-competence'): SubCompetenceFormValue {
  return {
    name,
    enabled: true,
    questionThreshold: null,
    standardErrorThreshold: null,
  }
}

const DEFAULT_FORM_VALUES: AdaptiveFormValues = {
  id: null,
  displayName: 'Adaptive Learning Test',
  description: '',
  levels: [
    { label: 'Novice' },
    { label: 'Developing' },
    { label: 'Proficient' },
    { label: 'Advanced' },
    { label: 'Expert' },
  ],
  competences: [
    {
      name: 'Descriptive Statistics',
      enabled: true,
      weight: 20,
      questionThreshold: null,
      standardErrorThreshold: null,
      subCompetences: [
        defaultSubCompetence('Central tendency'),
        defaultSubCompetence('Dispersion and spread'),
      ],
    },
    {
      name: 'Probability',
      enabled: true,
      weight: 25,
      questionThreshold: null,
      standardErrorThreshold: null,
      subCompetences: [
        defaultSubCompetence('Probability rules'),
        defaultSubCompetence('Random variables'),
      ],
    },
    {
      name: 'Statistical Inference',
      enabled: true,
      weight: 30,
      questionThreshold: null,
      standardErrorThreshold: null,
      subCompetences: [
        defaultSubCompetence('Confidence intervals'),
        defaultSubCompetence('Hypothesis testing'),
      ],
    },
    {
      name: 'Regression Analysis',
      enabled: true,
      weight: 25,
      questionThreshold: null,
      standardErrorThreshold: null,
      subCompetences: [
        defaultSubCompetence('Simple linear regression'),
        defaultSubCompetence('Multiple regression'),
      ],
    },
  ],
  elements: [],
  resultMessages: [
    {
      levelLabel: 'Proficient',
      minTheta: null,
      maxTheta: null,
      message: 'You are performing at a proficient level overall.',
      isFallback: false,
    },
    ...buildCompletionIntervalMessages(DEFAULT_THETA_MIN, DEFAULT_THETA_MAX),
    {
      levelLabel: '',
      minTheta: null,
      maxTheta: null,
      message: 'Thanks for completing the adaptive learning test.',
      isFallback: true,
    },
  ],
  questionThreshold: DEFAULT_COMPETENCE_QUESTION_THRESHOLD,
  standardErrorThreshold: DEFAULT_COMPETENCE_STANDARD_ERROR_THRESHOLD,
  discrimination: 1.2,
  thetaMin: DEFAULT_THETA_MIN,
  thetaMax: DEFAULT_THETA_MAX,
  topInformationRatio: 0.8,
  showTimer: true,
  showCompetenceNames: true,
  showFinalResult: true,
  showSolutions: false,
}

const TABS = [
  'Competences',
  'Algorithm (3PL)',
  'Standing levels',
  'Results',
] as const
type Tab = (typeof TABS)[number]
const RESULT_TABS = ['Overview', 'Students', 'Items'] as const
type ResultTab = (typeof RESULT_TABS)[number]
type OverviewChartMode = 'individualPositions' | 'cohortDistribution'
const NEW_ASSESSMENT_ID = '__new_adaptive_assessment__'

function AdaptiveLearningManagePage() {
  const router = useRouter()
  const courseId = router.query.id as string | undefined
  const [tab, setTab] = useState<Tab>('Competences')
  const [resultTab, setResultTab] = useState<ResultTab>('Overview')
  const [overviewAttemptMode, setOverviewAttemptMode] =
    useState<AdaptiveOverviewAttemptMode>(AdaptiveOverviewAttemptMode.Best)
  const [overviewChartMode, setOverviewChartMode] = useState<OverviewChartMode>(
    'individualPositions'
  )
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<
    string | null
  >(null)
  const [searchString, setSearchString] = useState('')
  const [form, setForm] = useState<AdaptiveFormValues>(DEFAULT_FORM_VALUES)
  const [formError, setFormError] = useState<string | null>(null)

  const { data, loading, refetch } = useQuery(QAdaptiveAssessmentsDocument, {
    variables: { courseId: courseId ?? '' },
    skip: !courseId,
    fetchPolicy: 'network-only',
  })
  const { data: candidateData, loading: candidateLoading } = useQuery(
    QAdaptiveLearningElementCandidatesDocument,
    {
      variables: {
        searchString: searchString.trim() || undefined,
        numEntries: 200,
        offset: 0,
      },
      fetchPolicy: 'cache-and-network',
    }
  )
  const assessments = data?.adaptiveAssessments ?? []
  const assessmentIds = assessments.map((assessment) => assessment.id).join('|')
  const selectedAssessment =
    selectedAssessmentId === NEW_ASSESSMENT_ID
      ? null
      : (assessments.find(
          (assessment) => assessment.id === selectedAssessmentId
        ) ??
        assessments[0] ??
        null)
  const { data: resultsData, refetch: refetchResults } = useQuery(
    QAdaptiveAssessmentResultsDocument,
    {
      variables: {
        assessmentId: selectedAssessment?.id ?? '',
        attemptMode: overviewAttemptMode,
      },
      skip: !selectedAssessment?.id,
      fetchPolicy: 'network-only',
    }
  )

  const [upsertAssessment, { loading: saving }] = useMutation(
    MUpsertAdaptiveAssessmentDocument
  )
  const [publishAssessment, { loading: publishing }] = useMutation(
    MPublishAdaptiveAssessmentDocument
  )
  const [archiveAssessment, { loading: archiving }] = useMutation(
    MArchiveAdaptiveAssessmentDocument
  )

  const candidates = useMemo(
    () =>
      (candidateData?.userElements?.elements ?? []).filter(isElementCandidate),
    [candidateData]
  )

  useEffect(() => {
    if (selectedAssessmentId === NEW_ASSESSMENT_ID) return

    if (assessments.length === 0) {
      setSelectedAssessmentId(NEW_ASSESSMENT_ID)
      return
    }

    if (
      selectedAssessmentId &&
      assessments.some((assessment) => assessment.id === selectedAssessmentId)
    ) {
      return
    }

    setSelectedAssessmentId(assessments[0]!.id)
  }, [assessmentIds, selectedAssessmentId])

  useEffect(() => {
    if (selectedAssessment) {
      setForm(mapAssessmentToFormValues(selectedAssessment))
    } else if (selectedAssessmentId === NEW_ASSESSMENT_ID) {
      setForm(DEFAULT_FORM_VALUES)
    }
  }, [selectedAssessment?.id, selectedAssessmentId])

  const save = async () => {
    if (!courseId) return

    try {
      setFormError(null)
      const intervalErrors = validateResultMessageIntervals(form)
      if (intervalErrors.length > 0) {
        setFormError(intervalErrors[0])
        return
      }

      const result = await upsertAssessment({
        variables: {
          input: buildUpsertInput(form, courseId),
        },
      })
      const savedAssessment = result.data?.upsertAdaptiveAssessment ?? null
      if (savedAssessment) {
        setSelectedAssessmentId(savedAssessment.id)
      }
      await refetch()
      await refetchResults()
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Save failed')
    }
  }

  if (loading) {
    return (
      <Layout displayName="Adaptive learning">
        <Loader />
      </Layout>
    )
  }

  return (
    <Layout displayName="Adaptive learning">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 text-sm text-slate-500">
              Courses / Adaptive Learning
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-bold">Adaptive Learning</h1>
              <StatusPill status={selectedAssessment?.status} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              className="h-10 min-w-64 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm"
              value={selectedAssessmentId ?? NEW_ASSESSMENT_ID}
              onChange={(event) => {
                setFormError(null)
                setSelectedAssessmentId(event.target.value)
              }}
            >
              {assessments.map((assessment) => (
                <option key={assessment.id} value={assessment.id}>
                  {assessment.displayName}
                </option>
              ))}
              <option value={NEW_ASSESSMENT_ID}>New adaptive test</option>
            </select>
            <Button
              type="button"
              onClick={() => {
                setFormError(null)
                setSelectedAssessmentId(NEW_ASSESSMENT_ID)
                setForm(DEFAULT_FORM_VALUES)
              }}
            >
              <Button.Icon icon={faPlus} />
              <Button.Label>New adaptive test</Button.Label>
            </Button>
            {selectedAssessment && (
              <>
                <Button
                  type="button"
                  disabled={
                    publishing ||
                    selectedAssessment.status === PublicationStatus.Published
                  }
                  loading={publishing}
                  onClick={async () => {
                    await publishAssessment({
                      variables: { id: selectedAssessment.id },
                    })
                    await refetch()
                  }}
                >
                  <Button.Icon icon={faRocket} loading={publishing} />
                  <Button.Label>Publish</Button.Label>
                </Button>
                <Button
                  type="button"
                  disabled={archiving}
                  loading={archiving}
                  onClick={async () => {
                    await archiveAssessment({
                      variables: { id: selectedAssessment.id },
                    })
                    const nextAssessment = assessments.find(
                      (assessment) => assessment.id !== selectedAssessment.id
                    )
                    setSelectedAssessmentId(
                      nextAssessment?.id ?? NEW_ASSESSMENT_ID
                    )
                    setForm(DEFAULT_FORM_VALUES)
                    await refetch()
                  }}
                >
                  <Button.Icon icon={faArchive} loading={archiving} />
                  <Button.Label>Archive</Button.Label>
                </Button>
              </>
            )}
            <Button primary type="button" disabled={saving} onClick={save}>
              <Button.Icon icon={faSave} loading={saving} />
              <Button.Label>{form.id ? 'Save' : 'Save draft'}</Button.Label>
            </Button>
          </div>
        </div>

        {formError && <UserNotification type="error" message={formError} />}

        <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
          {TABS.map((entry) => (
            <button
              key={entry}
              type="button"
              className={twMerge(
                'rounded-md px-4 py-2 font-semibold text-slate-500',
                tab === entry && 'bg-white text-slate-900 shadow-sm'
              )}
              onClick={() => setTab(entry)}
            >
              {entry}
            </button>
          ))}
        </div>

        {tab === 'Competences' && (
          <CompetencesTab
            form={form}
            setForm={setForm}
            candidates={candidates}
            candidateLoading={candidateLoading}
            searchString={searchString}
            setSearchString={setSearchString}
          />
        )}
        {tab === 'Algorithm (3PL)' && (
          <AlgorithmTab form={form} setForm={setForm} />
        )}
        {tab === 'Standing levels' && (
          <StandingLevelsTab form={form} setForm={setForm} />
        )}
        {tab === 'Results' && (
          <ResultsTab
            form={form}
            results={resultsData?.adaptiveAssessmentResults ?? null}
            resultTab={resultTab}
            setResultTab={setResultTab}
            overviewAttemptMode={overviewAttemptMode}
            setOverviewAttemptMode={setOverviewAttemptMode}
            overviewChartMode={overviewChartMode}
            setOverviewChartMode={setOverviewChartMode}
          />
        )}
      </div>
    </Layout>
  )
}

function StatusPill({ status }: { status?: PublicationStatus | null }) {
  if (!status) {
    return (
      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
        Draft
      </span>
    )
  }

  const published = status === PublicationStatus.Published
  return (
    <span
      className={twMerge(
        'rounded-full px-3 py-1 text-sm font-semibold',
        published
          ? 'bg-uzh-darkgreen-20 text-uzh-darkgreen-100'
          : 'bg-slate-100 text-slate-600'
      )}
    >
      {published ? 'Live' : status}
    </span>
  )
}

function CompetencesTab({
  form,
  setForm,
  candidates,
  candidateLoading,
  searchString,
  setSearchString,
}: {
  form: AdaptiveFormValues
  setForm: (form: AdaptiveFormValues) => void
  candidates: ElementCandidate[]
  candidateLoading: boolean
  searchString: string
  setSearchString: (value: string) => void
}) {
  const selectedElementIds = new Set(
    form.elements.map((entry) => entry.elementId)
  )
  const candidateById = new Map(
    candidates.map((candidate) => [candidate.id, candidate])
  )
  const poolRows = [
    ...form.elements.map((mapping) => ({
      elementId: mapping.elementId,
      name: mapping.elementName,
      type: mapping.elementType,
      choiceCount: mapping.choiceCount,
      candidate: candidateById.get(mapping.elementId) ?? null,
      mapping,
    })),
    ...candidates
      .filter((candidate) => !selectedElementIds.has(candidate.id))
      .map((candidate) => ({
        elementId: candidate.id,
        name: candidate.name,
        type: candidate.type,
        choiceCount: mappedChoiceCount(candidate),
        candidate,
        mapping: null,
      })),
  ]

  return (
    <div className="grid min-w-0 gap-4">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <SectionHeading
              title="Competences"
              tooltip="Competences define weighted reporting dimensions. Adaptive stopping is configured only on their enabled subcompetences."
            />
            <p className="text-slate-600">
              Define what the adaptive test measures and how it contributes to
              the overall standing. Set max items and target SE on
              subcompetences.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => setForm(equalizeCompetenceWeights(form))}
            >
              <Button.Label>Equalize</Button.Label>
            </Button>
            <Button
              type="button"
              onClick={() =>
                setForm(
                  recomputeEnabledCompetenceWeights({
                    ...form,
                    competences: [
                      ...form.competences,
                      {
                        name: 'New competence',
                        enabled: true,
                        weight: 0,
                        questionThreshold: null,
                        standardErrorThreshold: null,
                        subCompetences: [defaultSubCompetence()],
                      },
                    ],
                  })
                )
              }
            >
              <Button.Icon icon={faPlus} />
              <Button.Label>Add competence</Button.Label>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 p-4">
          {form.competences.map((competence, index) => (
            <div
              key={`competence-${index}`}
              className={twMerge(
                'rounded-lg border border-l-4 border-slate-200 bg-white p-4 shadow-sm',
                !competence.enabled && 'bg-slate-50 opacity-75'
              )}
              style={{
                borderLeftColor:
                  ADAPTIVE_COMPETENCE_COLORS[
                    index % ADAPTIVE_COMPETENCE_COLORS.length
                  ],
              }}
            >
              <div className="grid gap-5 lg:grid-cols-[minmax(18rem,1fr)_minmax(18rem,26rem)_8rem] lg:items-start">
                <div className="grid min-w-0 gap-4">
                  <div>
                    <FieldCaption>Competence title</FieldCaption>
                    <TextInput
                      value={competence.name}
                      disabled={!competence.enabled}
                      onChange={(name) =>
                        updateCompetence(form, setForm, index, { name })
                      }
                    />
                  </div>

                  <div>
                    <FieldCaption>Subcompetences</FieldCaption>
                    <div className="mt-2 grid gap-2">
                      {competence.subCompetences.length > 0 && (
                        <div className="hidden grid-cols-[5rem_minmax(10rem,1fr)_6.5rem_6.5rem_2rem] gap-2 px-1 text-[0.7rem] font-bold uppercase tracking-wide text-slate-400 sm:grid">
                          <span>Status</span>
                          <span>Title</span>
                          <span>Max items</span>
                          <span>Target SE</span>
                          <span />
                        </div>
                      )}
                      {competence.subCompetences.map(
                        (subCompetence, subIndex) => (
                          <div
                            key={`sub-competence-${index}-${subIndex}`}
                            className={twMerge(
                              'grid gap-2 rounded-md border border-slate-200 bg-slate-50 p-2 sm:grid-cols-[5rem_minmax(10rem,1fr)_6.5rem_6.5rem_2rem] sm:items-center',
                              (!competence.enabled || !subCompetence.enabled) &&
                                'opacity-70'
                            )}
                          >
                            <input
                              className="accent-primary-100 h-4 w-4"
                              type="checkbox"
                              checked={subCompetence.enabled}
                              disabled={!competence.enabled}
                              onChange={() =>
                                setForm(
                                  setSubCompetenceEnabled(
                                    form,
                                    index,
                                    subIndex,
                                    !subCompetence.enabled
                                  )
                                )
                              }
                              aria-label={`Enable ${subCompetence.name}`}
                            />
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="bg-primary-100 h-2 w-2 flex-none rounded-full" />
                              <input
                                className={twMerge(
                                  'min-w-0 flex-1 border-0 bg-transparent text-sm font-semibold focus:ring-0',
                                  (!competence.enabled ||
                                    !subCompetence.enabled) &&
                                    'text-slate-400'
                                )}
                                value={subCompetence.name}
                                disabled={
                                  !competence.enabled || !subCompetence.enabled
                                }
                                onChange={(event) =>
                                  updateSubCompetence(
                                    form,
                                    setForm,
                                    index,
                                    subIndex,
                                    { name: event.target.value }
                                  )
                                }
                              />
                            </div>
                            <NumberInput
                              value={subCompetence.questionThreshold}
                              placeholder={`${form.questionThreshold}`}
                              disabled={
                                !competence.enabled || !subCompetence.enabled
                              }
                              onChange={(questionThreshold) =>
                                updateSubCompetence(
                                  form,
                                  setForm,
                                  index,
                                  subIndex,
                                  {
                                    questionThreshold:
                                      questionThreshold == null
                                        ? null
                                        : Math.max(
                                            1,
                                            Math.trunc(questionThreshold)
                                          ),
                                  }
                                )
                              }
                            />
                            <NumberInput
                              value={subCompetence.standardErrorThreshold}
                              placeholder={`${form.standardErrorThreshold}`}
                              disabled={
                                !competence.enabled || !subCompetence.enabled
                              }
                              onChange={(standardErrorThreshold) =>
                                updateSubCompetence(
                                  form,
                                  setForm,
                                  index,
                                  subIndex,
                                  {
                                    standardErrorThreshold:
                                      standardErrorThreshold == null
                                        ? null
                                        : Math.max(
                                            0.01,
                                            standardErrorThreshold
                                          ),
                                  }
                                )
                              }
                            />
                            <button
                              type="button"
                              className={twMerge(
                                'text-slate-400 hover:text-red-600',
                                !competence.enabled &&
                                  'cursor-not-allowed hover:text-slate-400'
                              )}
                              disabled={!competence.enabled}
                              onClick={() => {
                                const subCompetences =
                                  competence.subCompetences.filter(
                                    (_, ix) => ix !== subIndex
                                  )
                                setForm(
                                  repairElementMappingsForExistingCompetences({
                                    ...form,
                                    competences: form.competences.map(
                                      (entry, ix) =>
                                        ix === index
                                          ? {
                                              ...entry,
                                              subCompetences:
                                                subCompetences.length > 0
                                                  ? subCompetences
                                                  : competence.subCompetences,
                                            }
                                          : entry
                                    ),
                                  })
                                )
                              }}
                            >
                              x
                            </button>
                          </div>
                        )
                      )}
                      <button
                        type="button"
                        className={twMerge(
                          'w-fit rounded-md border border-dashed border-slate-300 px-3 py-1 text-sm text-slate-500',
                          !competence.enabled && 'cursor-not-allowed opacity-50'
                        )}
                        disabled={!competence.enabled}
                        onClick={() =>
                          updateCompetence(form, setForm, index, {
                            subCompetences: [
                              ...competence.subCompetences,
                              defaultSubCompetence(),
                            ],
                          })
                        }
                      >
                        Add sub-competence
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2 lg:border-l lg:border-slate-200 lg:pl-5">
                  <div className="flex items-center justify-between gap-3">
                    <LabelWithTooltip
                      label="Weight"
                      tooltip="Changing one competence redistributes the remaining weight across the other competences so the total stays at 100%."
                    />
                    <div className="w-28">
                      <NumberInput
                        value={Math.round(competence.weight)}
                        suffix="%"
                        disabled={!competence.enabled}
                        onChange={(weight) =>
                          setForm(
                            rebalanceCompetenceWeight(form, index, weight ?? 0)
                          )
                        }
                      />
                    </div>
                  </div>
                  <input
                    className={twMerge(
                      'accent-primary-100 w-full',
                      !competence.enabled && 'cursor-not-allowed opacity-40'
                    )}
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={Math.round(competence.weight)}
                    disabled={!competence.enabled}
                    onChange={(event) =>
                      setForm(
                        rebalanceCompetenceWeight(
                          form,
                          index,
                          Number(event.target.value)
                        )
                      )
                    }
                  />
                </div>

                <div className="grid content-start gap-4 lg:justify-items-start lg:border-l lg:border-slate-200 lg:pl-5">
                  <div className="grid gap-2">
                    <FieldCaption>Status</FieldCaption>
                    <Checkbox
                      checked={competence.enabled}
                      label="Enabled"
                      onCheck={() =>
                        setForm(
                          setCompetenceEnabled(form, index, !competence.enabled)
                        )
                      }
                    />
                  </div>
                  <div className="grid gap-2">
                    <FieldCaption>Delete</FieldCaption>
                    <div className="flex justify-start">
                      <IconButton
                        label="Remove competence"
                        icon={faTrash}
                        disabled={form.competences.length <= 1}
                        onClick={() => {
                          setForm(
                            repairElementMappingsForExistingCompetences(
                              normalizeAfterCompetenceChange({
                                ...form,
                                competences: form.competences.filter(
                                  (_, ix) => ix !== index
                                ),
                              })
                            )
                          )
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="min-w-0 rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <SectionHeading
              title="Item pool"
              tooltip="Single choice, multiple choice, KPRIM, and free-text elements can be selected. Each selected item gets a competence, subcompetence, and manual level; the level maps to b."
            />
            <p className="text-slate-600">
              Select ready elements and map each item to a competence,
              subcompetence, and level.
            </p>
          </div>
          <input
            className="h-10 rounded-md border border-slate-200 px-3"
            value={searchString}
            placeholder="Search elements..."
            onChange={(event) => setSearchString(event.target.value)}
          />
        </div>

        <div className="p-4">
          <div className="min-w-0 overflow-hidden rounded-md border border-slate-200">
            <div className="max-h-[min(42rem,calc(100vh-16rem))] overflow-auto">
              <table className="w-full min-w-[72rem] table-fixed text-sm">
                <thead className="sticky top-0 z-10 bg-slate-50 text-left text-slate-500">
                  <tr>
                    <th className="w-16 p-3">Select</th>
                    <th className="w-[19rem] p-3">Element</th>
                    <th className="w-32 p-3">Type</th>
                    <th className="w-56 p-3">Competence</th>
                    <th className="w-52 p-3">Subcompetence</th>
                    <th className="w-36 p-3">Level</th>
                    <th className="w-28 p-3">a</th>
                    <th className="w-28 p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {candidateLoading && (
                    <tr>
                      <td colSpan={8} className="p-4 text-slate-500">
                        Loading elements...
                      </td>
                    </tr>
                  )}
                  {!candidateLoading && poolRows.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-4 text-slate-500">
                        No matching elements.
                      </td>
                    </tr>
                  )}
                  {!candidateLoading &&
                    poolRows.map((row) => {
                      const mapping = row.mapping
                      const selected = mapping != null
                      const competence = form.competences.find(
                        (entry) => entry.name === mapping?.competenceName
                      )
                      const subCompetence = competence?.subCompetences.find(
                        (entry) => entry.name === mapping?.subCompetenceName
                      )
                      const status = mapping
                        ? itemPoolStatus(mapping, competence, subCompetence)
                        : {
                            label: 'Not selected',
                            className: 'bg-slate-100 text-slate-500',
                          }

                      return (
                        <tr
                          key={row.elementId}
                          className={twMerge(
                            'border-t border-slate-100 align-top',
                            selected && 'bg-primary-20/30'
                          )}
                        >
                          <td className="p-3">
                            <Checkbox
                              checked={selected}
                              onCheck={() => {
                                if (row.candidate) {
                                  setForm(
                                    toggleElementMapping(form, row.candidate)
                                  )
                                  return
                                }

                                setForm({
                                  ...form,
                                  elements: form.elements.filter(
                                    (element) =>
                                      element.elementId !== row.elementId
                                  ),
                                })
                              }}
                            />
                          </td>
                          <td className="p-3">
                            <div className="truncate font-semibold">
                              {row.name}
                            </div>
                            <div className="text-xs text-slate-400">
                              #{row.elementId}
                            </div>
                          </td>
                          <td className="p-3">
                            {row.type ? formatElementType(row.type) : '-'}
                          </td>
                          <td className="p-3">
                            <select
                              className="h-9 w-full rounded border border-slate-200 px-2"
                              value={row.mapping?.competenceName ?? ''}
                              disabled={!selected}
                              onChange={(event) => {
                                const nextCompetence = form.competences.find(
                                  (entry) => entry.name === event.target.value
                                )
                                updateElementByElementId(
                                  form,
                                  setForm,
                                  row.elementId,
                                  {
                                    competenceName: event.target.value,
                                    subCompetenceName:
                                      nextCompetence?.subCompetences.find(
                                        (entry) => entry.enabled
                                      )?.name ??
                                      nextCompetence?.subCompetences[0]?.name ??
                                      '',
                                  }
                                )
                              }}
                            >
                              <option value="" disabled>
                                Select competence
                              </option>
                              {form.competences.map((entry) => (
                                <option key={entry.name} value={entry.name}>
                                  {entry.name}
                                  {!entry.enabled ? ' (disabled)' : ''}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3">
                            <select
                              className="h-9 w-full rounded border border-slate-200 px-2"
                              value={row.mapping?.subCompetenceName ?? ''}
                              disabled={!selected}
                              onChange={(event) =>
                                updateElementByElementId(
                                  form,
                                  setForm,
                                  row.elementId,
                                  { subCompetenceName: event.target.value }
                                )
                              }
                            >
                              <option value="" disabled>
                                Select subcompetence
                              </option>
                              {(competence?.subCompetences ?? []).map(
                                (entry) => (
                                  <option key={entry.name} value={entry.name}>
                                    {entry.name}
                                    {!entry.enabled ? ' (disabled)' : ''}
                                  </option>
                                )
                              )}
                            </select>
                          </td>
                          <td className="p-3">
                            <select
                              className="h-9 w-full rounded border border-slate-200 px-2"
                              value={row.mapping?.levelLabel ?? ''}
                              disabled={!selected}
                              onChange={(event) =>
                                updateElementByElementId(
                                  form,
                                  setForm,
                                  row.elementId,
                                  { levelLabel: event.target.value }
                                )
                              }
                            >
                              {form.levels.map((level) => (
                                <option key={level.label} value={level.label}>
                                  {level.label}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="p-3">
                            <NumberInput
                              value={row.mapping?.discrimination ?? null}
                              placeholder={`${form.discrimination}`}
                              disabled={!selected}
                              onChange={(discrimination) =>
                                updateElementByElementId(
                                  form,
                                  setForm,
                                  row.elementId,
                                  { discrimination }
                                )
                              }
                            />
                          </td>
                          <td className="p-3">
                            <span
                              className={twMerge(
                                'inline-flex rounded-full px-2.5 py-1 text-xs font-bold',
                                status.className
                              )}
                            >
                              {status.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AlgorithmTab({
  form,
  setForm,
}: {
  form: AdaptiveFormValues
  setForm: (form: AdaptiveFormValues) => void
}) {
  const previewItems = useMemo(
    () =>
      form.elements.filter((element) => isElementMappingActive(form, element)),
    [form]
  )
  const [previewElementId, setPreviewElementId] = useState<number | null>(null)
  const selectedPreviewItem =
    previewItems.find((element) => element.elementId === previewElementId) ??
    previewItems[0] ??
    null
  const difficulty = selectedPreviewItem
    ? levelTheta(form, selectedPreviewItem.levelLabel)
    : 0
  const guessing = selectedPreviewItem
    ? guessByType(
        selectedPreviewItem.elementType,
        selectedPreviewItem.choiceCount
      )
    : 0.25
  const discrimination =
    selectedPreviewItem?.discrimination ?? form.discrimination

  useEffect(() => {
    if (previewItems.length === 0) {
      setPreviewElementId(null)
      return
    }

    if (
      !previewItems.some((element) => element.elementId === previewElementId)
    ) {
      setPreviewElementId(previewItems[0]?.elementId ?? null)
    }
  }, [previewElementId, previewItems])

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_30rem]">
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionHeading
              title="Global item parameters"
              tooltip="The global a value is the default discrimination. Individual items can override a, while b comes from the selected level and c comes from item type."
            />
            <p className="text-slate-600">
              Global discrimination is applied unless an item overrides it. b is
              derived from the selected item level; c is derived from type.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <NumberSetting
            label="a - Discrimination"
            detail="Slope - how sharply items separate students"
            tooltip="Higher a values make the item more informative around its difficulty b. Use the global value as the default and override only known exceptions."
            value={form.discrimination}
            min={0.1}
            step={0.1}
            onChange={(discrimination) => setForm({ ...form, discrimination })}
          />
          <ReadOnlySetting
            label="b - Difficulty"
            value="Per item level"
            detail="Lecturer selects a level for every selected item."
            tooltip="The selected item level maps to a numeric b value on the theta scale. Tags are never used to infer b."
          />
          <ReadOnlySetting
            label="c - Guessing"
            value="Derived"
            detail="SC, MC, KPRIM, and free-text use type-specific defaults."
            tooltip="c is deterministic: single choice uses inverse choice count, multiple choice uses inverse non-empty checkbox patterns, KPRIM uses inverse true/false patterns, and free text is near zero."
          />
        </div>
      </div>

      <SidePanel
        title="Item characteristic curve"
        tooltip="The curve previews P(correct) and information for the selected item using its current a, level-derived b, and type-derived c."
      >
        <div className="mb-4">
          <FieldCaption>Preview item</FieldCaption>
          <select
            className="h-10 w-full rounded-md border border-slate-200 px-3 font-semibold"
            value={selectedPreviewItem?.elementId ?? ''}
            disabled={previewItems.length === 0}
            onChange={(event) =>
              setPreviewElementId(
                event.target.value === '' ? null : Number(event.target.value)
              )
            }
          >
            {previewItems.length === 0 && (
              <option value="">No selected items</option>
            )}
            {previewItems.map((element) => (
              <option key={element.elementId} value={element.elementId}>
                #{element.elementId} · {element.levelLabel} ·{' '}
                {formatElementType(element.elementType ?? ElementType.Sc)}
              </option>
            ))}
          </select>
        </div>
        <ItemCharacteristicCurve
          discrimination={discrimination}
          difficulty={difficulty}
          guessing={guessing}
          thetaMin={form.thetaMin - 1}
          thetaMax={form.thetaMax + 1}
        />
        <p className="text-center text-sm text-slate-500">
          Change the item, level, or a override to see the curve respond.
        </p>
      </SidePanel>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm xl:col-span-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <SectionHeading
              title="Testing options"
              tooltip="This option is for local testing only. When enabled, students see the correct solution during the adaptive attempt."
            />
            <p className="text-slate-600">
              Make answer solutions visible in the student attempt screen.
            </p>
          </div>
          <span className="text-primary-100 bg-primary-20 inline-flex h-10 w-10 items-center justify-center rounded-md">
            <FontAwesomeIcon icon={faEye} />
          </span>
        </div>
        <div className="mt-4">
          <Checkbox
            checked={form.showSolutions}
            label="Show solution during attempts"
            onCheck={() =>
              setForm({ ...form, showSolutions: !form.showSolutions })
            }
          />
        </div>
      </div>
    </div>
  )
}

function StandingLevelsTab({
  form,
  setForm,
}: {
  form: AdaptiveFormValues
  setForm: (form: AdaptiveFormValues) => void
}) {
  return (
    <div className="grid gap-4">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b p-4">
          <div>
            <SectionHeading
              title="Standing levels"
              tooltip="Levels are ordered from low to high. Their order defines the standing bands and the numeric theta centers used for item difficulty b."
            />
            <p className="text-slate-600">
              Ability maps onto these ordered bands from low to high.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  levels: [
                    { label: 'A1' },
                    { label: 'A2' },
                    { label: 'B1' },
                    { label: 'B2' },
                    { label: 'C1' },
                    { label: 'C2' },
                  ],
                })
              }
            >
              <Button.Label>Use CEFR preset</Button.Label>
            </Button>
            <Button
              type="button"
              onClick={() =>
                setForm({
                  ...form,
                  levels: [...form.levels, { label: 'New level' }],
                })
              }
            >
              <Button.Icon icon={faPlus} />
              <Button.Label>Add level</Button.Label>
            </Button>
          </div>
        </div>
        <div className="hidden grid-cols-[9rem_minmax(0,1fr)_9rem_2.5rem] gap-3 border-b bg-slate-50 px-4 py-2 text-xs font-bold uppercase text-slate-400 md:grid">
          <div>Badge</div>
          <div>Label</div>
          <div className="text-right">Theta center</div>
          <div />
        </div>
        <div className="divide-y">
          {form.levels.map((level, index) => (
            <div
              key={`standing-level-${index}`}
              className="grid gap-3 p-4 md:grid-cols-[9rem_minmax(0,1fr)_9rem_2.5rem] md:items-center"
            >
              <div className="min-w-0">
                <LevelBadge label={level.label} index={index} />
              </div>
              <TextInput
                value={level.label}
                onChange={(label) => {
                  const levels = [...form.levels]
                  levels[index] = { label }
                  setForm({ ...form, levels })
                }}
              />
              <div className="text-right font-mono text-slate-500">
                {formatTheta(levelThetaByIndex(form, index))}
              </div>
              <IconButton
                label="Remove level"
                icon={faTrash}
                disabled={form.levels.length <= 2}
                onClick={() =>
                  setForm({
                    ...form,
                    levels: form.levels.filter((_, ix) => ix !== index),
                  })
                }
              />
            </div>
          ))}
        </div>
      </div>
      <CompletionMessagesEditor form={form} setForm={setForm} />
    </div>
  )
}

function CompletionMessagesEditor({
  form,
  setForm,
}: {
  form: AdaptiveFormValues
  setForm: (form: AdaptiveFormValues) => void
}) {
  const intervalMessageIndexes = form.resultMessages.reduce<number[]>(
    (indexes, message, index) =>
      isIntervalResultMessage(message) ? [...indexes, index] : indexes,
    []
  )
  const intervalErrors = validateResultMessageIntervals(form)
  const nextIntervalMessage = buildAvailableIntervalMessage(form)

  const updateMessage = (
    index: number,
    patch: Partial<ResultMessageFormValue>
  ) => {
    const resultMessages = [...form.resultMessages]
    const currentMessage = resultMessages[index]
    if (!currentMessage) return

    resultMessages[index] = sanitizeIntervalMessage(form, currentMessage, patch)
    setForm({ ...form, resultMessages })
  }

  const addIntervalMessage = () => {
    const intervalMessage = buildAvailableIntervalMessage(form)
    if (!intervalMessage) return

    const fallbackIndex = form.resultMessages.findIndex(
      (message) => message.isFallback
    )
    const resultMessages = [...form.resultMessages]
    resultMessages.splice(
      fallbackIndex >= 0 ? fallbackIndex : resultMessages.length,
      0,
      intervalMessage
    )
    setForm({ ...form, resultMessages })
  }

  const removeIntervalMessage = (index: number) => {
    setForm({
      ...form,
      resultMessages: form.resultMessages.filter((_, ix) => ix !== index),
    })
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <SectionHeading
            title="Completion messages"
            tooltip="Optional interval messages are appended to the completed standing only when the final theta falls inside the configured range."
          />
          <p className="text-slate-600">
            Add optional end-of-test notes for specific theta intervals.
          </p>
        </div>
        <Button
          type="button"
          disabled={!nextIntervalMessage}
          onClick={addIntervalMessage}
        >
          <Button.Icon icon={faPlus} />
          <Button.Label>Add interval message</Button.Label>
        </Button>
      </div>

      {intervalErrors.length > 0 && (
        <div className="mx-4 mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          {intervalErrors[0]}
        </div>
      )}

      <div className="divide-y divide-slate-200">
        {intervalMessageIndexes.length === 0 && (
          <div className="p-4 text-sm text-slate-500">
            No optional interval messages configured.
          </div>
        )}
        {intervalMessageIndexes.map((messageIndex) => {
          const message = form.resultMessages[messageIndex]

          return (
            <div
              key={`interval-message-${messageIndex}`}
              className="grid gap-3 p-4 md:grid-cols-[10rem_10rem_minmax(0,1fr)_2.5rem] md:items-start"
            >
              <NumberInput
                value={message.minTheta}
                placeholder="Min"
                onChange={(minTheta) =>
                  updateMessage(messageIndex, { minTheta })
                }
              />
              <NumberInput
                value={message.maxTheta}
                placeholder="Max"
                onChange={(maxTheta) =>
                  updateMessage(messageIndex, { maxTheta })
                }
              />
              <textarea
                className="min-h-20 w-full rounded-md border border-slate-200 px-3 py-2 font-semibold"
                value={message.message}
                onChange={(event) =>
                  updateMessage(messageIndex, { message: event.target.value })
                }
              />
              <IconButton
                label="Remove interval message"
                icon={faTrash}
                onClick={() => removeIntervalMessage(messageIndex)}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ResultsTab({
  form,
  results,
  resultTab,
  setResultTab,
  overviewAttemptMode,
  setOverviewAttemptMode,
  overviewChartMode,
  setOverviewChartMode,
}: {
  form: AdaptiveFormValues
  results: Results | null
  resultTab: ResultTab
  setResultTab: (tab: ResultTab) => void
  overviewAttemptMode: AdaptiveOverviewAttemptMode
  setOverviewAttemptMode: (mode: AdaptiveOverviewAttemptMode) => void
  overviewChartMode: OverviewChartMode
  setOverviewChartMode: (mode: OverviewChartMode) => void
}) {
  const [showOverviewSubCompetences, setShowOverviewSubCompetences] =
    useState(false)
  if (!results) {
    return (
      <UserNotification
        type="info"
        message="Save an adaptive assessment before viewing results."
      />
    )
  }

  const overviewThetaAttempts = selectOverviewAttemptRows(
    results.students,
    overviewAttemptMode
  )
  const hasOverviewSubCompetences = results.competences.some(
    (competence) => (competence.subCompetences ?? []).length > 0
  )

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
          {RESULT_TABS.map((entry) => (
            <button
              key={entry}
              type="button"
              className={twMerge(
                'rounded-md px-4 py-2 font-semibold text-slate-500',
                resultTab === entry && 'bg-white text-slate-900 shadow-sm'
              )}
              onClick={() => setResultTab(entry)}
            >
              {entry}
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-slate-200 px-4 py-2 font-semibold text-slate-600">
          {results.completedCount} of {results.participantCount} completed
        </div>
      </div>

      {resultTab === 'Overview' && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div>
              <div className="font-bold text-slate-900">
                Attempts included in overview
              </div>
              <div className="text-sm text-slate-500">
                Pick one completed attempt per student for cohort metrics.
              </div>
            </div>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {[
                {
                  mode: AdaptiveOverviewAttemptMode.Best,
                  label: 'Best attempts',
                },
                {
                  mode: AdaptiveOverviewAttemptMode.Latest,
                  label: 'Latest attempts',
                },
              ].map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  className={twMerge(
                    'rounded-md px-4 py-2 font-semibold text-slate-500',
                    overviewAttemptMode === option.mode &&
                      'bg-white text-slate-900 shadow-sm'
                  )}
                  onClick={() => setOverviewAttemptMode(option.mode)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <AdaptiveMetricCard
              label="Class mean ability"
              value={formatTheta(results.classMeanTheta)}
              icon={<FontAwesomeIcon icon={faChartLine} />}
              detail={
                <LevelBadge
                  label={levelForTheta(form, results.classMeanTheta)}
                  index={levelIndex(
                    form,
                    levelForTheta(form, results.classMeanTheta)
                  )}
                />
              }
            />
            <AdaptiveMetricCard
              label="Mean precision (SE)"
              value={results.meanStandardError?.toFixed(2) ?? '-'}
              icon={<FontAwesomeIcon icon={faBullseye} />}
              accentClassName="bg-uzh-turqoise-20"
            />
            <AdaptiveMetricCard
              label="Avg. items per student"
              value={results.averageAnsweredQuestions?.toFixed(1) ?? '-'}
              icon={<FontAwesomeIcon icon={faClipboardCheck} />}
              accentClassName="bg-secondary-20"
            />
            <AdaptiveMetricCard
              label="Completion"
              value={`${Math.round(results.completionRate * 100)}%`}
              icon={<FontAwesomeIcon icon={faPercent} />}
              accentClassName="bg-uzh-darkgreen-20"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div>
              <div className="font-bold text-slate-900">Ability chart</div>
              <div className="text-sm text-slate-500">
                Switch between exact anonymous values and the cohort histogram.
              </div>
            </div>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {[
                {
                  mode: 'individualPositions' as const,
                  label: 'Individual positions',
                },
                {
                  mode: 'cohortDistribution' as const,
                  label: 'Cohort distribution',
                },
              ].map((option) => (
                <button
                  key={option.mode}
                  type="button"
                  className={twMerge(
                    'rounded-md px-4 py-2 font-semibold text-slate-500',
                    overviewChartMode === option.mode &&
                      'bg-white text-slate-900 shadow-sm'
                  )}
                  onClick={() => setOverviewChartMode(option.mode)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_28rem]">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              {overviewChartMode === 'individualPositions' ? (
                <>
                  <SectionHeading
                    title="Individual ability positions"
                    tooltip="Shows exact theta values for the selected completed attempts without student names."
                  />
                  <p className="mb-4 text-slate-600">
                    Anonymous exact theta values from the currently selected{' '}
                    {overviewAttemptMode === AdaptiveOverviewAttemptMode.Best
                      ? 'best'
                      : 'latest'}{' '}
                    attempt view.
                  </p>
                  <IndividualAbilityPositions
                    attempts={overviewThetaAttempts}
                    levels={form.levels}
                    thetaMin={form.thetaMin}
                    thetaMax={form.thetaMax}
                  />
                </>
              ) : (
                <>
                  <SectionHeading
                    title="Cohort ability distribution"
                    tooltip="Uses one completed attempt per participant. The selector above switches between the student's best completed attempt and latest completed attempt."
                  />
                  <p className="mb-4 text-slate-600">
                    Histogram of estimated theta across selected completed
                    student attempts.
                  </p>
                  <AbilityHistogram bins={results.distribution} />
                </>
              )}
            </div>
            <SidePanel
              title="Cohort by competence"
              tooltip="Aggregates the selected completed attempts by competence with inverse-variance weighting."
            >
              {hasOverviewSubCompetences && (
                <div className="mb-4 flex justify-end">
                  <Button
                    type="button"
                    onClick={() =>
                      setShowOverviewSubCompetences(
                        (currentValue) => !currentValue
                      )
                    }
                  >
                    <Button.Icon
                      icon={
                        showOverviewSubCompetences
                          ? faChevronDown
                          : faChevronRight
                      }
                    />
                    <Button.Label>
                      {showOverviewSubCompetences
                        ? 'Hide subcompetences'
                        : 'Show subcompetences'}
                    </Button.Label>
                  </Button>
                </div>
              )}
              <CompetenceThetaOverview
                competences={results.competences.map((competence) => ({
                  ...competence,
                  theta: competence.theta ?? null,
                }))}
                thetaMin={form.thetaMin}
                thetaMax={form.thetaMax}
                levels={form.levels}
                showSubCompetences={showOverviewSubCompetences}
              />
            </SidePanel>
          </div>
        </>
      )}

      {resultTab === 'Students' && (
        <StudentAttemptsPreview
          attempts={results.students}
          levels={form.levels}
          thetaMin={form.thetaMin}
          thetaMax={form.thetaMax}
        />
      )}

      {resultTab === 'Items' && (
        <ItemResultsView items={results.items} levels={form.levels} />
      )}
    </div>
  )
}

function selectOverviewAttemptRows(
  attempts: StudentAttemptResult[],
  mode: AdaptiveOverviewAttemptMode
) {
  const completedAttempts = attempts.filter(
    (attempt) => attempt.attemptId && attempt.completedAt
  )

  return groupStudentAttempts(completedAttempts).map((group) =>
    mode === AdaptiveOverviewAttemptMode.Best
      ? group.bestAttempt
      : (group.attempts.find((attempt) => attempt.isLatestAttempt) ??
        group.latestAttempt)
  )
}

function IndividualAbilityPositions({
  attempts,
  levels,
  thetaMin,
  thetaMax,
}: {
  attempts: StudentAttemptResult[]
  levels: LevelFormValue[]
  thetaMin: number
  thetaMax: number
}) {
  const midpoint = (thetaMin + thetaMax) / 2
  const ticks = [thetaMin, midpoint, thetaMax]
  const sortedAttempts = [...attempts].sort((a, b) => b.theta - a.theta)

  if (attempts.length === 0) {
    return (
      <div className="rounded-lg bg-slate-50 p-5 text-sm text-slate-500">
        No completed attempts are available for this view yet.
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-slate-50 p-4">
      <div className="hidden grid-cols-[5rem_minmax(10rem,1fr)_5rem_9rem] gap-3 px-2 text-xs font-bold uppercase text-slate-400 sm:grid">
        <div>Anon.</div>
        <div className="relative h-8">
          <div className="absolute left-0 right-0 top-3 border-t border-slate-300" />
          {ticks.map((tick) => (
            <div
              key={`theta-axis-${tick}`}
              className="absolute top-0 h-5 border-l border-slate-300"
              style={{ left: `${thetaToPercent(tick, thetaMin, thetaMax)}%` }}
            >
              <span className="absolute top-4 -translate-x-1/2 whitespace-nowrap font-mono">
                {formatTheta(tick)}
              </span>
            </div>
          ))}
        </div>
        <div className="text-right">Theta</div>
        <div>Level</div>
      </div>

      <div className="mt-3 max-h-96 overflow-auto rounded-lg border border-slate-200 bg-white">
        {sortedAttempts.map((attempt, index) => {
          const levelIndex = levelIndexFromLevels(levels, attempt.levelLabel)
          const color = getLevelColor(attempt.levelLabel, levelIndex)
          const left = thetaToPercent(attempt.theta, thetaMin, thetaMax)

          return (
            <div
              key={`${attempt.attemptId}-${index}`}
              className="grid gap-3 border-b border-slate-100 px-3 py-2 last:border-b-0 sm:grid-cols-[5rem_minmax(10rem,1fr)_5rem_9rem] sm:items-center"
            >
              <div className="text-xs font-bold uppercase text-slate-500">
                P{String(index + 1).padStart(3, '0')}
              </div>
              <div className="relative h-7 min-w-0">
                <div className="absolute left-0 right-0 top-1/2 border-t border-slate-200" />
                <div
                  className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-sm ring-1 ring-slate-300"
                  style={{
                    backgroundColor: color.fill,
                    left: `${left}%`,
                  }}
                  title={`theta ${formatTheta(attempt.theta)} · attempt #${attempt.attemptNumber}`}
                />
              </div>
              <div className="font-mono font-bold text-slate-900 sm:text-right">
                {formatTheta(attempt.theta)}
              </div>
              <LevelBadge label={attempt.levelLabel} index={levelIndex} />
            </div>
          )
        })}
      </div>
      <div className="mt-3 text-xs font-semibold text-slate-500">
        {attempts.length} anonymous completed{' '}
        {attempts.length === 1 ? 'attempt' : 'attempts'}
      </div>
    </div>
  )
}

function ItemResultsView({
  items,
  levels,
}: {
  items: ItemResult[]
  levels: LevelFormValue[]
}) {
  const answeredItems = items.filter((item) => item.responseCount > 0)
  const totalResponses = items.reduce(
    (sum, item) => sum + item.responseCount,
    0
  )
  const averageAccuracy =
    answeredItems.length > 0
      ? answeredItems.reduce((sum, item) => sum + (item.accuracy ?? 0), 0) /
        answeredItems.length
      : null
  const mostSeenItem = [...items].sort(
    (a, b) => b.responseCount - a.responseCount
  )[0]
  const reviewItem = [...answeredItems]
    .filter((item) => item.accuracy != null)
    .sort((a, b) => Number(a.accuracy) - Number(b.accuracy))[0]

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <AdaptiveMetricCard
          label="Items in pool"
          value={items.length}
          detail={`${answeredItems.length} have responses`}
          icon={<FontAwesomeIcon icon={faLayerGroup} />}
        />
        <AdaptiveMetricCard
          label="Total responses"
          value={totalResponses}
          detail={mostSeenItem ? `Most seen: #${mostSeenItem.elementId}` : '-'}
          icon={<FontAwesomeIcon icon={faClipboardCheck} />}
          accentClassName="bg-uzh-turqoise-20"
        />
        <AdaptiveMetricCard
          label="Mean accuracy"
          value={
            averageAccuracy == null
              ? '-'
              : `${Math.round(averageAccuracy * 100)}%`
          }
          detail={reviewItem ? `Lowest: #${reviewItem.elementId}` : '-'}
          icon={<FontAwesomeIcon icon={faBullseye} />}
          accentClassName="bg-secondary-20"
        />
      </div>

      <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <SectionHeading
          title="Item analytics"
          tooltip="Sortable item-level analytics. Export keeps the raw item parameters."
        />
        <div className="mt-4 max-w-full overflow-x-auto pb-2">
          <DataTable
            isPaginated
            initialSorting={[{ id: 'responseCount', desc: true }]}
            csvFilename="adaptive-learning-items"
            className={{
              table:
                'min-w-[56rem] overflow-hidden rounded-lg border border-slate-200',
              tableHeader: 'bg-slate-50',
              tableRow: 'hover:bg-slate-50',
              tableCell: 'align-middle',
            }}
            columns={[
              {
                accessorKey: 'elementName',
                header: 'Item',
                cell: ({ row }: any) => {
                  const item = row.original as ItemResult
                  return (
                    <div className="min-w-0 max-w-[24rem]">
                      <div className="truncate font-semibold text-slate-900">
                        {item.elementName}
                      </div>
                      <div className="text-xs text-slate-500">
                        #{item.elementId} · {item.subCompetenceName}
                      </div>
                    </div>
                  )
                },
              },
              { accessorKey: 'competenceName', header: 'Competence' },
              {
                accessorKey: 'levelLabel',
                header: 'Level',
                cell: ({ row }: any) => (
                  <LevelBadge
                    label={row.getValue('levelLabel')}
                    index={levelIndexFromLevels(
                      levels,
                      row.getValue('levelLabel')
                    )}
                  />
                ),
              },
              {
                accessorKey: 'difficulty',
                header: 'IRT',
                cell: ({ row }: any) => (
                  <IrtParameterSummary item={row.original as ItemResult} />
                ),
              },
              {
                accessorKey: 'responseCount',
                header: 'Responses',
                cell: ({ row }: any) => (
                  <ResponseSummary item={row.original as ItemResult} />
                ),
              },
              {
                accessorKey: 'accuracy',
                header: 'Accuracy',
                cell: ({ row }: any) => (
                  <AccuracyMeter accuracy={row.getValue('accuracy')} />
                ),
              },
              {
                accessorKey: 'discrimination',
                header: 'a',
                csvOnly: true,
              },
              {
                accessorKey: 'guessing',
                header: 'c',
                csvOnly: true,
              },
            ]}
            data={items}
          />
        </div>
      </div>
    </div>
  )
}

function IrtParameterSummary({ item }: { item: ItemResult }) {
  return (
    <div className="grid min-w-[10rem] grid-cols-3 gap-1">
      <IrtParameterBadge
        label="b"
        value={formatTheta(item.difficulty)}
        className="bg-primary-20 text-primary-100"
      />
      <IrtParameterBadge
        label="a"
        value={item.discrimination.toFixed(2)}
        className="bg-uzh-turqoise-20 text-uzh-turqoise-100"
      />
      <IrtParameterBadge
        label="c"
        value={item.guessing.toFixed(2)}
        className="bg-slate-100 text-slate-600"
      />
    </div>
  )
}

function IrtParameterBadge({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className: string
}) {
  return (
    <div className={twMerge('rounded-md px-2 py-1 text-center', className)}>
      <div className="text-[0.65rem] font-bold uppercase tracking-wide opacity-70">
        {label}
      </div>
      <div className="font-mono text-xs font-bold">{value}</div>
    </div>
  )
}

function ResponseSummary({ item }: { item: ItemResult }) {
  const correctPercent =
    item.responseCount > 0 ? (item.correctCount / item.responseCount) * 100 : 0
  const incorrectCount = item.responseCount - item.correctCount

  if (item.responseCount === 0) {
    return (
      <div className="min-w-[11rem] rounded-md bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-400">
        No responses yet
      </div>
    )
  }

  return (
    <div className="min-w-[12rem]">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-bold text-slate-900">
          {item.responseCount} total
        </span>
        <span className="text-xs font-semibold text-slate-500">
          {item.correctCount} correct · {incorrectCount} wrong
        </span>
      </div>
      <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="bg-uzh-darkgreen-80 h-full"
          style={{ width: `${correctPercent}%` }}
        />
        <div
          className="h-full bg-red-300"
          style={{ width: `${100 - correctPercent}%` }}
        />
      </div>
    </div>
  )
}

function AccuracyMeter({ accuracy }: { accuracy?: number | null }) {
  const percent = accuracy == null ? null : Math.round(accuracy * 100)

  return (
    <div className="min-w-[9rem]">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-semibold text-slate-700">Accuracy</span>
        <span className="font-mono font-bold text-slate-900">
          {percent == null ? '-' : `${percent}%`}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={twMerge(
            'h-full rounded-full',
            percent == null
              ? 'bg-slate-300'
              : percent >= 75
                ? 'bg-uzh-darkgreen-80'
                : percent >= 50
                  ? 'bg-uzh-turqoise-80'
                  : 'bg-secondary-100'
          )}
          style={{ width: `${percent ?? 0}%` }}
        />
      </div>
    </div>
  )
}

function CompetenceThetaOverview({
  competences,
  thetaMin,
  thetaMax,
  levels,
  showSubCompetences,
}: {
  competences: CompetenceWithSubCompetences[]
  thetaMin: number
  thetaMax: number
  levels: LevelFormValue[]
  showSubCompetences: boolean
}) {
  return (
    <div className="grid gap-4">
      {competences.map((competence, index) => {
        const color =
          ADAPTIVE_COMPETENCE_COLORS[index % ADAPTIVE_COMPETENCE_COLORS.length]
        const competencePercent =
          competence.theta == null
            ? 0
            : thetaToPercent(competence.theta, thetaMin, thetaMax)
        const competenceLevelIndex = levelIndexFromLevels(
          levels,
          competence.levelLabel
        )

        return (
          <div key={competence.competenceId} className="grid gap-3">
            <div className="grid gap-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 font-semibold text-slate-700">
                  {competence.competenceName}
                </div>
                <div className="flex flex-none items-center gap-2">
                  <span className="font-mono font-semibold" style={{ color }}>
                    {formatTheta(competence.theta)}
                  </span>
                  <LevelBadge
                    label={competence.levelLabel}
                    index={competenceLevelIndex}
                  />
                </div>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${competencePercent}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
            {showSubCompetences && (
              <div className="ml-3 grid gap-2 border-l border-slate-200 pl-3">
                {(competence.subCompetences ?? []).map((subCompetence) => (
                  <SubCompetenceThetaRow
                    key={subCompetence.subCompetenceId}
                    subCompetence={subCompetence}
                    levels={levels}
                    thetaMin={thetaMin}
                    thetaMax={thetaMax}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function SubCompetenceThetaRow({
  subCompetence,
  levels,
  thetaMin,
  thetaMax,
}: {
  subCompetence: SubCompetenceEstimate
  levels: LevelFormValue[]
  thetaMin: number
  thetaMax: number
}) {
  const percent =
    subCompetence.theta == null
      ? 0
      : thetaToPercent(subCompetence.theta, thetaMin, thetaMax)
  const levelIndex = levelIndexFromLevels(levels, subCompetence.levelLabel)

  return (
    <div className="grid gap-1.5 rounded-md bg-slate-50 p-2">
      <div className="flex items-start justify-between gap-2 text-sm">
        <div className="min-w-0 truncate font-semibold text-slate-700">
          {subCompetence.subCompetenceName}
        </div>
        <div className="flex flex-none items-center gap-2">
          <span className="font-mono font-semibold text-slate-600">
            {formatTheta(subCompetence.theta)}
          </span>
          <LevelBadge label={subCompetence.levelLabel} index={levelIndex} />
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white">
        <div
          className="bg-primary-80 h-full rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  )
}

function StudentAttemptsPreview({
  attempts,
  levels,
  thetaMin,
  thetaMax,
}: {
  attempts: StudentAttemptResult[]
  levels: LevelFormValue[]
  thetaMin: number
  thetaMax: number
}) {
  const attemptedRows = attempts.filter((attempt) => attempt.attemptId)
  const notStartedRows = attempts.filter((attempt) => !attempt.attemptId)
  const latestRows = attemptedRows.filter((attempt) => attempt.isLatestAttempt)
  const attemptGroups = groupStudentAttempts(attemptedRows)
  const hasStudentSubCompetences = attemptedRows.some((attempt) =>
    attempt.competences.some(
      (competence) => (competence.subCompetences ?? []).length > 0
    )
  )
  const [expandedParticipantIds, setExpandedParticipantIds] = useState<
    Set<string>
  >(() => new Set())
  const [showStudentSubCompetences, setShowStudentSubCompetences] =
    useState(false)
  const allGroupsExpanded =
    attemptGroups.length > 0 &&
    attemptGroups.every((group) =>
      expandedParticipantIds.has(group.participantId)
    )

  const toggleGroup = (participantId: string) => {
    setExpandedParticipantIds((current) => {
      const next = new Set(current)
      if (next.has(participantId)) {
        next.delete(participantId)
      } else {
        next.add(participantId)
      }
      return next
    })
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-4 md:grid-cols-3">
        <AdaptiveMetricCard
          label="Students with attempts"
          value={latestRows.length}
          detail={`${notStartedRows.length} not started`}
          icon={<FontAwesomeIcon icon={faUsers} />}
        />
        <AdaptiveMetricCard
          label="Attempt records"
          value={attemptedRows.length}
          detail="Retakes are shown separately"
          icon={<FontAwesomeIcon icon={faLayerGroup} />}
          accentClassName="bg-uzh-turqoise-20"
        />
        <AdaptiveMetricCard
          label="Latest completed"
          value={
            latestRows.filter((attempt) => attempt.completedAt != null).length
          }
          detail="Used for overview metrics"
          icon={<FontAwesomeIcon icon={faClipboardCheck} />}
          accentClassName="bg-uzh-darkgreen-20"
        />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 p-4">
          <div>
            <SectionHeading
              title="Student attempts"
              tooltip="Each student is collapsed by default. Retakes appear under the same student; the best and latest attempts are marked separately."
            />
            <p className="text-sm text-slate-500">
              Review individual attempts, precision, and competence-level
              estimates.
            </p>
          </div>
          {attemptGroups.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {hasStudentSubCompetences && (
                <Button
                  type="button"
                  onClick={() =>
                    setShowStudentSubCompetences(
                      (currentValue) => !currentValue
                    )
                  }
                >
                  <Button.Icon
                    icon={
                      showStudentSubCompetences ? faChevronDown : faChevronRight
                    }
                  />
                  <Button.Label>
                    {showStudentSubCompetences
                      ? 'Hide subcompetences'
                      : 'Show subcompetences'}
                  </Button.Label>
                </Button>
              )}
              <Button
                type="button"
                onClick={() =>
                  setExpandedParticipantIds(
                    new Set(attemptGroups.map((group) => group.participantId))
                  )
                }
              >
                <Button.Label>Expand all</Button.Label>
              </Button>
              <Button
                type="button"
                disabled={
                  !allGroupsExpanded && expandedParticipantIds.size === 0
                }
                onClick={() => setExpandedParticipantIds(new Set())}
              >
                <Button.Label>Collapse all</Button.Label>
              </Button>
            </div>
          )}
        </div>
        <div className="grid gap-3 p-4">
          {attemptedRows.length === 0 && (
            <div className="rounded-md bg-slate-50 p-4 text-slate-500">
              No student has started an adaptive attempt yet.
            </div>
          )}
          {attemptGroups.map((group) => (
            <StudentAttemptGroup
              key={group.participantId}
              group={group}
              levels={levels}
              thetaMin={thetaMin}
              thetaMax={thetaMax}
              expanded={expandedParticipantIds.has(group.participantId)}
              showSubCompetences={showStudentSubCompetences}
              onToggle={() => toggleGroup(group.participantId)}
            />
          ))}
        </div>
        {notStartedRows.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Not started:{' '}
            {notStartedRows
              .slice(0, 8)
              .map((attempt) => attempt.participantUsername)
              .join(', ')}
            {notStartedRows.length > 8
              ? ` and ${notStartedRows.length - 8} more`
              : ''}
          </div>
        )}
      </div>
    </div>
  )
}

function StudentAttemptGroup({
  group,
  levels,
  thetaMin,
  thetaMax,
  expanded,
  showSubCompetences,
  onToggle,
}: {
  group: ReturnType<typeof groupStudentAttempts>[number]
  levels: LevelFormValue[]
  thetaMin: number
  thetaMax: number
  expanded: boolean
  showSubCompetences: boolean
  onToggle: () => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        className="flex w-full flex-wrap items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-3 text-left hover:bg-slate-100"
        onClick={onToggle}
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="bg-primary-20 text-primary-100 flex h-11 w-11 flex-none items-center justify-center rounded-full font-bold">
            {initials(group.participantUsername)}
          </div>
          <div className="min-w-0">
            <div className="truncate text-lg font-bold text-slate-900">
              {group.participantUsername}
            </div>
            <div className="text-sm text-slate-500">
              {group.attempts.length}{' '}
              {group.attempts.length === 1 ? 'attempt' : 'attempts'}
              <span className="px-2 text-slate-300">·</span>
              latest {formatTheta(group.latestAttempt.theta)}
              <span className="px-2 text-slate-300">·</span>
              best {formatTheta(group.bestAttempt.theta)}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <LevelBadge
            label={group.latestAttempt.levelLabel}
            index={levelIndexFromLevels(levels, group.latestAttempt.levelLabel)}
          />
          <span className="text-slate-500">
            <FontAwesomeIcon icon={expanded ? faChevronDown : faChevronRight} />
          </span>
        </div>
      </button>

      {expanded && (
        <div className="grid gap-3 border-t border-slate-100 p-4">
          {group.attempts.map((attempt) => (
            <div
              key={attempt.attemptId ?? attempt.participantId}
              className={twMerge(
                'grid gap-4 rounded-lg border border-slate-200 p-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]',
                attempt.isLatestAttempt && 'border-primary-40 bg-slate-50'
              )}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 font-bold text-slate-900">
                      <span>Attempt #{attempt.attemptNumber}</span>
                      {attempt.attemptId === group.bestAttempt.attemptId && (
                        <span className="bg-uzh-darkgreen-20 text-uzh-darkgreen-100 rounded-full px-2 py-0.5 text-xs font-bold uppercase">
                          Best
                        </span>
                      )}
                      {attempt.isLatestAttempt && (
                        <span className="bg-primary-20 text-primary-100 rounded-full px-2 py-0.5 text-xs font-bold uppercase">
                          Latest
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-500">
                      {attempt.completedAt
                        ? `Completed ${formatDateTime(attempt.completedAt)}`
                        : `Started ${formatDateTime(attempt.startedAt)}`}
                    </div>
                  </div>
                  <LevelBadge
                    label={attempt.levelLabel}
                    index={levelIndexFromLevels(levels, attempt.levelLabel)}
                  />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <AttemptMetric
                    label="theta"
                    value={formatTheta(attempt.theta)}
                  />
                  <AttemptMetric
                    label="SE"
                    value={attempt.standardError.toFixed(2)}
                  />
                  <AttemptMetric
                    label="Items"
                    value={`${attempt.answeredQuestions}`}
                  />
                  <AttemptMetric
                    label="Status"
                    value={formatAttemptStatus(attempt.status)}
                  />
                </div>

                <div className="mt-3 text-sm text-slate-500">
                  Started {formatDateTime(attempt.startedAt)}
                  {attempt.completedAt
                    ? ` - completed ${formatDateTime(attempt.completedAt)}`
                    : ''}
                </div>
              </div>

              <div className="grid gap-4">
                <CompetenceThetaOverview
                  competences={attempt.competences.map((competence) => ({
                    ...competence,
                    theta: competence.theta ?? null,
                  }))}
                  thetaMin={thetaMin}
                  thetaMax={thetaMax}
                  levels={levels}
                  showSubCompetences={showSubCompetences}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function groupStudentAttempts(attempts: StudentAttemptResult[]) {
  const groups = new Map<
    string,
    {
      participantId: string
      participantUsername: string
      attempts: StudentAttemptResult[]
      latestAttempt: StudentAttemptResult
      bestAttempt: StudentAttemptResult
    }
  >()

  for (const attempt of attempts) {
    const existing = groups.get(attempt.participantId)
    if (existing) {
      existing.attempts.push(attempt)
      if (attempt.isLatestAttempt) {
        existing.latestAttempt = attempt
      }
    } else {
      groups.set(attempt.participantId, {
        participantId: attempt.participantId,
        participantUsername: attempt.participantUsername,
        attempts: [attempt],
        latestAttempt: attempt,
        bestAttempt: attempt,
      })
    }
  }

  return Array.from(groups.values())
    .map((group) => {
      const sortedAttempts = group.attempts
        .slice()
        .sort((a, b) => b.attemptNumber - a.attemptNumber)

      return {
        ...group,
        attempts: sortedAttempts,
        latestAttempt:
          sortedAttempts.find((attempt) => attempt.isLatestAttempt) ??
          group.latestAttempt,
        bestAttempt: pickBestAttempt(sortedAttempts),
      }
    })
    .sort((a, b) => a.participantUsername.localeCompare(b.participantUsername))
}

function pickBestAttempt(attempts: StudentAttemptResult[]) {
  const completedAttempts = attempts.filter((attempt) => attempt.completedAt)
  const candidates = completedAttempts.length > 0 ? completedAttempts : attempts

  return candidates.reduce((best, attempt) =>
    attempt.theta > best.theta ? attempt : best
  )
}

function AttemptMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-2">
      <div className="text-xs font-bold uppercase text-slate-400">{label}</div>
      <div className="font-mono font-bold text-slate-800">{value}</div>
    </div>
  )
}

function NumberSetting({
  label,
  detail,
  tooltip,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  detail?: string
  tooltip?: ReactNode
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (value: number) => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <label className="font-bold">
        <LabelWithTooltip label={label} tooltip={tooltip ?? detail} />
      </label>
      {detail && <p className="text-sm text-slate-500">{detail}</p>}
      <input
        className="mt-3 h-10 w-full rounded-md border border-slate-200 px-3 font-mono"
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </div>
  )
}

function ReadOnlySetting({
  label,
  value,
  detail,
  tooltip,
}: {
  label: string
  value: string
  detail: string
  tooltip?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="font-bold">
        <LabelWithTooltip label={label} tooltip={tooltip ?? detail} />
      </div>
      <div className="mt-3 h-10 rounded-md border border-slate-200 bg-white px-3 py-2 font-semibold">
        {value}
      </div>
      <p className="mt-2 text-sm text-slate-500">{detail}</p>
    </div>
  )
}

function SectionHeading({
  title,
  tooltip,
  className,
}: {
  title: string
  tooltip: ReactNode
  className?: string
}) {
  return (
    <div className={twMerge('flex items-center gap-2', className)}>
      <h2 className="text-xl font-bold">{title}</h2>
      <InfoTooltip tooltip={tooltip} />
    </div>
  )
}

function LabelWithTooltip({
  label,
  tooltip,
}: {
  label: string
  tooltip?: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span>{label}</span>
      {tooltip && <InfoTooltip tooltip={tooltip} />}
    </span>
  )
}

function FieldCaption({ children }: { children: ReactNode }) {
  return (
    <div className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-400">
      {children}
    </div>
  )
}

function InfoTooltip({ tooltip }: { tooltip: ReactNode }) {
  return (
    <Tooltip
      tooltip={<div className="max-w-80 text-sm leading-snug">{tooltip}</div>}
      className={{ trigger: 'inline-flex' }}
    >
      <FontAwesomeIcon
        icon={faInfoCircle}
        className="hover:text-primary-100 h-4 w-4 text-slate-400"
      />
    </Tooltip>
  )
}

function SidePanel({
  title,
  children,
  tooltip,
}: {
  title: string
  children: ReactNode
  tooltip?: ReactNode
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      {tooltip ? (
        <SectionHeading title={title} tooltip={tooltip} className="mb-4" />
      ) : (
        <h2 className="mb-4 text-xl font-bold">{title}</h2>
      )}
      {children}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  return (
    <input
      className={twMerge(
        'h-10 w-full rounded-md border border-slate-200 px-3 font-semibold',
        disabled && 'cursor-not-allowed bg-slate-50 text-slate-400'
      )}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

function NumberInput({
  value,
  onChange,
  suffix,
  placeholder,
  disabled,
}: {
  value: number | null
  onChange: (value: number | null) => void
  suffix?: string
  placeholder?: string
  disabled?: boolean
}) {
  return (
    <div
      className={twMerge(
        'flex h-10 items-center overflow-hidden rounded-md border border-slate-200',
        disabled && 'bg-slate-50 text-slate-400'
      )}
    >
      <input
        className="min-w-0 flex-1 border-0 bg-transparent px-3 font-mono focus:ring-0 disabled:cursor-not-allowed"
        type="number"
        value={value ?? ''}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) =>
          onChange(
            event.target.value === '' ? null : Number(event.target.value)
          )
        }
      />
      {suffix && <span className="px-3 text-slate-400">{suffix}</span>}
    </div>
  )
}

function IconButton({
  label,
  icon,
  disabled,
  onClick,
}: {
  label: string
  icon: any
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button type="button" disabled={disabled} onClick={onClick}>
      <Button.Icon icon={icon} />
      <span className="sr-only">{label}</span>
    </Button>
  )
}

function updateCompetence(
  form: AdaptiveFormValues,
  setForm: (form: AdaptiveFormValues) => void,
  index: number,
  patch: Partial<CompetenceFormValue>
) {
  const competences = [...form.competences]
  competences[index] = { ...competences[index], ...patch }
  setForm({ ...form, competences })
}

function updateSubCompetence(
  form: AdaptiveFormValues,
  setForm: (form: AdaptiveFormValues) => void,
  competenceIndex: number,
  subCompetenceIndex: number,
  patch: Partial<SubCompetenceFormValue>
) {
  const competence = form.competences[competenceIndex]
  const subCompetence = competence?.subCompetences[subCompetenceIndex]
  if (!competence || !subCompetence) return

  const subCompetences = [...competence.subCompetences]
  subCompetences[subCompetenceIndex] = { ...subCompetence, ...patch }
  updateCompetence(form, setForm, competenceIndex, { subCompetences })
}

function rebalanceCompetenceWeight(
  form: AdaptiveFormValues,
  index: number,
  nextWeight: number
): AdaptiveFormValues {
  if (!form.competences[index]?.enabled) {
    return recomputeEnabledCompetenceWeights(form)
  }

  const enabledIndexes = form.competences.reduce<number[]>(
    (indexes, competence, ix) =>
      competence.enabled ? [...indexes, ix] : indexes,
    []
  )

  if (enabledIndexes.length <= 1) {
    return {
      ...form,
      competences: form.competences.map((competence, ix) =>
        ix === index
          ? { ...competence, weight: 100 }
          : { ...competence, weight: 0 }
      ),
    }
  }

  const targetWeight = clampWeight(nextWeight)
  const remainingWeight = 100 - targetWeight
  const otherCompetences = form.competences
    .map((competence, ix) => ({ competence, ix }))
    .filter((entry) => entry.ix !== index && entry.competence.enabled)
  const otherTotal = otherCompetences.reduce(
    (sum, { competence }) => sum + Math.max(0, competence.weight),
    0
  )

  const redistributed = otherCompetences.map(({ competence }) => {
    if (otherTotal > 0) {
      return roundWeight((remainingWeight * competence.weight) / otherTotal)
    }

    return roundWeight(remainingWeight / otherCompetences.length)
  })
  const drift =
    remainingWeight - redistributed.reduce((sum, weight) => sum + weight, 0)
  if (redistributed.length > 0) {
    redistributed[0] = roundWeight(redistributed[0] + drift)
  }

  let otherIndex = 0
  return {
    ...form,
    competences: form.competences.map((competence, ix) => {
      if (ix === index) {
        return { ...competence, weight: targetWeight }
      }

      if (!competence.enabled) {
        return { ...competence, weight: 0 }
      }

      const weight = redistributed[otherIndex] ?? 0
      otherIndex += 1
      return { ...competence, weight }
    }),
  }
}

function recomputeEnabledCompetenceWeights(
  form: AdaptiveFormValues
): AdaptiveFormValues {
  const enabledCompetences = form.competences.filter(
    (competence) => competence.enabled
  )

  if (enabledCompetences.length === 0) return form

  const total = enabledCompetences.reduce(
    (sum, competence) => sum + Math.max(0, competence.weight),
    0
  )

  if (total <= 0) {
    return equalizeCompetenceWeights(form)
  }

  const weights = enabledCompetences.map((competence) =>
    roundWeight((Math.max(0, competence.weight) / total) * 100)
  )
  const drift = 100 - weights.reduce((sum, weight) => sum + weight, 0)
  if (weights.length > 0) {
    weights[0] = roundWeight(weights[0] + drift)
  }

  return {
    ...form,
    competences: form.competences.map((competence) => {
      if (!competence.enabled) return { ...competence, weight: 0 }

      const enabledIndex = enabledCompetences.findIndex(
        (entry) => entry === competence
      )
      return { ...competence, weight: weights[enabledIndex] ?? 0 }
    }),
  }
}

function equalizeCompetenceWeights(
  form: AdaptiveFormValues
): AdaptiveFormValues {
  const enabledIndexes = form.competences.reduce<number[]>(
    (indexes, competence, index) =>
      competence.enabled ? [...indexes, index] : indexes,
    []
  )

  if (enabledIndexes.length === 0) return form

  const baseWeight = roundWeight(100 / enabledIndexes.length)
  const weights = enabledIndexes.map(() => baseWeight)
  const drift = 100 - weights.reduce((sum, weight) => sum + weight, 0)
  weights[0] = roundWeight(weights[0] + drift)

  let enabledIndex = 0
  return {
    ...form,
    competences: form.competences.map((competence) => {
      if (!competence.enabled) return { ...competence, weight: 0 }

      const weight = weights[enabledIndex] ?? 0
      enabledIndex += 1
      return { ...competence, weight }
    }),
  }
}

function setCompetenceEnabled(
  form: AdaptiveFormValues,
  index: number,
  enabled: boolean
): AdaptiveFormValues {
  const current = form.competences[index]
  if (!current || current.enabled === enabled) return form

  const enabledCount = form.competences.filter(
    (competence) => competence.enabled
  ).length
  if (!enabled && enabledCount <= 1) return form

  return syncElementMappingEnabledForParents(
    normalizeAfterCompetenceChange({
      ...form,
      competences: form.competences.map((competence, ix) =>
        ix === index ? { ...competence, enabled } : competence
      ),
    }),
    enabled
      ? {
          competenceName: current.name,
        }
      : null
  )
}

function syncElementMappingEnabledForParents(
  form: AdaptiveFormValues,
  parent: {
    competenceName: string
    subCompetenceName?: string
  } | null
): AdaptiveFormValues {
  if (!parent) return form

  return {
    ...form,
    elements: form.elements.map((element) =>
      element.competenceName === parent.competenceName &&
      (parent.subCompetenceName == null ||
        element.subCompetenceName === parent.subCompetenceName)
        ? { ...element, enabled: true }
        : element
    ),
  }
}

function normalizeAfterCompetenceChange(
  form: AdaptiveFormValues
): AdaptiveFormValues {
  return recomputeEnabledCompetenceWeights(form)
}

function repairElementMappingsForExistingCompetences(
  form: AdaptiveFormValues
): AdaptiveFormValues {
  const fallbackCompetence =
    form.competences.find((competence) => competence.enabled) ??
    form.competences[0]

  if (!fallbackCompetence) return form

  return {
    ...form,
    elements: form.elements.map((element) => {
      const competence = form.competences.find(
        (entry) => entry.name === element.competenceName
      )
      const targetCompetence = competence ?? fallbackCompetence
      const subCompetence = targetCompetence.subCompetences.find(
        (entry) => entry.name === element.subCompetenceName
      )
      const fallbackSubCompetence =
        targetCompetence.subCompetences.find((entry) => entry.enabled) ??
        targetCompetence.subCompetences[0]

      return {
        ...element,
        competenceName: targetCompetence.name,
        subCompetenceName:
          subCompetence?.name ?? fallbackSubCompetence?.name ?? '',
      }
    }),
  }
}

function setSubCompetenceEnabled(
  form: AdaptiveFormValues,
  competenceIndex: number,
  subCompetenceIndex: number,
  enabled: boolean
): AdaptiveFormValues {
  const competence = form.competences[competenceIndex]
  const subCompetence = competence?.subCompetences[subCompetenceIndex]
  if (!competence || !subCompetence || subCompetence.enabled === enabled) {
    return form
  }

  const enabledCount = competence.subCompetences.filter(
    (entry) => entry.enabled
  ).length
  if (!enabled && competence.enabled && enabledCount <= 1) return form

  const subCompetences = [...competence.subCompetences]
  subCompetences[subCompetenceIndex] = { ...subCompetence, enabled }

  return syncElementMappingEnabledForParents(
    {
      ...form,
      competences: form.competences.map((entry, ix) =>
        ix === competenceIndex ? { ...entry, subCompetences } : entry
      ),
    },
    enabled
      ? {
          competenceName: competence.name,
          subCompetenceName: subCompetence.name,
        }
      : null
  )
}

function clampWeight(value: number) {
  return Math.min(100, Math.max(0, Math.round(value)))
}

function roundWeight(value: number) {
  return Math.round(value * 10) / 10
}

function updateElement(
  form: AdaptiveFormValues,
  setForm: (form: AdaptiveFormValues) => void,
  index: number,
  patch: Partial<ElementMappingFormValue>
) {
  const elements = [...form.elements]
  elements[index] = { ...elements[index], ...patch }
  setForm({ ...form, elements })
}

function updateElementByElementId(
  form: AdaptiveFormValues,
  setForm: (form: AdaptiveFormValues) => void,
  elementId: number,
  patch: Partial<ElementMappingFormValue>
) {
  const index = form.elements.findIndex(
    (element) => element.elementId === elementId
  )
  if (index < 0) return
  updateElement(form, setForm, index, patch)
}

function toggleElementMapping(
  form: AdaptiveFormValues,
  element: ElementCandidate
): AdaptiveFormValues {
  const selected = form.elements.some((entry) => entry.elementId === element.id)

  if (selected) {
    return {
      ...form,
      elements: form.elements.filter((entry) => entry.elementId !== element.id),
    }
  }

  const competence =
    form.competences.find((entry) => entry.enabled) ?? form.competences[0]
  const subCompetence =
    competence?.subCompetences.find((entry) => entry.enabled) ??
    competence?.subCompetences[0]

  return {
    ...form,
    elements: [
      ...form.elements,
      {
        elementId: element.id,
        elementName: element.name,
        elementType: element.type,
        choiceCount: mappedChoiceCount(element),
        competenceName: competence?.name ?? '',
        subCompetenceName: subCompetence?.name ?? '',
        levelLabel:
          form.levels[Math.floor(form.levels.length / 2)]?.label ?? '',
        enabled: true,
        discrimination: null,
      },
    ],
  }
}

function mapAssessmentToFormValues(assessment: Assessment): AdaptiveFormValues {
  return {
    id: assessment.id,
    displayName: assessment.displayName,
    description: assessment.description ?? '',
    levels: assessment.levels
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((level) => ({ label: level.label })),
    competences: assessment.competences
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((competence) => ({
        name: competence.name,
        enabled: competence.enabled,
        weight: competence.weight,
        questionThreshold: competence.questionThreshold ?? null,
        standardErrorThreshold: competence.standardErrorThreshold ?? null,
        subCompetences: (competence.subCompetences ?? []).map(
          (subCompetence) => ({
            name: subCompetence.name,
            enabled: subCompetence.enabled,
            questionThreshold: subCompetence.questionThreshold ?? null,
            standardErrorThreshold:
              subCompetence.standardErrorThreshold ?? null,
          })
        ),
      })),
    elements: assessment.elements.map((element) => ({
      elementId: element.elementId,
      elementName: mappedElementName(
        element.element,
        `Element #${element.elementId}`
      ),
      elementType: mappedElementType(element.element),
      choiceCount: mappedChoiceCount(element.element),
      competenceName: element.competence?.name ?? '',
      subCompetenceName: element.subCompetence?.name ?? '',
      levelLabel: element.level?.label ?? '',
      enabled: element.enabled,
      discrimination: element.discrimination ?? null,
    })),
    resultMessages: assessment.resultMessages
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((message) => ({
        levelLabel: message.level?.label ?? '',
        minTheta: message.minTheta ?? null,
        maxTheta: message.maxTheta ?? null,
        message: message.message,
        isFallback: message.isFallback,
      })),
    questionThreshold: assessment.questionThreshold,
    standardErrorThreshold: assessment.standardErrorThreshold,
    discrimination: assessment.discrimination,
    thetaMin: assessment.thetaMin,
    thetaMax: assessment.thetaMax,
    topInformationRatio: assessment.topInformationRatio,
    showTimer: assessment.showTimer,
    showCompetenceNames: assessment.showCompetenceNames,
    showFinalResult: assessment.showFinalResult,
    showSolutions: assessment.showSolutions,
  }
}

function buildUpsertInput(
  form: AdaptiveFormValues,
  courseId: string
): UpsertAdaptiveAssessmentInput {
  return {
    id: form.id,
    courseId,
    name: form.displayName.trim(),
    displayName: form.displayName.trim(),
    description: form.description.trim() || null,
    levels: form.levels.map((level, order) => ({
      label: level.label.trim(),
      order,
    })),
    competences: form.competences.map((competence, order) => ({
      name: competence.name.trim(),
      tagName: null,
      enabled: competence.enabled,
      order,
      weight: competence.weight,
      questionThreshold: null,
      standardErrorThreshold: null,
      subCompetences: competence.subCompetences.map(
        (subCompetence, subOrder) => ({
          name: subCompetence.name.trim(),
          tagName: null,
          enabled: subCompetence.enabled,
          order: subOrder,
          questionThreshold: subCompetence.questionThreshold,
          standardErrorThreshold: subCompetence.standardErrorThreshold,
        })
      ),
    })),
    elements: form.elements.map((element) => ({
      elementId: element.elementId,
      competenceName: element.competenceName,
      subCompetenceName: element.subCompetenceName,
      levelLabel: element.levelLabel,
      enabled: element.enabled,
      discrimination: element.discrimination,
    })),
    resultMessages: form.resultMessages.map((message, order) => ({
      order,
      message: message.message,
      minTheta: message.minTheta,
      maxTheta: message.maxTheta,
      levelLabel: message.levelLabel || null,
      isFallback: message.isFallback,
    })),
    standardErrorThreshold: form.standardErrorThreshold,
    questionThreshold: form.questionThreshold,
    discrimination: form.discrimination,
    thetaMin: form.thetaMin,
    thetaMax: form.thetaMax,
    topInformationRatio: form.topInformationRatio,
    showTimer: form.showTimer,
    showCompetenceNames: form.showCompetenceNames,
    showFinalResult: form.showFinalResult,
    showSolutions: form.showSolutions,
  }
}

function isElementCandidate(value: any): value is ElementCandidate {
  return (
    (value?.__typename === 'ChoicesElement' &&
      (value.type === ElementType.Sc ||
        value.type === ElementType.Mc ||
        value.type === ElementType.Kprim)) ||
    value?.__typename === 'FreeTextElement'
  )
}

function mappedElementType(
  element: Assessment['elements'][number]['element']
): ElementType | null {
  if (
    element?.__typename === 'ChoicesElement' ||
    element?.__typename === 'FreeTextElement'
  ) {
    return element.type
  }

  return null
}

function mappedElementName(
  element: Assessment['elements'][number]['element'],
  fallback: string
) {
  if (
    element?.__typename === 'ChoicesElement' ||
    element?.__typename === 'FreeTextElement'
  ) {
    return element.name
  }

  return fallback
}

function mappedChoiceCount(
  element: Assessment['elements'][number]['element'] | ElementCandidate
): number | null {
  if (element?.__typename !== 'ChoicesElement') return null
  return element.options?.choices.length ?? null
}

function itemPoolStatus(
  mapping: ElementMappingFormValue,
  competence?: CompetenceFormValue,
  subCompetence?: SubCompetenceFormValue
) {
  if (!competence || !subCompetence) {
    return {
      label: 'Incomplete',
      className: 'bg-red-50 text-red-700',
    }
  }

  if (!mapping.enabled || !competence.enabled || !subCompetence.enabled) {
    return {
      label: 'Inactive',
      className: 'bg-slate-100 text-slate-500',
    }
  }

  return {
    label: 'Active',
    className: 'bg-green-50 text-green-700',
  }
}

function isElementMappingActive(
  form: AdaptiveFormValues,
  mapping: ElementMappingFormValue
) {
  const competence = form.competences.find(
    (entry) => entry.name === mapping.competenceName
  )
  const subCompetence = competence?.subCompetences.find(
    (entry) => entry.name === mapping.subCompetenceName
  )

  return itemPoolStatus(mapping, competence, subCompetence).label === 'Active'
}

function formatElementType(type: ElementType) {
  if (type === ElementType.Sc) return 'Single choice'
  if (type === ElementType.Mc) return 'Multiple choice'
  if (type === ElementType.Kprim) return 'KPRIM'
  if (type === ElementType.FreeText) return 'Free text'
  return type
}

function levelTheta(form: AdaptiveFormValues, label: string) {
  const index = form.levels.findIndex((level) => level.label === label)
  return levelThetaByIndex(form, Math.max(0, index))
}

function levelThetaByIndex(form: AdaptiveFormValues, index: number) {
  const denominator = Math.max(form.levels.length - 1, 1)
  return form.thetaMin + ((form.thetaMax - form.thetaMin) * index) / denominator
}

function levelForTheta(form: AdaptiveFormValues, theta?: number | null) {
  if (theta == null) return null
  const levels = form.levels.map((level, index) => ({
    label: level.label,
    theta: levelThetaByIndex(form, index),
  }))
  return levels.reduce((closest, level) =>
    Math.abs(level.theta - theta) < Math.abs(closest.theta - theta)
      ? level
      : closest
  ).label
}

function levelIndex(
  form: AdaptiveFormValues,
  label?: string | null
): number | undefined {
  return levelIndexFromLevels(form.levels, label)
}

function levelIndexFromLevels(
  levels: LevelFormValue[],
  label?: string | null
): number | undefined {
  if (!label) return undefined
  const index = levels.findIndex((level) => level.label === label)
  return index >= 0 ? index : undefined
}

function buildCompletionIntervalMessages(
  thetaMin: number,
  thetaMax: number,
  messages = DEFAULT_COMPLETION_INTERVAL_MESSAGES
): ResultMessageFormValue[] {
  const width = (thetaMax - thetaMin) / messages.length

  return messages.map((message, index) => ({
    levelLabel: '',
    minTheta: roundTheta(thetaMin + width * index),
    maxTheta: roundTheta(
      index === messages.length - 1 ? thetaMax : thetaMin + width * (index + 1)
    ),
    message,
    isFallback: false,
  }))
}

function sanitizeIntervalMessage(
  form: AdaptiveFormValues,
  message: ResultMessageFormValue,
  patch: Partial<ResultMessageFormValue>
): ResultMessageFormValue {
  const nextMessage = { ...message, ...patch }

  return {
    ...nextMessage,
    minTheta: clampIntervalTheta(nextMessage.minTheta, form),
    maxTheta: clampIntervalTheta(nextMessage.maxTheta, form),
  }
}

function clampIntervalTheta(
  value: number | null | undefined,
  form: AdaptiveFormValues
) {
  if (value == null) return null

  return roundTheta(Math.min(form.thetaMax, Math.max(form.thetaMin, value)))
}

function validateResultMessageIntervals(form: AdaptiveFormValues) {
  const errors: string[] = []
  const intervals = form.resultMessages
    .map((message, index) => {
      if (!isIntervalResultMessage(message)) return null

      if (message.minTheta == null || message.maxTheta == null) {
        errors.push('Interval messages need both a minimum and maximum theta.')
        return null
      }

      if (
        message.minTheta < form.thetaMin ||
        message.maxTheta > form.thetaMax
      ) {
        errors.push(
          `Interval messages must stay between ${formatTheta(form.thetaMin)} and ${formatTheta(form.thetaMax)}.`
        )
      }

      if (message.minTheta >= message.maxTheta) {
        errors.push(
          'Interval message maximum theta must be larger than minimum theta.'
        )
      }

      return {
        index,
        minTheta: message.minTheta,
        maxTheta: message.maxTheta,
      }
    })
    .filter(
      (
        interval
      ): interval is { index: number; minTheta: number; maxTheta: number } =>
        interval != null
    )
    .sort((a, b) => a.minTheta - b.minTheta)

  for (let index = 1; index < intervals.length; index += 1) {
    const previous = intervals[index - 1]!
    const current = intervals[index]!

    if (current.minTheta < previous.maxTheta) {
      errors.push('Interval message ranges cannot overlap.')
      break
    }
  }

  return Array.from(new Set(errors))
}

function buildAvailableIntervalMessage(
  form: AdaptiveFormValues
): ResultMessageFormValue | null {
  const validIntervals = form.resultMessages
    .map((message) => {
      if (
        !isIntervalResultMessage(message) ||
        message.minTheta == null ||
        message.maxTheta == null
      ) {
        return null
      }

      return {
        minTheta: Math.max(form.thetaMin, message.minTheta),
        maxTheta: Math.min(form.thetaMax, message.maxTheta),
      }
    })
    .filter(
      (interval): interval is { minTheta: number; maxTheta: number } =>
        interval != null && interval.minTheta < interval.maxTheta
    )
    .sort((a, b) => a.minTheta - b.minTheta)

  let cursor = form.thetaMin
  let largestGap: { minTheta: number; maxTheta: number } | null = null
  for (const interval of validIntervals) {
    if (interval.minTheta > cursor) {
      const gap = { minTheta: cursor, maxTheta: interval.minTheta }
      if (
        !largestGap ||
        gap.maxTheta - gap.minTheta > largestGap.maxTheta - largestGap.minTheta
      ) {
        largestGap = gap
      }
    }
    cursor = Math.max(cursor, interval.maxTheta)
  }

  if (cursor < form.thetaMax) {
    const gap = { minTheta: cursor, maxTheta: form.thetaMax }
    if (
      !largestGap ||
      gap.maxTheta - gap.minTheta > largestGap.maxTheta - largestGap.minTheta
    ) {
      largestGap = gap
    }
  }

  if (!largestGap || largestGap.maxTheta - largestGap.minTheta < 0.01) {
    return null
  }

  return {
    levelLabel: '',
    minTheta: roundTheta(largestGap.minTheta),
    maxTheta: roundTheta(largestGap.maxTheta),
    message: 'Add a short end-of-test note for this theta interval.',
    isFallback: false,
  }
}

function isIntervalResultMessage(message: ResultMessageFormValue) {
  return (
    !message.isFallback &&
    !message.levelLabel &&
    (message.minTheta != null || message.maxTheta != null)
  )
}

function roundTheta(value: number) {
  return Number(value.toFixed(2))
}

function guessByType(type?: ElementType | null, choiceCount?: number | null) {
  const choices = Math.max(choiceCount ?? 4, 1)
  if (type === ElementType.Mc) return 1 / (2 ** choices - 1)
  if (type === ElementType.Kprim) return 1 / 2 ** choices
  if (type === ElementType.FreeText) return 0.01
  return 1 / Math.max(choices, 2)
}

function initials(value: string) {
  return value
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function formatDateTime(value?: string | null) {
  if (!value) return '-'
  return dayjs(value).format('D MMM YYYY, HH:mm')
}

function formatAttemptStatus(status?: string | null) {
  if (!status) return 'Not started'
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(' ')
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
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default AdaptiveLearningManagePage
