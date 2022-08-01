import React from 'react'
import { Popup } from 'semantic-ui-react'
import { Button } from '@uzh-bf/design-system'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faQrcode } from '@fortawesome/free-solid-svg-icons'
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
        <Button className="w-[41%] sm:w-max !mr-0" labelPosition="left" size="small">
          <Button.Icon>
            <FontAwesomeIcon icon={faQrcode} />
          </Button.Icon>
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
              logoImage="https://www.klicker.uzh.ch/img/KlickerUZH_Gray_BG.png"
              logoWidth={120}
              size={300}
              value={`${publicRuntimeConfig.baseUrl}/join/${shortname}`}
            />
          </div>

          <Link passHref href={`/qr/${shortname}`}>
            <a target="_blank">
              <Button fluid className="text-lg font-bold text-white bg-uzh-blue-80 h-11">
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
