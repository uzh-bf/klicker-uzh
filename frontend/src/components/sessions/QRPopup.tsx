import React from 'react'
import { Popup, Button, Icon } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'
import QRCode from 'qrcode.react'
import getConfig from 'next/config'

const { publicRuntimeConfig } = getConfig()

interface Props {
  shortname: string
}

function QRPopup({ shortname }: Props): React.ReactElement {
  return (
    <Popup
      basic
      hideOnScroll
      on="click"
      position="bottom right"
      trigger={
        <div className="qrTrigger">
          <Button icon labelPosition="left" size="small">
            <Icon name="qrcode" />
            QR Code
          </Button>
        </div>
      }
    >
      <Popup.Content>
        <div className="popupContent">
          <div className="link">
            <strong>
              {publicRuntimeConfig.joinUrl
                ? `${publicRuntimeConfig.joinUrl}/${shortname}`
                : `${publicRuntimeConfig.baseUrl}/join/${shortname}`}
            </strong>
          </div>

          <div className="qr">
            <QRCode size={200} value={`${publicRuntimeConfig.baseUrl}/join/${shortname}`} />
          </div>

          <a href={`/qr/${shortname}`} rel="noopener noreferrer" target="_blank">
            <Button fluid primary>
              <FormattedMessage defaultMessage="Present QR" id="sessionArea.qrPresentation" />
            </Button>
          </a>
        </div>
      </Popup.Content>
    </Popup>
  )
}

export default QRPopup
