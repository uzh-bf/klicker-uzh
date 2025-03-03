import { useQuery } from '@apollo/client'
import { UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import QR from '@pages/qr/[...args]'
import { Button, H3, Modal, Prose } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import React, { Dispatch, SetStateAction } from 'react'

function LiveQuizQRModal({
  quizId,
  open,
  setOpen,
}: {
  quizId: string
  open: boolean
  setOpen: Dispatch<SetStateAction<boolean>>
}): React.ReactElement {
  const t = useTranslations()

  const { data } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })

  const shortname = data?.userProfile?.shortname
  const accountRelativeLink = `/join/${shortname}`
  const quizRelativeLink = `/session/${quizId}`

  return (
    <Modal
      title={t('manage.general.qrCode')}
      open={open}
      onClose={() => setOpen(false)}
      className={{
        content: 'h-max max-h-full !w-max max-w-6xl overflow-y-auto',
      }}
    >
      <div className="flex flex-col gap-8 md:flex-row">
        <div className="flex-1">
          <H3>{t('manage.cockpit.qrCodeAccountLinkTitle')}</H3>
          <Prose>{t('manage.cockpit.qrCodeAccountLinkDescription')}</Prose>
          <QR
            className={{ title: 'text-base', canvas: 'flex justify-center' }}
            path={accountRelativeLink}
            width={100}
          />

          <Link passHref href={`/qr${accountRelativeLink}`} target="_blank">
            <Button
              fluid
              primary
              className={{ root: 'mt-2' }}
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
            path={quizRelativeLink}
            width={100}
          />

          <Link passHref href={`/qr${quizRelativeLink}`} target="_blank">
            <Button
              fluid
              primary
              className={{ root: 'mt-2' }}
              data={{ cy: `qr-direct-link-${quizId}` }}
            >
              <Button.Label>{t('manage.general.presentQrCode')}</Button.Label>
            </Button>
          </Link>
        </div>
      </div>
    </Modal>
  )
}

export default LiveQuizQRModal
