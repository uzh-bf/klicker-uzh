import NextAuth from 'next-auth'
import { Provider } from 'next-auth/providers/index'

export const authOptions = {
  providers: [
    {
      id: process.env.EDUID_ID,
      name: 'EduID',
      type: 'oauth',
      wellKnown: process.env.EDUID_WELL_KNOWN,
      authorization: {
        params: {
          scope: 'openid email https://login.eduid.ch/authz/User.Read',
        },
      },
      idToken: true,
      checks: ['pkce', 'state'],
      clientId: process.env.EDUID_CLIENT_ID,
      clientSecret: process.env.EDUID_CLIENT_SECRET,
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
