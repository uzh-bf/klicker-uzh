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
  description?: Maybe<Scalars['String']>;
  id: Scalars['ID'];
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
  deleteFeedback?: Maybe<Feedback>;
  deleteFeedbackResponse?: Maybe<Feedback>;
  deleteQuestion?: Maybe<Question>;
  deleteTag?: Maybe<Tag>;
  editTag?: Maybe<Tag>;
  endSession?: Maybe<Session>;
  joinCourseWithPin?: Maybe<Participant>;
  joinParticipantGroup?: Maybe<ParticipantGroup>;
  leaveParticipantGroup?: Maybe<ParticipantGroup>;
  loginUser?: Maybe<Scalars['String']>;
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


export type MutationLeaveParticipantGroupArgs = {
  courseId: Scalars['String'];
  groupId: Scalars['String'];
};


export type MutationLoginUserArgs = {
  email: Scalars['String'];
  password: Scalars['String'];
};

export type Participant = {
  __typename?: 'Participant';
  achievements: Array<ParticipantAchievementInstance>;
  avatar?: Maybe<Scalars['String']>;
  avatarSettings: Scalars['Json'];
  id: Scalars['ID'];
  participantGroups: Array<ParticipantGroup>;
  username: Scalars['String'];
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

export type Participation = {
  __typename?: 'Participation';
  id: Scalars['Int'];
};

export type PushSubscription = {
  __typename?: 'PushSubscription';
  id: Scalars['Int'];
};

export type Query = {
  __typename?: 'Query';
  self?: Maybe<Participant>;
};

export type Question = {
  __typename?: 'Question';
  id: Scalars['Int'];
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
};

export enum SessionStatus {
  Completed = 'COMPLETED',
  Prepared = 'PREPARED',
  Running = 'RUNNING',
  Scheduled = 'SCHEDULED'
}

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
  id: Scalars['ID'];
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

export type LeaveParticipantGroupMutationVariables = Exact<{
  groupId: Scalars['String'];
  courseId: Scalars['String'];
}>;


export type LeaveParticipantGroupMutation = { __typename?: 'Mutation', leaveParticipantGroup?: { __typename?: 'ParticipantGroup', id: string, name: string, code: number, participants: Array<{ __typename?: 'Participant', id: string, username: string }> } | null };

export type LoginUserMutationVariables = Exact<{
  email: Scalars['String'];
  password: Scalars['String'];
}>;


export type LoginUserMutation = { __typename?: 'Mutation', loginUser?: string | null };

export type SelfQueryVariables = Exact<{ [key: string]: never; }>;


export type SelfQuery = { __typename?: 'Query', self?: { __typename?: 'Participant', id: string, username: string, avatar?: string | null, avatarSettings: any, achievements: Array<{ __typename?: 'ParticipantAchievementInstance', id: number, achievedAt: any, achievedCount: number, achievement: { __typename?: 'Achievement', id: number, name: string, description: string, icon: string, iconColor?: string | null } }> } | null };



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
  GroupActivityInstance: ResolverTypeWrapper<GroupActivityInstance>;
  GroupActivityParameter: ResolverTypeWrapper<GroupActivityParameter>;
  ID: ResolverTypeWrapper<Scalars['ID']>;
  Int: ResolverTypeWrapper<Scalars['Int']>;
  Json: ResolverTypeWrapper<Scalars['Json']>;
  LeaderboardEntry: ResolverTypeWrapper<LeaderboardEntry>;
  LearningElement: ResolverTypeWrapper<LearningElement>;
  MicroSession: ResolverTypeWrapper<MicroSession>;
  Mutation: ResolverTypeWrapper<{}>;
  Participant: ResolverTypeWrapper<Participant>;
  ParticipantAchievementInstance: ResolverTypeWrapper<ParticipantAchievementInstance>;
  ParticipantGroup: ResolverTypeWrapper<ParticipantGroup>;
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
  SessionStatus: SessionStatus;
  String: ResolverTypeWrapper<Scalars['String']>;
  Tag: ResolverTypeWrapper<Tag>;
  Title: ResolverTypeWrapper<Title>;
  User: ResolverTypeWrapper<User>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Achievement: Achievement;
  Attachment: Attachment;
  AttachmentInstance: AttachmentInstance;
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
  GroupActivityInstance: GroupActivityInstance;
  GroupActivityParameter: GroupActivityParameter;
  ID: Scalars['ID'];
  Int: Scalars['Int'];
  Json: Scalars['Json'];
  LeaderboardEntry: LeaderboardEntry;
  LearningElement: LearningElement;
  MicroSession: MicroSession;
  Mutation: {};
  Participant: Participant;
  ParticipantAchievementInstance: ParticipantAchievementInstance;
  ParticipantGroup: ParticipantGroup;
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
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
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

export type MicroSessionResolvers<ContextType = any, ParentType extends ResolversParentTypes['MicroSession'] = ResolversParentTypes['MicroSession']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  cancelSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationCancelSessionArgs, 'id'>>;
  changeCourseColor?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType, RequireFields<MutationChangeCourseColorArgs, 'color' | 'courseId'>>;
  changeCourseDescription?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType, RequireFields<MutationChangeCourseDescriptionArgs, 'courseId' | 'input'>>;
  createFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationCreateFeedbackArgs, 'content' | 'sessionId'>>;
  deleteFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationDeleteFeedbackArgs, 'id'>>;
  deleteFeedbackResponse?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationDeleteFeedbackResponseArgs, 'id'>>;
  deleteQuestion?: Resolver<Maybe<ResolversTypes['Question']>, ParentType, ContextType, RequireFields<MutationDeleteQuestionArgs, 'id'>>;
  deleteTag?: Resolver<Maybe<ResolversTypes['Tag']>, ParentType, ContextType, RequireFields<MutationDeleteTagArgs, 'id'>>;
  editTag?: Resolver<Maybe<ResolversTypes['Tag']>, ParentType, ContextType, RequireFields<MutationEditTagArgs, 'id' | 'name'>>;
  endSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationEndSessionArgs, 'id'>>;
  joinCourseWithPin?: Resolver<Maybe<ResolversTypes['Participant']>, ParentType, ContextType, RequireFields<MutationJoinCourseWithPinArgs, 'courseId' | 'pin'>>;
  joinParticipantGroup?: Resolver<Maybe<ResolversTypes['ParticipantGroup']>, ParentType, ContextType, RequireFields<MutationJoinParticipantGroupArgs, 'code' | 'courseId'>>;
  leaveParticipantGroup?: Resolver<Maybe<ResolversTypes['ParticipantGroup']>, ParentType, ContextType, RequireFields<MutationLeaveParticipantGroupArgs, 'courseId' | 'groupId'>>;
  loginUser?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, RequireFields<MutationLoginUserArgs, 'email' | 'password'>>;
};

export type ParticipantResolvers<ContextType = any, ParentType extends ResolversParentTypes['Participant'] = ResolversParentTypes['Participant']> = {
  achievements?: Resolver<Array<ResolversTypes['ParticipantAchievementInstance']>, ParentType, ContextType>;
  avatar?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  avatarSettings?: Resolver<ResolversTypes['Json'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  participantGroups?: Resolver<Array<ResolversTypes['ParticipantGroup']>, ParentType, ContextType>;
  username?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
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

export type ParticipationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Participation'] = ResolversParentTypes['Participation']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type PushSubscriptionResolvers<ContextType = any, ParentType extends ResolversParentTypes['PushSubscription'] = ResolversParentTypes['PushSubscription']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  self?: Resolver<Maybe<ResolversTypes['Participant']>, ParentType, ContextType>;
};

export type QuestionResolvers<ContextType = any, ParentType extends ResolversParentTypes['Question'] = ResolversParentTypes['Question']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
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
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
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
  MicroSession?: MicroSessionResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Participant?: ParticipantResolvers<ContextType>;
  ParticipantAchievementInstance?: ParticipantAchievementInstanceResolvers<ContextType>;
  ParticipantGroup?: ParticipantGroupResolvers<ContextType>;
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
export const DeleteFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteFeedbackMutation, DeleteFeedbackMutationVariables>;
export const DeleteFeedbackResponseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteFeedbackResponse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteFeedbackResponse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteFeedbackResponseMutation, DeleteFeedbackResponseMutationVariables>;
export const DeleteQuestionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteQuestion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteQuestion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteQuestionMutation, DeleteQuestionMutationVariables>;
export const DeleteTagDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteTag"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteTag"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteTagMutation, DeleteTagMutationVariables>;
export const EditTagDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EditTag"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"editTag"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<EditTagMutation, EditTagMutationVariables>;
export const EndSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EndSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"endSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<EndSessionMutation, EndSessionMutationVariables>;
export const JoinCourseWithPinDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinCourseWithPin"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pin"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinCourseWithPin"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"pin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<JoinCourseWithPinMutation, JoinCourseWithPinMutationVariables>;
export const JoinParticipantGroupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinParticipantGroup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"code"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinParticipantGroup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"code"},"value":{"kind":"Variable","name":{"kind":"Name","value":"code"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]}}]} as unknown as DocumentNode<JoinParticipantGroupMutation, JoinParticipantGroupMutationVariables>;
export const LeaveParticipantGroupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LeaveParticipantGroup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"leaveParticipantGroup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]}}]} as unknown as DocumentNode<LeaveParticipantGroupMutation, LeaveParticipantGroupMutationVariables>;
export const LoginUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}]}]}}]} as unknown as DocumentNode<LoginUserMutation, LoginUserMutationVariables>;
export const SelfDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Self"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"self"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"avatarSettings"}},{"kind":"Field","name":{"kind":"Name","value":"achievements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"achievedAt"}},{"kind":"Field","name":{"kind":"Name","value":"achievedCount"}},{"kind":"Field","name":{"kind":"Name","value":"achievement"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"iconColor"}}]}}]}}]}}]}}]} as unknown as DocumentNode<SelfQuery, SelfQueryVariables>;

      export interface PossibleTypesResultData {
        possibleTypes: {
          [key: string]: string[]
        }
      }
      const result: PossibleTypesResultData = {
  "possibleTypes": {}
};
      export default result;
    