const { loadAsString } = require('../../lib/utils')

const TagListQuery = loadAsString('./TagListQuery.graphql')
const QuestionListQuery = loadAsString('./QuestionListQuery.graphql')
const QuestionDetailsQuery = loadAsString('./QuestionDetailsQuery.graphql')
const AccountSummaryQuery = loadAsString('./AccountSummaryQuery.graphql')
const JoinSessionQuery = loadAsString('./JoinSessionQuery.graphql')
const RunningSessionQuery = loadAsString('./RunningSessionQuery.graphql')
const SessionEvaluationQuery = loadAsString('./SessionEvaluationQuery.graphql')
const SessionListQuery = loadAsString('./SessionListQuery.graphql')
const UserListQuery = loadAsString('./UserListQuery.graphql')
const SessionPublicEvaluationQuery = loadAsString('./SessionPublicEvaluationQuery.graphql')
const CheckAvailabilityQuery = loadAsString('./CheckAvailabilityQuery.graphql')

const QuestionDetailsSerializer = require('./QuestionDetailsSerializer')
const RunningSessionSerializer = require('./RunningSessionSerializer')
const JoinSessionSerializer = require('./JoinSessionSerializer')
const SessionEvaluationSerializer = require('./SessionEvaluationSerializer')
const SessionPublicEvaluationSerializer = require('./SessionPublicEvaluationSerializer')

module.exports = {
  TagListQuery,
  QuestionListQuery,
  QuestionDetailsQuery,
  AccountSummaryQuery,
  JoinSessionQuery,
  RunningSessionQuery,
  SessionEvaluationQuery,
  SessionListQuery,
  SessionPublicEvaluationQuery,
  UserListQuery,
  CheckAvailabilityQuery,
  serializers: [
    QuestionDetailsSerializer,
    RunningSessionSerializer,
    JoinSessionSerializer,
    SessionEvaluationSerializer,
    SessionPublicEvaluationSerializer,
  ],
}
