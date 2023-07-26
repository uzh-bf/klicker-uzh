import NextAuth from 'next-auth'
import { Provider } from 'next-auth/providers/index'

export const authOptions = {
  providers: [
    {
      id: process.env.EDUID_ID,
      wellKnown: process.env.EDUID_WELL_KNOWN,
      clientId: process.env.EDUID_CLIENT_ID,
      clientSecret: process.env.EDUID_CLIENT_SECRET,

      name: 'EduID',
      type: 'oauth',
      authorization: {
        params: {
          claims: {
            id_token: {
              sub: { essential: true },
              email: { essential: true },
              swissEduPersonUniqueID: { essential: true },
            },
          },
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
