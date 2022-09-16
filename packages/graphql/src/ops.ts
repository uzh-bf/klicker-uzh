import { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  /** A date-time string at UTC, such as 2007-12-03T10:15:30Z, compliant with the `date-time` format outlined in section 5.6 of the RFC 3339 profile of the ISO 8601 standard for representation of dates and times using the Gregorian calendar. */
  DateTime: any;
  /** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  JSONObject: any;
};

export enum AccessMode {
  Public = 'PUBLIC',
  Restricted = 'RESTRICTED'
}

export type AggregatedConfusionFeedbacks = {
  __typename?: 'AggregatedConfusionFeedbacks';
  difficulty: Scalars['Float'];
  numberOfParticipants: Scalars['Int'];
  speed: Scalars['Float'];
  timestamp?: Maybe<Scalars['DateTime']>;
};

export type Attachment = {
  __typename?: 'Attachment';
  description?: Maybe<Scalars['String']>;
  href: Scalars['String'];
  id: Scalars['String'];
  name: Scalars['String'];
  originalName?: Maybe<Scalars['String']>;
  type: AttachmentType;
};

export enum AttachmentType {
  Gif = 'GIF',
  Jpeg = 'JPEG',
  Link = 'LINK',
  Png = 'PNG',
  Svg = 'SVG',
  Webp = 'WEBP'
}

export type BlockInput = {
  questionIds: Array<Scalars['Int']>;
  randomSelection?: InputMaybe<Scalars['Int']>;
  timeLimit?: InputMaybe<Scalars['Int']>;
};

export type Choice = {
  __typename?: 'Choice';
  correct?: Maybe<Scalars['Boolean']>;
  feedback?: Maybe<Scalars['String']>;
  ix: Scalars['Int'];
  value: Scalars['String'];
};

export type ChoicesQuestionData = QuestionData & {
  __typename?: 'ChoicesQuestionData';
  content: Scalars['String'];
  contentPlain: Scalars['String'];
  id: Scalars['Int'];
  isArchived: Scalars['Boolean'];
  isDeleted: Scalars['Boolean'];
  name: Scalars['String'];
  options: ChoicesQuestionOptions;
  type: Scalars['String'];
};

export type ChoicesQuestionOptions = {
  __typename?: 'ChoicesQuestionOptions';
  choices: Array<Choice>;
};

export type ConfusionTimestep = {
  __typename?: 'ConfusionTimestep';
  createdAt: Scalars['DateTime'];
  difficulty: Scalars['Int'];
  id: Scalars['Int'];
  speed: Scalars['Int'];
};

export type Course = {
  __typename?: 'Course';
  color?: Maybe<Scalars['String']>;
  displayName: Scalars['String'];
  id: Scalars['ID'];
  learningElements: Array<LearningElement>;
  microSessions: Array<MicroSession>;
  name: Scalars['String'];
  sessions: Array<Session>;
};

export type Feedback = {
  __typename?: 'Feedback';
  content: Scalars['String'];
  createdAt?: Maybe<Scalars['DateTime']>;
  id: Scalars['Int'];
  isPinned: Scalars['Boolean'];
  isPublished: Scalars['Boolean'];
  isResolved: Scalars['Boolean'];
  resolvedAt?: Maybe<Scalars['DateTime']>;
  responses?: Maybe<Array<Maybe<FeedbackResponse>>>;
  updatedAt?: Maybe<Scalars['DateTime']>;
  votes: Scalars['Int'];
};

export type FeedbackResponse = {
  __typename?: 'FeedbackResponse';
  content: Scalars['String'];
  createdAt: Scalars['DateTime'];
  id: Scalars['Int'];
  negativeReactions: Scalars['Int'];
  positiveReactions: Scalars['Int'];
  resolvedAt?: Maybe<Scalars['DateTime']>;
};

export type FreeTextQuestionData = QuestionData & {
  __typename?: 'FreeTextQuestionData';
  content: Scalars['String'];
  contentPlain: Scalars['String'];
  id: Scalars['Int'];
  isArchived: Scalars['Boolean'];
  isDeleted: Scalars['Boolean'];
  name: Scalars['String'];
  options: FreeTextQuestionOptions;
  type: Scalars['String'];
};

export type FreeTextQuestionOptions = {
  __typename?: 'FreeTextQuestionOptions';
  restrictions?: Maybe<FreeTextRestrictions>;
  solutions?: Maybe<Array<Scalars['String']>>;
};

export type FreeTextRestrictions = {
  __typename?: 'FreeTextRestrictions';
  maxLength?: Maybe<Scalars['Int']>;
};

export type InstanceEvaluation = {
  __typename?: 'InstanceEvaluation';
  choices: Scalars['JSONObject'];
  feedbacks?: Maybe<Array<QuestionFeedback>>;
};

export type LeaderboardEntry = {
  __typename?: 'LeaderboardEntry';
  avatar?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
  score: Scalars['Float'];
  username: Scalars['String'];
};

export type LearningElement = {
  __typename?: 'LearningElement';
  course: Course;
  displayName: Scalars['String'];
  id: Scalars['ID'];
  instances: Array<QuestionInstance>;
  name: Scalars['String'];
};

export type LecturerSession = {
  __typename?: 'LecturerSession';
  accessMode: AccessMode;
  activeBlock?: Maybe<SessionBlock>;
  blocks: Array<SessionBlock>;
  confusionFeedbacks?: Maybe<Array<Maybe<AggregatedConfusionFeedbacks>>>;
  course?: Maybe<Course>;
  displayName: Scalars['String'];
  feedbacks?: Maybe<Array<Maybe<Feedback>>>;
  finishedAt?: Maybe<Scalars['DateTime']>;
  id: Scalars['ID'];
  isAudienceInteractionActive: Scalars['Boolean'];
  isGamificationEnabled: Scalars['Boolean'];
  isModerationEnabled: Scalars['Boolean'];
  name: Scalars['String'];
  namespace: Scalars['String'];
  startedAt?: Maybe<Scalars['DateTime']>;
  status: SessionStatus;
};

export type MicroSession = {
  __typename?: 'MicroSession';
  course: Course;
  description?: Maybe<Scalars['String']>;
  displayName: Scalars['String'];
  id: Scalars['ID'];
  instances: Array<QuestionInstance>;
  name: Scalars['String'];
};

export type Mutation = {
  __typename?: 'Mutation';
  activateSessionBlock?: Maybe<Session>;
  addConfusionTimestep?: Maybe<ConfusionTimestep>;
  changeSessionSettings?: Maybe<Session>;
  createCourse?: Maybe<Course>;
  createFeedback?: Maybe<Feedback>;
  createSession?: Maybe<Session>;
  deactivateSessionBlock?: Maybe<Session>;
  deleteFeedback?: Maybe<Feedback>;
  deleteFeedbackResponse?: Maybe<FeedbackResponse>;
  endSession?: Maybe<Session>;
  joinCourse?: Maybe<Participation>;
  leaveCourse?: Maybe<Participation>;
  loginParticipant?: Maybe<Scalars['ID']>;
  loginUser?: Maybe<Scalars['ID']>;
  logoutParticipant?: Maybe<Scalars['ID']>;
  logoutUser?: Maybe<Scalars['ID']>;
  pinFeedback?: Maybe<Feedback>;
  publishFeedback?: Maybe<Feedback>;
  registerParticipantFromLTI?: Maybe<ParticipantLearningData>;
  resolveFeedback?: Maybe<Feedback>;
  respondToFeedback?: Maybe<Feedback>;
  respondToQuestionInstance?: Maybe<QuestionInstance>;
  startSession?: Maybe<Session>;
  upvoteFeedback?: Maybe<Feedback>;
  voteFeedbackResponse?: Maybe<FeedbackResponse>;
};


export type MutationActivateSessionBlockArgs = {
  sessionBlockId: Scalars['Int'];
  sessionId: Scalars['ID'];
};


export type MutationAddConfusionTimestepArgs = {
  difficulty: Scalars['Int'];
  sessionId: Scalars['ID'];
  speed: Scalars['Int'];
};


export type MutationChangeSessionSettingsArgs = {
  id: Scalars['ID'];
  isAudienceInteractionActive?: InputMaybe<Scalars['Boolean']>;
  isGamificationEnabled?: InputMaybe<Scalars['Boolean']>;
  isModerationEnabled?: InputMaybe<Scalars['Boolean']>;
};


export type MutationCreateCourseArgs = {
  color?: InputMaybe<Scalars['String']>;
  displayName?: InputMaybe<Scalars['String']>;
  name: Scalars['String'];
};


export type MutationCreateFeedbackArgs = {
  content: Scalars['String'];
  sessionId: Scalars['ID'];
};


export type MutationCreateSessionArgs = {
  blocks: Array<BlockInput>;
  courseId?: InputMaybe<Scalars['String']>;
  displayName?: InputMaybe<Scalars['String']>;
  name: Scalars['String'];
};


export type MutationDeactivateSessionBlockArgs = {
  sessionBlockId: Scalars['Int'];
  sessionId: Scalars['ID'];
};


export type MutationDeleteFeedbackArgs = {
  id: Scalars['Int'];
};


export type MutationDeleteFeedbackResponseArgs = {
  id: Scalars['Int'];
};


export type MutationEndSessionArgs = {
  id: Scalars['ID'];
};


export type MutationJoinCourseArgs = {
  courseId: Scalars['ID'];
};


export type MutationLeaveCourseArgs = {
  courseId: Scalars['ID'];
};


export type MutationLoginParticipantArgs = {
  password: Scalars['String'];
  username: Scalars['String'];
};


export type MutationLoginUserArgs = {
  email: Scalars['String'];
  password: Scalars['String'];
};


export type MutationLogoutParticipantArgs = {
  id: Scalars['ID'];
};


export type MutationLogoutUserArgs = {
  userId: Scalars['ID'];
};


export type MutationPinFeedbackArgs = {
  id: Scalars['Int'];
  isPinned: Scalars['Boolean'];
};


export type MutationPublishFeedbackArgs = {
  id: Scalars['Int'];
  isPublished: Scalars['Boolean'];
};


export type MutationRegisterParticipantFromLtiArgs = {
  courseId: Scalars['ID'];
  participantId: Scalars['ID'];
};


export type MutationResolveFeedbackArgs = {
  id: Scalars['Int'];
  isResolved: Scalars['Boolean'];
};


export type MutationRespondToFeedbackArgs = {
  id: Scalars['Int'];
  responseContent: Scalars['String'];
};


export type MutationRespondToQuestionInstanceArgs = {
  courseId: Scalars['ID'];
  id: Scalars['Int'];
  response: ResponseInput;
};


export type MutationStartSessionArgs = {
  id: Scalars['ID'];
};


export type MutationUpvoteFeedbackArgs = {
  feedbackId: Scalars['Int'];
  increment: Scalars['Int'];
};


export type MutationVoteFeedbackResponseArgs = {
  id: Scalars['Int'];
  incrementDownvote: Scalars['Int'];
  incrementUpvote: Scalars['Int'];
};

export type NumericalQuestionData = QuestionData & {
  __typename?: 'NumericalQuestionData';
  content: Scalars['String'];
  contentPlain: Scalars['String'];
  id: Scalars['Int'];
  isArchived: Scalars['Boolean'];
  isDeleted: Scalars['Boolean'];
  name: Scalars['String'];
  options: NumericalQuestionOptions;
  type: Scalars['String'];
};

export type NumericalQuestionOptions = {
  __typename?: 'NumericalQuestionOptions';
  restrictions?: Maybe<NumericalRestrictions>;
  solutionRanges?: Maybe<Array<NumericalSolutionRange>>;
};

export type NumericalRestrictions = {
  __typename?: 'NumericalRestrictions';
  max?: Maybe<Scalars['Int']>;
  min?: Maybe<Scalars['Int']>;
};

export type NumericalSolutionRange = {
  __typename?: 'NumericalSolutionRange';
  max?: Maybe<Scalars['Float']>;
  min?: Maybe<Scalars['Float']>;
};

export type Participant = {
  __typename?: 'Participant';
  avatar: Scalars['String'];
  id: Scalars['ID'];
  username: Scalars['String'];
};

export type ParticipantLearningData = {
  __typename?: 'ParticipantLearningData';
  course: Course;
  id: Scalars['ID'];
  participant: Participant;
  participantToken: Scalars['String'];
  participation: Participation;
};

export type Participation = {
  __typename?: 'Participation';
  course: Course;
  id: Scalars['Int'];
  isActive: Scalars['Boolean'];
  points: Scalars['Int'];
};

export type Query = {
  __typename?: 'Query';
  cockpitSession?: Maybe<LecturerSession>;
  feedbacks?: Maybe<Array<Feedback>>;
  getCourseOverviewData?: Maybe<ParticipantLearningData>;
  learningElement?: Maybe<LearningElement>;
  microSession?: Maybe<MicroSession>;
  participations?: Maybe<Array<Participation>>;
  pinnedFeedbacks?: Maybe<LecturerSession>;
  runningSessions?: Maybe<Array<Session>>;
  self?: Maybe<Participant>;
  session?: Maybe<Session>;
  sessionLeaderboard?: Maybe<Array<LeaderboardEntry>>;
  userProfile?: Maybe<User>;
  userSessions?: Maybe<Array<Session>>;
};


export type QueryCockpitSessionArgs = {
  id: Scalars['ID'];
};


export type QueryFeedbacksArgs = {
  id: Scalars['ID'];
};


export type QueryGetCourseOverviewDataArgs = {
  courseId: Scalars['ID'];
};


export type QueryLearningElementArgs = {
  id: Scalars['ID'];
};


export type QueryMicroSessionArgs = {
  id: Scalars['ID'];
};


export type QueryPinnedFeedbacksArgs = {
  id: Scalars['ID'];
};


export type QueryRunningSessionsArgs = {
  shortname: Scalars['String'];
};


export type QuerySessionArgs = {
  id: Scalars['ID'];
};


export type QuerySessionLeaderboardArgs = {
  sessionId: Scalars['ID'];
};

export type QuestionData = {
  content: Scalars['String'];
  contentPlain: Scalars['String'];
  id: Scalars['Int'];
  isArchived: Scalars['Boolean'];
  isDeleted: Scalars['Boolean'];
  name: Scalars['String'];
  type: Scalars['String'];
};

export type QuestionFeedback = {
  __typename?: 'QuestionFeedback';
  correct: Scalars['Boolean'];
  feedback: Scalars['String'];
  ix: Scalars['Int'];
  value: Scalars['String'];
};

export type QuestionInstance = {
  __typename?: 'QuestionInstance';
  attachments: Array<Maybe<Attachment>>;
  evaluation?: Maybe<InstanceEvaluation>;
  id: Scalars['Int'];
  questionData: QuestionData;
};

export type ResponseInput = {
  choices?: InputMaybe<Array<Scalars['Int']>>;
  value?: InputMaybe<Scalars['String']>;
};

export type Session = {
  __typename?: 'Session';
  accessMode: AccessMode;
  activeBlock?: Maybe<SessionBlock>;
  blocks: Array<SessionBlock>;
  confusionFeedbacks?: Maybe<Array<Maybe<ConfusionTimestep>>>;
  course?: Maybe<Course>;
  createdAt: Scalars['DateTime'];
  displayName: Scalars['String'];
  feedbacks?: Maybe<Array<Maybe<Feedback>>>;
  id: Scalars['ID'];
  isAudienceInteractionActive: Scalars['Boolean'];
  isGamificationEnabled: Scalars['Boolean'];
  isModerationEnabled: Scalars['Boolean'];
  name: Scalars['String'];
  namespace: Scalars['String'];
  status: SessionStatus;
};

export type SessionBlock = {
  __typename?: 'SessionBlock';
  execution: Scalars['Int'];
  expiresAt?: Maybe<Scalars['DateTime']>;
  id: Scalars['Int'];
  instances: Array<QuestionInstance>;
  randomSelection?: Maybe<Scalars['Boolean']>;
  status: SessionBlockStatus;
  timeLimit?: Maybe<Scalars['Int']>;
};

export enum SessionBlockStatus {
  Active = 'ACTIVE',
  Executed = 'EXECUTED',
  Scheduled = 'SCHEDULED'
}

export enum SessionStatus {
  Completed = 'COMPLETED',
  Prepared = 'PREPARED',
  Running = 'RUNNING',
  Scheduled = 'SCHEDULED'
}

export type User = {
  __typename?: 'User';
  description?: Maybe<Scalars['String']>;
  email: Scalars['String'];
  id: Scalars['ID'];
  isActive: Scalars['Boolean'];
  shortname: Scalars['String'];
};

export type QuestionDataFragment = { __typename?: 'QuestionInstance', questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'ChoicesQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'FreeTextQuestionOptions', solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'NumericalQuestionOptions', restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } };

export type QuestionDataWithoutSolutionsFragment = { __typename?: 'QuestionInstance', questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'ChoicesQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'FreeTextQuestionOptions', restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'NumericalQuestionOptions', restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null } } };

export type ActivateSessionBlockMutationVariables = Exact<{
  sessionId: Scalars['ID'];
  sessionBlockId: Scalars['Int'];
}>;


export type ActivateSessionBlockMutation = { __typename?: 'Mutation', activateSessionBlock?: { __typename?: 'Session', id: string, status: SessionStatus, blocks: Array<{ __typename?: 'SessionBlock', id: number, status: SessionBlockStatus }> } | null };

export type AddConfusionTimestepMutationVariables = Exact<{
  sessionId: Scalars['ID'];
  difficulty: Scalars['Int'];
  speed: Scalars['Int'];
}>;


export type AddConfusionTimestepMutation = { __typename?: 'Mutation', addConfusionTimestep?: { __typename?: 'ConfusionTimestep', id: number, difficulty: number, speed: number } | null };

export type ChangeSessionSettingsMutationVariables = Exact<{
  id: Scalars['ID'];
  isAudienceInteractionActive?: InputMaybe<Scalars['Boolean']>;
  isModerationEnabled?: InputMaybe<Scalars['Boolean']>;
  isGamificationEnabled?: InputMaybe<Scalars['Boolean']>;
}>;


export type ChangeSessionSettingsMutation = { __typename?: 'Mutation', changeSessionSettings?: { __typename?: 'Session', id: string } | null };

export type CreateFeedbackMutationVariables = Exact<{
  sessionId: Scalars['ID'];
  content: Scalars['String'];
}>;


export type CreateFeedbackMutation = { __typename?: 'Mutation', createFeedback?: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number } | null };

export type DeactivateSessionBlockMutationVariables = Exact<{
  sessionId: Scalars['ID'];
  sessionBlockId: Scalars['Int'];
}>;


export type DeactivateSessionBlockMutation = { __typename?: 'Mutation', deactivateSessionBlock?: { __typename?: 'Session', id: string, status: SessionStatus, activeBlock?: { __typename?: 'SessionBlock', id: number } | null, blocks: Array<{ __typename?: 'SessionBlock', id: number, status: SessionBlockStatus }> } | null };

export type DeleteFeedbackMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteFeedbackMutation = { __typename?: 'Mutation', deleteFeedback?: { __typename?: 'Feedback', id: number } | null };

export type DeleteFeedbackResponseMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteFeedbackResponseMutation = { __typename?: 'Mutation', deleteFeedbackResponse?: { __typename?: 'FeedbackResponse', id: number } | null };

export type EndSessionMutationVariables = Exact<{
  id: Scalars['ID'];
}>;


export type EndSessionMutation = { __typename?: 'Mutation', endSession?: { __typename?: 'Session', id: string, status: SessionStatus } | null };

export type JoinCourseMutationVariables = Exact<{
  courseId: Scalars['ID'];
}>;


export type JoinCourseMutation = { __typename?: 'Mutation', joinCourse?: { __typename?: 'Participation', id: number, isActive: boolean, points: number } | null };

export type LeaveCourseMutationVariables = Exact<{
  courseId: Scalars['ID'];
}>;


export type LeaveCourseMutation = { __typename?: 'Mutation', leaveCourse?: { __typename?: 'Participation', id: number, isActive: boolean, points: number } | null };

export type LoginParticipantMutationVariables = Exact<{
  username: Scalars['String'];
  password: Scalars['String'];
}>;


export type LoginParticipantMutation = { __typename?: 'Mutation', loginParticipant?: string | null };

export type LoginUserMutationVariables = Exact<{
  email: Scalars['String'];
  password: Scalars['String'];
}>;


export type LoginUserMutation = { __typename?: 'Mutation', loginUser?: string | null };

export type LogoutParticipantMutationVariables = Exact<{
  id: Scalars['ID'];
}>;


export type LogoutParticipantMutation = { __typename?: 'Mutation', logoutParticipant?: string | null };

export type LogoutUserMutationVariables = Exact<{
  userId: Scalars['ID'];
}>;


export type LogoutUserMutation = { __typename?: 'Mutation', logoutUser?: string | null };

export type PinFeedbackMutationVariables = Exact<{
  id: Scalars['Int'];
  isPinned: Scalars['Boolean'];
}>;


export type PinFeedbackMutation = { __typename?: 'Mutation', pinFeedback?: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number } | null };

export type PublishFeedbackMutationVariables = Exact<{
  id: Scalars['Int'];
  isPublished: Scalars['Boolean'];
}>;


export type PublishFeedbackMutation = { __typename?: 'Mutation', publishFeedback?: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number } | null };

export type RegisterParticipantFromLtiMutationVariables = Exact<{
  courseId: Scalars['ID'];
  participantId: Scalars['ID'];
}>;


export type RegisterParticipantFromLtiMutation = { __typename?: 'Mutation', registerParticipantFromLTI?: { __typename?: 'ParticipantLearningData', id: string, participantToken: string, participant: { __typename?: 'Participant', id: string, avatar: string, username: string }, participation: { __typename?: 'Participation', id: number, isActive: boolean, points: number }, course: { __typename?: 'Course', id: string, name: string, displayName: string } } | null };

export type ResolveFeedbackMutationVariables = Exact<{
  id: Scalars['Int'];
  isResolved: Scalars['Boolean'];
}>;


export type ResolveFeedbackMutation = { __typename?: 'Mutation', resolveFeedback?: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number } | null };

export type RespondToFeedbackMutationVariables = Exact<{
  id: Scalars['Int'];
  responseContent: Scalars['String'];
}>;


export type RespondToFeedbackMutation = { __typename?: 'Mutation', respondToFeedback?: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, resolvedAt?: any | null, createdAt?: any | null, responses?: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number } | null> | null } | null };

export type ResponseToQuestionInstanceMutationVariables = Exact<{
  courseId: Scalars['ID'];
  id: Scalars['Int'];
  response: ResponseInput;
}>;


export type ResponseToQuestionInstanceMutation = { __typename?: 'Mutation', respondToQuestionInstance?: { __typename?: 'QuestionInstance', id: number, evaluation?: { __typename?: 'InstanceEvaluation', choices: any, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback: string, correct: boolean, value: string }> | null } | null, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'ChoicesQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'FreeTextQuestionOptions', solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'NumericalQuestionOptions', restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } } | null };

export type StartSessionMutationVariables = Exact<{
  id: Scalars['ID'];
}>;


export type StartSessionMutation = { __typename?: 'Mutation', startSession?: { __typename?: 'Session', id: string, status: SessionStatus } | null };

export type UpvoteFeedbackMutationVariables = Exact<{
  feedbackId: Scalars['Int'];
  increment: Scalars['Int'];
}>;


export type UpvoteFeedbackMutation = { __typename?: 'Mutation', upvoteFeedback?: { __typename?: 'Feedback', id: number, votes: number } | null };

export type VoteFeedbackResponseMutationVariables = Exact<{
  id: Scalars['Int'];
  incrementUpvote: Scalars['Int'];
  incrementDownvote: Scalars['Int'];
}>;


export type VoteFeedbackResponseMutation = { __typename?: 'Mutation', voteFeedbackResponse?: { __typename?: 'FeedbackResponse', id: number, positiveReactions: number, negativeReactions: number } | null };

export type GetCockpitSessionQueryVariables = Exact<{
  id: Scalars['ID'];
}>;


export type GetCockpitSessionQuery = { __typename?: 'Query', cockpitSession?: { __typename?: 'LecturerSession', id: string, isAudienceInteractionActive: boolean, isModerationEnabled: boolean, isGamificationEnabled: boolean, namespace: string, name: string, displayName: string, status: SessionStatus, startedAt?: any | null, course?: { __typename?: 'Course', displayName: string } | null, blocks: Array<{ __typename?: 'SessionBlock', id: number, status: SessionBlockStatus, expiresAt?: any | null, timeLimit?: number | null, randomSelection?: boolean | null, execution: number, instances: Array<{ __typename?: 'QuestionInstance', id: number, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, contentPlain: string } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, contentPlain: string } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, contentPlain: string } }> }>, confusionFeedbacks?: Array<{ __typename?: 'AggregatedConfusionFeedbacks', speed: number, difficulty: number, numberOfParticipants: number } | null> | null, feedbacks?: Array<{ __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, createdAt?: any | null, resolvedAt?: any | null, responses?: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number } | null> | null } | null> | null } | null };

export type GetCourseOverviewDataQueryVariables = Exact<{
  courseId: Scalars['ID'];
}>;


export type GetCourseOverviewDataQuery = { __typename?: 'Query', getCourseOverviewData?: { __typename?: 'ParticipantLearningData', id: string, participant: { __typename?: 'Participant', id: string, avatar: string, username: string }, participation: { __typename?: 'Participation', id: number, isActive: boolean, points: number }, course: { __typename?: 'Course', id: string, name: string, displayName: string } } | null };

export type GetFeedbacksQueryVariables = Exact<{
  sessionId: Scalars['ID'];
}>;


export type GetFeedbacksQuery = { __typename?: 'Query', feedbacks?: Array<{ __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, resolvedAt?: any | null, createdAt?: any | null, responses?: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number } | null> | null }> | null };

export type GetLearningElementQueryVariables = Exact<{
  id: Scalars['ID'];
}>;


export type GetLearningElementQuery = { __typename?: 'Query', learningElement?: { __typename?: 'LearningElement', id: string, course: { __typename?: 'Course', id: string, displayName: string, color?: string | null }, instances: Array<{ __typename?: 'QuestionInstance', id: number, evaluation?: { __typename?: 'InstanceEvaluation', choices: any, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback: string, correct: boolean, value: string }> | null } | null, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'ChoicesQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'FreeTextQuestionOptions', solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'NumericalQuestionOptions', restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } }> } | null };

export type GetMicroSessionQueryVariables = Exact<{
  id: Scalars['ID'];
}>;


export type GetMicroSessionQuery = { __typename?: 'Query', microSession?: { __typename?: 'MicroSession', id: string, displayName: string, description?: string | null, course: { __typename?: 'Course', id: string, displayName: string, color?: string | null }, instances: Array<{ __typename?: 'QuestionInstance', id: number, evaluation?: { __typename?: 'InstanceEvaluation', choices: any, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback: string, correct: boolean, value: string }> | null } | null, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'ChoicesQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'FreeTextQuestionOptions', solutions?: Array<string> | null, restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'NumericalQuestionOptions', restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null, solutionRanges?: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> | null } } }> } | null };

export type GetPinnedFeedbacksQueryVariables = Exact<{
  id: Scalars['ID'];
}>;


export type GetPinnedFeedbacksQuery = { __typename?: 'Query', pinnedFeedbacks?: { __typename?: 'LecturerSession', id: string, isAudienceInteractionActive: boolean, isModerationEnabled: boolean, isGamificationEnabled: boolean, confusionFeedbacks?: Array<{ __typename?: 'AggregatedConfusionFeedbacks', speed: number, difficulty: number, numberOfParticipants: number } | null> | null, feedbacks?: Array<{ __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, createdAt?: any | null, resolvedAt?: any | null, responses?: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number } | null> | null } | null> | null } | null };

export type GetRunningSessionQueryVariables = Exact<{
  id: Scalars['ID'];
}>;


export type GetRunningSessionQuery = { __typename?: 'Query', session?: { __typename?: 'Session', id: string, isAudienceInteractionActive: boolean, isModerationEnabled: boolean, isGamificationEnabled: boolean, namespace: string, name: string, displayName: string, status: SessionStatus, course?: { __typename?: 'Course', displayName: string } | null, activeBlock?: { __typename?: 'SessionBlock', id: number, status: SessionBlockStatus, expiresAt?: any | null, timeLimit?: number | null, randomSelection?: boolean | null, execution: number, instances: Array<{ __typename?: 'QuestionInstance', id: number, attachments: Array<{ __typename?: 'Attachment', id: string, href: string, name: string, originalName?: string | null, description?: string | null, type: AttachmentType } | null>, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'ChoicesQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'FreeTextQuestionOptions', restrictions?: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } | null } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'NumericalQuestionOptions', restrictions?: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } | null } } }> } | null } | null };

export type GetRunningSessionsQueryVariables = Exact<{
  shortname: Scalars['String'];
}>;


export type GetRunningSessionsQuery = { __typename?: 'Query', runningSessions?: Array<{ __typename?: 'Session', id: string, name: string, displayName: string }> | null };

export type GetSessionLeaderboardQueryVariables = Exact<{
  sessionId: Scalars['ID'];
}>;


export type GetSessionLeaderboardQuery = { __typename?: 'Query', sessionLeaderboard?: Array<{ __typename?: 'LeaderboardEntry', id: string, username: string, avatar?: string | null, score: number }> | null };

export type GetUserSessionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserSessionsQuery = { __typename?: 'Query', userSessions?: Array<{ __typename?: 'Session', id: string, name: string, displayName: string, accessMode: AccessMode, status: SessionStatus, createdAt: any, blocks: Array<{ __typename?: 'SessionBlock', id: number, instances: Array<{ __typename?: 'QuestionInstance', id: number, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string } }> }>, course?: { __typename?: 'Course', name: string, displayName: string } | null }> | null };

export type ParticipationsQueryVariables = Exact<{ [key: string]: never; }>;


export type ParticipationsQuery = { __typename?: 'Query', participations?: Array<{ __typename?: 'Participation', id: number, points: number, course: { __typename?: 'Course', id: string, displayName: string, microSessions: Array<{ __typename?: 'MicroSession', id: string, displayName: string }>, sessions: Array<{ __typename?: 'Session', id: string, displayName: string }> } }> | null };

export type SelfQueryVariables = Exact<{ [key: string]: never; }>;


export type SelfQuery = { __typename?: 'Query', self?: { __typename?: 'Participant', id: string, username: string, avatar: string } | null };

export type UserProfileQueryVariables = Exact<{ [key: string]: never; }>;


export type UserProfileQuery = { __typename?: 'Query', userProfile?: { __typename?: 'User', id: string, isActive: boolean, email: string, shortname: string, description?: string | null } | null };



export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = {
  AccessMode: AccessMode;
  AggregatedConfusionFeedbacks: ResolverTypeWrapper<AggregatedConfusionFeedbacks>;
  Attachment: ResolverTypeWrapper<Attachment>;
  AttachmentType: AttachmentType;
  BlockInput: BlockInput;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']>;
  Choice: ResolverTypeWrapper<Choice>;
  ChoicesQuestionData: ResolverTypeWrapper<ChoicesQuestionData>;
  ChoicesQuestionOptions: ResolverTypeWrapper<ChoicesQuestionOptions>;
  ConfusionTimestep: ResolverTypeWrapper<ConfusionTimestep>;
  Course: ResolverTypeWrapper<Course>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']>;
  Feedback: ResolverTypeWrapper<Feedback>;
  FeedbackResponse: ResolverTypeWrapper<FeedbackResponse>;
  Float: ResolverTypeWrapper<Scalars['Float']>;
  FreeTextQuestionData: ResolverTypeWrapper<FreeTextQuestionData>;
  FreeTextQuestionOptions: ResolverTypeWrapper<FreeTextQuestionOptions>;
  FreeTextRestrictions: ResolverTypeWrapper<FreeTextRestrictions>;
  ID: ResolverTypeWrapper<Scalars['ID']>;
  InstanceEvaluation: ResolverTypeWrapper<InstanceEvaluation>;
  Int: ResolverTypeWrapper<Scalars['Int']>;
  JSONObject: ResolverTypeWrapper<Scalars['JSONObject']>;
  LeaderboardEntry: ResolverTypeWrapper<LeaderboardEntry>;
  LearningElement: ResolverTypeWrapper<LearningElement>;
  LecturerSession: ResolverTypeWrapper<LecturerSession>;
  MicroSession: ResolverTypeWrapper<MicroSession>;
  Mutation: ResolverTypeWrapper<{}>;
  NumericalQuestionData: ResolverTypeWrapper<NumericalQuestionData>;
  NumericalQuestionOptions: ResolverTypeWrapper<NumericalQuestionOptions>;
  NumericalRestrictions: ResolverTypeWrapper<NumericalRestrictions>;
  NumericalSolutionRange: ResolverTypeWrapper<NumericalSolutionRange>;
  Participant: ResolverTypeWrapper<Participant>;
  ParticipantLearningData: ResolverTypeWrapper<ParticipantLearningData>;
  Participation: ResolverTypeWrapper<Participation>;
  Query: ResolverTypeWrapper<{}>;
  QuestionData: ResolversTypes['ChoicesQuestionData'] | ResolversTypes['FreeTextQuestionData'] | ResolversTypes['NumericalQuestionData'];
  QuestionFeedback: ResolverTypeWrapper<QuestionFeedback>;
  QuestionInstance: ResolverTypeWrapper<QuestionInstance>;
  ResponseInput: ResponseInput;
  Session: ResolverTypeWrapper<Session>;
  SessionBlock: ResolverTypeWrapper<SessionBlock>;
  SessionBlockStatus: SessionBlockStatus;
  SessionStatus: SessionStatus;
  String: ResolverTypeWrapper<Scalars['String']>;
  User: ResolverTypeWrapper<User>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  AggregatedConfusionFeedbacks: AggregatedConfusionFeedbacks;
  Attachment: Attachment;
  BlockInput: BlockInput;
  Boolean: Scalars['Boolean'];
  Choice: Choice;
  ChoicesQuestionData: ChoicesQuestionData;
  ChoicesQuestionOptions: ChoicesQuestionOptions;
  ConfusionTimestep: ConfusionTimestep;
  Course: Course;
  DateTime: Scalars['DateTime'];
  Feedback: Feedback;
  FeedbackResponse: FeedbackResponse;
  Float: Scalars['Float'];
  FreeTextQuestionData: FreeTextQuestionData;
  FreeTextQuestionOptions: FreeTextQuestionOptions;
  FreeTextRestrictions: FreeTextRestrictions;
  ID: Scalars['ID'];
  InstanceEvaluation: InstanceEvaluation;
  Int: Scalars['Int'];
  JSONObject: Scalars['JSONObject'];
  LeaderboardEntry: LeaderboardEntry;
  LearningElement: LearningElement;
  LecturerSession: LecturerSession;
  MicroSession: MicroSession;
  Mutation: {};
  NumericalQuestionData: NumericalQuestionData;
  NumericalQuestionOptions: NumericalQuestionOptions;
  NumericalRestrictions: NumericalRestrictions;
  NumericalSolutionRange: NumericalSolutionRange;
  Participant: Participant;
  ParticipantLearningData: ParticipantLearningData;
  Participation: Participation;
  Query: {};
  QuestionData: ResolversParentTypes['ChoicesQuestionData'] | ResolversParentTypes['FreeTextQuestionData'] | ResolversParentTypes['NumericalQuestionData'];
  QuestionFeedback: QuestionFeedback;
  QuestionInstance: QuestionInstance;
  ResponseInput: ResponseInput;
  Session: Session;
  SessionBlock: SessionBlock;
  String: Scalars['String'];
  User: User;
};

export type AggregatedConfusionFeedbacksResolvers<ContextType = any, ParentType extends ResolversParentTypes['AggregatedConfusionFeedbacks'] = ResolversParentTypes['AggregatedConfusionFeedbacks']> = {
  difficulty?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  numberOfParticipants?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  speed?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  timestamp?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AttachmentResolvers<ContextType = any, ParentType extends ResolversParentTypes['Attachment'] = ResolversParentTypes['Attachment']> = {
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  href?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  originalName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['AttachmentType'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ChoiceResolvers<ContextType = any, ParentType extends ResolversParentTypes['Choice'] = ResolversParentTypes['Choice']> = {
  correct?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  feedback?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  ix?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  value?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ChoicesQuestionDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['ChoicesQuestionData'] = ResolversParentTypes['ChoicesQuestionData']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  contentPlain?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isArchived?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  options?: Resolver<ResolversTypes['ChoicesQuestionOptions'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ChoicesQuestionOptionsResolvers<ContextType = any, ParentType extends ResolversParentTypes['ChoicesQuestionOptions'] = ResolversParentTypes['ChoicesQuestionOptions']> = {
  choices?: Resolver<Array<ResolversTypes['Choice']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ConfusionTimestepResolvers<ContextType = any, ParentType extends ResolversParentTypes['ConfusionTimestep'] = ResolversParentTypes['ConfusionTimestep']> = {
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  difficulty?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  speed?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CourseResolvers<ContextType = any, ParentType extends ResolversParentTypes['Course'] = ResolversParentTypes['Course']> = {
  color?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  learningElements?: Resolver<Array<ResolversTypes['LearningElement']>, ParentType, ContextType>;
  microSessions?: Resolver<Array<ResolversTypes['MicroSession']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  sessions?: Resolver<Array<ResolversTypes['Session']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type FeedbackResolvers<ContextType = any, ParentType extends ResolversParentTypes['Feedback'] = ResolversParentTypes['Feedback']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isPinned?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isPublished?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isResolved?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  resolvedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  responses?: Resolver<Maybe<Array<Maybe<ResolversTypes['FeedbackResponse']>>>, ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  votes?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FeedbackResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['FeedbackResponse'] = ResolversParentTypes['FeedbackResponse']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  negativeReactions?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  positiveReactions?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  resolvedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FreeTextQuestionDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['FreeTextQuestionData'] = ResolversParentTypes['FreeTextQuestionData']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  contentPlain?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isArchived?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  options?: Resolver<ResolversTypes['FreeTextQuestionOptions'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FreeTextQuestionOptionsResolvers<ContextType = any, ParentType extends ResolversParentTypes['FreeTextQuestionOptions'] = ResolversParentTypes['FreeTextQuestionOptions']> = {
  restrictions?: Resolver<Maybe<ResolversTypes['FreeTextRestrictions']>, ParentType, ContextType>;
  solutions?: Resolver<Maybe<Array<ResolversTypes['String']>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FreeTextRestrictionsResolvers<ContextType = any, ParentType extends ResolversParentTypes['FreeTextRestrictions'] = ResolversParentTypes['FreeTextRestrictions']> = {
  maxLength?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type InstanceEvaluationResolvers<ContextType = any, ParentType extends ResolversParentTypes['InstanceEvaluation'] = ResolversParentTypes['InstanceEvaluation']> = {
  choices?: Resolver<ResolversTypes['JSONObject'], ParentType, ContextType>;
  feedbacks?: Resolver<Maybe<Array<ResolversTypes['QuestionFeedback']>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface JsonObjectScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSONObject'], any> {
  name: 'JSONObject';
}

export type LeaderboardEntryResolvers<ContextType = any, ParentType extends ResolversParentTypes['LeaderboardEntry'] = ResolversParentTypes['LeaderboardEntry']> = {
  avatar?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  score?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  username?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LearningElementResolvers<ContextType = any, ParentType extends ResolversParentTypes['LearningElement'] = ResolversParentTypes['LearningElement']> = {
  course?: Resolver<ResolversTypes['Course'], ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  instances?: Resolver<Array<ResolversTypes['QuestionInstance']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LecturerSessionResolvers<ContextType = any, ParentType extends ResolversParentTypes['LecturerSession'] = ResolversParentTypes['LecturerSession']> = {
  accessMode?: Resolver<ResolversTypes['AccessMode'], ParentType, ContextType>;
  activeBlock?: Resolver<Maybe<ResolversTypes['SessionBlock']>, ParentType, ContextType>;
  blocks?: Resolver<Array<ResolversTypes['SessionBlock']>, ParentType, ContextType>;
  confusionFeedbacks?: Resolver<Maybe<Array<Maybe<ResolversTypes['AggregatedConfusionFeedbacks']>>>, ParentType, ContextType>;
  course?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  feedbacks?: Resolver<Maybe<Array<Maybe<ResolversTypes['Feedback']>>>, ParentType, ContextType>;
  finishedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isAudienceInteractionActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isGamificationEnabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isModerationEnabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  namespace?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  startedAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SessionStatus'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MicroSessionResolvers<ContextType = any, ParentType extends ResolversParentTypes['MicroSession'] = ResolversParentTypes['MicroSession']> = {
  course?: Resolver<ResolversTypes['Course'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  instances?: Resolver<Array<ResolversTypes['QuestionInstance']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  activateSessionBlock?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationActivateSessionBlockArgs, 'sessionBlockId' | 'sessionId'>>;
  addConfusionTimestep?: Resolver<Maybe<ResolversTypes['ConfusionTimestep']>, ParentType, ContextType, RequireFields<MutationAddConfusionTimestepArgs, 'difficulty' | 'sessionId' | 'speed'>>;
  changeSessionSettings?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationChangeSessionSettingsArgs, 'id'>>;
  createCourse?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType, RequireFields<MutationCreateCourseArgs, 'name'>>;
  createFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationCreateFeedbackArgs, 'content' | 'sessionId'>>;
  createSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationCreateSessionArgs, 'blocks' | 'name'>>;
  deactivateSessionBlock?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationDeactivateSessionBlockArgs, 'sessionBlockId' | 'sessionId'>>;
  deleteFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationDeleteFeedbackArgs, 'id'>>;
  deleteFeedbackResponse?: Resolver<Maybe<ResolversTypes['FeedbackResponse']>, ParentType, ContextType, RequireFields<MutationDeleteFeedbackResponseArgs, 'id'>>;
  endSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationEndSessionArgs, 'id'>>;
  joinCourse?: Resolver<Maybe<ResolversTypes['Participation']>, ParentType, ContextType, RequireFields<MutationJoinCourseArgs, 'courseId'>>;
  leaveCourse?: Resolver<Maybe<ResolversTypes['Participation']>, ParentType, ContextType, RequireFields<MutationLeaveCourseArgs, 'courseId'>>;
  loginParticipant?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType, RequireFields<MutationLoginParticipantArgs, 'password' | 'username'>>;
  loginUser?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType, RequireFields<MutationLoginUserArgs, 'email' | 'password'>>;
  logoutParticipant?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType, RequireFields<MutationLogoutParticipantArgs, 'id'>>;
  logoutUser?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType, RequireFields<MutationLogoutUserArgs, 'userId'>>;
  pinFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationPinFeedbackArgs, 'id' | 'isPinned'>>;
  publishFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationPublishFeedbackArgs, 'id' | 'isPublished'>>;
  registerParticipantFromLTI?: Resolver<Maybe<ResolversTypes['ParticipantLearningData']>, ParentType, ContextType, RequireFields<MutationRegisterParticipantFromLtiArgs, 'courseId' | 'participantId'>>;
  resolveFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationResolveFeedbackArgs, 'id' | 'isResolved'>>;
  respondToFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationRespondToFeedbackArgs, 'id' | 'responseContent'>>;
  respondToQuestionInstance?: Resolver<Maybe<ResolversTypes['QuestionInstance']>, ParentType, ContextType, RequireFields<MutationRespondToQuestionInstanceArgs, 'courseId' | 'id' | 'response'>>;
  startSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationStartSessionArgs, 'id'>>;
  upvoteFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationUpvoteFeedbackArgs, 'feedbackId' | 'increment'>>;
  voteFeedbackResponse?: Resolver<Maybe<ResolversTypes['FeedbackResponse']>, ParentType, ContextType, RequireFields<MutationVoteFeedbackResponseArgs, 'id' | 'incrementDownvote' | 'incrementUpvote'>>;
};

export type NumericalQuestionDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['NumericalQuestionData'] = ResolversParentTypes['NumericalQuestionData']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  contentPlain?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isArchived?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  options?: Resolver<ResolversTypes['NumericalQuestionOptions'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type NumericalQuestionOptionsResolvers<ContextType = any, ParentType extends ResolversParentTypes['NumericalQuestionOptions'] = ResolversParentTypes['NumericalQuestionOptions']> = {
  restrictions?: Resolver<Maybe<ResolversTypes['NumericalRestrictions']>, ParentType, ContextType>;
  solutionRanges?: Resolver<Maybe<Array<ResolversTypes['NumericalSolutionRange']>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type NumericalRestrictionsResolvers<ContextType = any, ParentType extends ResolversParentTypes['NumericalRestrictions'] = ResolversParentTypes['NumericalRestrictions']> = {
  max?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  min?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type NumericalSolutionRangeResolvers<ContextType = any, ParentType extends ResolversParentTypes['NumericalSolutionRange'] = ResolversParentTypes['NumericalSolutionRange']> = {
  max?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  min?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ParticipantResolvers<ContextType = any, ParentType extends ResolversParentTypes['Participant'] = ResolversParentTypes['Participant']> = {
  avatar?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  username?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ParticipantLearningDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['ParticipantLearningData'] = ResolversParentTypes['ParticipantLearningData']> = {
  course?: Resolver<ResolversTypes['Course'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  participant?: Resolver<ResolversTypes['Participant'], ParentType, ContextType>;
  participantToken?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  participation?: Resolver<ResolversTypes['Participation'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ParticipationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Participation'] = ResolversParentTypes['Participation']> = {
  course?: Resolver<ResolversTypes['Course'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  points?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  cockpitSession?: Resolver<Maybe<ResolversTypes['LecturerSession']>, ParentType, ContextType, RequireFields<QueryCockpitSessionArgs, 'id'>>;
  feedbacks?: Resolver<Maybe<Array<ResolversTypes['Feedback']>>, ParentType, ContextType, RequireFields<QueryFeedbacksArgs, 'id'>>;
  getCourseOverviewData?: Resolver<Maybe<ResolversTypes['ParticipantLearningData']>, ParentType, ContextType, RequireFields<QueryGetCourseOverviewDataArgs, 'courseId'>>;
  learningElement?: Resolver<Maybe<ResolversTypes['LearningElement']>, ParentType, ContextType, RequireFields<QueryLearningElementArgs, 'id'>>;
  microSession?: Resolver<Maybe<ResolversTypes['MicroSession']>, ParentType, ContextType, RequireFields<QueryMicroSessionArgs, 'id'>>;
  participations?: Resolver<Maybe<Array<ResolversTypes['Participation']>>, ParentType, ContextType>;
  pinnedFeedbacks?: Resolver<Maybe<ResolversTypes['LecturerSession']>, ParentType, ContextType, RequireFields<QueryPinnedFeedbacksArgs, 'id'>>;
  runningSessions?: Resolver<Maybe<Array<ResolversTypes['Session']>>, ParentType, ContextType, RequireFields<QueryRunningSessionsArgs, 'shortname'>>;
  self?: Resolver<Maybe<ResolversTypes['Participant']>, ParentType, ContextType>;
  session?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<QuerySessionArgs, 'id'>>;
  sessionLeaderboard?: Resolver<Maybe<Array<ResolversTypes['LeaderboardEntry']>>, ParentType, ContextType, RequireFields<QuerySessionLeaderboardArgs, 'sessionId'>>;
  userProfile?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  userSessions?: Resolver<Maybe<Array<ResolversTypes['Session']>>, ParentType, ContextType>;
};

export type QuestionDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['QuestionData'] = ResolversParentTypes['QuestionData']> = {
  __resolveType: TypeResolveFn<'ChoicesQuestionData' | 'FreeTextQuestionData' | 'NumericalQuestionData', ParentType, ContextType>;
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  contentPlain?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isArchived?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type QuestionFeedbackResolvers<ContextType = any, ParentType extends ResolversParentTypes['QuestionFeedback'] = ResolversParentTypes['QuestionFeedback']> = {
  correct?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  feedback?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  ix?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  value?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QuestionInstanceResolvers<ContextType = any, ParentType extends ResolversParentTypes['QuestionInstance'] = ResolversParentTypes['QuestionInstance']> = {
  attachments?: Resolver<Array<Maybe<ResolversTypes['Attachment']>>, ParentType, ContextType>;
  evaluation?: Resolver<Maybe<ResolversTypes['InstanceEvaluation']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  questionData?: Resolver<ResolversTypes['QuestionData'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SessionResolvers<ContextType = any, ParentType extends ResolversParentTypes['Session'] = ResolversParentTypes['Session']> = {
  accessMode?: Resolver<ResolversTypes['AccessMode'], ParentType, ContextType>;
  activeBlock?: Resolver<Maybe<ResolversTypes['SessionBlock']>, ParentType, ContextType>;
  blocks?: Resolver<Array<ResolversTypes['SessionBlock']>, ParentType, ContextType>;
  confusionFeedbacks?: Resolver<Maybe<Array<Maybe<ResolversTypes['ConfusionTimestep']>>>, ParentType, ContextType>;
  course?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['DateTime'], ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  feedbacks?: Resolver<Maybe<Array<Maybe<ResolversTypes['Feedback']>>>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isAudienceInteractionActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isGamificationEnabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isModerationEnabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  namespace?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SessionStatus'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SessionBlockResolvers<ContextType = any, ParentType extends ResolversParentTypes['SessionBlock'] = ResolversParentTypes['SessionBlock']> = {
  execution?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  expiresAt?: Resolver<Maybe<ResolversTypes['DateTime']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  instances?: Resolver<Array<ResolversTypes['QuestionInstance']>, ParentType, ContextType>;
  randomSelection?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SessionBlockStatus'], ParentType, ContextType>;
  timeLimit?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UserResolvers<ContextType = any, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = {
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  shortname?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  AggregatedConfusionFeedbacks?: AggregatedConfusionFeedbacksResolvers<ContextType>;
  Attachment?: AttachmentResolvers<ContextType>;
  Choice?: ChoiceResolvers<ContextType>;
  ChoicesQuestionData?: ChoicesQuestionDataResolvers<ContextType>;
  ChoicesQuestionOptions?: ChoicesQuestionOptionsResolvers<ContextType>;
  ConfusionTimestep?: ConfusionTimestepResolvers<ContextType>;
  Course?: CourseResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  Feedback?: FeedbackResolvers<ContextType>;
  FeedbackResponse?: FeedbackResponseResolvers<ContextType>;
  FreeTextQuestionData?: FreeTextQuestionDataResolvers<ContextType>;
  FreeTextQuestionOptions?: FreeTextQuestionOptionsResolvers<ContextType>;
  FreeTextRestrictions?: FreeTextRestrictionsResolvers<ContextType>;
  InstanceEvaluation?: InstanceEvaluationResolvers<ContextType>;
  JSONObject?: GraphQLScalarType;
  LeaderboardEntry?: LeaderboardEntryResolvers<ContextType>;
  LearningElement?: LearningElementResolvers<ContextType>;
  LecturerSession?: LecturerSessionResolvers<ContextType>;
  MicroSession?: MicroSessionResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  NumericalQuestionData?: NumericalQuestionDataResolvers<ContextType>;
  NumericalQuestionOptions?: NumericalQuestionOptionsResolvers<ContextType>;
  NumericalRestrictions?: NumericalRestrictionsResolvers<ContextType>;
  NumericalSolutionRange?: NumericalSolutionRangeResolvers<ContextType>;
  Participant?: ParticipantResolvers<ContextType>;
  ParticipantLearningData?: ParticipantLearningDataResolvers<ContextType>;
  Participation?: ParticipationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  QuestionData?: QuestionDataResolvers<ContextType>;
  QuestionFeedback?: QuestionFeedbackResolvers<ContextType>;
  QuestionInstance?: QuestionInstanceResolvers<ContextType>;
  Session?: SessionResolvers<ContextType>;
  SessionBlock?: SessionBlockResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
};


export const QuestionDataFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"contentPlain"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}}]}}]}}]} as unknown as DocumentNode<QuestionDataFragment, unknown>;
export const QuestionDataWithoutSolutionsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"contentPlain"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<QuestionDataWithoutSolutionsFragment, unknown>;
export const ActivateSessionBlockDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ActivateSessionBlock"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionBlockId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activateSessionBlock"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"sessionBlockId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionBlockId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]}}]} as unknown as DocumentNode<ActivateSessionBlockMutation, ActivateSessionBlockMutationVariables>;
export const AddConfusionTimestepDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddConfusionTimestep"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"difficulty"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"speed"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addConfusionTimestep"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"difficulty"},"value":{"kind":"Variable","name":{"kind":"Name","value":"difficulty"}}},{"kind":"Argument","name":{"kind":"Name","value":"speed"},"value":{"kind":"Variable","name":{"kind":"Name","value":"speed"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"speed"}}]}}]}}]} as unknown as DocumentNode<AddConfusionTimestepMutation, AddConfusionTimestepMutationVariables>;
export const ChangeSessionSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangeSessionSettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isAudienceInteractionActive"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isModerationEnabled"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changeSessionSettings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"isAudienceInteractionActive"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isAudienceInteractionActive"}}},{"kind":"Argument","name":{"kind":"Name","value":"isModerationEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isModerationEnabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"isGamificationEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<ChangeSessionSettingsMutation, ChangeSessionSettingsMutationVariables>;
export const CreateFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"content"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"content"},"value":{"kind":"Variable","name":{"kind":"Name","value":"content"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<CreateFeedbackMutation, CreateFeedbackMutationVariables>;
export const DeactivateSessionBlockDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeactivateSessionBlock"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionBlockId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deactivateSessionBlock"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"sessionBlockId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionBlockId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"activeBlock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]}}]} as unknown as DocumentNode<DeactivateSessionBlockMutation, DeactivateSessionBlockMutationVariables>;
export const DeleteFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteFeedbackMutation, DeleteFeedbackMutationVariables>;
export const DeleteFeedbackResponseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteFeedbackResponse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteFeedbackResponse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteFeedbackResponseMutation, DeleteFeedbackResponseMutationVariables>;
export const EndSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EndSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"endSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<EndSessionMutation, EndSessionMutationVariables>;
export const JoinCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}}]}}]} as unknown as DocumentNode<JoinCourseMutation, JoinCourseMutationVariables>;
export const LeaveCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LeaveCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"leaveCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}}]}}]} as unknown as DocumentNode<LeaveCourseMutation, LeaveCourseMutationVariables>;
export const LoginParticipantDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginParticipant"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginParticipant"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}]}]}}]} as unknown as DocumentNode<LoginParticipantMutation, LoginParticipantMutationVariables>;
export const LoginUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}]}]}}]} as unknown as DocumentNode<LoginUserMutation, LoginUserMutationVariables>;
export const LogoutParticipantDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LogoutParticipant"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logoutParticipant"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}]}]}}]} as unknown as DocumentNode<LogoutParticipantMutation, LogoutParticipantMutationVariables>;
export const LogoutUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LogoutUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"userId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logoutUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"userId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"userId"}}}]}]}}]} as unknown as DocumentNode<LogoutUserMutation, LogoutUserMutationVariables>;
export const PinFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PinFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isPinned"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pinFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"isPinned"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isPinned"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<PinFeedbackMutation, PinFeedbackMutationVariables>;
export const PublishFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PublishFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isPublished"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publishFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"isPublished"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isPublished"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<PublishFeedbackMutation, PublishFeedbackMutationVariables>;
export const RegisterParticipantFromLtiDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RegisterParticipantFromLTI"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"participantId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registerParticipantFromLTI"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"participantId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"participantId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participantToken"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]} as unknown as DocumentNode<RegisterParticipantFromLtiMutation, RegisterParticipantFromLtiMutationVariables>;
export const ResolveFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResolveFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isResolved"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resolveFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"isResolved"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isResolved"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<ResolveFeedbackMutation, ResolveFeedbackMutationVariables>;
export const RespondToFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RespondToFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"responseContent"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"respondToFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"responseContent"},"value":{"kind":"Variable","name":{"kind":"Name","value":"responseContent"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]}}]} as unknown as DocumentNode<RespondToFeedbackMutation, RespondToFeedbackMutationVariables>;
export const ResponseToQuestionInstanceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResponseToQuestionInstance"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"response"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ResponseInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"respondToQuestionInstance"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"response"},"value":{"kind":"Variable","name":{"kind":"Name","value":"response"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionData"}},{"kind":"Field","name":{"kind":"Name","value":"evaluation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"choices"}}]}}]}}]}},...QuestionDataFragmentDoc.definitions]} as unknown as DocumentNode<ResponseToQuestionInstanceMutation, ResponseToQuestionInstanceMutationVariables>;
export const StartSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<StartSessionMutation, StartSessionMutationVariables>;
export const UpvoteFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpvoteFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"feedbackId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"increment"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"upvoteFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"feedbackId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"feedbackId"}}},{"kind":"Argument","name":{"kind":"Name","value":"increment"},"value":{"kind":"Variable","name":{"kind":"Name","value":"increment"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<UpvoteFeedbackMutation, UpvoteFeedbackMutationVariables>;
export const VoteFeedbackResponseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VoteFeedbackResponse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"incrementUpvote"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"incrementDownvote"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voteFeedbackResponse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"incrementUpvote"},"value":{"kind":"Variable","name":{"kind":"Name","value":"incrementUpvote"}}},{"kind":"Argument","name":{"kind":"Name","value":"incrementDownvote"},"value":{"kind":"Variable","name":{"kind":"Name","value":"incrementDownvote"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]} as unknown as DocumentNode<VoteFeedbackResponseMutation, VoteFeedbackResponseMutationVariables>;
export const GetCockpitSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetCockpitSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cockpitSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isAudienceInteractionActive"}},{"kind":"Field","name":{"kind":"Name","value":"isModerationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"namespace"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"randomSelection"}},{"kind":"Field","name":{"kind":"Name","value":"execution"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"contentPlain"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"confusionFeedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"speed"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"numberOfParticipants"}}]}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetCockpitSessionQuery, GetCockpitSessionQueryVariables>;
export const GetCourseOverviewDataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetCourseOverviewData"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getCourseOverviewData"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]} as unknown as DocumentNode<GetCourseOverviewDataQuery, GetCourseOverviewDataQueryVariables>;
export const GetFeedbacksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFeedbacks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]}}]} as unknown as DocumentNode<GetFeedbacksQuery, GetFeedbacksQueryVariables>;
export const GetLearningElementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetLearningElement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"learningElement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionData"}},{"kind":"Field","name":{"kind":"Name","value":"evaluation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"choices"}}]}}]}}]}}]}},...QuestionDataFragmentDoc.definitions]} as unknown as DocumentNode<GetLearningElementQuery, GetLearningElementQueryVariables>;
export const GetMicroSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMicroSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"microSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionData"}},{"kind":"Field","name":{"kind":"Name","value":"evaluation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"choices"}}]}}]}}]}}]}},...QuestionDataFragmentDoc.definitions]} as unknown as DocumentNode<GetMicroSessionQuery, GetMicroSessionQueryVariables>;
export const GetPinnedFeedbacksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPinnedFeedbacks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pinnedFeedbacks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isAudienceInteractionActive"}},{"kind":"Field","name":{"kind":"Name","value":"isModerationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"confusionFeedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"speed"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"numberOfParticipants"}}]}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetPinnedFeedbacksQuery, GetPinnedFeedbacksQueryVariables>;
export const GetRunningSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRunningSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"session"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isAudienceInteractionActive"}},{"kind":"Field","name":{"kind":"Name","value":"isModerationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"namespace"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"activeBlock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"randomSelection"}},{"kind":"Field","name":{"kind":"Name","value":"execution"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"href"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"originalName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionDataWithoutSolutions"}}]}}]}}]}}]}},...QuestionDataWithoutSolutionsFragmentDoc.definitions]} as unknown as DocumentNode<GetRunningSessionQuery, GetRunningSessionQueryVariables>;
export const GetRunningSessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRunningSessions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shortname"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"runningSessions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shortname"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shortname"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]} as unknown as DocumentNode<GetRunningSessionsQuery, GetRunningSessionsQueryVariables>;
export const GetSessionLeaderboardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSessionLeaderboard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sessionLeaderboard"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"score"}}]}}]}}]} as unknown as DocumentNode<GetSessionLeaderboardQuery, GetSessionLeaderboardQueryVariables>;
export const GetUserSessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"accessMode"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]} as unknown as DocumentNode<GetUserSessionsQuery, GetUserSessionsQueryVariables>;
export const ParticipationsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Participations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participations"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"points"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"microSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ParticipationsQuery, ParticipationsQueryVariables>;
export const SelfDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Self"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"self"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}}]} as unknown as DocumentNode<SelfQuery, SelfQueryVariables>;
export const UserProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserProfile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userProfile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"shortname"}},{"kind":"Field","name":{"kind":"Name","value":"description"}}]}}]}}]} as unknown as DocumentNode<UserProfileQuery, UserProfileQueryVariables>;

      export interface PossibleTypesResultData {
        possibleTypes: {
          [key: string]: string[]
        }
      }
      const result: PossibleTypesResultData = {
  "possibleTypes": {
    "QuestionData": [
      "ChoicesQuestionData",
      "FreeTextQuestionData",
      "NumericalQuestionData"
    ]
  }
};
      export default result;
    