module.exports = `
  input TagInput {
    name: String!
    question: ID!
  }
  type Tag {
    id: ID!
    name: String!

    user: User!

    questions: [Question!]!

    createdAt: DateTime!
    updatedAt: DateTime!
  }
`
