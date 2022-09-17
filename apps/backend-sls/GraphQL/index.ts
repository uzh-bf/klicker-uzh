import { AzureFunction, Context, HttpRequest } from '@azure/functions'

import getCachedApp from './cachedApp'

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
) {
  // immediately return on GET -> healthcheck
  if (req.method === 'GET') {
    return {
      status: 200,
    }
  }

  const cachedServerlessExpress = getCachedApp()

  return cachedServerlessExpress(context, req, () => {})
}

export default httpTrigger
