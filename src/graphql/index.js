// HACK: this fixes https://github.com/detrohutt/babel-plugin-inline-import-graphql-ast/issues/2

// HACK: don't remove these hacks, the imports below need exactly one empty line above them to work!

import ActivateNextBlockMutation from './mutations/ActivateNextBlockMutation.graphql'
import AddConfusionTSMutation from './mutations/AddConfusionTSMutation.graphql'
import AddFeedbackMutation from './mutations/AddFeedbackMutation.graphql'
import AddResponseMutation from './mutations/AddResponseMutation.graphql'
import CreateQuestionMutation from './mutations/CreateQuestionMutation.graphql'
import CreateSessionMutation from './mutations/CreateSessionMutation.graphql'
import DeleteFeedbackMutation from './mutations/DeleteFeedbackMutation.graphql'
import EndSessionMutation from './mutations/EndSessionMutation.graphql'
import LoginMutation from './mutations/LoginMutation.graphql'
import ModifyQuestionMutation from './mutations/ModifyQuestionMutation.graphql'
import RegistrationMutation from './mutations/RegistrationMutation.graphql'
import StartSessionMutation from './mutations/StartSessionMutation.graphql'
import UpdateSessionSettingsMutation from './mutations/UpdateSessionSettingsMutation.graphql'

import AccountSummaryQuery from './queries/AccountSummaryQuery.graphql'
import JoinSessionQuery from './queries/JoinSessionQuery.graphql'
import QuestionDetailsQuery from './queries/QuestionDetailsQuery.graphql'
import QuestionListQuery from './queries/QuestionListQuery.graphql'
import RunningSessionQuery from './queries/RunningSessionQuery.graphql'
import SessionEvaluationQuery from './queries/SessionEvaluationQuery.graphql'
import SessionListQuery from './queries/SessionListQuery.graphql'
import TagListQuery from './queries/TagListQuery.graphql'

export {
  ActivateNextBlockMutation,
  AddConfusionTSMutation,
  AddFeedbackMutation,
  AddResponseMutation,
  CreateQuestionMutation,
  CreateSessionMutation,
  DeleteFeedbackMutation,
  EndSessionMutation,
  LoginMutation,
  ModifyQuestionMutation,
  RegistrationMutation,
  StartSessionMutation,
  UpdateSessionSettingsMutation,
  AccountSummaryQuery,
  JoinSessionQuery,
  QuestionDetailsQuery,
  QuestionListQuery,
  RunningSessionQuery,
  SessionEvaluationQuery,
  SessionListQuery,
  TagListQuery,
}
