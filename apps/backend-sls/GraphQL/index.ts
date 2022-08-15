import serverlessExpress from '@vendia/serverless-express'

import app from './app'

const cachedServerlessExpress = serverlessExpress({ app })

export default async function (context: any, req: any) {
  return cachedServerlessExpress(context, req, () => {})
}
