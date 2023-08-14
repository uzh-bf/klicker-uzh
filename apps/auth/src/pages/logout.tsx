import { signOut } from 'next-auth/react'
import { useRouter } from 'next/router'
import { useEffect } from 'react'

export default function Logout() {
  const router = useRouter()

  useEffect(() => {
    async function exec() {
      await signOut()
      router.push('https://www.klicker.uzh.ch')
    }
    exec()
  })
  return null
}
