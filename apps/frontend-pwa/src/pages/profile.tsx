import { useMutation, useQuery } from '@apollo/client'
import Layout from '@components/Layout'
import {
  LogoutParticipantDocument,
  SelfDocument,
} from '@klicker-uzh/graphql/dist/ops'
import { Button, H1 } from '@uzh-bf/design-system'
import Image from 'next/future/image'
import Router from 'next/router'
import { useEffect, useState } from 'react'

const Profile = () => {
  const { data, loading } = useQuery(SelfDocument)
  const [logoutParticipant] = useMutation(LogoutParticipantDocument)

  const [pageInIframe, setPageInIframe] = useState(false)

  // detect if the page is currently shown as an iframe (i.e. in OLAT) -> hide the logout button in this case
  useEffect(() => {
    if (window.location !== window.parent.location) {
      setPageInIframe(true)
    } else {
      setPageInIframe(false)
    }
  }, [])

  if (loading || !data?.self) return <div>loading...</div>

  return (
    <Layout>
      <div className="flex flex-col items-center md:max-w-md md:border md:rounded md:p-4 md:m-auto md:w-full">
        <H1>{data.self.username}</H1>
        <div className="relative h-36 md:h-48">
          <Image
            src={`https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/${data.self.avatar}.webp`}
            alt="Avatar-Image"
            fill
          />
        </div>
        <Button
          fluid
          onClick={() => Router.push('/editProfile')}
          className="mt-7"
        >
          Profil editieren
        </Button>
        <Button
          fluid
          onClick={async () => {
            await logoutParticipant()
            Router.push('https://www.klicker.uzh.ch')
          }}
          className="mt-2"
        >
          Ausloggen
        </Button>
      </div>
    </Layout>
  )
}
export default Profile
