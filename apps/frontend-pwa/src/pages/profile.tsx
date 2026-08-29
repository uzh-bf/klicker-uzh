import { useQuery } from '@apollo/client'
import { faPencil, faRoute } from '@fortawesome/free-solid-svg-icons'
import { SelfWithAchievementsDocument } from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import { TOUR_REPLAY_HREF } from '../components/onboarding/PwaOnboardingTour'
import ProfileData from '../components/participant/ProfileData'

const Profile = () => {
  const t = useTranslations()
  const { data, loading } = useQuery(SelfWithAchievementsDocument)
  const router = useRouter()

  if (loading || !data?.selfWithAchievements)
    return (
      <Layout
        course={{ displayName: 'KlickerUZH' }}
        displayName={t('pwa.profile.myProfile')}
      >
        <Loader />
      </Layout>
    )

  const { participant, achievements } = data.selfWithAchievements

  return (
    <Layout
      course={{ displayName: 'KlickerUZH' }}
      displayName={t('pwa.profile.myProfile')}
    >
      <div className="flex flex-col items-center gap-2 rounded border p-2 md:mx-auto md:w-max md:p-4">
        <div className="flex flex-row gap-2 self-end">
          {/* The assessment build never mounts the tour, so the replay would
              navigate to an overview page that shows nothing. */}
          {process.env.NEXT_PUBLIC_IS_ASSESSMENT !== 'true' && (
            <Button
              basic
              // The tour describes the overview page, so a replay goes there
              // instead of showing only the steps this page happens to carry.
              onClick={() => router.push(TOUR_REPLAY_HREF)}
              className={{ root: 'hover:bg-white hover:underline' }}
              data={{ cy: 'replay-onboarding-tour' }}
            >
              <Button.Icon icon={faRoute} />
              <Button.Label>{t('pwa.productTours.replayTitle')}</Button.Label>
            </Button>
          )}
          <Button
            basic
            onClick={() => router.push('/editProfile')}
            className={{ root: 'hover:bg-white hover:underline' }}
            data={{ cy: 'edit-profile' }}
          >
            <Button.Icon icon={faPencil} />
            <Button.Label>{t('pwa.profile.editProfile')}</Button.Label>
          </Button>
        </div>
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
