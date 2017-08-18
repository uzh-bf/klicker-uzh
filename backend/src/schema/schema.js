// @flow

const graphql = require('graphql')

const { GraphQLID, GraphQLObjectType, GraphQLSchema } = graphql

const mutation = require('./mutations')
const UserModel = require('../models/User')
const UserType = require('./types/User')

const RootQuery = new GraphQLObjectType({
  name: 'RootQueryType',
  fields: {
    user: {
      type: UserType,
      args: { id: { type: GraphQLID } },
      resolve(parentValue, args) {
        return UserModel.findOne(args.id)
      },
    },
  },
})

module.exports = new GraphQLSchema({
  query: RootQuery,
  mutation,
})
