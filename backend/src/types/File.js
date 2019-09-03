module.exports = `
  type File_PresignedURL {
    fileName: String!
    signedUrl: String!
  }

  input FileInput {
    id: ID
    name: String!
    type: String!
    originalName: String!
    description: String
  }
  type File {
    id: ID!

    name: String!
    originalName: String!
    type: String!
    description: String

    question: Question!
    user: User!

    createdAt: DateTime!
    updatedAt: DateTime!
  }
  type File_Public {
    id: ID!
    name: String!
    type: String!
    description: String
  }
`
