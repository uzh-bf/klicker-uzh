import { faPencil } from '@fortawesome/free-solid-svg-icons'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button, UserNotification } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ProfileData from '../components/participant/ProfileData'
import { trpc } from '../lib/trpc'

const Profile = () => {
  const t = useTranslations()
  const router = useRouter()
  const { data, error, isLoading } =
    trpc.participant.selfWithAchievements.useQuery()
  const profile = data?.selfWithAchievements

  if (isLoading && !profile)
    return (
      <Layout
        course={{ displayName: 'KlickerUZH' }}
        displayName={t('pwa.profile.myProfile')}
      >
        <Loader />
      </Layout>
    )

  if (error && !profile) {
    return (
      <Layout
        course={{ displayName: 'KlickerUZH' }}
        displayName={t('pwa.profile.myProfile')}
      >
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      </Layout>
    )
  }

  if (!profile) {
    return (
      <Layout
        course={{ displayName: 'KlickerUZH' }}
        displayName={t('pwa.profile.myProfile')}
      >
        <UserNotification
          type="error"
          message={t('shared.generic.systemError')}
        />
      </Layout>
    )
  }

  const { participant, achievements } = profile

  return (
    <Layout
      course={{ displayName: 'KlickerUZH' }}
      displayName={t('pwa.profile.myProfile')}
    >
      <div className="flex flex-col items-center gap-2 rounded border p-2 md:mx-auto md:w-max md:p-4">
        {error && profile ? (
          <UserNotification
            type="error"
            message={t('shared.generic.systemError')}
          />
        ) : null}
        <Button
          basic
          onClick={() => router.push('/editProfile')}
          className={{ root: 'self-end hover:bg-white hover:underline' }}
          data={{ cy: 'edit-profile' }}
        >
          <Button.Icon icon={faPencil} />
          <Button.Label>{t('pwa.profile.editProfile')}</Button.Label>
        </Button>
        <ProfileData
          isSelf={true}
          username={participant.username}
          avatar={participant.avatar}
          xp={participant.xp ?? 0}
          level={participant.levelData}
          achievements={participant.achievements}
          possibleAchievements={achievements}
          showProfileDetails={true}
        />

        <div className="mt-4 self-center">
          <Image
            src="/KlickerLogo.png"
            width={200}
            height={60}
            alt="KlickerUZH Logo"
          />
        </div>
      </div>
    </Layout>
  )
}

export async function getStaticProps({ locale }: GetStaticPropsContext) {
  return {
    props: {
      messages: (await import(`@klicker-uzh/i18n/messages/${locale}`)).default,
    },
  }
}

export default Profile
