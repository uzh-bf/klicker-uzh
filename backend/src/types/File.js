/* eslint-disable no-use-before-define */

// HACK: export before require such that circular dependencies can be handled
module.exports = () => [File]

const File = `
  type File_PresignedURL {
    fileName: String!
    signedUrl: String!
  }

  input FileInput {
    id: ID
    name: String!
    type: String!
    originalName: String!
  }
  type File {
    id: ID!

    name: String!
    originalName: String!
    type: String!

    question: Question!
    user: User!

    createdAt: DateTime!
    updatedAt: DateTime!
  }
  type File_Public {
    id: ID!
    name: String!
    type: String!
  }
`
