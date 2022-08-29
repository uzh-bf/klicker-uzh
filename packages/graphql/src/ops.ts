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

export type Choice = {
  __typename?: 'Choice';
  correct?: Maybe<Scalars['Boolean']>;
  feedback?: Maybe<Scalars['String']>;
  value: Scalars['String'];
};

export type ChoicesQuestionData = QuestionData & {
  __typename?: 'ChoicesQuestionData';
  content: Scalars['String'];
  contentPlain: Scalars['String'];
  id?: Maybe<Scalars['ID']>;
  isArchived: Scalars['Boolean'];
  isDeleted: Scalars['Boolean'];
  name: Scalars['String'];
  options: ChoicesQuestionOptions;
  type: Scalars['String'];
};

export type ChoicesQuestionOptions = {
  __typename?: 'ChoicesQuestionOptions';
  choices?: Maybe<Array<Maybe<Choice>>>;
};

export type Course = {
  __typename?: 'Course';
  displayName?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['ID']>;
  learningElements?: Maybe<Array<Maybe<LearningElement>>>;
  name: Scalars['String'];
};

export type InstanceEvaluation = {
  __typename?: 'InstanceEvaluation';
  choices?: Maybe<Scalars['JSONObject']>;
  feedbacks?: Maybe<Array<Maybe<QuestionFeedback>>>;
};

export type LearningElement = {
  __typename?: 'LearningElement';
  course?: Maybe<Course>;
  id?: Maybe<Scalars['ID']>;
  instances?: Maybe<Array<Maybe<QuestionInstance>>>;
};

export type Mutation = {
  __typename?: 'Mutation';
  joinCourse?: Maybe<Participation>;
  leaveCourse?: Maybe<Participation>;
  loginParticipant?: Maybe<Scalars['ID']>;
  loginUser?: Maybe<Scalars['ID']>;
  registerParticipantFromLTI?: Maybe<ParticipantLearningData>;
  respondToQuestionInstance?: Maybe<QuestionInstance>;
  startSession?: Maybe<Session>;
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


export type MutationRegisterParticipantFromLtiArgs = {
  courseId: Scalars['ID'];
  participantEmail: Scalars['ID'];
  participantId: Scalars['ID'];
};


export type MutationRespondToQuestionInstanceArgs = {
  courseId: Scalars['ID'];
  id: Scalars['ID'];
  response: ResponseInput;
};


export type MutationStartSessionArgs = {
  id: Scalars['ID'];
};

export type Participant = {
  __typename?: 'Participant';
  avatar?: Maybe<Scalars['String']>;
  id?: Maybe<Scalars['ID']>;
  username?: Maybe<Scalars['String']>;
};

export type ParticipantLearningData = {
  __typename?: 'ParticipantLearningData';
  course?: Maybe<Course>;
  id?: Maybe<Scalars['ID']>;
  participant?: Maybe<Participant>;
  participantToken?: Maybe<Scalars['String']>;
  participation?: Maybe<Participation>;
};

export type Participation = {
  __typename?: 'Participation';
  id?: Maybe<Scalars['ID']>;
  isActive?: Maybe<Scalars['Boolean']>;
  points?: Maybe<Scalars['Int']>;
};

export type Query = {
  __typename?: 'Query';
  getCourseOverviewData?: Maybe<ParticipantLearningData>;
  getParticipantCourses?: Maybe<Array<Maybe<Course>>>;
  getSession?: Maybe<Session>;
  learningElement?: Maybe<LearningElement>;
  self?: Maybe<Participant>;
};


export type QueryGetCourseOverviewDataArgs = {
  courseId: Scalars['ID'];
};


export type QueryGetSessionArgs = {
  id: Scalars['ID'];
};


export type QueryLearningElementArgs = {
  id: Scalars['ID'];
};

export type QuestionData = {
  content: Scalars['String'];
  contentPlain: Scalars['String'];
  id?: Maybe<Scalars['ID']>;
  isArchived: Scalars['Boolean'];
  isDeleted: Scalars['Boolean'];
  name: Scalars['String'];
  type: Scalars['String'];
};

export type QuestionFeedback = {
  __typename?: 'QuestionFeedback';
  correct?: Maybe<Scalars['Boolean']>;
  feedback?: Maybe<Scalars['String']>;
  ix?: Maybe<Scalars['Int']>;
  value?: Maybe<Scalars['String']>;
};

export type QuestionInstance = {
  __typename?: 'QuestionInstance';
  evaluation?: Maybe<InstanceEvaluation>;
  id?: Maybe<Scalars['ID']>;
  questionData?: Maybe<QuestionData>;
};

export type ResponseInput = {
  choices?: InputMaybe<Array<InputMaybe<Scalars['Int']>>>;
  value?: InputMaybe<Scalars['String']>;
};

export type Session = {
  __typename?: 'Session';
  activeBlock: Scalars['Int'];
  blocks?: Maybe<Array<Maybe<SessionBlock>>>;
  displayName: Scalars['String'];
  execution: Scalars['Int'];
  id?: Maybe<Scalars['ID']>;
  isAudienceInteractionActive: Scalars['Boolean'];
  isFeedbackChannelPublic: Scalars['Boolean'];
  name: Scalars['String'];
  namespace: Scalars['String'];
  status: SessionStatus;
};

export type SessionBlock = {
  __typename?: 'SessionBlock';
  id?: Maybe<Scalars['ID']>;
  instances?: Maybe<Array<Maybe<QuestionInstance>>>;
  status: SessionBlockStatus;
};

export enum SessionBlockStatus {
  Active = 'ACTIVE',
  Executed = 'EXECUTED',
  Scheduled = 'SCHEDULED'
}

export enum SessionStatus {
  Completed = 'COMPLETED',
  Planned = 'PLANNED',
  Running = 'RUNNING',
  Scheduled = 'SCHEDULED'
}

export type QuestionDataFragment = { __typename?: 'QuestionInstance', questionData?: { __typename?: 'ChoicesQuestionData', id?: string | null, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'ChoicesQuestionOptions', choices?: Array<{ __typename?: 'Choice', correct?: boolean | null, feedback?: string | null, value: string } | null> | null } } | null };

export type JoinCourseMutationVariables = Exact<{
  courseId: Scalars['ID'];
}>;


export type JoinCourseMutation = { __typename?: 'Mutation', joinCourse?: { __typename?: 'Participation', id?: string | null, isActive?: boolean | null, points?: number | null } | null };

export type LeaveCourseMutationVariables = Exact<{
  courseId: Scalars['ID'];
}>;


export type LeaveCourseMutation = { __typename?: 'Mutation', leaveCourse?: { __typename?: 'Participation', id?: string | null, isActive?: boolean | null, points?: number | null } | null };

export type LoginParticipantMutationVariables = Exact<{
  username: Scalars['String'];
  password: Scalars['String'];
}>;


export type LoginParticipantMutation = { __typename?: 'Mutation', loginParticipant?: string | null };

export type RegisterParticipantFromLtiMutationVariables = Exact<{
  courseId: Scalars['ID'];
  participantId: Scalars['ID'];
  participantEmail: Scalars['ID'];
}>;


export type RegisterParticipantFromLtiMutation = { __typename?: 'Mutation', registerParticipantFromLTI?: { __typename?: 'ParticipantLearningData', id?: string | null, participantToken?: string | null, participant?: { __typename?: 'Participant', id?: string | null, avatar?: string | null, username?: string | null } | null, participation?: { __typename?: 'Participation', id?: string | null, isActive?: boolean | null, points?: number | null } | null, course?: { __typename?: 'Course', id?: string | null, name: string, displayName?: string | null } | null } | null };

export type ResponseToQuestionInstanceMutationVariables = Exact<{
  courseId: Scalars['ID'];
  id: Scalars['ID'];
  response: ResponseInput;
}>;


export type ResponseToQuestionInstanceMutation = { __typename?: 'Mutation', respondToQuestionInstance?: { __typename?: 'QuestionInstance', id?: string | null, evaluation?: { __typename?: 'InstanceEvaluation', choices?: any | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix?: number | null, feedback?: string | null, correct?: boolean | null, value?: string | null } | null> | null } | null, questionData?: { __typename?: 'ChoicesQuestionData', id?: string | null, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'ChoicesQuestionOptions', choices?: Array<{ __typename?: 'Choice', correct?: boolean | null, feedback?: string | null, value: string } | null> | null } } | null } | null };

export type GetCourseOverviewDataQueryVariables = Exact<{
  courseId: Scalars['ID'];
}>;


export type GetCourseOverviewDataQuery = { __typename?: 'Query', getCourseOverviewData?: { __typename?: 'ParticipantLearningData', id?: string | null, participant?: { __typename?: 'Participant', id?: string | null, avatar?: string | null, username?: string | null } | null, participation?: { __typename?: 'Participation', id?: string | null, isActive?: boolean | null, points?: number | null } | null, course?: { __typename?: 'Course', id?: string | null, name: string, displayName?: string | null } | null } | null };

export type GetLearningElementQueryVariables = Exact<{
  id: Scalars['ID'];
}>;


export type GetLearningElementQuery = { __typename?: 'Query', learningElement?: { __typename?: 'LearningElement', id?: string | null, course?: { __typename?: 'Course', id?: string | null } | null, instances?: Array<{ __typename?: 'QuestionInstance', id?: string | null, evaluation?: { __typename?: 'InstanceEvaluation', choices?: any | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix?: number | null, feedback?: string | null, correct?: boolean | null, value?: string | null } | null> | null } | null, questionData?: { __typename?: 'ChoicesQuestionData', id?: string | null, name: string, type: string, content: string, contentPlain: string, options: { __typename?: 'ChoicesQuestionOptions', choices?: Array<{ __typename?: 'Choice', correct?: boolean | null, feedback?: string | null, value: string } | null> | null } } | null } | null> | null } | null };

export type GetParticipantCoursesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetParticipantCoursesQuery = { __typename?: 'Query', getParticipantCourses?: Array<{ __typename?: 'Course', id?: string | null, name: string } | null> | null };

export type GetSessionQueryVariables = Exact<{
  sessionId: Scalars['ID'];
}>;


export type GetSessionQuery = { __typename?: 'Query', getSession?: { __typename?: 'Session', id?: string | null, isAudienceInteractionActive: boolean, isFeedbackChannelPublic: boolean, namespace: string, name: string, activeBlock: number, execution: number, displayName: string, status: SessionStatus, blocks?: Array<{ __typename?: 'SessionBlock', id?: string | null, status: SessionBlockStatus, instances?: Array<{ __typename?: 'QuestionInstance', id?: string | null, questionData?: { __typename?: 'ChoicesQuestionData', content: string, contentPlain: string, id?: string | null, isArchived: boolean, isDeleted: boolean, name: string, type: string } | null } | null> | null } | null> | null } | null };

export type SelfQueryVariables = Exact<{ [key: string]: never; }>;


export type SelfQuery = { __typename?: 'Query', self?: { __typename?: 'Participant', id?: string | null, username?: string | null, avatar?: string | null } | null };



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
  Boolean: ResolverTypeWrapper<Scalars['Boolean']>;
  Choice: ResolverTypeWrapper<Choice>;
  ChoicesQuestionData: ResolverTypeWrapper<ChoicesQuestionData>;
  ChoicesQuestionOptions: ResolverTypeWrapper<ChoicesQuestionOptions>;
  Course: ResolverTypeWrapper<Course>;
  DateTime: ResolverTypeWrapper<Scalars['DateTime']>;
  ID: ResolverTypeWrapper<Scalars['ID']>;
  InstanceEvaluation: ResolverTypeWrapper<InstanceEvaluation>;
  Int: ResolverTypeWrapper<Scalars['Int']>;
  JSONObject: ResolverTypeWrapper<Scalars['JSONObject']>;
  LearningElement: ResolverTypeWrapper<LearningElement>;
  Mutation: ResolverTypeWrapper<{}>;
  Participant: ResolverTypeWrapper<Participant>;
  ParticipantLearningData: ResolverTypeWrapper<ParticipantLearningData>;
  Participation: ResolverTypeWrapper<Participation>;
  Query: ResolverTypeWrapper<{}>;
  QuestionData: ResolversTypes['ChoicesQuestionData'];
  QuestionFeedback: ResolverTypeWrapper<QuestionFeedback>;
  QuestionInstance: ResolverTypeWrapper<QuestionInstance>;
  ResponseInput: ResponseInput;
  Session: ResolverTypeWrapper<Session>;
  SessionBlock: ResolverTypeWrapper<SessionBlock>;
  SessionBlockStatus: SessionBlockStatus;
  SessionStatus: SessionStatus;
  String: ResolverTypeWrapper<Scalars['String']>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Boolean: Scalars['Boolean'];
  Choice: Choice;
  ChoicesQuestionData: ChoicesQuestionData;
  ChoicesQuestionOptions: ChoicesQuestionOptions;
  Course: Course;
  DateTime: Scalars['DateTime'];
  ID: Scalars['ID'];
  InstanceEvaluation: InstanceEvaluation;
  Int: Scalars['Int'];
  JSONObject: Scalars['JSONObject'];
  LearningElement: LearningElement;
  Mutation: {};
  Participant: Participant;
  ParticipantLearningData: ParticipantLearningData;
  Participation: Participation;
  Query: {};
  QuestionData: ResolversParentTypes['ChoicesQuestionData'];
  QuestionFeedback: QuestionFeedback;
  QuestionInstance: QuestionInstance;
  ResponseInput: ResponseInput;
  Session: Session;
  SessionBlock: SessionBlock;
  String: Scalars['String'];
};

export type ChoiceResolvers<ContextType = any, ParentType extends ResolversParentTypes['Choice'] = ResolversParentTypes['Choice']> = {
  correct?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  feedback?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  value?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ChoicesQuestionDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['ChoicesQuestionData'] = ResolversParentTypes['ChoicesQuestionData']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  contentPlain?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  isArchived?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  options?: Resolver<ResolversTypes['ChoicesQuestionOptions'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ChoicesQuestionOptionsResolvers<ContextType = any, ParentType extends ResolversParentTypes['ChoicesQuestionOptions'] = ResolversParentTypes['ChoicesQuestionOptions']> = {
  choices?: Resolver<Maybe<Array<Maybe<ResolversTypes['Choice']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CourseResolvers<ContextType = any, ParentType extends ResolversParentTypes['Course'] = ResolversParentTypes['Course']> = {
  displayName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  learningElements?: Resolver<Maybe<Array<Maybe<ResolversTypes['LearningElement']>>>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface DateTimeScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['DateTime'], any> {
  name: 'DateTime';
}

export type InstanceEvaluationResolvers<ContextType = any, ParentType extends ResolversParentTypes['InstanceEvaluation'] = ResolversParentTypes['InstanceEvaluation']> = {
  choices?: Resolver<Maybe<ResolversTypes['JSONObject']>, ParentType, ContextType>;
  feedbacks?: Resolver<Maybe<Array<Maybe<ResolversTypes['QuestionFeedback']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface JsonObjectScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['JSONObject'], any> {
  name: 'JSONObject';
}

export type LearningElementResolvers<ContextType = any, ParentType extends ResolversParentTypes['LearningElement'] = ResolversParentTypes['LearningElement']> = {
  course?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  instances?: Resolver<Maybe<Array<Maybe<ResolversTypes['QuestionInstance']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  joinCourse?: Resolver<Maybe<ResolversTypes['Participation']>, ParentType, ContextType, RequireFields<MutationJoinCourseArgs, 'courseId'>>;
  leaveCourse?: Resolver<Maybe<ResolversTypes['Participation']>, ParentType, ContextType, RequireFields<MutationLeaveCourseArgs, 'courseId'>>;
  loginParticipant?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType, RequireFields<MutationLoginParticipantArgs, 'password' | 'username'>>;
  loginUser?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType, RequireFields<MutationLoginUserArgs, 'email' | 'password'>>;
  registerParticipantFromLTI?: Resolver<Maybe<ResolversTypes['ParticipantLearningData']>, ParentType, ContextType, RequireFields<MutationRegisterParticipantFromLtiArgs, 'courseId' | 'participantEmail' | 'participantId'>>;
  respondToQuestionInstance?: Resolver<Maybe<ResolversTypes['QuestionInstance']>, ParentType, ContextType, RequireFields<MutationRespondToQuestionInstanceArgs, 'courseId' | 'id' | 'response'>>;
  startSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationStartSessionArgs, 'id'>>;
};

export type ParticipantResolvers<ContextType = any, ParentType extends ResolversParentTypes['Participant'] = ResolversParentTypes['Participant']> = {
  avatar?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  username?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ParticipantLearningDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['ParticipantLearningData'] = ResolversParentTypes['ParticipantLearningData']> = {
  course?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  participant?: Resolver<Maybe<ResolversTypes['Participant']>, ParentType, ContextType>;
  participantToken?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  participation?: Resolver<Maybe<ResolversTypes['Participation']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ParticipationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Participation'] = ResolversParentTypes['Participation']> = {
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  isActive?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  points?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = {
  getCourseOverviewData?: Resolver<Maybe<ResolversTypes['ParticipantLearningData']>, ParentType, ContextType, RequireFields<QueryGetCourseOverviewDataArgs, 'courseId'>>;
  getParticipantCourses?: Resolver<Maybe<Array<Maybe<ResolversTypes['Course']>>>, ParentType, ContextType>;
  getSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<QueryGetSessionArgs, 'id'>>;
  learningElement?: Resolver<Maybe<ResolversTypes['LearningElement']>, ParentType, ContextType, RequireFields<QueryLearningElementArgs, 'id'>>;
  self?: Resolver<Maybe<ResolversTypes['Participant']>, ParentType, ContextType>;
};

export type QuestionDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['QuestionData'] = ResolversParentTypes['QuestionData']> = {
  __resolveType: TypeResolveFn<'ChoicesQuestionData', ParentType, ContextType>;
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  contentPlain?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  isArchived?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isDeleted?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
};

export type QuestionFeedbackResolvers<ContextType = any, ParentType extends ResolversParentTypes['QuestionFeedback'] = ResolversParentTypes['QuestionFeedback']> = {
  correct?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  feedback?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  ix?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QuestionInstanceResolvers<ContextType = any, ParentType extends ResolversParentTypes['QuestionInstance'] = ResolversParentTypes['QuestionInstance']> = {
  evaluation?: Resolver<Maybe<ResolversTypes['InstanceEvaluation']>, ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  questionData?: Resolver<Maybe<ResolversTypes['QuestionData']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SessionResolvers<ContextType = any, ParentType extends ResolversParentTypes['Session'] = ResolversParentTypes['Session']> = {
  activeBlock?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  blocks?: Resolver<Maybe<Array<Maybe<ResolversTypes['SessionBlock']>>>, ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  execution?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  isAudienceInteractionActive?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isFeedbackChannelPublic?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  namespace?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SessionStatus'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SessionBlockResolvers<ContextType = any, ParentType extends ResolversParentTypes['SessionBlock'] = ResolversParentTypes['SessionBlock']> = {
  id?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  instances?: Resolver<Maybe<Array<Maybe<ResolversTypes['QuestionInstance']>>>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SessionBlockStatus'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type Resolvers<ContextType = any> = {
  Choice?: ChoiceResolvers<ContextType>;
  ChoicesQuestionData?: ChoicesQuestionDataResolvers<ContextType>;
  ChoicesQuestionOptions?: ChoicesQuestionOptionsResolvers<ContextType>;
  Course?: CourseResolvers<ContextType>;
  DateTime?: GraphQLScalarType;
  InstanceEvaluation?: InstanceEvaluationResolvers<ContextType>;
  JSONObject?: GraphQLScalarType;
  LearningElement?: LearningElementResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  Participant?: ParticipantResolvers<ContextType>;
  ParticipantLearningData?: ParticipantLearningDataResolvers<ContextType>;
  Participation?: ParticipationResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  QuestionData?: QuestionDataResolvers<ContextType>;
  QuestionFeedback?: QuestionFeedbackResolvers<ContextType>;
  QuestionInstance?: QuestionInstanceResolvers<ContextType>;
  Session?: SessionResolvers<ContextType>;
  SessionBlock?: SessionBlockResolvers<ContextType>;
};


export const QuestionDataFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"contentPlain"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<QuestionDataFragment, unknown>;
export const JoinCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}}]}}]} as unknown as DocumentNode<JoinCourseMutation, JoinCourseMutationVariables>;
export const LeaveCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LeaveCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"leaveCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}}]}}]} as unknown as DocumentNode<LeaveCourseMutation, LeaveCourseMutationVariables>;
export const LoginParticipantDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginParticipant"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginParticipant"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}]}]}}]} as unknown as DocumentNode<LoginParticipantMutation, LoginParticipantMutationVariables>;
export const RegisterParticipantFromLtiDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RegisterParticipantFromLTI"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"participantId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"participantEmail"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registerParticipantFromLTI"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"participantId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"participantId"}}},{"kind":"Argument","name":{"kind":"Name","value":"participantEmail"},"value":{"kind":"Variable","name":{"kind":"Name","value":"participantEmail"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participantToken"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]} as unknown as DocumentNode<RegisterParticipantFromLtiMutation, RegisterParticipantFromLtiMutationVariables>;
export const ResponseToQuestionInstanceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResponseToQuestionInstance"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"response"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ResponseInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"respondToQuestionInstance"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"response"},"value":{"kind":"Variable","name":{"kind":"Name","value":"response"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionData"}},{"kind":"Field","name":{"kind":"Name","value":"evaluation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"choices"}}]}}]}}]}},...QuestionDataFragmentDoc.definitions]} as unknown as DocumentNode<ResponseToQuestionInstanceMutation, ResponseToQuestionInstanceMutationVariables>;
export const GetCourseOverviewDataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetCourseOverviewData"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getCourseOverviewData"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"points"}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]} as unknown as DocumentNode<GetCourseOverviewDataQuery, GetCourseOverviewDataQueryVariables>;
export const GetLearningElementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetLearningElement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"learningElement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionData"}},{"kind":"Field","name":{"kind":"Name","value":"evaluation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"choices"}}]}}]}}]}}]}},...QuestionDataFragmentDoc.definitions]} as unknown as DocumentNode<GetLearningElementQuery, GetLearningElementQueryVariables>;
export const GetParticipantCoursesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetParticipantCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getParticipantCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<GetParticipantCoursesQuery, GetParticipantCoursesQueryVariables>;
export const GetSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isAudienceInteractionActive"}},{"kind":"Field","name":{"kind":"Name","value":"isFeedbackChannelPublic"}},{"kind":"Field","name":{"kind":"Name","value":"namespace"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"activeBlock"}},{"kind":"Field","name":{"kind":"Name","value":"execution"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"contentPlain"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"isDeleted"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetSessionQuery, GetSessionQueryVariables>;
export const SelfDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Self"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"self"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}}]} as unknown as DocumentNode<SelfQuery, SelfQueryVariables>;

      export interface PossibleTypesResultData {
        possibleTypes: {
          [key: string]: string[]
        }
      }
      const result: PossibleTypesResultData = {
  "possibleTypes": {
    "QuestionData": [
      "ChoicesQuestionData"
    ]
  }
};
      export default result;
    