module.exports = `
  input User_Create {
    email: String
    password: String
    shortname: String
    institution: String
    useCase: String
  }

  input User_Modify {
    email: String
    shortname: String
    institution: String
    useCase: String
  }

  input User_ModifyAsAdmin {
    email: String
    shortname: String
    institution: String 
    role: String
  }

  type User {
    id: ID!
    email: String!
    isActive: Boolean!
    isAAI: Boolean!
    shortname: String!
    institution: String
    useCase: String
    hmac: String!
    role: String!

    runningSession: Session

    questions: [Question!]!
    sessions: [Session!]!
    tags: [Tag!]!
    files: [File!]!

    createdAt: DateTime!
    updatedAt: DateTime!
  }

  type User_Availability {
    email: Boolean
    shortname: Boolean
  }
`
