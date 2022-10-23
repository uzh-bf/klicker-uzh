import { AzureFunction, Context, HttpRequest } from '@azure/functions'

const httpTrigger: AzureFunction = async function (
  context: Context,
  req: HttpRequest
) {
  return {
    status: 200,
  }
}

export default httpTrigger
