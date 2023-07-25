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
          scope: 'openid email https://login.eduid.ch/authz/User.Read',
        },
      },
      idToken: true,
      checks: ['pkce', 'state'],

      profile(profile, tokens) {
        console.log(profile)
        return {
          id: profile.sub,
          email: profile.email,
        }
      },

      // session: {
      //   strategy: 'jwt',
      // },
      // callbacks: {
      //   async jwt({ token, user, account }) {
      //     console.log(token, user, account)
      //     return token
      //   },
      //   async session({ token, session }) {
      //     console.log(token, session)
      //     return session
      //   },

      // }
    } as Provider,
  ],
}

export default NextAuth(authOptions)
