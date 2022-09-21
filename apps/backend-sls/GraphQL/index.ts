import { AzureFunction, Context, HttpRequest } from '@azure/functions'

import getCachedApp from './cachedApp'

const cachedServerlessExpress = getCachedApp()

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

  return cachedServerlessExpress(context, req, () => {})
}

export default httpTrigger
