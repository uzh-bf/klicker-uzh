import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { GetStaticPaths, GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import React, { MutableRefObject, useCallback, useRef } from 'react'
import { QRCode } from 'react-qrcode-logo'
import { twMerge } from 'tailwind-merge'

interface Props {
  path: string
  width?: number
  className?: {
    root?: string
    title?: string
    canvas?: string
  }
  showLink?: boolean
  showButton?: boolean
  showLogo?: boolean
}

export function QR({
  path,
  width = 200,
  className,
  showLink = true,
  showButton = true,
  showLogo = true,
}: Props): React.ReactElement {
  const t = useTranslations()

  const ref = useRef<QRCode>()

  const onButtonClick = useCallback(() => {
    if (ref.current === null) {
      return
    }

    ref.current?.download('png', `klickeruzh-${path}.png`)
  }, [ref, path])

  return (
    <div className={twMerge('space-y-2', className?.root)}>
      {showLink && (
        <Link
          target="_blank"
          href={`${process.env.NEXT_PUBLIC_PWA_URL}${path}`}
        >
          <div
            className={twMerge('text-primary-100 text-6xl', className?.title)}
          >
            {process.env.NEXT_PUBLIC_PWA_URL}
            {path}
          </div>
        </Link>
      )}
      <div className={className?.canvas}>
        {showLogo && width ? (
          <QRCode
            ref={ref as MutableRefObject<QRCode>}
            logoHeight={width / 3.34}
            logoImage="/img/logos/KlickerLogo.png"
            logoWidth={width}
            size={width * 3}
            value={`${process.env.NEXT_PUBLIC_PWA_URL}${path}`}
          />
        ) : (
          <QRCode
            ref={ref as MutableRefObject<QRCode>}
            style={{ width: '100%', height: '100%' }}
            value={`${process.env.NEXT_PUBLIC_PWA_URL}${path}`}
          />
        )}
      </div>
      {showButton && (
        <Button fluid onClick={onButtonClick} data={{ cy: 'download-qr-code' }}>
          <Button.Icon>
            <FontAwesomeIcon icon={faDownload} />
          </Button.Icon>
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
