const FileService = require('../services/files')
const { ensureLoaders } = require('../lib/loaders')

const fileByIDQuery = (parentValue, { id }, { loaders }) => ensureLoaders(loaders).files.load(id)
const filesByPVQuery = (parentValue, args, { loaders }) => ensureLoaders(loaders).files.loadMany(parentValue.files)

const requestPresignedURLMutation = async (parentValue, { fileType }, { auth }) =>
  FileService.requestPresignedURL({
    fileType,
    userId: auth.sub,
  })

module.exports = {
  // queries
  file: fileByIDQuery,
  files: filesByPVQuery,

  // mutations
  requestPresignedURL: requestPresignedURLMutation,
}
