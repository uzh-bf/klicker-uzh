import { useQuery } from '@apollo/client'
import { faQrcode } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import QR from '@pages/qr/[...args]'
import { Button, H3, Modal, Prose } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import React, { useState } from 'react'
import { twMerge } from 'tailwind-merge'

interface Props {
  sessionId: string
  shortname: string
}

function SessionQRModal({ sessionId, shortname }: Props): React.ReactElement {
  const t = useTranslations()
  const [modalOpen, setModalOpen] = useState(false)

  const { data } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })

  const accountRelativeLink = `/join/${data?.userProfile?.shortname}`
  const sessionRelativeLink = `/session/${sessionId}`

  return (
    <Modal
      title="QR Code"
      trigger={
        <Button
          className={{ root: 'w-[41%] sm:w-max !mr-0' }}
          onClick={() => setModalOpen(true)}
        >
          <Button.Icon>
            <FontAwesomeIcon icon={faQrcode} />
          </Button.Icon>
          {t('manage.general.qrCode')}
        </Button>
      }
      open={modalOpen}
      onClose={() => setModalOpen(false)}
      className={{
        content: 'max-w-6xl',
      }}
    >
      <div className="flex flex-row gap-8">
        <div className="flex-1">
          <H3>Account Link</H3>
          <Prose>{t('manage.cockpit.qrCodeAccountLinkDescription')}</Prose>
          <QR
            className={{ title: 'text-base' }}
            path={accountRelativeLink}
            width={100}
          />

          <Link passHref href={`/qr/${accountRelativeLink}`} target="_blank">
            <Button
              className={{
                root: twMerge(
                  'text-lg font-bold text-white h-11 bg-primary-80'
                ),
              }}
            >
              <Button.Label>{t('manage.general.presentQrCode')}</Button.Label>
            </Button>
          </Link>
        </div>
        <div className="flex-1">
          <H3>{t('manage.cockpit.qrCodeDirectLinkTitle')}</H3>
          <Prose>{t('manage.cockpit.qrCodeDirectLinkDescription')}</Prose>
          <QR
            className={{ title: 'text-base' }}
            path={sessionRelativeLink}
            width={100}
          />

          <Link passHref href={`/qr/${sessionRelativeLink}`} target="_blank">
            <Button
              className={{
                root: twMerge(
                  'text-lg font-bold text-white h-11 bg-primary-80'
                ),
              }}
            >
              <Button.Label>{t('manage.general.presentQrCode')}</Button.Label>
            </Button>
          </Link>
        </div>
      </div>
    </Modal>
  )
}

export default SessionQRModal
