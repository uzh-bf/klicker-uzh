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
      title={t('manage.cockpit.liveQuizQRCodes')}
      open={open}
      onClose={() => setOpen(false)}
      className={{ content: '!w-full max-w-6xl pb-2' }}
    >
      <div className="flex flex-col gap-8 md:flex-row">
        <div className="flex flex-1 flex-col justify-between">
          <div>
            <H3>{t('manage.cockpit.qrCodeAccountLinkTitle')}</H3>
            <Prose className={{ root: 'leading-6' }}>
              {t('manage.cockpit.qrCodeAccountLinkDescription')}
            </Prose>
          </div>

          <div>
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
        </div>
        <div className="flex flex-1 flex-col justify-between">
          <div>
            <H3>{t('manage.cockpit.qrCodeDirectLinkTitle')}</H3>
            <Prose className={{ root: 'leading-6' }}>
              {t('manage.cockpit.qrCodeDirectLinkDescription')}
            </Prose>
          </div>

          <div>
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
      </div>
    </Modal>
  )
}

export default LiveQuizQRModal
