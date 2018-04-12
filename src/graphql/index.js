import ActivateNextBlockMutation from './mutations/ActivateNextBlockMutation.graphql'
import AddConfusionTSMutation from './mutations/AddConfusionTSMutation.graphql'
import AddFeedbackMutation from './mutations/AddFeedbackMutation.graphql'
import AddResponseMutation from './mutations/AddResponseMutation.graphql'
import ChangePasswordMutation from './mutations/ChangePasswordMutation.graphql'
import CreateQuestionMutation from './mutations/CreateQuestionMutation.graphql'
import CreateSessionMutation from './mutations/CreateSessionMutation.graphql'
import DeleteFeedbackMutation from './mutations/DeleteFeedbackMutation.graphql'
import EndSessionMutation from './mutations/EndSessionMutation.graphql'
import LoginMutation from './mutations/LoginMutation.graphql'
import LogoutMutation from './mutations/LogoutMutation.graphql'
import ModifyQuestionMutation from './mutations/ModifyQuestionMutation.graphql'
import RequestPasswordMutation from './mutations/RequestPasswordMutation.graphql'
import RegistrationMutation from './mutations/RegistrationMutation.graphql'
import StartSessionMutation from './mutations/StartSessionMutation.graphql'
import UpdateSessionSettingsMutation from './mutations/UpdateSessionSettingsMutation.graphql'
import ArchiveQuestionsMutation from './mutations/ArchiveQuestionsMutation.graphql'

import AccountSummaryQuery from './queries/AccountSummaryQuery.graphql'
import JoinSessionQuery from './queries/JoinSessionQuery.graphql'
import QuestionDetailsQuery from './queries/QuestionDetailsQuery.graphql'
import RunningSessionQuery from './queries/RunningSessionQuery.graphql'
import SessionEvaluationQuery from './queries/SessionEvaluationQuery.graphql'
import SessionListQuery from './queries/SessionListQuery.graphql'
import QuestionPoolQuery from './queries/QuestionPoolQuery.graphql'
import TagListQuery from './queries/TagListQuery.graphql'

const queries = [
  ActivateNextBlockMutation,
  AddConfusionTSMutation,
  AddFeedbackMutation,
  AddResponseMutation,
  ArchiveQuestionsMutation,
  ChangePasswordMutation,
  CreateQuestionMutation,
  CreateSessionMutation,
  DeleteFeedbackMutation,
  EndSessionMutation,
  LoginMutation,
  LogoutMutation,
  ModifyQuestionMutation,
  RequestPasswordMutation,
  RegistrationMutation,
  StartSessionMutation,
  UpdateSessionSettingsMutation,
  AccountSummaryQuery,
  JoinSessionQuery,
  QuestionDetailsQuery,
  RunningSessionQuery,
  SessionEvaluationQuery,
  SessionListQuery,
  QuestionPoolQuery,
  TagListQuery,
]

// build a query map from the queries above
const queryMap = {}
queries.forEach((query) => {
  queryMap[query.documentId] = query
})

export {
  ActivateNextBlockMutation,
  AddConfusionTSMutation,
  AddFeedbackMutation,
  AddResponseMutation,
  ArchiveQuestionsMutation,
  ChangePasswordMutation,
  CreateQuestionMutation,
  CreateSessionMutation,
  DeleteFeedbackMutation,
  EndSessionMutation,
  LoginMutation,
  LogoutMutation,
  ModifyQuestionMutation,
  RegistrationMutation,
  StartSessionMutation,
  UpdateSessionSettingsMutation,
  AccountSummaryQuery,
  JoinSessionQuery,
  QuestionDetailsQuery,
  RequestPasswordMutation,
  RunningSessionQuery,
  SessionEvaluationQuery,
  SessionListQuery,
  QuestionPoolQuery,
  TagListQuery,
  queryMap,
}
