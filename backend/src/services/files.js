const AWS = require('aws-sdk')
const { v4: uuidv4 } = require('uuid')
const { UserInputError, ForbiddenError } = require('apollo-server-express')

const cfg = require('../klicker.conf.js')

const S3_CFG = cfg.get('s3')

let S3
if (S3_CFG.enabled) {
  S3 = new AWS.S3({
    accessKeyId: S3_CFG.accessKey,
    endpoint: S3_CFG.endpoint ? new AWS.Endpoint(S3_CFG.endpoint) : undefined,
    region: S3_CFG.region,
    secretAccessKey: S3_CFG.secretKey,
    s3ForcePathStyle: true,
    signatureVersion: 'v4',
  })
  console.log('[s3] Registered S3 storage backend')
}

/**
 * Request a presigned URL from the S3 backend
 * @param {String} fileType The mime type of the file to upload
 * @param {ID} userId The user id of the user owning the file
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
  const fileName = `${userId}/${uuidv4()}.${fileExtensions[fileType]}`

  // generate a presigned url with the specified file type and generated name
  const signedUrl = await S3.getSignedUrl('putObject', {
    Bucket: S3_CFG.bucket,
    ContentType: `${fileType}`,
    Key: fileName,
  })

  return {
    fileName,
    signedUrl,
  }
}

module.exports = { requestPresignedURL }
