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
  Date: any;
  /** The `JSONObject` scalar type represents JSON objects as specified by [ECMA-404](http://www.ecma-international.org/publications/files/ECMA-ST/ECMA-404.pdf). */
  Json: any;
};

export type Achievement = {
  __typename?: 'Achievement';
  description: Scalars['String'];
  icon: Scalars['String'];
  iconColor?: Maybe<Scalars['String']>;
  id: Scalars['Int'];
  name: Scalars['String'];
};

export type Attachment = {
  __typename?: 'Attachment';
  id: Scalars['ID'];
};

export type AttachmentInstance = {
  __typename?: 'AttachmentInstance';
  id: Scalars['ID'];
};

export type AvatarSettingsInput = {
  accessory: Scalars['String'];
  clothing: Scalars['String'];
  clothingColor: Scalars['String'];
  eyes: Scalars['String'];
  facialHair: Scalars['String'];
  hair: Scalars['String'];
  hairColor: Scalars['String'];
  mouth: Scalars['String'];
  skinTone: Scalars['String'];
};

export type AwardEntry = {
  __typename?: 'AwardEntry';
  id: Scalars['Int'];
};

export type ClassAchievementInstance = {
  __typename?: 'ClassAchievementInstance';
  id: Scalars['Int'];
};

export type ConfusionTimestep = {
  __typename?: 'ConfusionTimestep';
  id: Scalars['Int'];
};

export type Course = {
  __typename?: 'Course';
  color?: Maybe<Scalars['String']>;
  createdAt: Scalars['Date'];
  description?: Maybe<Scalars['String']>;
  displayName: Scalars['String'];
  id: Scalars['ID'];
  isArchived?: Maybe<Scalars['Boolean']>;
  name: Scalars['String'];
  pinCode?: Maybe<Scalars['Int']>;
  sessions: Array<Session>;
  updatedAt: Scalars['Date'];
};

export type Feedback = {
  __typename?: 'Feedback';
  content: Scalars['String'];
  createdAt: Scalars['Date'];
  id: Scalars['Int'];
  isPinned: Scalars['Boolean'];
  isPublished: Scalars['Boolean'];
  isResolved: Scalars['Boolean'];
  resolvedAt: Scalars['Date'];
  responses: Array<FeedbackResponse>;
  votes: Scalars['Int'];
};

export type FeedbackResponse = {
  __typename?: 'FeedbackResponse';
  content: Scalars['String'];
  id: Scalars['Int'];
  negativeReactions: Scalars['Int'];
  positiveReactions: Scalars['Int'];
};

export type GroupAchievementInstance = {
  __typename?: 'GroupAchievementInstance';
  id: Scalars['Int'];
};

export type GroupActivity = {
  __typename?: 'GroupActivity';
  id: Scalars['ID'];
};

export type GroupActivityClue = {
  __typename?: 'GroupActivityClue';
  id: Scalars['Int'];
};

export type GroupActivityClueAssignment = {
  __typename?: 'GroupActivityClueAssignment';
  id: Scalars['Int'];
};

export type GroupActivityClueInstance = {
  __typename?: 'GroupActivityClueInstance';
  id: Scalars['Int'];
};

export type GroupActivityDecisionInput = {
  id: Scalars['Int'];
  response?: InputMaybe<Scalars['String']>;
  selectedOptions: Array<Scalars['Int']>;
};

export type GroupActivityInstance = {
  __typename?: 'GroupActivityInstance';
  id: Scalars['Int'];
};

export type GroupActivityParameter = {
  __typename?: 'GroupActivityParameter';
  id: Scalars['Int'];
};

export type LeaderboardEntry = {
  __typename?: 'LeaderboardEntry';
  id: Scalars['Int'];
};

export type LearningElement = {
  __typename?: 'LearningElement';
  id: Scalars['ID'];
};

export type LeaveCourseParticipation = {
  __typename?: 'LeaveCourseParticipation';
  id: Scalars['String'];
  participation: Participation;
};

export type MicroSession = {
  __typename?: 'MicroSession';
  id: Scalars['ID'];
};

export type Mutation = {
  __typename?: 'Mutation';
  cancelSession?: Maybe<Session>;
  changeCourseColor?: Maybe<Course>;
  changeCourseDescription?: Maybe<Course>;
  createFeedback?: Maybe<Feedback>;
  deactivateSessionBlock?: Maybe<Session>;
  deleteFeedback?: Maybe<Feedback>;
  deleteFeedbackResponse?: Maybe<Feedback>;
  deleteQuestion?: Maybe<Question>;
  deleteTag?: Maybe<Tag>;
  editTag?: Maybe<Tag>;
  endSession?: Maybe<Session>;
  generateLoginToken?: Maybe<User>;
  joinCourseWithPin?: Maybe<Participant>;
  joinParticipantGroup?: Maybe<ParticipantGroup>;
  leaveCourse?: Maybe<LeaveCourseParticipation>;
  leaveParticipantGroup?: Maybe<ParticipantGroup>;
  loginParticipant?: Maybe<Scalars['ID']>;
  loginUser?: Maybe<Scalars['String']>;
  loginUserToken?: Maybe<Scalars['ID']>;
  logoutParticipant?: Maybe<Scalars['ID']>;
  logoutUser?: Maybe<Scalars['ID']>;
  markMicroSessionCompleted?: Maybe<Participation>;
  pinFeedback?: Maybe<Feedback>;
  publishFeedback?: Maybe<Feedback>;
  resolveFeedback?: Maybe<Feedback>;
  respondToFeedback?: Maybe<Feedback>;
  startSession?: Maybe<Session>;
  submitGroupActivityDecisions?: Maybe<GroupActivityInstance>;
  subscribeToPush?: Maybe<Participation>;
  updateParticipantProfile?: Maybe<Participant>;
  upvoteFeedback?: Maybe<Feedback>;
  voteFeedbackResponse?: Maybe<FeedbackResponse>;
};


export type MutationCancelSessionArgs = {
  id: Scalars['String'];
};


export type MutationChangeCourseColorArgs = {
  color: Scalars['String'];
  courseId: Scalars['String'];
};


export type MutationChangeCourseDescriptionArgs = {
  courseId: Scalars['String'];
  input: Scalars['String'];
};


export type MutationCreateFeedbackArgs = {
  content: Scalars['String'];
  sessionId: Scalars['String'];
};


export type MutationDeactivateSessionBlockArgs = {
  sessionBlockId: Scalars['Int'];
  sessionId: Scalars['String'];
};


export type MutationDeleteFeedbackArgs = {
  id: Scalars['Int'];
};


export type MutationDeleteFeedbackResponseArgs = {
  id: Scalars['Int'];
};


export type MutationDeleteQuestionArgs = {
  id: Scalars['Int'];
};


export type MutationDeleteTagArgs = {
  id: Scalars['Int'];
};


export type MutationEditTagArgs = {
  id: Scalars['Int'];
  name: Scalars['String'];
};


export type MutationEndSessionArgs = {
  id: Scalars['String'];
};


export type MutationJoinCourseWithPinArgs = {
  courseId: Scalars['String'];
  pin: Scalars['Int'];
};


export type MutationJoinParticipantGroupArgs = {
  code: Scalars['Int'];
  courseId: Scalars['String'];
};


export type MutationLeaveCourseArgs = {
  courseId: Scalars['String'];
};


export type MutationLeaveParticipantGroupArgs = {
  courseId: Scalars['String'];
  groupId: Scalars['String'];
};


export type MutationLoginParticipantArgs = {
  password: Scalars['String'];
  username: Scalars['String'];
};


export type MutationLoginUserArgs = {
  email: Scalars['String'];
  password: Scalars['String'];
};


export type MutationLoginUserTokenArgs = {
  email: Scalars['String'];
  token: Scalars['String'];
};


export type MutationMarkMicroSessionCompletedArgs = {
  courseId: Scalars['String'];
  id: Scalars['String'];
};


export type MutationPinFeedbackArgs = {
  id: Scalars['Int'];
  isPinned: Scalars['Boolean'];
};


export type MutationPublishFeedbackArgs = {
  id: Scalars['Int'];
  isPublished: Scalars['Boolean'];
};


export type MutationResolveFeedbackArgs = {
  id: Scalars['Int'];
  isResolved: Scalars['Boolean'];
};


export type MutationRespondToFeedbackArgs = {
  id: Scalars['Int'];
  responseContent: Scalars['String'];
};


export type MutationStartSessionArgs = {
  id: Scalars['String'];
};


export type MutationSubmitGroupActivityDecisionsArgs = {
  activityInstanceId: Scalars['Int'];
  decisions: Array<GroupActivityDecisionInput>;
};


export type MutationSubscribeToPushArgs = {
  courseId: Scalars['String'];
  subscriptionObject: SubscriptionObjectInput;
};


export type MutationUpdateParticipantProfileArgs = {
  avatar?: InputMaybe<Scalars['String']>;
  avatarSettings?: InputMaybe<AvatarSettingsInput>;
  password?: InputMaybe<Scalars['String']>;
  username?: InputMaybe<Scalars['String']>;
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

export type Participant = {
  __typename?: 'Participant';
  achievements: Array<ParticipantAchievementInstance>;
  avatar?: Maybe<Scalars['String']>;
  avatarSettings: Scalars['Json'];
  id: Scalars['ID'];
  lastLoginAt: Scalars['Date'];
  level: Scalars['Int'];
  participantGroups: Array<ParticipantGroup>;
  username: Scalars['String'];
  xp: Scalars['Int'];
};

export type ParticipantAchievementInstance = {
  __typename?: 'ParticipantAchievementInstance';
  achievedAt: Scalars['Date'];
  achievedCount: Scalars['Int'];
  achievement: Achievement;
  id: Scalars['Int'];
};

export type ParticipantGroup = {
  __typename?: 'ParticipantGroup';
  code: Scalars['Int'];
  id: Scalars['ID'];
  name: Scalars['String'];
  participants: Array<Participant>;
};

export type ParticipantLearningData = {
  __typename?: 'ParticipantLearningData';
  id: Scalars['String'];
};

export type Participation = {
  __typename?: 'Participation';
  completedMicroSessions: Array<Scalars['String']>;
  id: Scalars['Int'];
  isActive: Scalars['Boolean'];
  subscriptions: Array<PushSubscription>;
};

export type PushSubscription = {
  __typename?: 'PushSubscription';
  endpoint: Scalars['String'];
  id: Scalars['Int'];
};

export type Query = {
  __typename?: 'Query';
  basicCourseInformation?: Maybe<Course>;
  controlCourse?: Maybe<Course>;
  controlCourses?: Maybe<Array<Course>>;
  feedbacks?: Maybe<Array<Feedback>>;
  getLoginToken?: Maybe<User>;
  runningSessions?: Maybe<Array<Session>>;
  self?: Maybe<Participant>;
  unassignedSessions?: Maybe<Array<Session>>;
  userCourses?: Maybe<Array<Course>>;
  userProfile?: Maybe<User>;
  userQuestions?: Maybe<Array<Question>>;
  userTags?: Maybe<Array<Tag>>;
};


export type QueryBasicCourseInformationArgs = {
  courseId: Scalars['String'];
};


export type QueryControlCourseArgs = {
  id: Scalars['String'];
};


export type QueryFeedbacksArgs = {
  id: Scalars['String'];
};


export type QueryRunningSessionsArgs = {
  shortname: Scalars['String'];
};

export type Question = {
  __typename?: 'Question';
  content: Scalars['String'];
  createdAt: Scalars['Date'];
  hasAnswerFeedbacks: Scalars['Boolean'];
  hasSampleSolution: Scalars['Boolean'];
  id: Scalars['Int'];
  isArchived: Scalars['Boolean'];
  isDeleted: Scalars['Boolean'];
  name: Scalars['String'];
  options: Scalars['Json'];
  pointsMultiplier: Scalars['Int'];
  tags: Array<Tag>;
  type: Scalars['String'];
  updatedAt: Scalars['Date'];
};

export type QuestionInstance = {
  __typename?: 'QuestionInstance';
  id: Scalars['Int'];
};

export type QuestionResponse = {
  __typename?: 'QuestionResponse';
  id: Scalars['Int'];
};

export type QuestionResponseDetail = {
  __typename?: 'QuestionResponseDetail';
  id: Scalars['Int'];
};

export type Session = {
  __typename?: 'Session';
  accessMode: SessionAccessMode;
  activeBlock: SessionBlock;
  blocks: Array<SessionBlock>;
  confusionFeedbacks: Array<ConfusionTimestep>;
  course: Course;
  createdAt: Scalars['Date'];
  description?: Maybe<Scalars['String']>;
  displayName: Scalars['String'];
  feedbacks: Array<Feedback>;
  finishedAt?: Maybe<Scalars['Date']>;
  id: Scalars['ID'];
  isAudienceInteractionActive: Scalars['Boolean'];
  isGamificationEnabled: Scalars['Boolean'];
  isModerationEnabled: Scalars['Boolean'];
  linkTo?: Maybe<Scalars['String']>;
  linkToJoin?: Maybe<Scalars['String']>;
  name: Scalars['String'];
  namespace: Scalars['String'];
  pinCode?: Maybe<Scalars['Int']>;
  pointsMultiplier: Scalars['Int'];
  startedAt?: Maybe<Scalars['Date']>;
  status: SessionStatus;
  updatedAt?: Maybe<Scalars['Date']>;
};

export enum SessionAccessMode {
  Public = 'PUBLIC',
  Restricted = 'RESTRICTED'
}

export type SessionBlock = {
  __typename?: 'SessionBlock';
  id: Scalars['Int'];
  status: SessionBlockStatus;
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

export type SubscriptionKeysInput = {
  auth: Scalars['String'];
  p256dh: Scalars['String'];
};

export type SubscriptionObjectInput = {
  endpoint: Scalars['String'];
  expirationTime?: InputMaybe<Scalars['Int']>;
  keys: SubscriptionKeysInput;
};

export type Tag = {
  __typename?: 'Tag';
  id: Scalars['Int'];
  name: Scalars['String'];
};

export type Title = {
  __typename?: 'Title';
  id: Scalars['Int'];
};

export type User = {
  __typename?: 'User';
  email: Scalars['String'];
  id: Scalars['ID'];
  isActive: Scalars['Boolean'];
  loginToken?: Maybe<Scalars['String']>;
  loginTokenExpiresAt?: Maybe<Scalars['Date']>;
  shortname: Scalars['String'];
};

export type CancelSessionMutationVariables = Exact<{
  id: Scalars['String'];
}>;


export type CancelSessionMutation = { __typename?: 'Mutation', cancelSession?: { __typename?: 'Session', id: string } | null };

export type ChangeCourseColorMutationVariables = Exact<{
  color: Scalars['String'];
  courseId: Scalars['String'];
}>;


export type ChangeCourseColorMutation = { __typename?: 'Mutation', changeCourseColor?: { __typename?: 'Course', id: string, color?: string | null } | null };

export type ChangeCourseDescriptionMutationVariables = Exact<{
  input: Scalars['String'];
  courseId: Scalars['String'];
}>;


export type ChangeCourseDescriptionMutation = { __typename?: 'Mutation', changeCourseDescription?: { __typename?: 'Course', id: string, description?: string | null } | null };

export type CreateFeedbackMutationVariables = Exact<{
  sessionId: Scalars['String'];
  content: Scalars['String'];
}>;


export type CreateFeedbackMutation = { __typename?: 'Mutation', createFeedback?: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number } | null };

export type DeactivateSessionBlockMutationVariables = Exact<{
  sessionId: Scalars['String'];
  sessionBlockId: Scalars['Int'];
}>;


export type DeactivateSessionBlockMutation = { __typename?: 'Mutation', deactivateSessionBlock?: { __typename?: 'Session', id: string, status: SessionStatus, activeBlock: { __typename?: 'SessionBlock', id: number }, blocks: Array<{ __typename?: 'SessionBlock', id: number, status: SessionBlockStatus }> } | null };

export type DeleteFeedbackMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteFeedbackMutation = { __typename?: 'Mutation', deleteFeedback?: { __typename?: 'Feedback', id: number } | null };

export type DeleteFeedbackResponseMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteFeedbackResponseMutation = { __typename?: 'Mutation', deleteFeedbackResponse?: { __typename?: 'Feedback', id: number } | null };

export type DeleteQuestionMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteQuestionMutation = { __typename?: 'Mutation', deleteQuestion?: { __typename?: 'Question', id: number } | null };

export type DeleteTagMutationVariables = Exact<{
  id: Scalars['Int'];
}>;


export type DeleteTagMutation = { __typename?: 'Mutation', deleteTag?: { __typename?: 'Tag', id: number } | null };

export type EditTagMutationVariables = Exact<{
  id: Scalars['Int'];
  name: Scalars['String'];
}>;


export type EditTagMutation = { __typename?: 'Mutation', editTag?: { __typename?: 'Tag', id: number, name: string } | null };

export type EndSessionMutationVariables = Exact<{
  id: Scalars['String'];
}>;


export type EndSessionMutation = { __typename?: 'Mutation', endSession?: { __typename?: 'Session', id: string, status: SessionStatus } | null };

export type GenerateLoginTokenMutationVariables = Exact<{ [key: string]: never; }>;


export type GenerateLoginTokenMutation = { __typename?: 'Mutation', generateLoginToken?: { __typename?: 'User', id: string, loginToken?: string | null, loginTokenExpiresAt?: any | null } | null };

export type JoinCourseWithPinMutationVariables = Exact<{
  courseId: Scalars['String'];
  pin: Scalars['Int'];
}>;


export type JoinCourseWithPinMutation = { __typename?: 'Mutation', joinCourseWithPin?: { __typename?: 'Participant', id: string } | null };

export type JoinParticipantGroupMutationVariables = Exact<{
  courseId: Scalars['String'];
  code: Scalars['Int'];
}>;


export type JoinParticipantGroupMutation = { __typename?: 'Mutation', joinParticipantGroup?: { __typename?: 'ParticipantGroup', id: string, name: string, code: number, participants: Array<{ __typename?: 'Participant', id: string, username: string }> } | null };

export type LeaveCourseMutationVariables = Exact<{
  courseId: Scalars['String'];
}>;


export type LeaveCourseMutation = { __typename?: 'Mutation', leaveCourse?: { __typename?: 'LeaveCourseParticipation', id: string, participation: { __typename?: 'Participation', id: number, isActive: boolean } } | null };

export type LeaveParticipantGroupMutationVariables = Exact<{
  groupId: Scalars['String'];
  courseId: Scalars['String'];
}>;


export type LeaveParticipantGroupMutation = { __typename?: 'Mutation', leaveParticipantGroup?: { __typename?: 'ParticipantGroup', id: string, name: string, code: number, participants: Array<{ __typename?: 'Participant', id: string, username: string }> } | null };

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

export type LoginUserTokenMutationVariables = Exact<{
  email: Scalars['String'];
  token: Scalars['String'];
}>;


export type LoginUserTokenMutation = { __typename?: 'Mutation', loginUserToken?: string | null };

export type LogoutParticipantMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutParticipantMutation = { __typename?: 'Mutation', logoutParticipant?: string | null };

export type LogoutUserMutationVariables = Exact<{ [key: string]: never; }>;


export type LogoutUserMutation = { __typename?: 'Mutation', logoutUser?: string | null };

export type MarkMicroSessionCompletedMutationVariables = Exact<{
  courseId: Scalars['String'];
  id: Scalars['String'];
}>;


export type MarkMicroSessionCompletedMutation = { __typename?: 'Mutation', markMicroSessionCompleted?: { __typename?: 'Participation', id: number, completedMicroSessions: Array<string> } | null };

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

export type ResolveFeedbackMutationVariables = Exact<{
  id: Scalars['Int'];
  isResolved: Scalars['Boolean'];
}>;


export type ResolveFeedbackMutation = { __typename?: 'Mutation', resolveFeedback?: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number } | null };

export type RespondToFeedbackMutationVariables = Exact<{
  id: Scalars['Int'];
  responseContent: Scalars['String'];
}>;


export type RespondToFeedbackMutation = { __typename?: 'Mutation', respondToFeedback?: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, resolvedAt: any, createdAt: any, responses: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number }> } | null };

export type StartSessionMutationVariables = Exact<{
  id: Scalars['String'];
}>;


export type StartSessionMutation = { __typename?: 'Mutation', startSession?: { __typename?: 'Session', id: string, status: SessionStatus } | null };

export type SubmitGroupActivityDecisionsMutationVariables = Exact<{
  activityInstanceId: Scalars['Int'];
  decisions: Array<GroupActivityDecisionInput> | GroupActivityDecisionInput;
}>;


export type SubmitGroupActivityDecisionsMutation = { __typename?: 'Mutation', submitGroupActivityDecisions?: { __typename?: 'GroupActivityInstance', id: number } | null };

export type SubscribeToPushMutationVariables = Exact<{
  courseId: Scalars['String'];
  subscriptionObject: SubscriptionObjectInput;
}>;


export type SubscribeToPushMutation = { __typename?: 'Mutation', subscribeToPush?: { __typename?: 'Participation', id: number, subscriptions: Array<{ __typename?: 'PushSubscription', id: number, endpoint: string }> } | null };

export type UpdateParticipantProfileMutationVariables = Exact<{
  avatar?: InputMaybe<Scalars['String']>;
  avatarSettings?: InputMaybe<AvatarSettingsInput>;
  username?: InputMaybe<Scalars['String']>;
  password?: InputMaybe<Scalars['String']>;
}>;


export type UpdateParticipantProfileMutation = { __typename?: 'Mutation', updateParticipantProfile?: { __typename?: 'Participant', id: string, username: string, avatar?: string | null, avatarSettings: any } | null };

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

export type GetBasicCourseInformationQueryVariables = Exact<{
  courseId: Scalars['String'];
}>;


export type GetBasicCourseInformationQuery = { __typename?: 'Query', basicCourseInformation?: { __typename?: 'Course', id: string, name: string, displayName: string, description?: string | null, color?: string | null } | null };

export type GetControlCourseQueryVariables = Exact<{
  courseId: Scalars['String'];
}>;


export type GetControlCourseQuery = { __typename?: 'Query', controlCourse?: { __typename?: 'Course', id: string, name: string, sessions: Array<{ __typename?: 'Session', id: string, name: string, status: SessionStatus }> } | null };

export type GetControlCoursesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetControlCoursesQuery = { __typename?: 'Query', controlCourses?: Array<{ __typename?: 'Course', id: string, name: string, isArchived?: boolean | null, displayName: string, description?: string | null }> | null };

export type GetFeedbacksQueryVariables = Exact<{
  sessionId: Scalars['String'];
}>;


export type GetFeedbacksQuery = { __typename?: 'Query', feedbacks?: Array<{ __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, resolvedAt: any, createdAt: any, responses: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number }> }> | null };

export type GetLoginTokenQueryVariables = Exact<{ [key: string]: never; }>;


export type GetLoginTokenQuery = { __typename?: 'Query', getLoginToken?: { __typename?: 'User', loginToken?: string | null, loginTokenExpiresAt?: any | null } | null };

export type GetRunningSessionsQueryVariables = Exact<{
  shortname: Scalars['String'];
}>;


export type GetRunningSessionsQuery = { __typename?: 'Query', runningSessions?: Array<{ __typename?: 'Session', id: string, name: string, displayName: string, linkTo?: string | null }> | null };

export type GetUnassignedSessionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUnassignedSessionsQuery = { __typename?: 'Query', unassignedSessions?: Array<{ __typename?: 'Session', id: string, name: string, status: SessionStatus }> | null };

export type GetUserCoursesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserCoursesQuery = { __typename?: 'Query', userCourses?: Array<{ __typename?: 'Course', id: string, isArchived?: boolean | null, pinCode?: number | null, name: string, displayName: string, description?: string | null, createdAt: any, updatedAt: any }> | null };

export type GetUserQuestionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserQuestionsQuery = { __typename?: 'Query', userQuestions?: Array<{ __typename?: 'Question', id: number, name: string, type: string, content: string, isArchived: boolean, isDeleted: boolean, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, createdAt: any, updatedAt: any, tags: Array<{ __typename?: 'Tag', id: number, name: string }> }> | null };

export type GetUserTagsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserTagsQuery = { __typename?: 'Query', userTags?: Array<{ __typename?: 'Tag', id: number, name: string }> | null };

export type SelfQueryVariables = Exact<{ [key: string]: never; }>;


export type SelfQuery = { __typename?: 'Query', self?: { __typename?: 'Participant', id: string, username: string, avatar?: string | null, avatarSettings: any, achievements: Array<{ __typename?: 'ParticipantAchievementInstance', id: number, achievedAt: any, achievedCount: number, achievement: { __typename?: 'Achievement', id: number, name: string, description: string, icon: string, iconColor?: string | null } }> } | null };

export type UserProfileQueryVariables = Exact<{ [key: string]: never; }>;


export type UserProfileQuery = { __typename?: 'Query', userProfile?: { __typename?: 'User', id: string, isActive: boolean, email: string, shortname: string } | null };



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
  Achievement: ResolverTypeWrapper<Achievement>;
  Attachment: ResolverTypeWrapper<Attachment>;
  AttachmentInstance: ResolverTypeWrapper<AttachmentInstance>;
  AvatarSettingsInput: AvatarSettingsInput;
  AwardEntry: ResolverTypeWrapper<AwardEntry>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']>;
  ClassAchievementInstance: ResolverTypeWrapper<ClassAchievementInstance>;
  ConfusionTimestep: ResolverTypeWrapper<ConfusionTimestep>;
  Course: ResolverTypeWrapper<Course>;
  Date: ResolverTypeWrapper<Scalars['Date']>;
  Feedback: ResolverTypeWrapper<Feedback>;
  FeedbackResponse: ResolverTypeWrapper<FeedbackResponse>;
  GroupAchievementInstance: ResolverTypeWrapper<GroupAchievementInstance>;
  GroupActivity: ResolverTypeWrapper<GroupActivity>;
  GroupActivityClue: ResolverTypeWrapper<GroupActivityClue>;
  GroupActivityClueAssignment: ResolverTypeWrapper<GroupActivityClueAssignment>;
  GroupActivityClueInstance: ResolverTypeWrapper<GroupActivityClueInstance>;
  GroupActivityDecisionInput: GroupActivityDecisionInput;
  GroupActivityInstance: ResolverTypeWrapper<GroupActivityInstance>;
  GroupActivityParameter: ResolverTypeWrapper<GroupActivityParameter>;
  ID: ResolverTypeWrapper<Scalars['ID']>;
  Int: ResolverTypeWrapper<Scalars['Int']>;
  Json: ResolverTypeWrapper<Scalars['Json']>;
  LeaderboardEntry: ResolverTypeWrapper<LeaderboardEntry>;
  LearningElement: ResolverTypeWrapper<LearningElement>;
  LeaveCourseParticipation: ResolverTypeWrapper<LeaveCourseParticipation>;
  MicroSession: ResolverTypeWrapper<MicroSession>;
  Mutation: ResolverTypeWrapper<{}>;
  Participant: ResolverTypeWrapper<Participant>;
  ParticipantAchievementInstance: ResolverTypeWrapper<ParticipantAchievementInstance>;
  ParticipantGroup: ResolverTypeWrapper<ParticipantGroup>;
  ParticipantLearningData: ResolverTypeWrapper<ParticipantLearningData>;
  Participation: ResolverTypeWrapper<Participation>;
  PushSubscription: ResolverTypeWrapper<PushSubscription>;
  Query: ResolverTypeWrapper<{}>;
  Question: ResolverTypeWrapper<Question>;
  QuestionInstance: ResolverTypeWrapper<QuestionInstance>;
  QuestionResponse: ResolverTypeWrapper<QuestionResponse>;
  QuestionResponseDetail: ResolverTypeWrapper<QuestionResponseDetail>;
  Session: ResolverTypeWrapper<Session>;
  SessionAccessMode: SessionAccessMode;
  SessionBlock: ResolverTypeWrapper<SessionBlock>;
  SessionBlockStatus: SessionBlockStatus;
  SessionStatus: SessionStatus;
  String: ResolverTypeWrapper<Scalars['String']>;
  SubscriptionKeysInput: SubscriptionKeysInput;
  SubscriptionObjectInput: SubscriptionObjectInput;
  Tag: ResolverTypeWrapper<Tag>;
  Title: ResolverTypeWrapper<Title>;
  User: ResolverTypeWrapper<User>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Achievement: Achievement;
  Attachment: Attachment;
  AttachmentInstance: AttachmentInstance;
  AvatarSettingsInput: AvatarSettingsInput;
  AwardEntry: AwardEntry;
  Boolean: Scalars['Boolean'];
  ClassAchievementInstance: ClassAchievementInstance;
  ConfusionTimestep: ConfusionTimestep;
  Course: Course;
  Date: Scalars['Date'];
  Feedback: Feedback;
  FeedbackResponse: FeedbackResponse;
  GroupAchievementInstance: GroupAchievementInstance;
  GroupActivity: GroupActivity;
  GroupActivityClue: GroupActivityClue;
  GroupActivityClueAssignment: GroupActivityClueAssignment;
  GroupActivityClueInstance: GroupActivityClueInstance;
  GroupActivityDecisionInput: GroupActivityDecisionInput;
  GroupActivityInstance: GroupActivityInstance;
  GroupActivityParameter: GroupActivityParameter;
  ID: Scalars['ID'];
  Int: Scalars['Int'];
  Json: Scalars['Json'];
  LeaderboardEntry: LeaderboardEntry;
  LearningElement: LearningElement;
  LeaveCourseParticipation: LeaveCourseParticipation;
  MicroSession: MicroSession;
  Mutation: {};
  Participant: Participant;
  ParticipantAchievementInstance: ParticipantAchievementInstance;
  ParticipantGroup: ParticipantGroup;
  ParticipantLearningData: ParticipantLearningData;
  Participation: Participation;
  PushSubscription: PushSubscription;
  Query: {};
  Question: Question;
  QuestionInstance: QuestionInstance;
  QuestionResponse: QuestionResponse;
  QuestionResponseDetail: QuestionResponseDetail;
  Session: Session;
  SessionBlock: SessionBlock;
  String: Scalars['String'];
  SubscriptionKeysInput: SubscriptionKeysInput;
  SubscriptionObjectInput: SubscriptionObjectInput;
  Tag: Tag;
  Title: Title;
  User: User;
};

export type AchievementResolvers<ContextType = any, ParentType extends ResolversParentTypes['Achievement'] = ResolversParentTypes['Achievement']> = {
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  icon?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  iconColor?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AttachmentResolvers<ContextType = any, ParentType extends ResolversParentTypes['Attachment'] = ResolversParentTypes['Attachment']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AttachmentInstanceResolvers<ContextType = any, ParentType extends ResolversParentTypes['AttachmentInstance'] = ResolversParentTypes['AttachmentInstance']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AwardEntryResolvers<ContextType = any, ParentType extends ResolversParentTypes['AwardEntry'] = ResolversParentTypes['AwardEntry']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ClassAchievementInstanceResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClassAchievementInstance'] = ResolversParentTypes['ClassAchievementInstance']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ConfusionTimestepResolvers<ContextType = any, ParentType extends ResolversParentTypes['ConfusionTimestep'] = ResolversParentTypes['ConfusionTimestep']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CourseResolvers<ContextType = any, ParentType extends ResolversParentTypes['Course'] = ResolversParentTypes['Course']> = {
  color?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isArchived?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  pinCode?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  sessions?: Resolver<Array<ResolversTypes['Session']>, ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface DateScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Date'], any> {
  name: 'Date';
}

export type FeedbackResolvers<ContextType = any, ParentType extends ResolversParentTypes['Feedback'] = ResolversParentTypes['Feedback']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isPinned?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isPublished?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isResolved?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  resolvedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  responses?: Resolver<Array<ResolversTypes['FeedbackResponse']>, ParentType, ContextType>;
  votes?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FeedbackResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['FeedbackResponse'] = ResolversParentTypes['FeedbackResponse']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  negativeReactions?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  positiveReactions?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GroupAchievementInstanceResolvers<ContextType = any, ParentType extends ResolversParentTypes['GroupAchievementInstance'] = ResolversParentTypes['GroupAchievementInstance']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GroupActivityResolvers<ContextType = any, ParentType extends ResolversParentTypes['GroupActivity'] = ResolversParentTypes['GroupActivity']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GroupActivityClueResolvers<ContextType = any, ParentType extends ResolversParentTypes['GroupActivityClue'] = ResolversParentTypes['GroupActivityClue']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GroupActivityClueAssignmentResolvers<ContextType = any, ParentType extends ResolversParentTypes['GroupActivityClueAssignment'] = ResolversParentTypes['GroupActivityClueAssignment']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GroupActivityClueInstanceResolvers<ContextType = any, ParentType extends ResolversParentTypes['GroupActivityClueInstance'] = ResolversParentTypes['GroupActivityClueInstance']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GroupActivityInstanceResolvers<ContextType = any, ParentType extends ResolversParentTypes['GroupActivityInstance'] = ResolversParentTypes['GroupActivityInstance']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GroupActivityParameterResolvers<ContextType = any, ParentType extends ResolversParentTypes['GroupActivityParameter'] = ResolversParentTypes['GroupActivityParameter']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface JsonScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Json'], any> {
  name: 'Json';
}

export type LeaderboardEntryResolvers<ContextType = any, ParentType extends ResolversParentTypes['LeaderboardEntry'] = ResolversParentTypes['LeaderboardEntry']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LearningElementResolvers<ContextType = any, ParentType extends ResolversParentTypes['LearningElement'] = ResolversParentTypes['LearningElement']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LeaveCourseParticipationResolvers<ContextType = any, ParentType extends ResolversParentTypes['LeaveCourseParticipation'] = ResolversParentTypes['LeaveCourseParticipation']> = {
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  participation?: Resolver<ResolversTypes['Participation'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MicroSessionResolvers<ContextType = any, ParentType extends ResolversParentTypes['MicroSession'] = ResolversParentTypes['MicroSession']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  cancelSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationCancelSessionArgs, 'id'>>;
  changeCourseColor?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType, RequireFields<MutationChangeCourseColorArgs, 'color' | 'courseId'>>;
  changeCourseDescription?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType, RequireFields<MutationChangeCourseDescriptionArgs, 'courseId' | 'input'>>;
  createFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationCreateFeedbackArgs, 'content' | 'sessionId'>>;
  deactivateSessionBlock?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationDeactivateSessionBlockArgs, 'sessionBlockId' | 'sessionId'>>;
  deleteFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationDeleteFeedbackArgs, 'id'>>;
  deleteFeedbackResponse?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationDeleteFeedbackResponseArgs, 'id'>>;
  deleteQuestion?: Resolver<Maybe<ResolversTypes['Question']>, ParentType, ContextType, RequireFields<MutationDeleteQuestionArgs, 'id'>>;
  deleteTag?: Resolver<Maybe<ResolversTypes['Tag']>, ParentType, ContextType, RequireFields<MutationDeleteTagArgs, 'id'>>;
  editTag?: Resolver<Maybe<ResolversTypes['Tag']>, ParentType, ContextType, RequireFields<MutationEditTagArgs, 'id' | 'name'>>;
  endSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationEndSessionArgs, 'id'>>;
  generateLoginToken?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  joinCourseWithPin?: Resolver<Maybe<ResolversTypes['Participant']>, ParentType, ContextType, RequireFields<MutationJoinCourseWithPinArgs, 'courseId' | 'pin'>>;
  joinParticipantGroup?: Resolver<Maybe<ResolversTypes['ParticipantGroup']>, ParentType, ContextType, RequireFields<MutationJoinParticipantGroupArgs, 'code' | 'courseId'>>;
  leaveCourse?: Resolver<Maybe<ResolversTypes['LeaveCourseParticipation']>, ParentType, ContextType, RequireFields<MutationLeaveCourseArgs, 'courseId'>>;
  leaveParticipantGroup?: Resolver<Maybe<ResolversTypes['ParticipantGroup']>, ParentType, ContextType, RequireFields<MutationLeaveParticipantGroupArgs, 'courseId' | 'groupId'>>;
  loginParticipant?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType, RequireFields<MutationLoginParticipantArgs, 'password' | 'username'>>;
  loginUser?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, RequireFields<MutationLoginUserArgs, 'email' | 'password'>>;
  loginUserToken?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType, RequireFields<MutationLoginUserTokenArgs, 'email' | 'token'>>;
  logoutParticipant?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  logoutUser?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  markMicroSessionCompleted?: Resolver<Maybe<ResolversTypes['Participation']>, ParentType, ContextType, RequireFields<MutationMarkMicroSessionCompletedArgs, 'courseId' | 'id'>>;
  pinFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationPinFeedbackArgs, 'id' | 'isPinned'>>;
  publishFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationPublishFeedbackArgs, 'id' | 'isPublished'>>;
  resolveFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationResolveFeedbackArgs, 'id' | 'isResolved'>>;
  respondToFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationRespondToFeedbackArgs, 'id' | 'responseContent'>>;
  startSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationStartSessionArgs, 'id'>>;
  submitGroupActivityDecisions?: Resolver<Maybe<ResolversTypes['GroupActivityInstance']>, ParentType, ContextType, RequireFields<MutationSubmitGroupActivityDecisionsArgs, 'activityInstanceId' | 'decisions'>>;
  subscribeToPush?: Resolver<Maybe<ResolversTypes['Participation']>, ParentType, ContextType, RequireFields<MutationSubscribeToPushArgs, 'courseId' | 'subscriptionObject'>>;
  updateParticipantProfile?: Resolver<Maybe<ResolversTypes['Participant']>, ParentType, ContextType, Partial<MutationUpdateParticipantProfileArgs>>;
  upvoteFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationUpvoteFeedbackArgs, 'feedbackId' | 'increment'>>;
  voteFeedbackResponse?: Resolver<Maybe<ResolversTypes['FeedbackResponse']>, ParentType, ContextType, RequireFields<MutationVoteFeedbackResponseArgs, 'id' | 'incrementDownvote' | 'incrementUpvote'>>;
};

export type ParticipantResolvers<ContextType = any, ParentType extends ResolversParentTypes['Participant'] = ResolversParentTypes['Participant']> = {
  achievements?: Resolver<Array<ResolversTypes['ParticipantAchievementInstance']>, ParentType, ContextType>;
  avatar?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  avatarSettings?: Resolver<ResolversTypes['Json'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  lastLoginAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  level?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  participantGroups?: Resolver<Array<ResolversTypes['ParticipantGroup']>, ParentType, ContextType>;
  username?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  xp?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ParticipantAchievementInstanceResolvers<ContextType = any, ParentType extends ResolversParentTypes['ParticipantAchievementInstance'] = ResolversParentTypes['ParticipantAchievementInstance']> = {
  achievedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  achievedCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  achievement?: Resolver<ResolversTypes['Achievement'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ParticipantGroupResolvers<ContextType = any, ParentType extends ResolversParentTypes['ParticipantGroup'] = ResolversParentTypes['ParticipantGroup']> = {
  code?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  participants?: Resolver<Array<ResolversTypes['Participant']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ParticipantLearningDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['ParticipantLearningData'] = ResolversParentTypes['ParticipantLearningData']> = {
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ParticipationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Participation'] = ResolversParentTypes['Participation']> = {
  completedMicroSessions?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  subscriptions?: Resolver<Array<ResolversTypes['PushSubscription']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PushSubscriptionResolvers<ContextType = any, ParentType extends ResolversParentTypes['PushSubscription'] = ResolversParentTypes['PushSubscription']> = {
  endpoint?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  basicCourseInformation?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType, RequireFields<QueryBasicCourseInformationArgs, 'courseId'>>;
  controlCourse?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType, RequireFields<QueryControlCourseArgs, 'id'>>;
  controlCourses?: Resolver<Maybe<Array<ResolversTypes['Course']>>, ParentType, ContextType>;
  feedbacks?: Resolver<Maybe<Array<ResolversTypes['Feedback']>>, ParentType, ContextType, RequireFields<QueryFeedbacksArgs, 'id'>>;
  getLoginToken?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  runningSessions?: Resolver<Maybe<Array<ResolversTypes['Session']>>, ParentType, ContextType, RequireFields<QueryRunningSessionsArgs, 'shortname'>>;
  self?: Resolver<Maybe<ResolversTypes['Participant']>, ParentType, ContextType>;
  unassignedSessions?: Resolver<Maybe<Array<ResolversTypes['Session']>>, ParentType, ContextType>;
  userCourses?: Resolver<Maybe<Array<ResolversTypes['Course']>>, ParentType, ContextType>;
  userProfile?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  userQuestions?: Resolver<Maybe<Array<ResolversTypes['Question']>>, ParentType, ContextType>;
  userTags?: Resolver<Maybe<Array<ResolversTypes['Tag']>>, ParentType, ContextType>;
};

export type QuestionResolvers<ContextType = any, ParentType extends ResolversParentTypes['Question'] = ResolversParentTypes['Question']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  hasAnswerFeedbacks?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  hasSampleSolution?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isArchived?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  options?: Resolver<ResolversTypes['Json'], ParentType, ContextType>;
  pointsMultiplier?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  tags?: Resolver<Array<ResolversTypes['Tag']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QuestionInstanceResolvers<ContextType = any, ParentType extends ResolversParentTypes['QuestionInstance'] = ResolversParentTypes['QuestionInstance']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QuestionResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['QuestionResponse'] = ResolversParentTypes['QuestionResponse']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QuestionResponseDetailResolvers<ContextType = any, ParentType extends ResolversParentTypes['QuestionResponseDetail'] = ResolversParentTypes['QuestionResponseDetail']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SessionResolvers<ContextType = any, ParentType extends ResolversParentTypes['Session'] = ResolversParentTypes['Session']> = {
  accessMode?: Resolver<ResolversTypes['SessionAccessMode'], ParentType, ContextType>;
  activeBlock?: Resolver<ResolversTypes['SessionBlock'], ParentType, ContextType>;
  blocks?: Resolver<Array<ResolversTypes['SessionBlock']>, ParentType, ContextType>;
  confusionFeedbacks?: Resolver<Array<ResolversTypes['ConfusionTimestep']>, ParentType, ContextType>;
  course?: Resolver<ResolversTypes['Course'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  feedbacks?: Resolver<Array<ResolversTypes['Feedback']>, ParentType, ContextType>;
  finishedAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isAudienceInteractionActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isGamificationEnabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isModerationEnabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  linkTo?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  linkToJoin?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  namespace?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  pinCode?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pointsMultiplier?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  startedAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SessionStatus'], ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SessionBlockResolvers<ContextType = any, ParentType extends ResolversParentTypes['SessionBlock'] = ResolversParentTypes['SessionBlock']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SessionBlockStatus'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TagResolvers<ContextType = any, ParentType extends ResolversParentTypes['Tag'] = ResolversParentTypes['Tag']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TitleResolvers<ContextType = any, ParentType extends ResolversParentTypes['Title'] = ResolversParentTypes['Title']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type UserResolvers<ContextType = any, ParentType extends ResolversParentTypes['User'] = ResolversParentTypes['User']> = {
  email?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  loginToken?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  loginTokenExpiresAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  shortname?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  Achievement?: AchievementResolvers<ContextType>;
  Attachment?: AttachmentResolvers<ContextType>;
  AttachmentInstance?: AttachmentInstanceResolvers<ContextType>;
  AwardEntry?: AwardEntryResolvers<ContextType>;
  ClassAchievementInstance?: ClassAchievementInstanceResolvers<ContextType>;
  ConfusionTimestep?: ConfusionTimestepResolvers<ContextType>;
  Course?: CourseResolvers<ContextType>;
  Date?: GraphQLScalarType;
  Feedback?: FeedbackResolvers<ContextType>;
  FeedbackResponse?: FeedbackResponseResolvers<ContextType>;
  GroupAchievementInstance?: GroupAchievementInstanceResolvers<ContextType>;
  GroupActivity?: GroupActivityResolvers<ContextType>;
  GroupActivityClue?: GroupActivityClueResolvers<ContextType>;
  GroupActivityClueAssignment?: GroupActivityClueAssignmentResolvers<ContextType>;
  GroupActivityClueInstance?: GroupActivityClueInstanceResolvers<ContextType>;
  GroupActivityInstance?: GroupActivityInstanceResolvers<ContextType>;
  GroupActivityParameter?: GroupActivityParameterResolvers<ContextType>;
  Json?: GraphQLScalarType;
  LeaderboardEntry?: LeaderboardEntryResolvers<ContextType>;
  LearningElement?: LearningElementResolvers<ContextType>;
  LeaveCourseParticipation?: LeaveCourseParticipationResolvers<ContextType>;
  MicroSession?: MicroSessionResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Participant?: ParticipantResolvers<ContextType>;
  ParticipantAchievementInstance?: ParticipantAchievementInstanceResolvers<ContextType>;
  ParticipantGroup?: ParticipantGroupResolvers<ContextType>;
  ParticipantLearningData?: ParticipantLearningDataResolvers<ContextType>;
  Participation?: ParticipationResolvers<ContextType>;
  PushSubscription?: PushSubscriptionResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Question?: QuestionResolvers<ContextType>;
  QuestionInstance?: QuestionInstanceResolvers<ContextType>;
  QuestionResponse?: QuestionResponseResolvers<ContextType>;
  QuestionResponseDetail?: QuestionResponseDetailResolvers<ContextType>;
  Session?: SessionResolvers<ContextType>;
  SessionBlock?: SessionBlockResolvers<ContextType>;
  Tag?: TagResolvers<ContextType>;
  Title?: TitleResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
};



export const CancelSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CancelSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cancelSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CancelSessionMutation, CancelSessionMutationVariables>;
export const ChangeCourseColorDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangeCourseColor"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"color"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changeCourseColor"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"color"},"value":{"kind":"Variable","name":{"kind":"Name","value":"color"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}}]}}]} as unknown as DocumentNode<ChangeCourseColorMutation, ChangeCourseColorMutationVariables>;
export const ChangeCourseDescriptionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangeCourseDescription"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changeCourseDescription"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"description"}}]}}]}}]} as unknown as DocumentNode<ChangeCourseDescriptionMutation, ChangeCourseDescriptionMutationVariables>;
export const CreateFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"content"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"content"},"value":{"kind":"Variable","name":{"kind":"Name","value":"content"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<CreateFeedbackMutation, CreateFeedbackMutationVariables>;
export const DeactivateSessionBlockDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeactivateSessionBlock"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionBlockId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deactivateSessionBlock"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"sessionBlockId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionBlockId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"activeBlock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]}}]} as unknown as DocumentNode<DeactivateSessionBlockMutation, DeactivateSessionBlockMutationVariables>;
export const DeleteFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteFeedbackMutation, DeleteFeedbackMutationVariables>;
export const DeleteFeedbackResponseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteFeedbackResponse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteFeedbackResponse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteFeedbackResponseMutation, DeleteFeedbackResponseMutationVariables>;
export const DeleteQuestionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteQuestion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteQuestion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteQuestionMutation, DeleteQuestionMutationVariables>;
export const DeleteTagDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteTag"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteTag"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteTagMutation, DeleteTagMutationVariables>;
export const EditTagDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EditTag"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"editTag"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<EditTagMutation, EditTagMutationVariables>;
export const EndSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EndSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"endSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<EndSessionMutation, EndSessionMutationVariables>;
export const GenerateLoginTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GenerateLoginToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"generateLoginToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"loginToken"}},{"kind":"Field","name":{"kind":"Name","value":"loginTokenExpiresAt"}}]}}]}}]} as unknown as DocumentNode<GenerateLoginTokenMutation, GenerateLoginTokenMutationVariables>;
export const JoinCourseWithPinDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinCourseWithPin"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pin"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinCourseWithPin"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"pin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<JoinCourseWithPinMutation, JoinCourseWithPinMutationVariables>;
export const JoinParticipantGroupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinParticipantGroup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"code"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinParticipantGroup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"code"},"value":{"kind":"Variable","name":{"kind":"Name","value":"code"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]}}]} as unknown as DocumentNode<JoinParticipantGroupMutation, JoinParticipantGroupMutationVariables>;
export const LeaveCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LeaveCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"leaveCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}}]}}]}}]}}]} as unknown as DocumentNode<LeaveCourseMutation, LeaveCourseMutationVariables>;
export const LeaveParticipantGroupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LeaveParticipantGroup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"leaveParticipantGroup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]}}]} as unknown as DocumentNode<LeaveParticipantGroupMutation, LeaveParticipantGroupMutationVariables>;
export const LoginParticipantDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginParticipant"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginParticipant"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}]}]}}]} as unknown as DocumentNode<LoginParticipantMutation, LoginParticipantMutationVariables>;
export const LoginUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}]}]}}]} as unknown as DocumentNode<LoginUserMutation, LoginUserMutationVariables>;
export const LoginUserTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginUserToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginUserToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}]}]}}]} as unknown as DocumentNode<LoginUserTokenMutation, LoginUserTokenMutationVariables>;
export const LogoutParticipantDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LogoutParticipant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logoutParticipant"}}]}}]} as unknown as DocumentNode<LogoutParticipantMutation, LogoutParticipantMutationVariables>;
export const LogoutUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LogoutUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logoutUser"}}]}}]} as unknown as DocumentNode<LogoutUserMutation, LogoutUserMutationVariables>;
export const MarkMicroSessionCompletedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarkMicroSessionCompleted"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markMicroSessionCompleted"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"completedMicroSessions"}}]}}]}}]} as unknown as DocumentNode<MarkMicroSessionCompletedMutation, MarkMicroSessionCompletedMutationVariables>;
export const PinFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PinFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isPinned"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pinFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"isPinned"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isPinned"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<PinFeedbackMutation, PinFeedbackMutationVariables>;
export const PublishFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PublishFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isPublished"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publishFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"isPublished"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isPublished"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<PublishFeedbackMutation, PublishFeedbackMutationVariables>;
export const ResolveFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResolveFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isResolved"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resolveFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"isResolved"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isResolved"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<ResolveFeedbackMutation, ResolveFeedbackMutationVariables>;
export const RespondToFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RespondToFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"responseContent"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"respondToFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"responseContent"},"value":{"kind":"Variable","name":{"kind":"Name","value":"responseContent"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]}}]} as unknown as DocumentNode<RespondToFeedbackMutation, RespondToFeedbackMutationVariables>;
export const StartSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<StartSessionMutation, StartSessionMutationVariables>;
export const SubmitGroupActivityDecisionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SubmitGroupActivityDecisions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activityInstanceId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"decisions"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GroupActivityDecisionInput"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"submitGroupActivityDecisions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activityInstanceId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activityInstanceId"}}},{"kind":"Argument","name":{"kind":"Name","value":"decisions"},"value":{"kind":"Variable","name":{"kind":"Name","value":"decisions"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<SubmitGroupActivityDecisionsMutation, SubmitGroupActivityDecisionsMutationVariables>;
export const SubscribeToPushDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SubscribeToPush"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"subscriptionObject"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SubscriptionObjectInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subscribeToPush"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"subscriptionObject"},"value":{"kind":"Variable","name":{"kind":"Name","value":"subscriptionObject"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"subscriptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"endpoint"}}]}}]}}]}}]} as unknown as DocumentNode<SubscribeToPushMutation, SubscribeToPushMutationVariables>;
export const UpdateParticipantProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateParticipantProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"avatar"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"avatarSettings"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AvatarSettingsInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateParticipantProfile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"avatar"},"value":{"kind":"Variable","name":{"kind":"Name","value":"avatar"}}},{"kind":"Argument","name":{"kind":"Name","value":"avatarSettings"},"value":{"kind":"Variable","name":{"kind":"Name","value":"avatarSettings"}}},{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"avatarSettings"}}]}}]}}]} as unknown as DocumentNode<UpdateParticipantProfileMutation, UpdateParticipantProfileMutationVariables>;
export const UpvoteFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpvoteFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"feedbackId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"increment"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"upvoteFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"feedbackId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"feedbackId"}}},{"kind":"Argument","name":{"kind":"Name","value":"increment"},"value":{"kind":"Variable","name":{"kind":"Name","value":"increment"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<UpvoteFeedbackMutation, UpvoteFeedbackMutationVariables>;
export const VoteFeedbackResponseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VoteFeedbackResponse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"incrementUpvote"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"incrementDownvote"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voteFeedbackResponse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"incrementUpvote"},"value":{"kind":"Variable","name":{"kind":"Name","value":"incrementUpvote"}}},{"kind":"Argument","name":{"kind":"Name","value":"incrementDownvote"},"value":{"kind":"Variable","name":{"kind":"Name","value":"incrementDownvote"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]} as unknown as DocumentNode<VoteFeedbackResponseMutation, VoteFeedbackResponseMutationVariables>;
export const GetBasicCourseInformationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetBasicCourseInformation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"basicCourseInformation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}}]}}]} as unknown as DocumentNode<GetBasicCourseInformationQuery, GetBasicCourseInformationQueryVariables>;
export const GetControlCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetControlCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"controlCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"sessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]}}]} as unknown as DocumentNode<GetControlCourseQuery, GetControlCourseQueryVariables>;
export const GetControlCoursesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetControlCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"controlCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}}]}}]}}]} as unknown as DocumentNode<GetControlCoursesQuery, GetControlCoursesQueryVariables>;
export const GetFeedbacksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFeedbacks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]}}]} as unknown as DocumentNode<GetFeedbacksQuery, GetFeedbacksQueryVariables>;
export const GetLoginTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetLoginToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getLoginToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginToken"}},{"kind":"Field","name":{"kind":"Name","value":"loginTokenExpiresAt"}}]}}]}}]} as unknown as DocumentNode<GetLoginTokenQuery, GetLoginTokenQueryVariables>;
export const GetRunningSessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRunningSessions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shortname"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"runningSessions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shortname"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shortname"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"linkTo"}}]}}]}}]} as unknown as DocumentNode<GetRunningSessionsQuery, GetRunningSessionsQueryVariables>;
export const GetUnassignedSessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUnassignedSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unassignedSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<GetUnassignedSessionsQuery, GetUnassignedSessionsQueryVariables>;
export const GetUserCoursesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"pinCode"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetUserCoursesQuery, GetUserCoursesQueryVariables>;
export const GetUserQuestionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserQuestions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userQuestions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"isDeleted"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<GetUserQuestionsQuery, GetUserQuestionsQueryVariables>;
export const GetUserTagsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserTags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userTags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<GetUserTagsQuery, GetUserTagsQueryVariables>;
export const SelfDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Self"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"self"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"avatarSettings"}},{"kind":"Field","name":{"kind":"Name","value":"achievements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"achievedAt"}},{"kind":"Field","name":{"kind":"Name","value":"achievedCount"}},{"kind":"Field","name":{"kind":"Name","value":"achievement"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"iconColor"}}]}}]}}]}}]}}]} as unknown as DocumentNode<SelfQuery, SelfQueryVariables>;
export const UserProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserProfile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userProfile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"shortname"}}]}}]}}]} as unknown as DocumentNode<UserProfileQuery, UserProfileQueryVariables>;

      export interface PossibleTypesResultData {
        possibleTypes: {
          [key: string]: string[]
        }
      }
      const result: PossibleTypesResultData = {
  "possibleTypes": {}
};
      export default result;
    