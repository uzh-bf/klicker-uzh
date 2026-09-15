import { faChevronDown, faChevronUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import DataUseChoices from '@klicker-uzh/shared-components/src/DataUseChoices'
import {
  Button,
  Checkbox,
  Collapsible,
  H1,
  H3,
  H4,
  Modal,
  Select,
  Switch,
} from '@uzh-bf/design-system'
import { Form, Formik } from 'formik'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import * as yup from 'yup'

type ParticipantView =
  | 'eduid'
  | 'assessment'
  | 'gate'
  | 'settings'
  | 'leaderboard'

type ChoiceView = Exclude<ParticipantView, 'settings' | 'leaderboard'>

interface ChoiceValues {
  researchAllowed: boolean
  learningAnalytics: boolean | undefined
  acknowledgement: boolean
}

const noticeKeys = ['collection', 'visibility', 'purpose', 'retention'] as const

function Acknowledgement({
  id,
  checked,
  onCheck,
}: {
  id: string
  checked: boolean
  onCheck: () => void
}) {
  const t = useTranslations()

  return (
    <Checkbox
      id={id}
      checked={checked}
      onCheck={onCheck}
      data={{ cy: `${id}-checkbox` }}
      className={{
        root: checked ? 'h-6 w-6' : 'h-6 w-6 border-red-600 bg-red-400',
      }}
      label={
        <label htmlFor={id} className="text-sm">
          {t.rich('dpoDraft.account.acknowledgement', {
            privacy: (chunks) => (
              <a
                href="https://www.klicker.uzh.ch/privacy_policy"
                target="_blank"
                rel="noreferrer"
                data-cy={`${id}-privacy`}
                className="underline"
              >
                {chunks}
              </a>
            ),
            terms: (chunks) => (
              <a
                href="https://www.klicker.uzh.ch/terms_of_service"
                target="_blank"
                rel="noreferrer"
                data-cy={`${id}-terms`}
                className="underline"
              >
                {chunks}
              </a>
            ),
          })}
        </label>
      }
    />
  )
}

function NoticeList({
  id,
  collection,
  assessment,
}: {
  id: string
  collection: string
  assessment: boolean
}) {
  const t = useTranslations()
  const [openNotices, setOpenNotices] = useState<string[]>([])

  return (
    <div className="space-y-2">
      {noticeKeys.map((notice) => {
        const text =
          notice === 'collection'
            ? collection
            : assessment
              ? t(`dpoDraft.participant.assessment.${notice}`)
              : t(`dpoDraft.account.${notice}`)

        return (
          <Collapsible
            key={notice}
            open={openNotices.includes(notice)}
            onChange={() =>
              setOpenNotices((current) =>
                current.includes(notice)
                  ? current.filter((item) => item !== notice)
                  : [...current, notice]
              )
            }
            staticContent={<H4>{t(`dpoDraft.account.${notice}Title`)}</H4>}
            data={{ cy: `${id}-notice-${notice}` }}
            customTrigger={
              <>
                <FontAwesomeIcon
                  icon={
                    openNotices.includes(notice) ? faChevronUp : faChevronDown
                  }
                />
                <span className="sr-only">
                  {t(`dpoDraft.account.${notice}Title`)}
                </span>
              </>
            }
          >
            <p className="my-2 text-sm leading-relaxed">{text}</p>
          </Collapsible>
        )
      })}
    </div>
  )
}

function ConnectedEduId({ assessment }: { assessment: boolean }) {
  const t = useTranslations()

  return (
    <div className="rounded bg-white p-3 text-sm">
      <b>{t('dpoDraft.participant.connectedTitle')}</b>
      <br />
      <span>{t('dpoDraft.participant.connectedEmail')}</span>
      <br />
      <span className="text-sm">
        {t(
          assessment
            ? 'dpoDraft.participant.assessment.connectedHelp'
            : 'dpoDraft.participant.eduid.connectedHelp'
        )}
      </span>
    </div>
  )
}

function ChoiceJourney({ view }: { view: ChoiceView }) {
  const t = useTranslations()
  const isAssessment = view === 'assessment'
  const isGate = view === 'gate'
  const [scenario, setScenario] = useState<'legacy' | 'saved'>('legacy')
  const [complete, setComplete] = useState(false)

  const initialValues: ChoiceValues = {
    researchAllowed: !(isGate && scenario === 'saved'),
    learningAnalytics: isGate && scenario === 'saved' ? false : undefined,
    acknowledgement: false,
  }

  const schema = yup.object({
    researchAllowed: yup.boolean().required(),
    learningAnalytics: yup.boolean().required(t('dpoDraft.choices.required')),
    acknowledgement: yup
      .boolean()
      .oneOf([true], t('dpoDraft.required'))
      .required(t('dpoDraft.required')),
  })

  const collection = t(
    isAssessment
      ? 'dpoDraft.participant.assessment.collection'
      : 'dpoDraft.participant.eduid.collection'
  )

  return (
    <div className="space-y-3">
      <H1>
        {t(
          isGate
            ? 'dpoDraft.participant.gate.title'
            : isAssessment
              ? 'dpoDraft.participant.assessment.title'
              : 'dpoDraft.participant.eduid.title'
        )}
      </H1>
      <div className="rounded bg-slate-100 p-3 text-sm">
        {t(
          isGate
            ? 'dpoDraft.participant.gate.context'
            : isAssessment
              ? 'dpoDraft.participant.assessment.context'
              : 'dpoDraft.participant.eduid.context'
        )}
        {isGate && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <label htmlFor="dpo-gate-scenario" className="font-semibold">
              {t('dpoDraft.participant.gate.scenarioLabel')}
            </label>
            <Select
              id="dpo-gate-scenario"
              value={scenario}
              onChange={(value) => {
                const nextScenario = value === 'saved' ? 'saved' : 'legacy'
                setScenario(nextScenario)
                setComplete(false)
              }}
              items={[
                {
                  value: 'legacy',
                  label: t('dpoDraft.participant.gate.scenarios.legacy'),
                },
                {
                  value: 'saved',
                  label: t('dpoDraft.participant.gate.scenarios.saved'),
                },
              ]}
              data={{ cy: 'dpo-gate-scenario' }}
              className={{ root: 'min-w-0 sm:w-auto' }}
            />
          </div>
        )}
      </div>

      <Formik<ChoiceValues>
        key={scenario}
        initialValues={initialValues}
        validationSchema={schema}
        validateOnMount
        onSubmit={(_, helpers) => {
          setComplete(true)
          helpers.setSubmitting(false)
        }}
      >
        {({ values, setFieldValue, isValid, isSubmitting }) => (
          <Form
            className="flex flex-col gap-2 md:grid md:grid-cols-2"
            data-cy={`dpo-${view}-form`}
          >
            {isGate ? (
              <section className="space-y-3 rounded md:col-span-2 md:bg-slate-50 md:p-4">
                <H3 className={{ root: 'mb-0 border-b' }}>
                  {t('dpoDraft.participant.gate.title')}
                </H3>
                <p className="text-sm leading-relaxed">
                  {t('dpoDraft.participant.gate.intro')}{' '}
                  <b>{t('dpoDraft.participant.gate.username')}</b>{' '}
                  {t('dpoDraft.participant.gate.destination')}
                </p>
                <DataUseChoices
                  id="dpo-gate"
                  researchAllowed={values.researchAllowed}
                  learningAnalytics={values.learningAnalytics}
                  onResearchChange={(value) => {
                    setComplete(false)
                    void setFieldValue('researchAllowed', value)
                  }}
                  onLearningAnalyticsChange={(value) => {
                    setComplete(false)
                    void setFieldValue('learningAnalytics', value)
                  }}
                />
              </section>
            ) : (
              <>
                <section className="space-y-3 rounded md:bg-slate-50 md:p-4">
                  <H3 className={{ root: 'mb-0 border-b' }}>
                    {t(
                      isAssessment
                        ? 'dpoDraft.participant.assessment.accessTitle'
                        : 'dpoDraft.participant.eduid.title'
                    )}
                  </H3>
                  <ConnectedEduId assessment={isAssessment} />
                  <NoticeList
                    id={`dpo-${view}`}
                    collection={collection}
                    assessment={isAssessment}
                  />
                </section>
                <section className="space-y-2 rounded md:bg-slate-50 md:p-4">
                  <H3 className={{ root: 'mb-0 border-b' }}>
                    {t('dpoDraft.account.choicesTitle')}
                  </H3>
                  <DataUseChoices
                    id={`dpo-${view}`}
                    researchAllowed={values.researchAllowed}
                    learningAnalytics={values.learningAnalytics}
                    onResearchChange={(value) => {
                      setComplete(false)
                      void setFieldValue('researchAllowed', value)
                    }}
                    onLearningAnalyticsChange={(value) => {
                      setComplete(false)
                      void setFieldValue('learningAnalytics', value)
                    }}
                  />
                </section>
              </>
            )}

            <div className="space-y-3 rounded bg-slate-100 p-4 md:col-span-2">
              <Acknowledgement
                id={`dpo-${view}-ack`}
                checked={values.acknowledgement}
                onCheck={() => {
                  setComplete(false)
                  void setFieldValue('acknowledgement', !values.acknowledgement)
                }}
              />
              <div className="flex justify-end">
                <Button
                  primary
                  type="submit"
                  disabled={!isValid || isSubmitting}
                  data={{ cy: `dpo-${view}-submit` }}
                >
                  {t(
                    isGate
                      ? 'dpoDraft.participant.gate.submit'
                      : isAssessment
                        ? 'dpoDraft.participant.assessment.submit'
                        : 'dpoDraft.participant.eduid.submit'
                  )}
                </Button>
              </div>
              {complete && (
                <p role="status" data-cy={`dpo-${view}-result`}>
                  {t('dpoDraft.simulatedResult')}{' '}
                  {t(
                    isGate
                      ? 'dpoDraft.participant.gate.result'
                      : isAssessment
                        ? 'dpoDraft.participant.assessment.result'
                        : 'dpoDraft.participant.eduid.result'
                  )}
                </p>
              )}
            </div>
          </Form>
        )}
      </Formik>
    </div>
  )
}

function SettingsJourney() {
  const t = useTranslations()
  const [researchAllowed, setResearchAllowed] = useState(true)
  const [learningAnalytics, setLearningAnalytics] = useState(true)
  const [confirmAnalyticsOff, setConfirmAnalyticsOff] = useState(false)
  const [result, setResult] = useState<SettingsResult | undefined>()

  const showResult = (kind: SettingsResultKind, message: string) => {
    const marker =
      kind === 'research'
        ? t('dpoDraft.participant.settings.researchMarker')
        : t('dpoDraft.participant.settings.analyticsMarker')
    setResult({
      kind,
      message: `${t('dpoDraft.simulatedResult')} ${marker} ${message}`,
    })
  }

  return (
    <div className="space-y-3">
      <div className="rounded bg-slate-100 p-3 text-sm">
        {t('dpoDraft.participant.settings.context')}
      </div>
      <section className="space-y-3 rounded md:bg-slate-50 md:p-4">
        <H3 className={{ root: 'mb-0 border-b' }}>
          {t('dpoDraft.participant.settings.title')}
        </H3>
        <h4 className="font-bold">
          {t('dpoDraft.participant.settings.dataHeading')}
        </h4>
        <div className="flex flex-col gap-3 rounded border p-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h4 className="font-bold">
              <label htmlFor="dpo-settings-research">
                {t('dpoDraft.participant.settings.researchTitle')}
              </label>
            </h4>
            <p className="text-sm leading-relaxed">
              {t('dpoDraft.participant.settings.researchDescription')}
            </p>
            {result?.kind === 'research' && (
              <p className="rounded bg-slate-100 p-2 text-sm" role="status">
                {result.message}
              </p>
            )}
          </div>
          <Switch
            id="dpo-settings-research"
            checked={researchAllowed}
            label={t(
              researchAllowed
                ? 'dpoDraft.participant.settings.allowed'
                : 'dpoDraft.participant.settings.objected'
            )}
            onCheckedChange={(checked) => {
              setResearchAllowed(checked)
              showResult(
                'research',
                t(
                  checked
                    ? 'dpoDraft.participant.settings.researchEnabled'
                    : 'dpoDraft.participant.settings.researchDisabled'
                )
              )
            }}
            data={{ cy: 'dpo-settings-research' }}
          />
        </div>

        <div className="flex flex-col gap-3 rounded border p-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <h4 className="font-bold">
              <label htmlFor="dpo-settings-analytics">
                {t('dpoDraft.participant.settings.analyticsTitle')}
              </label>
            </h4>
            <p className="text-sm leading-relaxed">
              {t('dpoDraft.participant.settings.analyticsDescription')}{' '}
              <a
                href="/api/dpo-draft-assets/guide#entscheidung"
                target="_blank"
                rel="noreferrer"
                data-cy="dpo-settings-guide"
                className="text-uzh-blue-100 underline"
              >
                {t('dpoDraft.participant.settings.analyticsGuide')}
              </a>
            </p>
            {confirmAnalyticsOff && (
              <div
                className="rounded border border-uzh-red-60 bg-red-50 p-3 text-sm"
                role="alert"
                data-cy="dpo-settings-analytics-confirmation"
              >
                <b>{t('dpoDraft.participant.settings.confirmTitle')}</b>
                <p>{t('dpoDraft.participant.settings.confirmText')}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    type="button"
                    primary
                    data={{ cy: 'dpo-settings-analytics-confirm' }}
                    onClick={() => {
                      setLearningAnalytics(false)
                      setConfirmAnalyticsOff(false)
                      showResult(
                        'analytics',
                        t('dpoDraft.participant.settings.analyticsDisabled')
                      )
                    }}
                  >
                    {t('dpoDraft.participant.settings.disable')}
                  </Button>
                  <Button
                    type="button"
                    data={{ cy: 'dpo-settings-analytics-cancel' }}
                    onClick={() => setConfirmAnalyticsOff(false)}
                  >
                    {t('dpoDraft.participant.settings.keepEnabled')}
                  </Button>
                </div>
              </div>
            )}
          </div>
          <Switch
            id="dpo-settings-analytics"
            checked={learningAnalytics}
            label={t(
              learningAnalytics
                ? 'dpoDraft.participant.settings.enabled'
                : 'dpoDraft.participant.settings.disabled'
            )}
            onCheckedChange={(checked) => {
              if (!checked) {
                setConfirmAnalyticsOff(true)
                return
              }
              setLearningAnalytics(true)
              showResult(
                'analytics',
                t('dpoDraft.participant.settings.analyticsEnabled')
              )
            }}
            data={{ cy: 'dpo-settings-analytics' }}
          />
        </div>
        {result?.kind === 'analytics' && (
          <p
            className="rounded bg-slate-100 p-2 text-sm"
            role="status"
            data-cy="dpo-settings-result"
          >
            {result.message}
          </p>
        )}
      </section>
    </div>
  )
}

type SettingsResultKind = 'research' | 'analytics'

interface SettingsResult {
  kind: SettingsResultKind
  message: string
}

type LeaderboardMembership = 'notJoined' | 'joined' | 'left'

function LeaderboardJourney() {
  const t = useTranslations()
  const [membership, setMembership] =
    useState<LeaderboardMembership>('notJoined')
  const [open, setOpen] = useState(true)
  const [result, setResult] = useState<string | undefined>()

  const action =
    membership === 'joined'
      ? 'leave'
      : membership === 'left'
        ? 'rejoin'
        : 'join'

  const personalPoints = 120
  const rankingPoints = membership === 'joined' ? personalPoints : 0
  const awards = 0

  const completeAction = (
    nextMembership: LeaderboardMembership,
    key:
      | 'dpoDraft.participant.leaderboard.leftResult'
      | 'dpoDraft.participant.leaderboard.joinedResult'
      | 'dpoDraft.participant.leaderboard.rejoinedResult'
  ) => {
    setMembership(nextMembership)
    setOpen(false)
    setResult(`${t('dpoDraft.simulatedResult')} ${t(key)}`)
  }

  return (
    <div className="space-y-3">
      <div className="rounded bg-slate-100 p-3 text-sm">
        {t('dpoDraft.participant.leaderboard.context')}
      </div>
      <section className="space-y-3 rounded md:bg-slate-50 md:p-4">
        <div className="flex items-center justify-between gap-3">
          <H3 className={{ root: 'mb-0 border-b' }}>
            {t('dpoDraft.participant.leaderboard.readoutTitle')}
          </H3>
          <Button
            type="button"
            data={{ cy: 'dpo-leaderboard-open' }}
            onClick={() => setOpen(true)}
          >
            {t('dpoDraft.participant.leaderboard.open')}
          </Button>
        </div>
        <div
          className="rounded border p-3 text-sm"
          data-cy="dpo-leaderboard-readout"
        >
          <p>
            {t(
              membership === 'joined'
                ? 'dpoDraft.participant.leaderboard.joinedReadout'
                : membership === 'left'
                  ? 'dpoDraft.participant.leaderboard.leftReadout'
                  : 'dpoDraft.participant.leaderboard.notJoinedReadout'
            )}
          </p>
          <p className="mt-2">
            {t('dpoDraft.participant.leaderboard.unchangedChoices')}
          </p>
          <dl
            className="mt-3 grid gap-2 sm:grid-cols-3"
            data-cy="dpo-leaderboard-metrics"
          >
            <div className="rounded bg-slate-100 p-2">
              <dt className="text-xs font-semibold uppercase">
                {t('dpoDraft.participant.leaderboard.personalPointsLabel')}
              </dt>
              <dd>
                <data
                  value={String(personalPoints)}
                  className="text-lg font-bold"
                  data-cy="dpo-leaderboard-personal-points"
                >
                  {personalPoints}
                </data>
              </dd>
            </div>
            <div className="rounded bg-slate-100 p-2">
              <dt className="text-xs font-semibold uppercase">
                {t('dpoDraft.participant.leaderboard.rankingPointsLabel')}
              </dt>
              <dd>
                <data
                  value={String(rankingPoints)}
                  className="text-lg font-bold"
                  data-cy="dpo-leaderboard-ranking-points"
                >
                  {rankingPoints}
                </data>
              </dd>
            </div>
            <div className="rounded bg-slate-100 p-2">
              <dt className="text-xs font-semibold uppercase">
                {t('dpoDraft.participant.leaderboard.awardsLabel')}
              </dt>
              <dd>
                <data
                  value={String(awards)}
                  className="text-lg font-bold"
                  data-cy="dpo-leaderboard-awards"
                >
                  {awards}
                </data>
              </dd>
            </div>
          </dl>
          {result && (
            <p className="mt-2 rounded bg-slate-100 p-2" role="status">
              {result}
            </p>
          )}
        </div>
      </section>

      <Modal
        open={open}
        title={t('dpoDraft.participant.leaderboard.title')}
        onClose={() => setOpen(false)}
        primaryLabel={t(
          membership === 'joined'
            ? 'dpoDraft.participant.leaderboard.leave'
            : membership === 'left'
              ? 'dpoDraft.participant.leaderboard.rejoin'
              : 'dpoDraft.participant.leaderboard.join'
        )}
        primaryButtonStyle={membership === 'joined' ? 'destructive' : 'primary'}
        onPrimaryAction={() =>
          completeAction(
            membership === 'joined' ? 'left' : 'joined',
            membership === 'joined'
              ? 'dpoDraft.participant.leaderboard.leftResult'
              : membership === 'left'
                ? 'dpoDraft.participant.leaderboard.rejoinedResult'
                : 'dpoDraft.participant.leaderboard.joinedResult'
          )
        }
        secondaryLabel={t(
          membership === 'notJoined'
            ? 'dpoDraft.participant.leaderboard.decline'
            : 'dpoDraft.participant.leaderboard.close'
        )}
        onSecondaryAction={() => {
          if (membership === 'notJoined') {
            setResult(
              `${t('dpoDraft.simulatedResult')} ${t(
                'dpoDraft.participant.leaderboard.declinedResult'
              )}`
            )
          }
          setOpen(false)
        }}
        data={{ cy: 'dpo-leaderboard-modal' }}
        dataCloseButton={{ cy: 'dpo-leaderboard-modal-close' }}
        dataPrimaryAction={{ cy: `dpo-leaderboard-${action}` }}
        dataSecondaryAction={{ cy: 'dpo-leaderboard-close' }}
        className={{
          content: 'max-w-xl',
          title: 'min-w-0 whitespace-normal pr-8 text-left',
        }}
      >
        <p>{t('dpoDraft.participant.leaderboard.description')}</p>
      </Modal>
    </div>
  )
}

export default function ParticipantJourneys({
  view,
}: {
  view: 'eduid' | 'assessment' | 'gate' | 'settings' | 'leaderboard'
}) {
  if (view === 'settings') return <SettingsJourney />
  if (view === 'leaderboard') return <LeaderboardJourney />
  return <ChoiceJourney view={view} />
}
