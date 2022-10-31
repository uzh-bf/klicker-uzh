import { useMutation, useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import {
  LogoutParticipantDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H1 } from '@uzh-bf/design-system'
import Image from 'next/future/image'
import Router from 'next/router'

const Profile = () => {
  const { data, loading } = useQuery(SelfDocument)
  const [logoutParticipant] = useMutation(LogoutParticipantDocument)

  if (loading || !data?.self) return <div>loading...</div>

  const pageInFrame = window && window?.location !== window?.parent.location

  return (
    <Layout courseName="KlickerUZH" displayName="Mein Profil">
      <div className="flex flex-col items-center md:max-w-md md:border md:rounded md:p-4 md:mx-auto md:w-full">
        <H1>{data.self.username}</H1>

        <div className="relative border-b-4 w-36 h-36 md:w-48 md:h-48 border-uzh-blue-100">
          <Image
            className="bg-white"
            src={`${process.env.NEXT_PUBLIC_AVATAR_BASE_PATH}/${
              data.self.avatar ?? 'placeholder'
            }.svg`}
            alt=""
            fill
          />
        </div>

        <Button
          fluid
          onClick={() => Router.replace('/editProfile')}
          className="mt-7"
        >
          Profil editieren
        </Button>

        {!pageInFrame && (
          <Button
            fluid
            onClick={async () => {
              await logoutParticipant()
              Router.replace('/login')
            }}
            className="mt-2"
          >
            Ausloggen
          </Button>
        )}

        <div className="mt-8">
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
export default Profile
