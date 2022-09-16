import { GetStaticPaths, GetStaticProps } from 'next'
import React from 'react'
import { QRCode } from 'react-qrcode-logo'

interface Props {
  path: string
  width: number
}

const defaultProps = {
  width: 334
}

export function QR({ path , width }: Props): React.ReactElement {
  return (
    <QRCode
      logoHeight={width / 3.34}
      logoImage="https://www.klicker.uzh.ch/klicker_logo_v2.png"
      logoWidth={width}
      size={width * 2}
      value={`https://pwa.klicker.uzh.ch/${path}`}
    />
  )
}

QR.defaultProps = defaultProps

export const getStaticProps: GetStaticProps = function ({ params }) {
  const args = params!.args as string[]

  return {
    props: {
      path: `/${args.join('/')}`
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
