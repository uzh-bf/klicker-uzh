// @flow

const graphql = require('graphql')

const { GraphQLList, GraphQLObjectType, GraphQLString, GraphQLSchema } = graphql

const QuestionModel = require('../database/question')

const QuestionType = new GraphQLObjectType({
  name: 'Question',
  fields: () => ({
    id: { type: GraphQLString },
    title: { type: GraphQLString },
  }),
})

const RootQuery = new GraphQLObjectType({
  name: 'RootQueryType',
  fields: {
    allQuestions: {
      type: new GraphQLList(QuestionType),
      resolve() {
        return QuestionModel.find({})
      },
    },
    question: {
      type: QuestionType,
      args: { id: { type: GraphQLString } },
      resolve(parentValue, args) {
        return QuestionModel.findOne(args.id)
      },
    },
  },
})

module.exports = new GraphQLSchema({
  query: RootQuery,
})
