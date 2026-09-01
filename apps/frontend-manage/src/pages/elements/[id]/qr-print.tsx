import { useQuery } from '@apollo/client'
import { faPrint } from '@fortawesome/free-solid-svg-icons'
import { GetQrScanPrintDataDocument } from '@klicker-uzh/graphql/dist/ops'
import { Markdown } from '@klicker-uzh/markdown'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, H1, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import { useRouter } from 'next/router'
import { useMemo, useState } from 'react'
import { QRCode } from 'react-qrcode-logo'
import Layout from '../../../components/Layout'

function QrPrintCard({ code, index }: { code: string; index: number }) {
  const t = useTranslations()
  return (
    <div className="break-inside-avoid rounded border border-slate-300 p-4 text-center">
      <QRCode value={code} size={180} />
      <div className="mt-2 text-sm font-semibold">
        {t('manage.elements.qrPrintSheet', { number: index + 1 })}
      </div>
      <code className="text-xs">{code}</code>
    </div>
  )
}

function QrPrintPage() {
  const t = useTranslations()
  const router = useRouter()
  const elementId = Number(router.query.id)
  const [decoyCount, setDecoyCount] = useState(3)
  const { data, loading, error } = useQuery(GetQrScanPrintDataDocument, {
    variables: { elementId, decoyCount },
    skip: !Number.isInteger(elementId),
    fetchPolicy: 'network-only',
  })
  const printData = data?.qrScanPrintData
  const sheets = useMemo(() => {
    if (!printData) return []
    const codes = [printData.code, ...printData.decoys]
    // Keep the answer out of a predictable position on the printed sheet.
    for (let index = codes.length - 1; index > 0; index--) {
      const randomBuffer = new Uint32Array(1)
      crypto.getRandomValues(randomBuffer)
      const swapIndex = randomBuffer[0]! % (index + 1)
      ;[codes[index], codes[swapIndex]] = [codes[swapIndex]!, codes[index]!]
    }
    return codes
  }, [printData])

  return (
    <Layout>
      <div className="mx-auto w-full max-w-5xl p-6 print:max-w-none print:p-0">
        <div className="mb-6 flex items-end justify-between gap-4 print:hidden">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            {t('manage.elements.qrPrintDecoyCount')}
            <input
              className="w-24 rounded border border-slate-300 px-3 py-2"
              type="number"
              min={0}
              max={20}
              value={decoyCount}
              data-cy="qr-print-decoy-count"
              onChange={(event) => {
                const value = Number(event.target.value)
                setDecoyCount(Math.max(0, Math.min(20, Math.trunc(value || 0))))
              }}
            />
          </label>
          <Button
            onClick={() => window.print()}
            data={{ cy: 'print-qr-sheets' }}
          >
            <Button.Icon icon={faPrint} />
            <Button.Label>{t('manage.elements.qrPrintAction')}</Button.Label>
          </Button>
        </div>

        {loading ? <Loader /> : null}
        {!loading && error ? (
          <UserNotification type="error">
            {t('shared.generic.systemError')}
          </UserNotification>
        ) : null}
        {!loading && !error && !printData ? (
          <UserNotification type="error">
            {t('manage.elements.qrPrintUnauthorized')}
          </UserNotification>
        ) : null}
        {printData ? (
          <>
            <H1>{printData.name}</H1>
            <div className="my-4">
              <Markdown content={printData.content} />
            </div>
            <p className="mb-4 text-sm print:hidden">
              {t('manage.elements.qrPrintLegend', { code: printData.code })}
            </p>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2">
              {sheets.map((code, index) => (
                <QrPrintCard key={code} code={code} index={index} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </Layout>
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
  return { paths: [], fallback: 'blocking' }
}

export default QrPrintPage
