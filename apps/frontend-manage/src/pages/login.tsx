import { Button } from '@uzh-bf/design-system'
import Link from 'next/link'

function Login() {
  return (
    <div className="flex flex-col items-center h-full md:justify-center">
      <Link href={process.env.NEXT_PUBLIC_AUTH_URL as string}>
        <Button>Log In</Button>
      </Link>
    </div>
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

export default Login
