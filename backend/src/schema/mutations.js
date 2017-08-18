const graphql = require('graphql')

const { GraphQLObjectType, GraphQLString } = graphql
const UserType = require('./types/User')

const mutation = new GraphQLObjectType({
  name: 'Mutation',
  fields: {
    signup: {
      type: UserType,
      args: {
        email: { type: GraphQLString },
        password: { type: GraphQLString },
      },
      resolve(parentValue, { email, password }, req) {
        // TODO: check whether the email is already occupied
        // TODO: create a new user with passport
        // TODO: return details of the new user

        console.dir(req)

        return {
          id: 123,
          email,
          password,
          shortname: 'abcd',
          isActive: true,
          isAAI: false,
        }
      },
    },
  },
})

module.exports = mutation

/* query like

mutation Signup($email: String!, $password: String!) {
  signup(email: $email, password: $password) {
    id
    email
    shortname
    isActive
    isAAI
  }
}

{
  "email": "Helloworld",
  "password": "abc"
}

*/
