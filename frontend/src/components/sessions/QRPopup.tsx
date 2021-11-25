import React from 'react'
import { Popup, Button, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import { QRCode } from 'react-qrcode-logo'
import Link from 'next/link'
import getConfig from 'next/config'

const { publicRuntimeConfig } = getConfig()

interface Props {
  shortname: string
}

function QRPopup({ shortname }: Props): React.ReactElement {
  const joinUrl = publicRuntimeConfig.joinUrl
    ? `${publicRuntimeConfig.joinUrl}/${shortname}`
    : `${publicRuntimeConfig.baseUrl}/join/${shortname}`

  return (
    <Popup
      basic
      hideOnScroll
      on="click"
      position="bottom right"
      trigger={
        <Button icon labelPosition="left" size="small" className="w-1/2 sm:w-max">
          <Icon name="qrcode" />
          QR Code
        </Button>
      }
    >
      <Popup.Content>
        <div>
          <div className="font-bold">
            <Link href={joinUrl}>{joinUrl}</Link>
          </div>

          <div>
            <QRCode
              logoHeight={40}
              logoImage="https://www.klicker.uzh.ch/docs/img/KlickerUZH_Gray_BG.png"
              logoWidth={120}
              size={300}
              value={`${publicRuntimeConfig.baseUrl}/join/${shortname}`}
            />
          </div>

          <Link passHref href={`/qr/${shortname}`}>
            <a target="_blank">
              <Button fluid primary>
                <FormattedMessage defaultMessage="Present QR" id="sessionArea.qrPresentation" />
              </Button>
            </a>
          </Link>
        </div>
      </Popup.Content>
    </Popup>
  )
}

export default QRPopup
