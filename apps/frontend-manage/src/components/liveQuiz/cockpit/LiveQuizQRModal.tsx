import { useQuery } from '@apollo/client'
import {
  faCheck,
  faTriangleExclamation,
} from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { LocaleType, UserProfileDocument } from '@klicker-uzh/graphql/dist/ops'
import QR from '@pages/qr/[...args]'
import { Button, H3, Modal, Prose } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Link from 'next/link'
import React from 'react'

function LiveQuizQRModal({
  quizId,
  quizPin,
  isAssessmentEnabled,
  language,
  onClose,
}: {
  quizId: string
  quizPin?: string | null
  isAssessmentEnabled: boolean
  language?: LocaleType | null
  onClose: () => void
}): React.ReactElement {
  const t = useTranslations()
  const { data } = useQuery(UserProfileDocument, {
    fetchPolicy: 'cache-only',
  })

  const shortname = data?.userProfile?.shortname
  const accountRelativeLink = `${language ? `/${language}` : ''}/join/${shortname}`
  const quizRelativeLink = `${language ? `/${language}` : ''}/session/${quizId}${
    quizPin ? `?pin=${encodeURIComponent(quizPin)}` : ''
  }`

  return (
    <Modal
      open
      title={
        <div className="relative mb-2 w-full">
          <span className="block text-left">
            {t('manage.cockpit.liveQuizQRCodes')}
          </span>
          {quizPin ? (
            <span
              className="border-uzh-grey-100 text-uzh-red-100 absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md border bg-white px-2.5 py-0.5 text-xl tracking-wide md:text-2xl"
              data-cy="live-quiz-pin-header"
            >
              <span>{t('shared.generic.pin')}: </span>
              <span className="inline-flex gap-1">
                <span>{quizPin.slice(0, 3)}</span>
                <span>{quizPin.slice(3)}</span>
              </span>
            </span>
          ) : null}
        </div>
      }
      onClose={onClose}
      className={{ content: 'w-full! max-w-6xl pb-2' }}
      dataCloseButton={{ cy: 'live-quiz-qr-modal-close' }}
    >
      <div className="flex flex-col gap-8 md:flex-row">
        <div className="flex flex-1 flex-col justify-between">
          <div>
            <div className="flex flex-row items-center justify-between">
              <H3>{t('manage.cockpit.qrCodeAccountLinkTitle')}</H3>
              {quizPin ? (
                <div className="text-uzh-red-100 flex flex-row items-center gap-2.5">
                  <FontAwesomeIcon icon={faTriangleExclamation} />
                  <span>{t('manage.cockpit.qrCodeAccountLinkPinWarning')}</span>
                </div>
              ) : null}
            </div>
            <Prose className={{ root: 'prose-sm max-w-full leading-5' }}>
              {t('manage.cockpit.qrCodeAccountLinkDescription')}
            </Prose>
          </div>

          <div>
            <QR
              assessmentMode={isAssessmentEnabled}
              path={accountRelativeLink}
              width={100}
              data={{ cy: 'qr-link-shortname' }}
              className={{ title: 'text-base', canvas: 'flex justify-center' }}
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
            <div className="flex flex-row items-center justify-between">
              <H3>{t('manage.cockpit.qrCodeDirectLinkTitle')}</H3>
              {quizPin ? (
                <div className="flex flex-row items-center gap-2.5 text-green-700">
                  <FontAwesomeIcon icon={faCheck} />
                  <span>{t('manage.cockpit.qrCodeDirectLinkIncluded')}</span>
                </div>
              ) : null}
            </div>
            <Prose className={{ root: 'prose-sm max-w-full leading-5' }}>
              {t('manage.cockpit.qrCodeDirectLinkDescription')}
            </Prose>
          </div>

          <div>
            <QR
              assessmentMode={isAssessmentEnabled}
              path={quizRelativeLink}
              width={100}
              data={{ cy: 'qr-link-direct' }}
              className={{ title: 'text-base', canvas: 'flex justify-center' }}
            />
            <Link passHref href={`/qr${quizRelativeLink}`} target="_blank">
              <Button fluid primary className={{ root: 'mt-2' }}>
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
