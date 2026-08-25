import { useMutation } from '@apollo/client'
import type { ParticipantAchievementInstance } from '@klicker-uzh/graphql/dist/ops'
import { AcknowledgeAchievementReceiptDocument } from '@klicker-uzh/graphql/dist/ops'
import dayjs from 'dayjs'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useTranslations } from 'next-intl'
import { useEffect, useRef, useState } from 'react'

function ReceivedAchievementTile({
  instance,
  isSelf,
}: {
  instance: ParticipantAchievementInstance
  isSelf: boolean
}) {
  const { locale } = useRouter()
  const achievement = instance.achievement
  const t = useTranslations()
  const [acknowledgeAchievementReceipt] = useMutation(
    AcknowledgeAchievementReceiptDocument
  )
  const [receiptAcknowledged, setReceiptAcknowledged] = useState(false)
  const acknowledgementAttempted = useRef(false)

  useEffect(() => {
    if (
      !isSelf ||
      instance.receiptAcknowledgedAt !== null ||
      acknowledgementAttempted.current
    ) {
      return
    }

    acknowledgementAttempted.current = true

    void acknowledgeAchievementReceipt({
      variables: { achievementInstanceId: instance.id },
    })
      .then(({ data }) => {
        if (data?.acknowledgeAchievementReceipt) {
          setReceiptAcknowledged(true)
        }
      })
      .catch(() => {
        // A failed acknowledgement remains pending and is retried when the
        // profile is mounted again.
      })
  }, [
    acknowledgeAchievementReceipt,
    instance.id,
    instance.receiptAcknowledgedAt,
    isSelf,
  ])

  // Public profiles do not receive the private receipt field. They must not
  // display a pending receipt or attempt to acknowledge it.
  const receiptPending =
    isSelf === true &&
    instance.receiptAcknowledgedAt === null &&
    !receiptAcknowledged

  return (
    <div className="flex w-full flex-row items-center gap-4 rounded border px-3 py-2">
      <Image
        src={achievement.icon}
        width={80}
        height={80}
        alt=""
        className="contain"
      />

      <div className="flex-1">
        {receiptPending && (
          <div className="mb-1 text-xs font-bold text-primary">
            {t('pwa.general.newAchievementReceipt')}
          </div>
        )}
        <div className="text-sm font-bold">
          {locale === 'de' ? achievement.nameDE : achievement.nameEN}
        </div>
        <div className="text-xs">
          {locale === 'de'
            ? achievement.descriptionDE
            : achievement.descriptionEN}
        </div>
        <div className="mt-1 flex flex-row justify-between border-t pt-1 text-xs">
          <div>{instance.achievedCount}x</div>
          <div>{dayjs(instance.achievedAt).format('DD.MM.YYYY')}</div>
        </div>
      </div>
    </div>
  )
}

export default ReceivedAchievementTile
