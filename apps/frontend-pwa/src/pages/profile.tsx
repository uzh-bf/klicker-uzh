import { useMutation, useQuery } from '@apollo/client'
import {
  LogoutParticipantDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button } from '@uzh-bf/design-system'
import { useTranslations } from 'next-intl'
import Image from 'next/image'
import { useRouter } from 'next/router'
import Layout from '../components/Layout'
import ProfileData from '../components/participant/ProfileData'

const Profile = () => {
  const t = useTranslations()
  const { data, loading } = useQuery(SelfDocument)
  const [logoutParticipant] = useMutation(LogoutParticipantDocument)
  const router = useRouter()

  if (loading || !data?.self) return <div>loading...</div>

  const pageInFrame = window && window?.location !== window?.parent.location

  return (
    <Layout
      course={{ displayName: 'KlickerUZH' }}
      displayName={t('pwa.profile.myProfile')}
    >
      <div className="flex flex-col items-center gap-8 md:mx-auto md:w-full">
        <ProfileData
          isSelf={true}
          username={data.self.username}
          avatar={data.self.avatar}
          xp={data.self.xp}
          level={data.self.levelData}
          achievements={data.self.achievements}
        />

        <div className="space-x-2">
          <Button
            onClick={() => router.push('/editProfile')}
            className={{ root: 'mt-2' }}
          >
            {t('pwa.profile.editProfile')}
          </Button>

          {!pageInFrame && (
            <Button
              onClick={async () => {
                await logoutParticipant()
                router.push('/login')
              }}
              className={{ root: 'mt-2' }}
            >
              {t('shared.generic.logout')}
            </Button>
          )}
        </div>

        <div className="self-center mt-8">
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

export function getStaticProps({ locale }: any) {
  return {
    props: {
      messages: {
        ...require(`shared-components/src/intl-messages/${locale}.json`),
      },
    },
  }
}

export default Profile
