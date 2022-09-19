import bodyParser from 'body-parser'
import crypto from 'crypto'
import { GetServerSidePropsContext } from 'next'

interface Args {
  ctx: GetServerSidePropsContext
}

export async function extractLtiData({ ctx, key, secret }: Args) {
  const { req, res } = ctx

  const { request, response } = await new Promise((resolve) => {
    // @ts-ignore
    bodyParser.urlencoded({ extended: true })(req, res, () => {
      // @ts-ignore
      bodyParser.json()(req, res, () => {
        resolve({ request: req, response: res })
      })
    })
  })

  // const hitUrl = 'http://' + request.headers.host + request.url
  const hitUrl = 'http://lti.tools/test/tp.php'

  const encodedUrl = special_encode(hitUrl)

  const cleanBody = clean_request_body(request.body)

  const sig = `${request.method}&${encodedUrl}&${cleanBody}`
  console.log(sig)

  const signed = crypto
    .createHmac('sha1', `key&`)
    .update(sig, 'utf-8')
    .digest('base64')
  console.log(signed)

  return signed
}

const clean_request_body = function (body) {
  const out: any[] = []

  const encodeParam = (key, val) => `${key}=${special_encode(val)}`

  const cleanParams = function (params) {
    if (typeof params !== 'object') {
      return
    }

    for (let key in params) {
      const vals = params[key]
      if (key === 'oauth_signature') {
        continue
      }
      if (Array.isArray(vals) === true) {
        for (let val of Array.from(vals)) {
          out.push(encodeParam(key, val))
        }
      } else {
        out.push(encodeParam(key, vals))
      }
    }
  }

  cleanParams(body)

  return special_encode(out.sort().join('&'))
}

const special_encode = (string) =>
  encodeURIComponent(string)
    .replace(/[!'()]/g, escape)
    .replace(/\*/g, '%2A')
