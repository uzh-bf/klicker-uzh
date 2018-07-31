const AWS = require('aws-sdk')
const UUID = require('uuid/v4')
const { UserInputError, ForbiddenError } = require('apollo-server-express')

let S3
if (process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY) {
  S3 = new AWS.S3({
    accessKeyId: process.env.S3_ACCESS_KEY,
    endpoint: process.env.S3_ENDPOINT ? new AWS.Endpoint(process.env.S3_ENDPOINT) : undefined,
    region: process.env.S3_REGION,
    secretAccessKey: process.env.S3_SECRET_KEY,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
  })
  console.log('[s3] Registered S3 storage backend')
}

/**
 * Request a presigned URL from the S3 backend
 * @param {*} param0
 */
const requestPresignedURL = async ({ fileType, userId }) => {
  // ensure that S3 is available in the environment
  if (typeof S3 === 'undefined') {
    throw new ForbiddenError('S3 not available.')
  }

  // define the list of allowed file types
  const allowedFileTypes = ['image/png', 'image/jpeg', 'image/gif']
  if (!allowedFileTypes.includes(fileType)) {
    throw new UserInputError('Unsupported file type.')
  }

  // setup a mapping from file mime types to extensions
  const fileExtensions = {
    'image/png': 'png',
    'image/jpeg': 'jpeg',
    'image/gif': 'gif',
  }

  // compute a scoped filename
  // images are scoped to the question as they can be reused across versions
  // const fileName = `${userId}/${questionId}/${UUID()}.${fileType}`
  const fileName = `${userId}/${UUID()}.${fileExtensions[fileType]}`

  // generate a presigned url with the specified file type and generated name
  const signedUrl = await S3.getSignedUrl('putObject', {
    Bucket: process.env.S3_BUCKET,
    ContentType: `${fileType}`,
    Key: fileName,
  })

  return {
    fileName,
    signedUrl,
  }
}

module.exports = { requestPresignedURL }
