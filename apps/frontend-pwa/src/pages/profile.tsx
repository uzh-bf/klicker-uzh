import { useMutation, useQuery } from '@apollo/client'
import {
  LogoutParticipantDocument,
  SelfWithAchievementsDocument,
} from '@klicker-uzh/graphql/dist/ops'
import Loader from '@klicker-uzh/shared-components/src/Loader'
import { Button } from '@uzh-bf/design-system'
import { GetStaticPropsContext } from 'next'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ProfileData from '../components/participant/ProfileData'

const Profile = () => {
  const t = useTranslations()
  const { data, loading } = useQuery(SelfWithAchievementsDocument)
  const [logoutParticipant, { loading: loggingOut }] = useMutation(
    LogoutParticipantDocument
  )
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
  const pageInFrame = window && window?.location !== window?.parent.location

  return (
    <Layout
      course={{ displayName: 'KlickerUZH' }}
      displayName={t('pwa.profile.myProfile')}
    >
      <div className="flex flex-col items-center gap-4 rounded border p-4 md:mx-auto md:w-max">
        <ProfileData
          isSelf={true}
          username={participant.username}
          avatar={participant.avatar}
          xp={participant.xp}
          level={participant.levelData}
          achievements={participant.achievements}
          possibleAchievements={achievements}
          showProfileDetails={true}
        />

        <div className="flex w-full flex-row justify-between space-x-2 px-4">
          <Button
            onClick={() => router.push('/editProfile')}
            className={{ root: 'mt-2' }}
            data={{ cy: 'edit-profile' }}
          >
            {t('pwa.profile.editProfile')}
          </Button>

          {!pageInFrame && (
            <Button
              loading={loggingOut}
              onClick={async () => {
                await logoutParticipant()
                router.push('/login')
              }}
              className={{ root: 'mt-2' }}
              data={{ cy: 'logout' }}
            >
              {t('shared.generic.logout')}
            </Button>
          )}
        </div>

        <div className="mt-8 self-center">
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
