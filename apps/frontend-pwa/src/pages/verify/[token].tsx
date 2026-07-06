import { useQuery } from '@apollo/client'
import { QGetVerifiableCredentialDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { UserNotification } from '@uzh-bf/design-system'
import { GetServerSidePropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Head from 'next/head'
import { useRouter } from 'next/router'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export default function VerifyTokenPage() {
  const t = useTranslations()
  const router = useRouter()
  const { token } = router.query

  const { data, loading, error } = useQuery(QGetVerifiableCredentialDocument, {
    variables: { token: (token as string) || '' },
    skip: !token,
    fetchPolicy: 'network-only',
  })

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader />
      </div>
    )
  }

  const credential = data?.verifiableCredential

  // Helper to format numbers
  const formatNum = (val: number) =>
    Number.isInteger(val) ? val.toString() : val.toFixed(2)

  return (
    <>
      <Head>
        <title>
          Leistungsnachweis Verifizierung / Performance Verification
        </title>
      </Head>
      <div className="min-h-screen bg-slate-50 px-4 py-12 font-sans text-slate-900 md:px-8">
        <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-slate-200 bg-white shadow-md">
          {/* Header with UZH Logo */}
          <div className="border-uzh-blue flex flex-col items-center justify-between border-b-2 bg-white p-6 md:flex-row md:items-end">
            <div className="flex items-center gap-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 300 80"
                fill="none"
                className="h-12 w-auto"
              >
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="#121212"
                  strokeWidth="2"
                  fill="none"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="30"
                  stroke="#121212"
                  strokeWidth="1"
                  fill="none"
                />
                <text
                  x="40"
                  y="37"
                  textAnchor="middle"
                  fontFamily="Georgia, serif"
                  fontSize="7"
                  fill="#121212"
                  fontWeight="bold"
                >
                  UNIVERSITAS
                </text>
                <text
                  x="40"
                  y="47"
                  textAnchor="middle"
                  fontFamily="Georgia, serif"
                  fontSize="7"
                  fill="#121212"
                  fontWeight="bold"
                >
                  TURICENSIS
                </text>
                <line
                  x1="88"
                  y1="12"
                  x2="88"
                  y2="68"
                  stroke="#121212"
                  strokeWidth="0.5"
                />
                <text
                  x="100"
                  y="38"
                  fontFamily="'Source Sans 3', 'Source Sans Pro', Arial, sans-serif"
                  fontSize="18"
                  fontWeight="400"
                  fill="#121212"
                >
                  Universität Zürich
                </text>
                <text
                  x="100"
                  y="62"
                  fontFamily="'Source Sans 3', 'Source Sans Pro', Arial, sans-serif"
                  fontSize="22"
                  fontWeight="bold"
                  letterSpacing="2"
                  fill="#121212"
                >
                  UZH
                </text>
              </svg>
              <div className="h-8 w-px bg-slate-200" />
              <span className="text-sm font-bold text-slate-800">
                KlickerUZH
              </span>
            </div>
            <div className="mt-4 text-center md:mt-0 md:text-right">
              <h1 className="text-lg font-bold text-slate-800">
                Offizielle Leistungsverifizierung
              </h1>
              <p className="text-xs text-slate-500">
                Official Performance Verification
              </p>
            </div>
          </div>

          {/* Validation Banner */}
          {!credential || error ? (
            <div className="border-b border-red-200 bg-red-50 p-6">
              <UserNotification
                type="error"
                message="Nicht gefunden / Not Found"
              />
              <p className="mt-2 text-center text-xs text-red-600">
                Dieses Zertifikat existiert nicht oder der Link ist ungültig.
              </p>
              <p className="mt-1 text-center text-xs text-red-600">
                This credential does not exist or the link is invalid.
              </p>
            </div>
          ) : (
            <>
              {/* Success or Revoked Banner */}
              {credential.isRevoked ? (
                <div className="flex flex-col items-center border-b border-red-200 bg-red-50 p-6 text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2.5"
                      stroke="currentColor"
                      className="h-6 w-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </div>
                  <h2 className="mt-3 text-xl font-bold text-red-800">
                    Status: Widerrufen / Revoked
                  </h2>
                  <p className="mt-1 text-xs font-semibold text-red-600">
                    Dieses Dokument wurde vom Dozenten oder der Universität
                    Zürich widerrufen.
                  </p>
                  <p className="text-xs text-red-600">
                    This document has been revoked by the lecturer or the
                    University of Zurich.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center border-b border-green-200 bg-green-50 p-6 text-center">
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-green-600">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth="2.5"
                      stroke="currentColor"
                      className="h-6 w-6"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M4.5 12.75l6 6 9-13.5"
                      />
                    </svg>
                  </div>
                  <h2 className="mt-3 text-xl font-bold text-green-800">
                    Status: Verifiziert / Verified
                  </h2>
                  <p className="mt-1 text-xs text-green-600">
                    Dieses Dokument wurde offiziell von KlickerUZH signiert und
                    verifiziert.
                  </p>
                  <p className="text-xs text-green-600">
                    This document has been officially signed and verified by
                    KlickerUZH.
                  </p>
                </div>
              )}

              {/* Certificate Details */}
              <div className="p-6">
                <div className="grid grid-cols-1 gap-6 border-b border-slate-100 pb-6 md:grid-cols-2">
                  <div>
                    <label className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                      Kurs / Course
                    </label>
                    <div className="mt-1 text-lg font-bold text-slate-800">
                      {credential.course.displayName || credential.course.name}
                    </div>
                  </div>
                  <div>
                    <label className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                      Zertifikatstyp / Type
                    </label>
                    <div className="mt-1 text-sm font-semibold text-slate-700">
                      Kurs-Leistungsbericht / Course Assessment Report
                    </div>
                    <div className="text-2xs text-slate-400">
                      {credential.type}
                    </div>
                  </div>
                  <div>
                    <label className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                      Ausstellungsdatum / Date Issued
                    </label>
                    <div className="mt-1 text-sm font-semibold text-slate-700">
                      {new Date(credential.issuedAt).toLocaleDateString(
                        undefined,
                        {
                          dateStyle: 'medium',
                        }
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-2xs font-bold uppercase tracking-wider text-slate-400">
                      Verifizierungsschlüssel / Verification ID
                    </label>
                    <div className="mt-1 break-all font-mono text-xs font-semibold text-slate-600">
                      {credential.token}
                    </div>
                  </div>
                </div>

                {/* Score Section */}
                <div className="mt-6">
                  <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">
                    Punkteübersicht / Points Summary
                  </h3>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                      <div className="text-2xs font-bold uppercase text-slate-500">
                        Basispunkte
                      </div>
                      <div className="mt-1 text-xl font-bold text-slate-800">
                        {formatNum(credential.metadata.basePoints)}
                      </div>
                      <div className="text-2xs text-slate-400">
                        von {formatNum(credential.metadata.availableBasePoints)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                      <div className="text-2xs font-bold uppercase text-slate-500">
                        Korrektheit
                      </div>
                      <div className="mt-1 text-xl font-bold text-slate-800">
                        {formatNum(credential.metadata.correctnessPoints)}
                      </div>
                      <div className="text-2xs text-slate-400">
                        von{' '}
                        {formatNum(
                          credential.metadata.availableCorrectnessPoints
                        )}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center">
                      <div className="text-2xs font-bold uppercase text-slate-500">
                        Bonus
                      </div>
                      <div className="mt-1 text-xl font-bold text-slate-800">
                        {formatNum(credential.metadata.bonusPoints)}
                      </div>
                      <div className="text-2xs text-slate-400">
                        von{' '}
                        {formatNum(credential.metadata.availableBonusPoints)}
                      </div>
                    </div>
                    <div className="border-uzh-blue rounded-lg border bg-blue-50/50 p-4 text-center">
                      <div className="text-2xs text-uzh-blue font-bold uppercase">
                        Gesamtpunkte
                      </div>
                      <div className="text-uzh-blue mt-1 text-xl font-bold">
                        {formatNum(credential.metadata.totalPoints)}
                      </div>
                      <div className="text-2xs text-slate-400">
                        von{' '}
                        {formatNum(credential.metadata.availableTotalPoints)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Percentile and Histogram */}
                {credential.metadata.hasEnoughData &&
                  credential.metadata.percentile !== null && (
                    <div className="mt-8 border-t border-slate-100 pt-6">
                      <h3 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-400">
                        Vergleich / Comparison
                      </h3>
                      <div className="border-uzh-blue mb-4 rounded-r-lg border-l-4 bg-blue-50/30 p-4">
                        <div className="text-uzh-blue font-semibold">
                          Perzentil: {credential.metadata.percentile}%
                        </div>
                        <p className="mt-1 text-xs text-slate-600">
                          Dieses Perzentil gibt den Prozentsatz der
                          Teilnehmenden an, deren Punktzahl niedriger oder
                          gleich dieser ist.
                        </p>
                        <p className="text-xs text-slate-600">
                          This percentile shows the percentage of participants
                          with a score lower than or equal to this score.
                        </p>
                      </div>

                      {credential.metadata.histogram && (
                        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                          <div className="mb-3 text-center text-xs font-semibold text-slate-600">
                            Noten- / Punkteverteilung (Punkte vs. Häufigkeit)
                          </div>
                          <div className="h-56 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart
                                data={credential.metadata.histogram.map(
                                  (bin: any) => ({
                                    name: `${Math.round(bin.binStart)}-${Math.round(bin.binEnd)}`,
                                    count: bin.count,
                                    binStart: bin.binStart,
                                    binEnd: bin.binEnd,
                                  })
                                )}
                                margin={{
                                  top: 10,
                                  right: 10,
                                  left: -20,
                                  bottom: 5,
                                }}
                              >
                                <CartesianGrid
                                  strokeDasharray="3 3"
                                  vertical={false}
                                  stroke="#E2E8F0"
                                />
                                <XAxis
                                  dataKey="name"
                                  stroke="#64748B"
                                  fontSize={10}
                                  tickLine={false}
                                />
                                <YAxis
                                  allowDecimals={false}
                                  stroke="#64748B"
                                  fontSize={10}
                                  tickLine={false}
                                />
                                <Tooltip
                                  content={({ active, payload }) => {
                                    if (active && payload && payload.length) {
                                      const data = payload[0].payload
                                      return (
                                        <div className="rounded border border-slate-200 bg-white p-2 text-xs shadow-sm">
                                          <p className="font-semibold text-slate-800">
                                            Punktebereich: {data.name}
                                          </p>
                                          <p className="text-slate-600">
                                            Anzahl: {data.count}
                                          </p>
                                        </div>
                                      )
                                    }
                                    return null
                                  }}
                                />
                                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                  {credential.metadata.histogram.map(
                                    (bin: any, index: number) => {
                                      const totalPoints =
                                        credential.metadata.totalPoints
                                      const isUserBin =
                                        index ===
                                        credential.metadata.histogram.findIndex(
                                          (b: any) => {
                                            if (
                                              b.binStart ===
                                              credential.metadata.histogram[
                                                credential.metadata.histogram
                                                  .length - 1
                                              ]?.binStart
                                            ) {
                                              return (
                                                totalPoints >= b.binStart &&
                                                totalPoints <= b.binEnd
                                              )
                                            }
                                            return (
                                              totalPoints >= b.binStart &&
                                              totalPoints < b.binEnd
                                            )
                                          }
                                        )
                                      return (
                                        <Cell
                                          key={`cell-${index}`}
                                          fill={
                                            isUserBin ? '#0028A5' : '#4AC9E3'
                                          }
                                        />
                                      )
                                    }
                                  )}
                                </Bar>
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
              </div>
            </>
          )}

          {/* Footer Disclaimer */}
          <div className="text-2xs border-t border-slate-100 bg-slate-50 p-6 text-center leading-relaxed text-slate-400">
            Die Verifizierungsdaten werden direkt aus den manipulationssicheren
            KlickerUZH Datenbanken bezogen. Bei Fragen wenden Sie sich an die
            Universität Zürich.
            <br />
            Verification data is fetched directly from secure KlickerUZH
            servers. For questions, please contact the University of Zurich.
          </div>
        </div>
      </div>
    </>
  )
}

export async function getServerSideProps(ctx: GetServerSidePropsContext) {
  const locale = ctx.locale || 'en'
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}
