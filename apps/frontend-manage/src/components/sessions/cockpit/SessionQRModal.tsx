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
          className={{ root: '!mr-0 w-[41%] sm:w-max' }}
          onClick={() => setModalOpen(true)}
          data={{ cy: `qr-modal-trigger-${shortname}` }}
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
        content: 'h-max max-h-full max-w-6xl overflow-y-auto',
      }}
    >
      <div className="flex flex-col gap-8 md:flex-row">
        <div className="flex-1">
          <H3>Account Link</H3>
          <Prose>{t('manage.cockpit.qrCodeAccountLinkDescription')}</Prose>
          <QR
            className={{ title: 'text-base', canvas: 'flex justify-center' }}
            path={accountRelativeLink}
            width={100}
          />

          <Link passHref href={`/qr${accountRelativeLink}`} target="_blank">
            <Button
              fluid
              className={{
                root: twMerge(
                  'bg-primary-80 mt-2 h-9 text-lg font-bold text-white'
                ),
              }}
              data={{ cy: `qr-link-${shortname}` }}
            >
              <Button.Label>{t('manage.general.presentQrCode')}</Button.Label>
            </Button>
          </Link>
        </div>
        <div className="flex-1">
          <H3>{t('manage.cockpit.qrCodeDirectLinkTitle')}</H3>
          <Prose>{t('manage.cockpit.qrCodeDirectLinkDescription')}</Prose>
          <QR
            className={{ title: 'text-base', canvas: 'flex justify-center' }}
            path={sessionRelativeLink}
            width={100}
          />

          <Link passHref href={`/qr${sessionRelativeLink}`} target="_blank">
            <Button
              fluid
              className={{
                root: twMerge(
                  'bg-primary-80 mt-2 h-9 text-lg font-bold text-white'
                ),
              }}
              data={{ cy: `qr-direct-link-${sessionId}` }}
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
