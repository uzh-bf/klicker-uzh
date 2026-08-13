import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { Button } from '@uzh-bf/design-system'
import { GetStaticPaths, GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import React, { MutableRefObject, useCallback, useRef } from 'react'
import { QRCode } from 'react-qrcode-logo'
import { twMerge } from 'tailwind-merge'

interface Props {
  path: string
  assessmentMode?: boolean
  width?: number
  className?: {
    root?: string
    title?: string
    canvas?: string
  }
  showLink?: boolean
  showButton?: boolean
  showLogo?: boolean
  data?: { cy?: string; test?: string }
}

export function QR({
  path,
  assessmentMode = false,
  width = 200,
  className,
  showLink = true,
  showButton = true,
  showLogo = true,
  data,
}: Props): React.ReactElement {
  const t = useTranslations()

  const ref = useRef<QRCode>(null)

  const onButtonClick = useCallback(() => {
    if (ref.current === null) {
      return
    }

    ref.current?.download('png', `klickeruzh-${path}.png`)
  }, [path])

  const link = `${assessmentMode ? process.env.NEXT_PUBLIC_ASSESSMENT_URL : process.env.NEXT_PUBLIC_PWA_URL}${path}`

  return (
    <div className={twMerge('flex flex-col items-center', className?.root)}>
      {showLink && (
        <Link
          href={link}
          className={twMerge(
            'text-primary-100 mt-4 text-6xl',
            className?.title
          )}
          target="_blank"
          rel="noopener noreferrer"
          data-cy={data?.cy}
          data-test={data?.test}
        >
          {link}
        </Link>
      )}
      <div className={className?.canvas}>
        {showLogo && width ? (
          <QRCode
            ref={ref as MutableRefObject<QRCode>}
            logoHeight={width / 3.34}
            logoImage="/img/KlickerLogo.png"
            logoWidth={width}
            size={width * 3}
            value={link}
          />
        ) : (
          <QRCode
            ref={ref as MutableRefObject<QRCode>}
            style={{ width: '100%', height: '100%' }}
            value={link}
          />
        )}
      </div>
      {showButton && (
        <Button fluid onClick={onButtonClick} data={{ cy: 'download-qr-code' }}>
          <Button.Icon icon={faDownload} />
          <Button.Label>{t('shared.generic.download')}</Button.Label>
        </Button>
      )}
    </div>
  )
}

export async function getStaticProps({
  params,
  locale,
}: GetStaticPropsContext) {
  // TODO: adapt this function (possibly to getServerSideProps in order to also forward the query parameters to the QR component)
  const args = params!.args as string[]

  return {
    props: {
      path: `/${args.join('/')}`,
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export const getStaticPaths: GetStaticPaths = function () {
  return {
    paths: [],
    fallback: true,
  }
}

export default QR
