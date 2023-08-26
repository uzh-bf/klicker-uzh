import { GetStaticPaths, GetStaticPropsContext } from 'next'
import React from 'react'
import { QRCode } from 'react-qrcode-logo'

interface Props {
  path: string
  width: number
}

export function QR({ path, width = 334 }: Props): React.ReactElement {
  return (
    <QRCode
      logoHeight={width / 3.34}
      logoImage="https://www.klicker.uzh.ch/klicker_logo_v2.png"
      logoWidth={width}
      size={width * 2}
      value={`${process.env.NEXT_PUBLIC_PWA_URL}${path}`}
    />
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
