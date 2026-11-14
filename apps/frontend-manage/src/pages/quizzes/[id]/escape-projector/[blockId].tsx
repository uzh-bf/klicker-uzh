import { useQuery } from '@apollo/client'
import {
  EscapeRoomProgressStatus,
  EscapeRoomProjectorPhase,
  GetEscapeRoomProjectorDocument,
  GetEscapeRoomProjectorQuery,
} from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import QR from '@pages/qr/[...args]'
import { GetStaticPropsContext } from 'next'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'

type Projector = GetEscapeRoomProjectorQuery['escapeRoomProjector']

function formatDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds))
  const mins = Math.floor(safe / 60)
  const secs = safe % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function Avatar({ avatar }: { avatar?: string | null }) {
  return (
    <Image
      src={
        avatar
          ? `${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${avatar}.svg`
          : '/user-solid.svg'
      }
      alt=""
      height={48}
      width={48}
      className="h-12 w-12 rounded-full bg-white p-1"
    />
  )
}

// Counts down to the server-defined close; the offset between the server and
// the projector clock is taken from the response that carried both values.
function Countdown({
  closesAt,
  serverNow,
}: {
  closesAt: string
  serverNow: string
}) {
  const t = useTranslations()
  const [offset, setOffset] = useState(0)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    setOffset(new Date(serverNow).getTime() - Date.now())
  }, [serverNow])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(interval)
  }, [])

  const remaining = (new Date(closesAt).getTime() - (now + offset)) / 1000

  return (
    <div className="text-center" data-cy="escape-projector-countdown">
      <div className="text-3xl text-slate-300">
        {t('manage.escapeProjector.timeRemaining')}
      </div>
      <div className="text-8xl font-bold tabular-nums">
        {formatDuration(remaining)}
      </div>
    </div>
  )
}

function Ranking({
  rows,
  totalStages,
  highlightTop,
}: {
  rows: NonNullable<Projector>['rows']
  totalStages: number
  highlightTop: boolean
}) {
  const t = useTranslations()

  return (
    <table className="w-full text-3xl" data-cy="escape-projector-ranking">
      <thead>
        <tr className="border-b-2 border-slate-500 text-left text-2xl text-slate-300">
          <th className="p-3">{t('manage.evaluation.escapeRoomColRank')}</th>
          <th className="p-3">{t('manage.escapeProjector.colName')}</th>
          <th className="p-3">{t('manage.evaluation.escapeRoomColCleared')}</th>
          <th className="p-3 text-right">
            {t('manage.evaluation.escapeRoomColTime')}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, ix) => (
          <tr
            key={`${row.displayName}-${ix}`}
            data-cy="escape-projector-row"
            className={twMerge(
              'border-b border-slate-700',
              highlightTop && row.rank != null && row.rank <= 3
                ? 'bg-yellow-400 font-bold text-black'
                : ''
            )}
          >
            <td className="p-3 font-bold">{row.rank ?? ''}</td>
            <td className="p-3">
              <div className="flex items-center gap-4">
                <Avatar avatar={row.avatar} />
                <span>{row.displayName}</span>
              </div>
            </td>
            <td className="p-3 tabular-nums">
              {row.clearedStages} / {totalStages}
            </td>
            <td className="p-3 text-right tabular-nums">
              {row.status === EscapeRoomProgressStatus.Completed &&
              row.rankedSeconds != null
                ? formatDuration(row.rankedSeconds)
                : ''}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function StageLabel({
  stage,
  index,
}: {
  stage: NonNullable<Projector>['stages'][number]
  index: number
}) {
  const t = useTranslations()

  return (
    <>
      {stage.isBonus
        ? t('manage.evaluation.escapeRoomStageBonus')
        : t('manage.evaluation.escapeRoomStageNumber', { number: index + 1 })}
      {stage.title ? `: ${stage.title}` : ''}
    </>
  )
}

function StageCounts({
  stage,
}: {
  stage: NonNullable<Projector>['stages'][number]
}) {
  const t = useTranslations()

  return (
    <div className="flex gap-6 text-2xl tabular-nums">
      <span className="text-green-400">
        {t('manage.evaluation.escapeRoomColSolved')}: {stage.solved}
      </span>
      <span className="text-yellow-300">
        {t('manage.evaluation.escapeRoomColRevealed')}: {stage.revealed}
      </span>
      <span className="text-red-400">
        {t('manage.evaluation.escapeRoomColSkipped')}: {stage.skipped}
      </span>
    </div>
  )
}

function EscapeProjectorContent({
  projector,
}: {
  projector: NonNullable<Projector>
}) {
  const t = useTranslations()
  const router = useRouter()

  const note = t('manage.escapeProjector.participationNote', {
    started: projector.startedCount,
    ranked: projector.rankedCount,
  })

  if (projector.phase === EscapeRoomProjectorPhase.Lobby) {
    return (
      <div className="flex flex-col items-center gap-8 text-center">
        <h1 className="text-6xl font-bold">
          {t('manage.escapeProjector.lobbyHeading')}
        </h1>
        <QR
          path={`/session/${router.query.id as string}`}
          width={100}
          showButton={false}
          className={{
            title: 'mt-0 break-all text-4xl text-white',
            canvas: 'mt-6 rounded-lg bg-white p-4',
          }}
          data={{ cy: 'escape-projector-join-link' }}
        />
        <div className="text-4xl">
          {t('manage.escapeProjector.lobbyStarted', {
            count: projector.startedCount,
          })}
        </div>
      </div>
    )
  }

  if (projector.phase === EscapeRoomProjectorPhase.Running) {
    return (
      <div className="flex flex-col gap-8">
        {projector.closesAt && (
          <Countdown
            closesAt={projector.closesAt}
            serverNow={projector.serverNow}
          />
        )}
        <Ranking
          rows={projector.rows}
          totalStages={projector.totalStages}
          highlightTop={false}
        />
        <div
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
          data-cy="escape-projector-stages"
        >
          {projector.stages.map((stage, index) => (
            <div
              key={stage.stageKey}
              className="rounded-lg border border-slate-600 p-3"
            >
              <div className="text-2xl font-bold">
                <StageLabel stage={stage} index={index} />
              </div>
              <StageCounts stage={stage} />
            </div>
          ))}
        </div>
        <div className="text-2xl text-slate-300">{note}</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-6xl font-bold">
        {t('manage.escapeProjector.finalRanking')}
      </h1>
      <Ranking
        rows={projector.rows}
        totalStages={projector.totalStages}
        highlightTop
      />
      <div className="text-2xl text-slate-300">{note}</div>
      <h2 className="text-5xl font-bold">
        {t('manage.evaluation.escapeRoomStagesHeading')}
      </h2>
      <div className="flex flex-col gap-4" data-cy="escape-projector-stages">
        {projector.stages.map((stage, index) => (
          <div
            key={stage.stageKey}
            className="rounded-lg border border-slate-600 p-4"
          >
            <div className="text-3xl font-bold">
              <StageLabel stage={stage} index={index} />
            </div>
            <StageCounts stage={stage} />
            {stage.debrief && (
              <div
                className="mt-3 rounded-lg bg-white p-4 text-2xl text-black"
                data-cy="escape-projector-debrief"
              >
                <div className="mb-1 font-bold">
                  {t('manage.evaluation.escapeRoomStageDebrief')}
                </div>
                <Markdown content={stage.debrief} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// Public projector view: no Layout and no login. The block's digest in the
// query string authorizes the read; lecturers with access need none.
function EscapeProjector() {
  const router = useRouter()
  const t = useTranslations()

  const { data, error, stopPolling } = useQuery(
    GetEscapeRoomProjectorDocument,
    {
      variables: {
        liveQuizId: router.query.id as string,
        elementBlockId: parseInt(router.query.blockId as string, 10),
        digest: router.query.digest as string | undefined,
      },
      skip: !router.isReady,
      pollInterval: 5000,
      fetchPolicy: 'network-only',
    }
  )

  const projector = data?.escapeRoomProjector

  useEffect(() => {
    if (projector?.phase === EscapeRoomProjectorPhase.Closed) {
      stopPolling()
    }
  }, [projector?.phase, stopPolling])

  return (
    <div
      className="fixed inset-0 overflow-auto bg-slate-950 p-10 text-white"
      data-cy="escape-projector"
      data-phase={projector?.phase}
    >
      {projector ? (
        <EscapeProjectorContent projector={projector} />
      ) : error ? (
        <div className="flex h-full items-center justify-center text-center text-5xl">
          {t('manage.escapeProjector.error')}
        </div>
      ) : null}
    </div>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  }
}

export default EscapeProjector
