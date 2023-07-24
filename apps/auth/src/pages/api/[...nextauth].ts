import NextAuth from 'next-auth'
import { Provider } from 'next-auth/providers/index'

export const authOptions = {
  providers: [
    {
      id: 'eduid-test',
      name: 'EduID',
      type: 'oauth',
      wellKnown: 'https://login.test.eduid.ch/.well-known/openid-configuration',
      authorization: {
        params: {
          scope: 'openid email https://login.eduid.ch/authz/User.Read',
        },
      },
      idToken: true,
      checks: ['pkce', 'state'],
      profile(profile) {
        return {
          id: profile.sub,
          email: profile.email,
        }
      },
    } as Provider,
  ],
}

export default NextAuth(authOptions)
