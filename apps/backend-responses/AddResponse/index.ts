import Redis from 'ioredis'

import { AzureFunction, Context, HttpRequest } from '@azure/functions'

const redisExec = new Redis({
  family: 4,
  host: process.env.REDIS_HOST ?? 'localhost',
  password: process.env.REDIS_PASS ?? '',
  port: Number(process.env.REDIS_PORT) ?? 6379,
  tls: process.env.REDIS_TLS ? {} : undefined,
})

// TODO: verify the participant cookie (if available)
// TODO: add the participant response to redis (aggregated and separately)
// TODO: award points based on the timing and correctness of the response

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
) {
  context.log('HTTP trigger function processed a request.')
  const name = req.query.name || (req.body && req.body.name)
  const responseMessage = name
    ? 'Hello, ' + name + '. This HTTP triggered function executed successfully.'
    : 'This HTTP triggered function executed successfully. Pass a name in the query string or in the request body for a personalized response.'

  return {
    // status: 200, /* Defaults to 200 */
    body: responseMessage,
  }
}

export default httpTrigger
