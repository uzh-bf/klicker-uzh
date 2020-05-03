const FileService = require('../services/files')
const { ensureLoaders } = require('../lib/loaders')

const fileByIDQuery = (parentValue, { id }, { loaders }) => ensureLoaders(loaders).files.load(id)
const filesByPVQuery = (parentValue, args, { loaders }) => {
  const loader = ensureLoaders(loaders).files
  return Promise.all(parentValue.files.map((file) => loader.load(file)))
}

const requestPresignedURLMutation = async (parentValue, { fileType }, { auth }) =>
  FileService.requestPresignedURL({ fileType, userId: auth.sub })

module.exports = {
  // queries
  file: fileByIDQuery,
  files: filesByPVQuery,

  // mutations
  requestPresignedURL: requestPresignedURLMutation,
}
