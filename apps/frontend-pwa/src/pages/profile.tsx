import { Button, H1 } from '@uzh-bf/design-system'
import Router from 'next/router'
import { useEffect, useState } from 'react'

const fakeUsername = 'testuser'
const Profile = () => {
  const [pageInIframe, setPageInIframe] = useState(false)

  // detect if the page is currently shown as an iframe (i.e. in OLAT) -> hide the logout button in this case
  useEffect(() => {
    if (window.location !== window.parent.location) {
      setPageInIframe(true)
    } else {
      setPageInIframe(false)
    }
  }, [])

  return (
    <div className="relative flex flex-col items-center justify-center w-screen h-screen pb-20">
      <H1>Profil</H1>
      <img
        src="https://sos-ch-dk-2.exo.io/klicker-uzh-dev/avatars/41b98856a8c221db667cf066f34b931eff048c32.webp"
        alt="Avatar-Image"
      />
      <p className="font-bold mt-3">{fakeUsername}</p>
      <Button onClick={() => Router.push('/edit_profile')} className="mt-7">
        Bearbeiten
      </Button>
    </div>
  )
}
export default Profile
