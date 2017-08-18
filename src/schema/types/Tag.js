const graphql = require('graphql')

const { GraphQLID, GraphQLObjectType, GraphQLString } = graphql

const Tag = new GraphQLObjectType({
  name: 'Tag',
  fields: () => ({
    id: { type: GraphQLID },
    name: { type: GraphQLString },
  }),
})

module.exports = Tag
