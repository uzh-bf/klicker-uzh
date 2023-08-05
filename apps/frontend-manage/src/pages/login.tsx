import { Button } from '@uzh-bf/design-system'
import Link from 'next/link'

function Login() {
  return (
    <div>
      <Link href={process.env.NEXT_PUBLIC_AUTH_URL as string}>
        <Button data={{ cy: 'login-button' }}>LOGIN</Button>
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
