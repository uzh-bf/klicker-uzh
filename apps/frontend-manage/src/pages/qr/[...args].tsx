import { faDownload } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Button } from '@uzh-bf/design-system'
import { toPng } from 'html-to-image'
import { GetStaticPaths, GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import React, { useCallback, useRef } from 'react'
import { QRCode } from 'react-qrcode-logo'
import { twMerge } from 'tailwind-merge'

interface Props {
  path: string
  width: number
  className?: {
    title?: string
    canvas?: string
  }
}

export function QR({
  path,
  width = 200,
  className,
}: Props): React.ReactElement {
  const t = useTranslations()

  const canvasRef = useRef<HTMLDivElement>(null)

  const onButtonClick = useCallback(() => {
    if (canvasRef.current === null) {
      return
    }

    toPng(canvasRef.current)
      .then((dataUrl) => {
        const link = document.createElement('a')
        link.download = `${path}.png`
        link.href = dataUrl
        link.click()
      })
      .catch((err) => {
        console.log(err)
      })
  }, [canvasRef, path])

  return (
    <div className="space-y-2">
      <Link target="_blank" href={`${process.env.NEXT_PUBLIC_PWA_URL}${path}`}>
        <div className={twMerge('text-primary-100 text-6xl', className?.title)}>
          {process.env.NEXT_PUBLIC_PWA_URL}
          {path}
        </div>
      </Link>
      <div ref={canvasRef} className={className?.canvas}>
        <QRCode
          logoHeight={width / 3.34}
          logoImage="/img/KlickerLogo.png"
          logoWidth={width}
          size={width * 3}
          value={`${process.env.NEXT_PUBLIC_PWA_URL}${path}`}
        />
      </div>
      <Button fluid onClick={onButtonClick} data={{ cy: 'download-qr-code' }}>
        <Button.Icon>
          <FontAwesomeIcon icon={faDownload} />
        </Button.Icon>
        <Button.Label>{t('shared.generic.download')}</Button.Label>
      </Button>
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
