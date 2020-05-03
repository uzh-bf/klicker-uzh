const { loadAsString } = require('../../lib/utils')

const RegistrationMutation = loadAsString('./RegistrationMutation.graphql')
const LoginMutation = loadAsString('./LoginMutation.graphql')
const LoginParticipantMutation = loadAsString('./LoginParticipantMutation.graphql')
const LogoutMutation = loadAsString('./LogoutMutation.graphql')
const CreateQuestionMutation = loadAsString('./CreateQuestionMutation.graphql')
const ModifyQuestionMutation = loadAsString('./ModifyQuestionMutation.graphql')
const ArchiveQuestionsMutation = loadAsString('./ArchiveQuestionsMutation.graphql')
const CreateSessionMutation = loadAsString('./CreateSessionMutation.graphql')
const ModifySessionMutation = loadAsString('./ModifySessionMutation.graphql')
const StartSessionMutation = loadAsString('./StartSessionMutation.graphql')
const PauseSessionMutation = loadAsString('./PauseSessionMutation.graphql')
const CancelSessionMutation = loadAsString('./CancelSessionMutation.graphql')
const EndSessionMutation = loadAsString('./EndSessionMutation.graphql')
const AddFeedbackMutation = loadAsString('./AddFeedbackMutation.graphql')
const DeleteFeedbackMutation = loadAsString('./DeleteFeedbackMutation.graphql')
const AddConfusionTSMutation = loadAsString('./AddConfusionTSMutation.graphql')
const UpdateSessionSettingsMutation = loadAsString('./UpdateSessionSettingsMutation.graphql')
const AddResponseMutation = loadAsString('./AddResponseMutation.graphql')
const ActivateNextBlockMutation = loadAsString('./ActivateNextBlockMutation.graphql')
const RequestPasswordMutation = loadAsString('./RequestPasswordMutation.graphql')
const ChangePasswordMutation = loadAsString('./ChangePasswordMutation.graphql')
const DeleteQuestionsMutation = loadAsString('./DeleteQuestionsMutation.graphql')
const DeleteSessionsMutation = loadAsString('./DeleteSessionsMutation.graphql')
const ModifyUserMutation = loadAsString('./ModifyUserMutation.graphql')
const RequestAccountDeletionMutation = loadAsString('./RequestAccountDeletionMutation.graphql')
const ResolveAccountDeletionMutation = loadAsString('./ResolveAccountDeletionMutation.graphql')
const ActivateAccountMutation = loadAsString('./ActivateAccountMutation.graphql')
const DeleteResponseMutation = loadAsString('./DeleteResponseMutation.graphql')
const ModifyQuestionBlockMutation = loadAsString('./ModifyQuestionBlockMutation.graphql')
const QuestionStatisticsMutation = loadAsString('./QuestionStatisticsMutation.graphql')
const ActivateBlockByIdMutation = loadAsString('./ActivateBlockByIdMutation.graphql')
const ResetQuestionBlockMutation = loadAsString('./ResetQuestionBlockMutation.graphql')

const RegistrationSerializer = require('./RegistrationSerializer')
const ActivateNextBlockSerializer = require('./ActivateNextBlockSerializer')
const ArchiveQuestionsSerializer = require('./ArchiveQuestionsSerializer')
const ChangePasswordSerializer = require('./ChangePasswordSerializer')
const CreateQuestionSerializer = require('./CreateQuestionSerializer')
const CreateSessionSerializer = require('./CreateSessionSerializer')
const StartAndEndSessionSerializer = require('./StartAndEndSessionSerializer')
const UpdateSessionSettingsSerializer = require('./UpdateSessionSettingsSerializer')
const ModifyQuestionBlockSerializer = require('./ModifyQuestionBlockSerializer')

module.exports = {
  RegistrationMutation,
  LoginMutation,
  LoginParticipantMutation,
  LogoutMutation,
  CreateQuestionMutation,
  ModifyQuestionMutation,
  ArchiveQuestionsMutation,
  CreateSessionMutation,
  ModifySessionMutation,
  StartSessionMutation,
  PauseSessionMutation,
  EndSessionMutation,
  AddFeedbackMutation,
  DeleteFeedbackMutation,
  AddConfusionTSMutation,
  UpdateSessionSettingsMutation,
  AddResponseMutation,
  ActivateNextBlockMutation,
  RequestPasswordMutation,
  ChangePasswordMutation,
  DeleteQuestionsMutation,
  DeleteSessionsMutation,
  ModifyUserMutation,
  RequestAccountDeletionMutation,
  ResolveAccountDeletionMutation,
  ActivateAccountMutation,
  DeleteResponseMutation,
  CancelSessionMutation,
  ModifyQuestionBlockMutation,
  QuestionStatisticsMutation,
  ActivateBlockByIdMutation,
  ResetQuestionBlockMutation,
  serializers: [
    RegistrationSerializer,
    ActivateNextBlockSerializer,
    ArchiveQuestionsSerializer,
    ChangePasswordSerializer,
    CreateQuestionSerializer,
    CreateSessionSerializer,
    StartAndEndSessionSerializer,
    UpdateSessionSettingsSerializer,
    ModifyQuestionBlockSerializer,
  ],
}
