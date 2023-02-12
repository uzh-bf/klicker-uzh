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
  description?: Maybe<Scalars['String']>;
  href: Scalars['String'];
  id: Scalars['ID'];
  name: Scalars['String'];
  originalName?: Maybe<Scalars['String']>;
  type: Scalars['String'];
};

export type AttachmentInput = {
  id: Scalars['String'];
};

export type AttachmentInstance = {
  __typename?: 'AttachmentInstance';
  description?: Maybe<Scalars['String']>;
  href: Scalars['String'];
  id: Scalars['ID'];
  name: Scalars['String'];
  originalName?: Maybe<Scalars['String']>;
  type: Scalars['String'];
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
  description: Scalars['String'];
  displayName: Scalars['String'];
  id: Scalars['Int'];
  name: Scalars['String'];
  order: Scalars['Int'];
  participant: Participant;
  participantGroup: ParticipantGroup;
  type: Scalars['String'];
};

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

export type ChoiceInput = {
  correct?: InputMaybe<Scalars['Boolean']>;
  feedback?: InputMaybe<Scalars['String']>;
  ix: Scalars['Int'];
  value: Scalars['String'];
};

export type ChoiceQuestionOptions = {
  __typename?: 'ChoiceQuestionOptions';
  choices: Array<Choice>;
};

export type ChoicesQuestionData = QuestionData & {
  __typename?: 'ChoicesQuestionData';
  content: Scalars['String'];
  id: Scalars['Int'];
  name: Scalars['String'];
  options: ChoiceQuestionOptions;
  pointsMultiplier: Scalars['Int'];
  type: Scalars['String'];
};

export type ClassAchievementInstance = {
  __typename?: 'ClassAchievementInstance';
  id: Scalars['Int'];
};

export type ConfusionTimestep = {
  __typename?: 'ConfusionTimestep';
  createdAt: Scalars['Date'];
  difficulty: Scalars['Int'];
  id: Scalars['Int'];
  numberOfParticipants?: Maybe<Scalars['Int']>;
  speed: Scalars['Int'];
};

export type Course = {
  __typename?: 'Course';
  averageActiveScore?: Maybe<Scalars['Float']>;
  averageScore?: Maybe<Scalars['Float']>;
  awards: Array<AwardEntry>;
  color?: Maybe<Scalars['String']>;
  createdAt: Scalars['Date'];
  description?: Maybe<Scalars['String']>;
  displayName: Scalars['String'];
  id: Scalars['ID'];
  isArchived?: Maybe<Scalars['Boolean']>;
  leaderboard: Array<LeaderboardEntry>;
  learningElements: Array<LearningElement>;
  microSessions: Array<MicroSession>;
  name: Scalars['String'];
  numOfActiveParticipants?: Maybe<Scalars['Int']>;
  numOfParticipants?: Maybe<Scalars['Int']>;
  pinCode?: Maybe<Scalars['Int']>;
  sessions: Array<Session>;
  updatedAt: Scalars['Date'];
};

export type EvaluationBlock = {
  __typename?: 'EvaluationBlock';
  blockIx?: Maybe<Scalars['Int']>;
  blockStatus: SessionBlockStatus;
  tabData: Array<TabData>;
};

export type Feedback = {
  __typename?: 'Feedback';
  content: Scalars['String'];
  createdAt: Scalars['Date'];
  id: Scalars['Int'];
  isPinned: Scalars['Boolean'];
  isPublished: Scalars['Boolean'];
  isResolved: Scalars['Boolean'];
  resolvedAt?: Maybe<Scalars['Date']>;
  responses: Array<FeedbackResponse>;
  votes: Scalars['Int'];
};

export type FeedbackResponse = {
  __typename?: 'FeedbackResponse';
  content: Scalars['String'];
  createdAt: Scalars['Date'];
  id: Scalars['Int'];
  negativeReactions: Scalars['Int'];
  positiveReactions: Scalars['Int'];
};

export type FreeTextQuestionData = QuestionData & {
  __typename?: 'FreeTextQuestionData';
  content: Scalars['String'];
  id: Scalars['Int'];
  name: Scalars['String'];
  options: FreeTextQuestionOptions;
  pointsMultiplier: Scalars['Int'];
  type: Scalars['String'];
};

export type FreeTextQuestionOptions = {
  __typename?: 'FreeTextQuestionOptions';
  restrictions: FreeTextRestrictions;
  solutions: Array<Scalars['String']>;
};

export type FreeTextRestrictions = {
  __typename?: 'FreeTextRestrictions';
  maxLength?: Maybe<Scalars['Int']>;
};

export type FreeTextRestrictionsInput = {
  maxLength?: InputMaybe<Scalars['Int']>;
  minLength?: InputMaybe<Scalars['Int']>;
  pattern?: InputMaybe<Scalars['String']>;
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
  displayName: Scalars['String'];
  id: Scalars['Int'];
  name: Scalars['String'];
};

export type GroupActivityClueAssignment = {
  __typename?: 'GroupActivityClueAssignment';
  id: Scalars['Int'];
};

export type GroupActivityClueInstance = {
  __typename?: 'GroupActivityClueInstance';
  displayName: Scalars['String'];
  id: Scalars['Int'];
  name: Scalars['String'];
  participant: Participant;
  type: ParameterType;
  unit?: Maybe<Scalars['String']>;
  value?: Maybe<Scalars['String']>;
};

export type GroupActivityDecisionInput = {
  id: Scalars['Int'];
  response?: InputMaybe<Scalars['String']>;
  selectedOptions: Array<Scalars['Int']>;
};

export type GroupActivityDetails = {
  __typename?: 'GroupActivityDetails';
  activityInstance?: Maybe<GroupActivityInstance>;
  clues: Array<GroupActivityClue>;
  course: Course;
  description?: Maybe<Scalars['String']>;
  displayName: Scalars['String'];
  group: ParticipantGroup;
  id: Scalars['String'];
  instances: Array<QuestionInstance>;
  name: Scalars['String'];
  scheduledEndAt?: Maybe<Scalars['Date']>;
  scheduledStartAt?: Maybe<Scalars['Date']>;
};

export type GroupActivityInstance = {
  __typename?: 'GroupActivityInstance';
  clues: Array<GroupActivityClueInstance>;
  decisions?: Maybe<Scalars['Json']>;
  decisionsSubmittedAt?: Maybe<Scalars['Date']>;
  id: Scalars['Int'];
};

export type GroupActivityParameter = {
  __typename?: 'GroupActivityParameter';
  id: Scalars['Int'];
};

export type GroupLeaderboardEntry = {
  __typename?: 'GroupLeaderboardEntry';
  id: Scalars['ID'];
  isMember?: Maybe<Scalars['Boolean']>;
  name: Scalars['String'];
  rank: Scalars['Int'];
  score: Scalars['Float'];
};

export type InstanceEvaluation = {
  __typename?: 'InstanceEvaluation';
  choices: Scalars['Json'];
  feedbacks?: Maybe<Array<QuestionFeedback>>;
  newPointsFrom?: Maybe<Scalars['Date']>;
  percentile?: Maybe<Scalars['Float']>;
  pointsAwarded?: Maybe<Scalars['Float']>;
  score: Scalars['Float'];
};

export type InstanceResult = {
  __typename?: 'InstanceResult';
  blockIx?: Maybe<Scalars['Int']>;
  id: Scalars['String'];
  instanceIx: Scalars['Int'];
  participants: Scalars['Int'];
  questionData: QuestionData;
  results: Scalars['Json'];
  statistics: Statistics;
  status: SessionBlockStatus;
};

export type LeaderboardEntry = {
  __typename?: 'LeaderboardEntry';
  avatar: Scalars['String'];
  id: Scalars['Int'];
  isSelf: Scalars['Boolean'];
  lastBlockOrder: Scalars['Int'];
  participant: Participant;
  participantId: Scalars['String'];
  participation: Participation;
  rank: Scalars['Int'];
  score: Scalars['Float'];
  username: Scalars['String'];
};

export type LeaderboardStatistics = {
  __typename?: 'LeaderboardStatistics';
  averageScore: Scalars['Float'];
  participantCount: Scalars['Int'];
};

export type LearningElement = {
  __typename?: 'LearningElement';
  course: Course;
  courseId: Scalars['String'];
  description?: Maybe<Scalars['String']>;
  displayName: Scalars['String'];
  id: Scalars['String'];
  instances: Array<QuestionInstance>;
  name: Scalars['String'];
  numOfInstances: Scalars['Int'];
  orderType: LearningElementOrderType;
  pointsMultiplier: Scalars['Int'];
  previousPointsAwarded: Scalars['Float'];
  previousScore: Scalars['Float'];
  previouslyAnswered: Scalars['Int'];
  resetTimeDays?: Maybe<Scalars['Int']>;
  totalTrials: Scalars['Int'];
};

export enum LearningElementOrderType {
  LastResponse = 'LAST_RESPONSE',
  Sequential = 'SEQUENTIAL',
  Shuffled = 'SHUFFLED'
}

export type LeaveCourseParticipation = {
  __typename?: 'LeaveCourseParticipation';
  id: Scalars['String'];
  participation: Participation;
};

export type MicroSession = {
  __typename?: 'MicroSession';
  course: Course;
  description?: Maybe<Scalars['String']>;
  displayName: Scalars['String'];
  id: Scalars['ID'];
  instances: Array<QuestionInstance>;
  name: Scalars['String'];
  numOfInstances?: Maybe<Scalars['Int']>;
  pointsMultiplier: Scalars['Float'];
  scheduledEndAt: Scalars['Date'];
  scheduledStartAt: Scalars['Date'];
};

export type Mutation = {
  __typename?: 'Mutation';
  activateSessionBlock?: Maybe<Session>;
  addConfusionTimestep?: Maybe<ConfusionTimestep>;
  cancelSession?: Maybe<Session>;
  changeCourseColor?: Maybe<Course>;
  changeCourseDescription?: Maybe<Course>;
  changeSessionSettings?: Maybe<Session>;
  createFeedback?: Maybe<Feedback>;
  createLearningElement?: Maybe<LearningElement>;
  createMicroSession?: Maybe<MicroSession>;
  createParticipantAndJoinCourse?: Maybe<Participant>;
  createParticipantGroup?: Maybe<ParticipantGroup>;
  createSession?: Maybe<Session>;
  deactivateSessionBlock?: Maybe<Session>;
  deleteFeedback?: Maybe<Feedback>;
  deleteFeedbackResponse?: Maybe<Feedback>;
  deleteQuestion?: Maybe<Question>;
  deleteTag?: Maybe<Tag>;
  editMicroSession?: Maybe<MicroSession>;
  editSession?: Maybe<Session>;
  editTag?: Maybe<Tag>;
  endSession?: Maybe<Session>;
  generateLoginToken?: Maybe<User>;
  joinCourse?: Maybe<ParticipantLearningData>;
  joinCourseWithPin?: Maybe<Participant>;
  joinParticipantGroup?: Maybe<ParticipantGroup>;
  leaveCourse?: Maybe<LeaveCourseParticipation>;
  leaveParticipantGroup?: Maybe<ParticipantGroup>;
  loginParticipant?: Maybe<Scalars['ID']>;
  loginUser?: Maybe<Scalars['String']>;
  loginUserToken?: Maybe<Scalars['ID']>;
  logoutParticipant?: Maybe<Scalars['ID']>;
  logoutUser?: Maybe<Scalars['ID']>;
  manipulateChoicesQuestion?: Maybe<Question>;
  manipulateFreeTextQuestion?: Maybe<Question>;
  manipulateNumericalQuestion?: Maybe<Question>;
  markMicroSessionCompleted?: Maybe<Participation>;
  pinFeedback?: Maybe<Feedback>;
  publishFeedback?: Maybe<Feedback>;
  registerParticipantFromLTI?: Maybe<ParticipantLearningData>;
  resolveFeedback?: Maybe<Feedback>;
  respondToFeedback?: Maybe<Feedback>;
  respondToQuestionInstance?: Maybe<QuestionInstance>;
  startGroupActivity?: Maybe<GroupActivityDetails>;
  startSession?: Maybe<Session>;
  submitGroupActivityDecisions?: Maybe<GroupActivityInstance>;
  subscribeToPush?: Maybe<Participation>;
  updateParticipantProfile?: Maybe<Participant>;
  upvoteFeedback?: Maybe<Feedback>;
  voteFeedbackResponse?: Maybe<FeedbackResponse>;
};


export type MutationActivateSessionBlockArgs = {
  sessionBlockId: Scalars['Int'];
  sessionId: Scalars['String'];
};


export type MutationAddConfusionTimestepArgs = {
  difficulty: Scalars['Int'];
  sessionId: Scalars['String'];
  speed: Scalars['Int'];
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


export type MutationChangeSessionSettingsArgs = {
  id: Scalars['String'];
  isConfusionFeedbackEnabled?: InputMaybe<Scalars['Boolean']>;
  isGamificationEnabled?: InputMaybe<Scalars['Boolean']>;
  isLiveQAEnabled?: InputMaybe<Scalars['Boolean']>;
  isModerationEnabled?: InputMaybe<Scalars['Boolean']>;
};


export type MutationCreateFeedbackArgs = {
  content: Scalars['String'];
  sessionId: Scalars['String'];
};


export type MutationCreateLearningElementArgs = {
  courseId?: InputMaybe<Scalars['String']>;
  description?: InputMaybe<Scalars['String']>;
  displayName: Scalars['String'];
  multiplier: Scalars['Int'];
  name: Scalars['String'];
  order: LearningElementOrderType;
  questions: Array<Scalars['Int']>;
  resetTimeDays: Scalars['Int'];
};


export type MutationCreateMicroSessionArgs = {
  courseId?: InputMaybe<Scalars['String']>;
  description?: InputMaybe<Scalars['String']>;
  displayName: Scalars['String'];
  endDate: Scalars['Date'];
  multiplier: Scalars['Int'];
  name: Scalars['String'];
  questions: Array<Scalars['Int']>;
  startDate: Scalars['Date'];
};


export type MutationCreateParticipantAndJoinCourseArgs = {
  courseId: Scalars['String'];
  password: Scalars['String'];
  pin: Scalars['Int'];
  username: Scalars['String'];
};


export type MutationCreateParticipantGroupArgs = {
  courseId: Scalars['String'];
  name: Scalars['String'];
};


export type MutationCreateSessionArgs = {
  blocks: Array<BlockInput>;
  courseId?: InputMaybe<Scalars['String']>;
  description?: InputMaybe<Scalars['String']>;
  displayName: Scalars['String'];
  isGamificationEnabled?: InputMaybe<Scalars['Boolean']>;
  multiplier: Scalars['Int'];
  name: Scalars['String'];
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


export type MutationEditMicroSessionArgs = {
  courseId?: InputMaybe<Scalars['String']>;
  description?: InputMaybe<Scalars['String']>;
  displayName: Scalars['String'];
  endDate: Scalars['Date'];
  id: Scalars['String'];
  multiplier: Scalars['Int'];
  name: Scalars['String'];
  questions: Array<Scalars['Int']>;
  startDate: Scalars['Date'];
};


export type MutationEditSessionArgs = {
  blocks: Array<BlockInput>;
  courseId?: InputMaybe<Scalars['String']>;
  description?: InputMaybe<Scalars['String']>;
  displayName: Scalars['String'];
  id: Scalars['String'];
  isGamificationEnabled?: InputMaybe<Scalars['Boolean']>;
  multiplier: Scalars['Int'];
  name: Scalars['String'];
};


export type MutationEditTagArgs = {
  id: Scalars['Int'];
  name: Scalars['String'];
};


export type MutationEndSessionArgs = {
  id: Scalars['String'];
};


export type MutationJoinCourseArgs = {
  courseId: Scalars['String'];
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


export type MutationManipulateChoicesQuestionArgs = {
  attachments?: InputMaybe<Array<AttachmentInput>>;
  content?: InputMaybe<Scalars['String']>;
  hasAnswerFeedbacks?: InputMaybe<Scalars['Boolean']>;
  hasSampleSolution?: InputMaybe<Scalars['Boolean']>;
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
  options?: InputMaybe<OptionsChoicesInput>;
  tags?: InputMaybe<Array<Scalars['String']>>;
  type: QuestionType;
};


export type MutationManipulateFreeTextQuestionArgs = {
  attachments?: InputMaybe<Array<AttachmentInput>>;
  content?: InputMaybe<Scalars['String']>;
  hasAnswerFeedbacks?: InputMaybe<Scalars['Boolean']>;
  hasSampleSolution?: InputMaybe<Scalars['Boolean']>;
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
  options?: InputMaybe<OptionsFreeTextInput>;
  tags?: InputMaybe<Array<Scalars['String']>>;
  type: QuestionType;
};


export type MutationManipulateNumericalQuestionArgs = {
  attachments?: InputMaybe<Array<AttachmentInput>>;
  content?: InputMaybe<Scalars['String']>;
  hasAnswerFeedbacks?: InputMaybe<Scalars['Boolean']>;
  hasSampleSolution?: InputMaybe<Scalars['Boolean']>;
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
  options?: InputMaybe<OptionsNumericalInput>;
  tags?: InputMaybe<Array<Scalars['String']>>;
  type: QuestionType;
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


export type MutationRegisterParticipantFromLtiArgs = {
  courseId: Scalars['String'];
  participantId: Scalars['String'];
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
  courseId: Scalars['String'];
  id: Scalars['Int'];
  response: ResponseInput;
};


export type MutationStartGroupActivityArgs = {
  activityId: Scalars['String'];
  groupId: Scalars['String'];
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

export type NumericalQuestionData = QuestionData & {
  __typename?: 'NumericalQuestionData';
  content: Scalars['String'];
  id: Scalars['Int'];
  name: Scalars['String'];
  options: NumericalQuestionOptions;
  pointsMultiplier: Scalars['Int'];
  type: Scalars['String'];
};

export type NumericalQuestionOptions = {
  __typename?: 'NumericalQuestionOptions';
  accuracy?: Maybe<Scalars['Int']>;
  placeholder?: Maybe<Scalars['String']>;
  restrictions: NumericalRestrictions;
  solutionRanges: Array<NumericalSolutionRange>;
  unit?: Maybe<Scalars['String']>;
};

export type NumericalRestrictions = {
  __typename?: 'NumericalRestrictions';
  max?: Maybe<Scalars['Int']>;
  min?: Maybe<Scalars['Int']>;
};

export type NumericalRestrictionsInput = {
  max?: InputMaybe<Scalars['Float']>;
  min?: InputMaybe<Scalars['Float']>;
};

export type NumericalSolutionRange = {
  __typename?: 'NumericalSolutionRange';
  max?: Maybe<Scalars['Int']>;
  min?: Maybe<Scalars['Int']>;
};

export type OptionsChoicesInput = {
  choices?: InputMaybe<Array<ChoiceInput>>;
};

export type OptionsFreeTextInput = {
  feedback?: InputMaybe<Scalars['String']>;
  restrictions?: InputMaybe<FreeTextRestrictionsInput>;
  solutions?: InputMaybe<Array<Scalars['String']>>;
};

export type OptionsNumericalInput = {
  accuracy?: InputMaybe<Scalars['Int']>;
  feedback?: InputMaybe<Scalars['String']>;
  restrictions?: InputMaybe<NumericalRestrictionsInput>;
  solutionRanges?: InputMaybe<Array<SolutionRangeInput>>;
};

export enum ParameterType {
  Number = 'NUMBER',
  String = 'STRING'
}

export type Participant = {
  __typename?: 'Participant';
  achievements: Array<ParticipantAchievementInstance>;
  avatar?: Maybe<Scalars['String']>;
  avatarSettings: Scalars['Json'];
  id: Scalars['ID'];
  isSelf: Scalars['Boolean'];
  lastLoginAt?: Maybe<Scalars['Date']>;
  level: Scalars['Int'];
  participantGroups: Array<ParticipantGroup>;
  rank: Scalars['Int'];
  score: Scalars['Float'];
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
  averageMemberScore: Scalars['Float'];
  code: Scalars['Int'];
  groupActivityScore: Scalars['Float'];
  id: Scalars['ID'];
  name: Scalars['String'];
  participants: Array<Participant>;
  score: Scalars['Float'];
};

export type ParticipantLearningData = {
  __typename?: 'ParticipantLearningData';
  course?: Maybe<Course>;
  groupLeaderboard?: Maybe<Array<GroupLeaderboardEntry>>;
  groupLeaderboardStatistics?: Maybe<LeaderboardStatistics>;
  id: Scalars['String'];
  leaderboard?: Maybe<Array<LeaderboardEntry>>;
  leaderboardStatistics?: Maybe<LeaderboardStatistics>;
  participant?: Maybe<Participant>;
  participantToken?: Maybe<Scalars['String']>;
  participation?: Maybe<Participation>;
};

export type Participation = {
  __typename?: 'Participation';
  completedMicroSessions: Array<Scalars['String']>;
  course: Course;
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
  cockpitSession?: Maybe<Session>;
  controlCourse?: Maybe<Course>;
  controlCourses?: Maybe<Array<Course>>;
  controlSession?: Maybe<Session>;
  course?: Maybe<Course>;
  feedbacks?: Maybe<Array<Feedback>>;
  getCourseOverviewData?: Maybe<ParticipantLearningData>;
  getLoginToken?: Maybe<User>;
  groupActivityDetails?: Maybe<GroupActivityDetails>;
  learningElement?: Maybe<LearningElement>;
  learningElements?: Maybe<Array<LearningElement>>;
  liveSession?: Maybe<Session>;
  microSession?: Maybe<MicroSession>;
  participantGroups?: Maybe<Array<ParticipantGroup>>;
  participations?: Maybe<Array<Participation>>;
  pinnedFeedbacks?: Maybe<Session>;
  question?: Maybe<Question>;
  runningSessions?: Maybe<Array<Session>>;
  self?: Maybe<Participant>;
  session?: Maybe<Session>;
  sessionEvaluation?: Maybe<SessionEvaluation>;
  sessionLeaderboard?: Maybe<Array<LeaderboardEntry>>;
  singleMicroSession?: Maybe<MicroSession>;
  unassignedSessions?: Maybe<Array<Session>>;
  userCourses?: Maybe<Array<Course>>;
  userProfile?: Maybe<User>;
  userQuestions?: Maybe<Array<Question>>;
  userSessions?: Maybe<Array<Session>>;
  userTags?: Maybe<Array<Tag>>;
};


export type QueryBasicCourseInformationArgs = {
  courseId: Scalars['String'];
};


export type QueryCockpitSessionArgs = {
  id: Scalars['String'];
};


export type QueryControlCourseArgs = {
  id: Scalars['String'];
};


export type QueryControlSessionArgs = {
  id: Scalars['String'];
};


export type QueryCourseArgs = {
  id: Scalars['String'];
};


export type QueryFeedbacksArgs = {
  id: Scalars['String'];
};


export type QueryGetCourseOverviewDataArgs = {
  courseId: Scalars['String'];
};


export type QueryGroupActivityDetailsArgs = {
  activityId: Scalars['String'];
  groupId: Scalars['String'];
};


export type QueryLearningElementArgs = {
  id: Scalars['String'];
};


export type QueryLiveSessionArgs = {
  id: Scalars['String'];
};


export type QueryMicroSessionArgs = {
  id: Scalars['String'];
};


export type QueryParticipantGroupsArgs = {
  courseId: Scalars['String'];
};


export type QueryParticipationsArgs = {
  endpoint?: InputMaybe<Scalars['String']>;
};


export type QueryPinnedFeedbacksArgs = {
  id: Scalars['String'];
};


export type QueryQuestionArgs = {
  id: Scalars['Int'];
};


export type QueryRunningSessionsArgs = {
  shortname: Scalars['String'];
};


export type QuerySessionArgs = {
  id: Scalars['String'];
};


export type QuerySessionEvaluationArgs = {
  id: Scalars['String'];
};


export type QuerySessionLeaderboardArgs = {
  sessionId: Scalars['String'];
};


export type QuerySingleMicroSessionArgs = {
  id: Scalars['String'];
};

export type Question = {
  __typename?: 'Question';
  attachments: Array<Attachment>;
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
  questionData: QuestionData;
  tags: Array<Tag>;
  type: Scalars['String'];
  updatedAt: Scalars['Date'];
};

export type QuestionData = {
  content: Scalars['String'];
  id: Scalars['Int'];
  name: Scalars['String'];
  pointsMultiplier: Scalars['Int'];
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
  attachments: Array<AttachmentInstance>;
  evaluation?: Maybe<InstanceEvaluation>;
  id: Scalars['Int'];
  pointsMultiplier: Scalars['Int'];
  questionData: QuestionData;
};

export type QuestionResponse = {
  __typename?: 'QuestionResponse';
  id: Scalars['Int'];
};

export type QuestionResponseDetail = {
  __typename?: 'QuestionResponseDetail';
  id: Scalars['Int'];
};

export enum QuestionType {
  FreeText = 'FREE_TEXT',
  Kprim = 'KPRIM',
  Mc = 'MC',
  Numerical = 'NUMERICAL',
  Sc = 'SC'
}

export type ResponseInput = {
  choices?: InputMaybe<Array<Scalars['Int']>>;
  value?: InputMaybe<Scalars['String']>;
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
  isConfusionFeedbackEnabled: Scalars['Boolean'];
  isGamificationEnabled: Scalars['Boolean'];
  isLiveQAEnabled: Scalars['Boolean'];
  isModerationEnabled: Scalars['Boolean'];
  linkTo?: Maybe<Scalars['String']>;
  linkToJoin?: Maybe<Scalars['String']>;
  name: Scalars['String'];
  namespace: Scalars['String'];
  numOfBlocks?: Maybe<Scalars['Int']>;
  numOfQuestions?: Maybe<Scalars['Int']>;
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
  execution?: Maybe<Scalars['Int']>;
  expiresAt?: Maybe<Scalars['Date']>;
  id: Scalars['Int'];
  instances: Array<QuestionInstance>;
  order?: Maybe<Scalars['Int']>;
  randomSelection?: Maybe<Scalars['Int']>;
  status: SessionBlockStatus;
  timeLimit?: Maybe<Scalars['Int']>;
};

export enum SessionBlockStatus {
  Active = 'ACTIVE',
  Executed = 'EXECUTED',
  Scheduled = 'SCHEDULED'
}

export type SessionEvaluation = {
  __typename?: 'SessionEvaluation';
  blocks: Array<EvaluationBlock>;
  confusionFeedbacks: Array<ConfusionTimestep>;
  feedbacks: Array<Feedback>;
  id: Scalars['String'];
  instanceResults: Array<InstanceResult>;
  isGamificationEnabled: Scalars['Boolean'];
  status: SessionStatus;
};

export enum SessionStatus {
  Completed = 'COMPLETED',
  Prepared = 'PREPARED',
  Running = 'RUNNING',
  Scheduled = 'SCHEDULED'
}

export type SolutionRangeInput = {
  max?: InputMaybe<Scalars['Float']>;
  min?: InputMaybe<Scalars['Float']>;
};

export type Statistics = {
  __typename?: 'Statistics';
  max: Scalars['Float'];
  mean: Scalars['Float'];
  median: Scalars['Float'];
  min: Scalars['Float'];
  q1: Scalars['Float'];
  q3: Scalars['Float'];
  sd: Scalars['Float'];
};

export type SubscriptionKeysInput = {
  auth: Scalars['String'];
  p256dh: Scalars['String'];
};

export type SubscriptionObjectInput = {
  endpoint: Scalars['String'];
  expirationTime?: InputMaybe<Scalars['Int']>;
  keys: SubscriptionKeysInput;
};

export type TabData = {
  __typename?: 'TabData';
  id: Scalars['String'];
  name: Scalars['String'];
  questionIx?: Maybe<Scalars['Int']>;
  status?: Maybe<Scalars['String']>;
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

export type FeedbackDataFragment = { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, resolvedAt?: any | null, createdAt: any, responses: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number }> };

export type QuestionDataFragment = { __typename?: 'QuestionInstance', questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', solutions: Array<string>, restrictions: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null }, solutionRanges: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> } } };

export type QuestionDataWithoutSolutionsFragment = { __typename?: 'QuestionInstance', questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', restrictions: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', restrictions: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } } } };

export type ActivateSessionBlockMutationVariables = Exact<{
  sessionId: Scalars['String'];
  sessionBlockId: Scalars['Int'];
}>;


export type ActivateSessionBlockMutation = { __typename?: 'Mutation', activateSessionBlock?: { __typename?: 'Session', id: string, status: SessionStatus, blocks: Array<{ __typename?: 'SessionBlock', id: number, status: SessionBlockStatus }> } | null };

export type AddConfusionTimestepMutationVariables = Exact<{
  sessionId: Scalars['String'];
  difficulty: Scalars['Int'];
  speed: Scalars['Int'];
}>;


export type AddConfusionTimestepMutation = { __typename?: 'Mutation', addConfusionTimestep?: { __typename?: 'ConfusionTimestep', id: number, difficulty: number, speed: number } | null };

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

export type ChangeSessionSettingsMutationVariables = Exact<{
  id: Scalars['String'];
  isLiveQAEnabled?: InputMaybe<Scalars['Boolean']>;
  isConfusionFeedbackEnabled?: InputMaybe<Scalars['Boolean']>;
  isModerationEnabled?: InputMaybe<Scalars['Boolean']>;
  isGamificationEnabled?: InputMaybe<Scalars['Boolean']>;
}>;


export type ChangeSessionSettingsMutation = { __typename?: 'Mutation', changeSessionSettings?: { __typename?: 'Session', id: string, isLiveQAEnabled: boolean, isConfusionFeedbackEnabled: boolean, isModerationEnabled: boolean, isGamificationEnabled: boolean } | null };

export type CreateFeedbackMutationVariables = Exact<{
  sessionId: Scalars['String'];
  content: Scalars['String'];
}>;


export type CreateFeedbackMutation = { __typename?: 'Mutation', createFeedback?: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number } | null };

export type CreateLearningElementMutationVariables = Exact<{
  name: Scalars['String'];
  displayName: Scalars['String'];
  description?: InputMaybe<Scalars['String']>;
  questions: Array<Scalars['Int']> | Scalars['Int'];
  courseId?: InputMaybe<Scalars['String']>;
  multiplier: Scalars['Int'];
  order: LearningElementOrderType;
  resetTimeDays: Scalars['Int'];
}>;


export type CreateLearningElementMutation = { __typename?: 'Mutation', createLearningElement?: { __typename?: 'LearningElement', id: string } | null };

export type CreateMicroSessionMutationVariables = Exact<{
  name: Scalars['String'];
  displayName: Scalars['String'];
  description?: InputMaybe<Scalars['String']>;
  questions: Array<Scalars['Int']> | Scalars['Int'];
  courseId?: InputMaybe<Scalars['String']>;
  multiplier: Scalars['Int'];
  startDate: Scalars['Date'];
  endDate: Scalars['Date'];
}>;


export type CreateMicroSessionMutation = { __typename?: 'Mutation', createMicroSession?: { __typename?: 'MicroSession', id: string } | null };

export type CreateParticipantAndJoinCourseMutationVariables = Exact<{
  username: Scalars['String'];
  password: Scalars['String'];
  courseId: Scalars['String'];
  pin: Scalars['Int'];
}>;


export type CreateParticipantAndJoinCourseMutation = { __typename?: 'Mutation', createParticipantAndJoinCourse?: { __typename?: 'Participant', id: string, username: string, avatar?: string | null } | null };

export type CreateParticipantGroupMutationVariables = Exact<{
  courseId: Scalars['String'];
  name: Scalars['String'];
}>;


export type CreateParticipantGroupMutation = { __typename?: 'Mutation', createParticipantGroup?: { __typename?: 'ParticipantGroup', id: string, name: string, code: number, participants: Array<{ __typename?: 'Participant', id: string, username: string }> } | null };

export type CreateSessionMutationVariables = Exact<{
  name: Scalars['String'];
  displayName: Scalars['String'];
  description?: InputMaybe<Scalars['String']>;
  blocks: Array<BlockInput> | BlockInput;
  courseId?: InputMaybe<Scalars['String']>;
  multiplier: Scalars['Int'];
  isGamificationEnabled?: InputMaybe<Scalars['Boolean']>;
}>;


export type CreateSessionMutation = { __typename?: 'Mutation', createSession?: { __typename?: 'Session', id: string } | null };

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

export type EditMicroSessionMutationVariables = Exact<{
  id: Scalars['String'];
  name: Scalars['String'];
  displayName: Scalars['String'];
  description?: InputMaybe<Scalars['String']>;
  questions: Array<Scalars['Int']> | Scalars['Int'];
  courseId?: InputMaybe<Scalars['String']>;
  multiplier: Scalars['Int'];
  startDate: Scalars['Date'];
  endDate: Scalars['Date'];
}>;


export type EditMicroSessionMutation = { __typename?: 'Mutation', editMicroSession?: { __typename?: 'MicroSession', id: string } | null };

export type EditSessionMutationVariables = Exact<{
  id: Scalars['String'];
  name: Scalars['String'];
  displayName: Scalars['String'];
  description?: InputMaybe<Scalars['String']>;
  blocks: Array<BlockInput> | BlockInput;
  courseId?: InputMaybe<Scalars['String']>;
  multiplier: Scalars['Int'];
  isGamificationEnabled?: InputMaybe<Scalars['Boolean']>;
}>;


export type EditSessionMutation = { __typename?: 'Mutation', editSession?: { __typename?: 'Session', id: string } | null };

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

export type JoinCourseMutationVariables = Exact<{
  courseId: Scalars['String'];
}>;


export type JoinCourseMutation = { __typename?: 'Mutation', joinCourse?: { __typename?: 'ParticipantLearningData', id: string, participation?: { __typename?: 'Participation', id: number, isActive: boolean } | null } | null };

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

export type ManipulateChoicesQuestionMutationVariables = Exact<{
  id?: InputMaybe<Scalars['Int']>;
  type: QuestionType;
  name?: InputMaybe<Scalars['String']>;
  content?: InputMaybe<Scalars['String']>;
  options?: InputMaybe<OptionsChoicesInput>;
  hasSampleSolution?: InputMaybe<Scalars['Boolean']>;
  hasAnswerFeedbacks?: InputMaybe<Scalars['Boolean']>;
  attachments?: InputMaybe<Array<AttachmentInput> | AttachmentInput>;
  tags?: InputMaybe<Array<Scalars['String']> | Scalars['String']>;
}>;


export type ManipulateChoicesQuestionMutation = { __typename?: 'Mutation', manipulateChoicesQuestion?: { __typename?: 'Question', id: number, name: string, type: string, content: string, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, questionData: { __typename?: 'ChoicesQuestionData', options: { __typename?: 'ChoiceQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', options: { __typename?: 'FreeTextQuestionOptions', solutions: Array<string>, restrictions: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } } } | { __typename?: 'NumericalQuestionData', options: { __typename?: 'NumericalQuestionOptions', restrictions: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null }, solutionRanges: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> } }, tags: Array<{ __typename?: 'Tag', id: number, name: string }>, attachments: Array<{ __typename?: 'Attachment', id: string, href: string, name: string, originalName?: string | null, description?: string | null, type: string }> } | null };

export type ManipulateFreeTextQuestionMutationVariables = Exact<{
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
  content?: InputMaybe<Scalars['String']>;
  options?: InputMaybe<OptionsFreeTextInput>;
  hasSampleSolution?: InputMaybe<Scalars['Boolean']>;
  hasAnswerFeedbacks?: InputMaybe<Scalars['Boolean']>;
  attachments?: InputMaybe<Array<AttachmentInput> | AttachmentInput>;
  tags?: InputMaybe<Array<Scalars['String']> | Scalars['String']>;
}>;


export type ManipulateFreeTextQuestionMutation = { __typename?: 'Mutation', manipulateFreeTextQuestion?: { __typename?: 'Question', id: number, name: string, type: string, content: string, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, questionData: { __typename?: 'ChoicesQuestionData', options: { __typename?: 'ChoiceQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', options: { __typename?: 'FreeTextQuestionOptions', solutions: Array<string>, restrictions: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } } } | { __typename?: 'NumericalQuestionData', options: { __typename?: 'NumericalQuestionOptions', restrictions: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null }, solutionRanges: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> } }, tags: Array<{ __typename?: 'Tag', id: number, name: string }>, attachments: Array<{ __typename?: 'Attachment', id: string, href: string, name: string, originalName?: string | null, description?: string | null, type: string }> } | null };

export type ManipulateNumericalQuestionMutationVariables = Exact<{
  id?: InputMaybe<Scalars['Int']>;
  name?: InputMaybe<Scalars['String']>;
  content?: InputMaybe<Scalars['String']>;
  options?: InputMaybe<OptionsNumericalInput>;
  hasSampleSolution?: InputMaybe<Scalars['Boolean']>;
  hasAnswerFeedbacks?: InputMaybe<Scalars['Boolean']>;
  attachments?: InputMaybe<Array<AttachmentInput> | AttachmentInput>;
  tags?: InputMaybe<Array<Scalars['String']> | Scalars['String']>;
}>;


export type ManipulateNumericalQuestionMutation = { __typename?: 'Mutation', manipulateNumericalQuestion?: { __typename?: 'Question', id: number, name: string, type: string, content: string, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, questionData: { __typename?: 'ChoicesQuestionData', options: { __typename?: 'ChoiceQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', options: { __typename?: 'FreeTextQuestionOptions', solutions: Array<string>, restrictions: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } } } | { __typename?: 'NumericalQuestionData', options: { __typename?: 'NumericalQuestionOptions', restrictions: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null }, solutionRanges: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> } }, tags: Array<{ __typename?: 'Tag', id: number, name: string }>, attachments: Array<{ __typename?: 'Attachment', id: string, href: string, name: string, originalName?: string | null, description?: string | null, type: string }> } | null };

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

export type RegisterParticipantFromLtiMutationVariables = Exact<{
  courseId: Scalars['String'];
  participantId: Scalars['String'];
}>;


export type RegisterParticipantFromLtiMutation = { __typename?: 'Mutation', registerParticipantFromLTI?: { __typename?: 'ParticipantLearningData', id: string, participantToken?: string | null, participant?: { __typename?: 'Participant', id: string, avatar?: string | null, username: string } | null, participation?: { __typename?: 'Participation', id: number, isActive: boolean } | null, course?: { __typename?: 'Course', id: string, name: string, displayName: string } | null } | null };

export type ResolveFeedbackMutationVariables = Exact<{
  id: Scalars['Int'];
  isResolved: Scalars['Boolean'];
}>;


export type ResolveFeedbackMutation = { __typename?: 'Mutation', resolveFeedback?: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number } | null };

export type RespondToFeedbackMutationVariables = Exact<{
  id: Scalars['Int'];
  responseContent: Scalars['String'];
}>;


export type RespondToFeedbackMutation = { __typename?: 'Mutation', respondToFeedback?: { __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, resolvedAt?: any | null, createdAt: any, responses: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number }> } | null };

export type ResponseToQuestionInstanceMutationVariables = Exact<{
  courseId: Scalars['String'];
  id: Scalars['Int'];
  response: ResponseInput;
}>;


export type ResponseToQuestionInstanceMutation = { __typename?: 'Mutation', respondToQuestionInstance?: { __typename?: 'QuestionInstance', id: number, evaluation?: { __typename?: 'InstanceEvaluation', choices: any, score: number, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback: string, correct: boolean, value: string }> | null } | null, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', solutions: Array<string>, restrictions: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null }, solutionRanges: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> } } } | null };

export type StartGroupActivityMutationVariables = Exact<{
  activityId: Scalars['String'];
  groupId: Scalars['String'];
}>;


export type StartGroupActivityMutation = { __typename?: 'Mutation', startGroupActivity?: { __typename?: 'GroupActivityDetails', id: string } | null };

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

export type GetCockpitSessionQueryVariables = Exact<{
  id: Scalars['String'];
}>;


export type GetCockpitSessionQuery = { __typename?: 'Query', cockpitSession?: { __typename?: 'Session', id: string, isLiveQAEnabled: boolean, isConfusionFeedbackEnabled: boolean, isModerationEnabled: boolean, isGamificationEnabled: boolean, namespace: string, name: string, displayName: string, status: SessionStatus, startedAt?: any | null, course: { __typename?: 'Course', id: string, displayName: string }, blocks: Array<{ __typename?: 'SessionBlock', id: number, order?: number | null, status: SessionBlockStatus, expiresAt?: any | null, timeLimit?: number | null, randomSelection?: number | null, execution?: number | null, instances: Array<{ __typename?: 'QuestionInstance', id: number, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string } }> }>, activeBlock: { __typename?: 'SessionBlock', id: number }, confusionFeedbacks: Array<{ __typename?: 'ConfusionTimestep', speed: number, difficulty: number, numberOfParticipants?: number | null }>, feedbacks: Array<{ __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, createdAt: any, resolvedAt?: any | null, responses: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number }> }> } | null };

export type GetControlCourseQueryVariables = Exact<{
  courseId: Scalars['String'];
}>;


export type GetControlCourseQuery = { __typename?: 'Query', controlCourse?: { __typename?: 'Course', id: string, name: string, sessions: Array<{ __typename?: 'Session', id: string, name: string, status: SessionStatus }> } | null };

export type GetControlCoursesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetControlCoursesQuery = { __typename?: 'Query', controlCourses?: Array<{ __typename?: 'Course', id: string, name: string, isArchived?: boolean | null, displayName: string, description?: string | null }> | null };

export type GetControlSessionQueryVariables = Exact<{
  id: Scalars['String'];
}>;


export type GetControlSessionQuery = { __typename?: 'Query', controlSession?: { __typename?: 'Session', id: string, name: string, displayName: string, course: { __typename?: 'Course', id: string, displayName: string }, blocks: Array<{ __typename?: 'SessionBlock', id: number, order?: number | null, status: SessionBlockStatus, expiresAt?: any | null, timeLimit?: number | null, randomSelection?: number | null, execution?: number | null, instances: Array<{ __typename?: 'QuestionInstance', id: number, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string } }> }>, activeBlock: { __typename?: 'SessionBlock', id: number, order?: number | null } } | null };

export type GetCourseOverviewDataQueryVariables = Exact<{
  courseId: Scalars['String'];
}>;


export type GetCourseOverviewDataQuery = { __typename?: 'Query', getCourseOverviewData?: { __typename?: 'ParticipantLearningData', id: string, participant?: { __typename?: 'Participant', id: string, avatar?: string | null, username: string } | null, participation?: { __typename?: 'Participation', id: number, isActive: boolean } | null, course?: { __typename?: 'Course', id: string, name: string, displayName: string, color?: string | null, description?: string | null, awards: Array<{ __typename?: 'AwardEntry', id: number, order: number, type: string, name: string, displayName: string, description: string, participant: { __typename?: 'Participant', id: string, username: string, avatar?: string | null }, participantGroup: { __typename?: 'ParticipantGroup', id: string, name: string } }> } | null, leaderboard?: Array<{ __typename?: 'LeaderboardEntry', id: number, participantId: string, username: string, avatar: string, score: number, isSelf: boolean, rank: number }> | null, leaderboardStatistics?: { __typename?: 'LeaderboardStatistics', participantCount: number, averageScore: number } | null, groupLeaderboard?: Array<{ __typename?: 'GroupLeaderboardEntry', id: string, name: string, score: number }> | null, groupLeaderboardStatistics?: { __typename?: 'LeaderboardStatistics', participantCount: number, averageScore: number } | null } | null, participantGroups?: Array<{ __typename?: 'ParticipantGroup', id: string, name: string, code: number, averageMemberScore: number, groupActivityScore: number, score: number, participants: Array<{ __typename?: 'Participant', id: string, username: string, avatar?: string | null, score: number, isSelf: boolean }> }> | null };

export type GetFeedbacksQueryVariables = Exact<{
  sessionId: Scalars['String'];
}>;


export type GetFeedbacksQuery = { __typename?: 'Query', feedbacks?: Array<{ __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, resolvedAt?: any | null, createdAt: any, responses: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number }> }> | null };

export type GetLearningElementQueryVariables = Exact<{
  id: Scalars['String'];
}>;


export type GetLearningElementQuery = { __typename?: 'Query', learningElement?: { __typename?: 'LearningElement', id: string, displayName: string, description?: string | null, pointsMultiplier: number, resetTimeDays?: number | null, orderType: LearningElementOrderType, previouslyAnswered: number, previousScore: number, previousPointsAwarded: number, totalTrials: number, course: { __typename?: 'Course', id: string, displayName: string, color?: string | null }, instances: Array<{ __typename?: 'QuestionInstance', id: number, pointsMultiplier: number, evaluation?: { __typename?: 'InstanceEvaluation', choices: any, score: number, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback: string, correct: boolean, value: string }> | null } | null, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', solutions: Array<string>, restrictions: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null }, solutionRanges: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> } } }> } | null };

export type GetLearningElementsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetLearningElementsQuery = { __typename?: 'Query', learningElements?: Array<{ __typename?: 'LearningElement', id: string, displayName: string, courseId: string }> | null };

export type GetLoginTokenQueryVariables = Exact<{ [key: string]: never; }>;


export type GetLoginTokenQuery = { __typename?: 'Query', getLoginToken?: { __typename?: 'User', loginToken?: string | null, loginTokenExpiresAt?: any | null } | null };

export type GetMicroSessionQueryVariables = Exact<{
  id: Scalars['String'];
}>;


export type GetMicroSessionQuery = { __typename?: 'Query', microSession?: { __typename?: 'MicroSession', id: string, displayName: string, description?: string | null, course: { __typename?: 'Course', id: string, displayName: string, color?: string | null }, instances: Array<{ __typename?: 'QuestionInstance', id: number, evaluation?: { __typename?: 'InstanceEvaluation', choices: any, score: number, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback: string, correct: boolean, value: string }> | null } | null, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', solutions: Array<string>, restrictions: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null }, solutionRanges: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> } } }> } | null };

export type GetParticipantGroupsQueryVariables = Exact<{
  courseId: Scalars['String'];
}>;


export type GetParticipantGroupsQuery = { __typename?: 'Query', participantGroups?: Array<{ __typename?: 'ParticipantGroup', id: string, name: string, code: number, score: number, participants: Array<{ __typename?: 'Participant', id: string, username: string, score: number, isSelf: boolean, rank: number }> }> | null };

export type GetPinnedFeedbacksQueryVariables = Exact<{
  id: Scalars['String'];
}>;


export type GetPinnedFeedbacksQuery = { __typename?: 'Query', pinnedFeedbacks?: { __typename?: 'Session', id: string, isLiveQAEnabled: boolean, isConfusionFeedbackEnabled: boolean, isModerationEnabled: boolean, isGamificationEnabled: boolean, confusionFeedbacks: Array<{ __typename?: 'ConfusionTimestep', speed: number, difficulty: number, numberOfParticipants?: number | null }>, feedbacks: Array<{ __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, createdAt: any, resolvedAt?: any | null, responses: Array<{ __typename?: 'FeedbackResponse', id: number, content: string, positiveReactions: number, negativeReactions: number }> }> } | null };

export type GetRunningSessionQueryVariables = Exact<{
  id: Scalars['String'];
}>;


export type GetRunningSessionQuery = { __typename?: 'Query', session?: { __typename?: 'Session', id: string, isLiveQAEnabled: boolean, isConfusionFeedbackEnabled: boolean, isModerationEnabled: boolean, isGamificationEnabled: boolean, namespace: string, name: string, displayName: string, status: SessionStatus, course: { __typename?: 'Course', id: string, displayName: string, color?: string | null }, activeBlock: { __typename?: 'SessionBlock', id: number, status: SessionBlockStatus, expiresAt?: any | null, timeLimit?: number | null, randomSelection?: number | null, execution?: number | null, instances: Array<{ __typename?: 'QuestionInstance', id: number, attachments: Array<{ __typename?: 'AttachmentInstance', id: string, href: string, name: string, originalName?: string | null, description?: string | null, type: string }>, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', restrictions: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', restrictions: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null } } } }> } } | null };

export type GetRunningSessionsQueryVariables = Exact<{
  shortname: Scalars['String'];
}>;


export type GetRunningSessionsQuery = { __typename?: 'Query', runningSessions?: Array<{ __typename?: 'Session', id: string, name: string, displayName: string, linkTo?: string | null }> | null };

export type GetSessionEvaluationQueryVariables = Exact<{
  id: Scalars['String'];
}>;


export type GetSessionEvaluationQuery = { __typename?: 'Query', sessionEvaluation?: { __typename?: 'SessionEvaluation', id: string, status: SessionStatus, isGamificationEnabled: boolean, blocks: Array<{ __typename?: 'EvaluationBlock', blockIx?: number | null, blockStatus: SessionBlockStatus, tabData: Array<{ __typename?: 'TabData', id: string, questionIx?: number | null, name: string, status?: string | null }> }>, instanceResults: Array<{ __typename?: 'InstanceResult', id: string, blockIx?: number | null, instanceIx: number, status: SessionBlockStatus, participants: number, results: any, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, options: { __typename?: 'ChoiceQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, options: { __typename?: 'FreeTextQuestionOptions', solutions: Array<string>, restrictions: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, options: { __typename?: 'NumericalQuestionOptions', restrictions: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null }, solutionRanges: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> } }, statistics: { __typename?: 'Statistics', max: number, mean: number, median: number, min: number, q1: number, q3: number, sd: number } }>, feedbacks: Array<{ __typename?: 'Feedback', id: number, isPublished: boolean, isPinned: boolean, isResolved: boolean, content: string, votes: number, resolvedAt?: any | null, createdAt: any, responses: Array<{ __typename?: 'FeedbackResponse', id: number, createdAt: any, content: string, positiveReactions: number, negativeReactions: number }> }>, confusionFeedbacks: Array<{ __typename?: 'ConfusionTimestep', id: number, speed: number, difficulty: number, createdAt: any }> } | null, sessionLeaderboard?: Array<{ __typename?: 'LeaderboardEntry', id: number, participantId: string, rank: number, username: string, avatar: string, score: number }> | null };

export type GetSessionLeaderboardQueryVariables = Exact<{
  sessionId: Scalars['String'];
}>;


export type GetSessionLeaderboardQuery = { __typename?: 'Query', sessionLeaderboard?: Array<{ __typename?: 'LeaderboardEntry', id: number, participantId: string, rank: number, username: string, avatar: string, score: number, isSelf: boolean, lastBlockOrder: number }> | null };

export type GetSingleCourseQueryVariables = Exact<{
  courseId: Scalars['String'];
}>;


export type GetSingleCourseQuery = { __typename?: 'Query', course?: { __typename?: 'Course', id: string, isArchived?: boolean | null, pinCode?: number | null, name: string, displayName: string, description?: string | null, color?: string | null, numOfParticipants?: number | null, numOfActiveParticipants?: number | null, averageScore?: number | null, averageActiveScore?: number | null, sessions: Array<{ __typename?: 'Session', id: string, name: string, displayName: string, isGamificationEnabled: boolean, pinCode?: number | null, accessMode: SessionAccessMode, status: SessionStatus, createdAt: any, numOfBlocks?: number | null, numOfQuestions?: number | null }>, learningElements: Array<{ __typename?: 'LearningElement', id: string, name: string, displayName: string, numOfInstances: number }>, microSessions: Array<{ __typename?: 'MicroSession', id: string, name: string, displayName: string, scheduledStartAt: any, scheduledEndAt: any, numOfInstances?: number | null }>, leaderboard: Array<{ __typename?: 'LeaderboardEntry', id: number, score: number, rank: number, username: string, avatar: string, participation: { __typename?: 'Participation', isActive: boolean } }> } | null };

export type GetSingleLiveSessionQueryVariables = Exact<{
  sessionId: Scalars['String'];
}>;


export type GetSingleLiveSessionQuery = { __typename?: 'Query', liveSession?: { __typename?: 'Session', id: string, name: string, displayName: string, description?: string | null, pointsMultiplier: number, isGamificationEnabled: boolean, blocks: Array<{ __typename?: 'SessionBlock', id: number, status: SessionBlockStatus, timeLimit?: number | null, instances: Array<{ __typename?: 'QuestionInstance', id: number, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string } | { __typename?: 'FreeTextQuestionData', id: number, name: string } | { __typename?: 'NumericalQuestionData', id: number, name: string } }> }>, course: { __typename?: 'Course', id: string } } | null };

export type GetSingleMicroSessionQueryVariables = Exact<{
  id: Scalars['String'];
}>;


export type GetSingleMicroSessionQuery = { __typename?: 'Query', singleMicroSession?: { __typename?: 'MicroSession', id: string, name: string, displayName: string, description?: string | null, scheduledStartAt: any, scheduledEndAt: any, pointsMultiplier: number, course: { __typename?: 'Course', id: string }, instances: Array<{ __typename?: 'QuestionInstance', id: number, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string } | { __typename?: 'FreeTextQuestionData', id: number, name: string } | { __typename?: 'NumericalQuestionData', id: number, name: string } }> } | null };

export type GetSingleQuestionQueryVariables = Exact<{
  id: Scalars['Int'];
}>;


export type GetSingleQuestionQuery = { __typename?: 'Query', question?: { __typename?: 'Question', id: number, name: string, type: string, content: string, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, questionData: { __typename?: 'ChoicesQuestionData', options: { __typename?: 'ChoiceQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', options: { __typename?: 'FreeTextQuestionOptions', solutions: Array<string>, restrictions: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } } } | { __typename?: 'NumericalQuestionData', options: { __typename?: 'NumericalQuestionOptions', restrictions: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null }, solutionRanges: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> } }, tags: Array<{ __typename?: 'Tag', id: number, name: string }>, attachments: Array<{ __typename?: 'Attachment', id: string, href: string, name: string, originalName?: string | null, description?: string | null, type: string }> } | null };

export type GetUnassignedSessionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUnassignedSessionsQuery = { __typename?: 'Query', unassignedSessions?: Array<{ __typename?: 'Session', id: string, name: string, status: SessionStatus }> | null };

export type GetUserCoursesQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserCoursesQuery = { __typename?: 'Query', userCourses?: Array<{ __typename?: 'Course', id: string, isArchived?: boolean | null, pinCode?: number | null, name: string, displayName: string, description?: string | null, createdAt: any, updatedAt: any }> | null };

export type GetUserQuestionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserQuestionsQuery = { __typename?: 'Query', userQuestions?: Array<{ __typename?: 'Question', id: number, name: string, type: string, content: string, isArchived: boolean, isDeleted: boolean, hasSampleSolution: boolean, hasAnswerFeedbacks: boolean, createdAt: any, updatedAt: any, tags: Array<{ __typename?: 'Tag', id: number, name: string }> }> | null };

export type GetUserSessionsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserSessionsQuery = { __typename?: 'Query', userSessions?: Array<{ __typename?: 'Session', id: string, name: string, displayName: string, accessMode: SessionAccessMode, status: SessionStatus, createdAt: any, updatedAt?: any | null, startedAt?: any | null, numOfBlocks?: number | null, numOfQuestions?: number | null, blocks: Array<{ __typename?: 'SessionBlock', id: number, instances: Array<{ __typename?: 'QuestionInstance', id: number, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string } }> }>, course: { __typename?: 'Course', id: string, name: string, displayName: string } }> | null };

export type GetUserTagsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetUserTagsQuery = { __typename?: 'Query', userTags?: Array<{ __typename?: 'Tag', id: number, name: string }> | null };

export type GroupActivityDetailsQueryVariables = Exact<{
  activityId: Scalars['String'];
  groupId: Scalars['String'];
}>;


export type GroupActivityDetailsQuery = { __typename?: 'Query', groupActivityDetails?: { __typename?: 'GroupActivityDetails', id: string, name: string, displayName: string, description?: string | null, scheduledStartAt?: any | null, scheduledEndAt?: any | null, clues: Array<{ __typename?: 'GroupActivityClue', id: number, name: string, displayName: string }>, instances: Array<{ __typename?: 'QuestionInstance', id: number, evaluation?: { __typename?: 'InstanceEvaluation', choices: any, score: number, pointsAwarded?: number | null, percentile?: number | null, newPointsFrom?: any | null, feedbacks?: Array<{ __typename?: 'QuestionFeedback', ix: number, feedback: string, correct: boolean, value: string }> | null } | null, questionData: { __typename?: 'ChoicesQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'ChoiceQuestionOptions', choices: Array<{ __typename?: 'Choice', ix: number, correct?: boolean | null, feedback?: string | null, value: string }> } } | { __typename?: 'FreeTextQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'FreeTextQuestionOptions', solutions: Array<string>, restrictions: { __typename?: 'FreeTextRestrictions', maxLength?: number | null } } } | { __typename?: 'NumericalQuestionData', id: number, name: string, type: string, content: string, pointsMultiplier: number, options: { __typename?: 'NumericalQuestionOptions', accuracy?: number | null, placeholder?: string | null, unit?: string | null, restrictions: { __typename?: 'NumericalRestrictions', min?: number | null, max?: number | null }, solutionRanges: Array<{ __typename?: 'NumericalSolutionRange', min?: number | null, max?: number | null }> } } }>, course: { __typename?: 'Course', id: string, displayName: string, color?: string | null }, group: { __typename?: 'ParticipantGroup', id: string, name: string, participants: Array<{ __typename?: 'Participant', id: string, username: string, avatar?: string | null, isSelf: boolean }> }, activityInstance?: { __typename?: 'GroupActivityInstance', id: number, decisions?: any | null, decisionsSubmittedAt?: any | null, clues: Array<{ __typename?: 'GroupActivityClueInstance', id: number, name: string, displayName: string, type: ParameterType, unit?: string | null, value?: string | null, participant: { __typename?: 'Participant', id: string, username: string, avatar?: string | null, isSelf: boolean } }> } | null } | null };

export type ParticipationsQueryVariables = Exact<{
  endpoint?: InputMaybe<Scalars['String']>;
}>;


export type ParticipationsQuery = { __typename?: 'Query', participations?: Array<{ __typename?: 'Participation', id: number, completedMicroSessions: Array<string>, subscriptions: Array<{ __typename?: 'PushSubscription', id: number, endpoint: string }>, course: { __typename?: 'Course', id: string, displayName: string, microSessions: Array<{ __typename?: 'MicroSession', id: string, displayName: string, scheduledStartAt: any, scheduledEndAt: any }>, sessions: Array<{ __typename?: 'Session', id: string, displayName: string, linkTo?: string | null }> } }> | null };

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
  AttachmentInput: AttachmentInput;
  AttachmentInstance: ResolverTypeWrapper<AttachmentInstance>;
  AvatarSettingsInput: AvatarSettingsInput;
  AwardEntry: ResolverTypeWrapper<AwardEntry>;
  BlockInput: BlockInput;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']>;
  Choice: ResolverTypeWrapper<Choice>;
  ChoiceInput: ChoiceInput;
  ChoiceQuestionOptions: ResolverTypeWrapper<ChoiceQuestionOptions>;
  ChoicesQuestionData: ResolverTypeWrapper<ChoicesQuestionData>;
  ClassAchievementInstance: ResolverTypeWrapper<ClassAchievementInstance>;
  ConfusionTimestep: ResolverTypeWrapper<ConfusionTimestep>;
  Course: ResolverTypeWrapper<Course>;
  Date: ResolverTypeWrapper<Scalars['Date']>;
  EvaluationBlock: ResolverTypeWrapper<EvaluationBlock>;
  Feedback: ResolverTypeWrapper<Feedback>;
  FeedbackResponse: ResolverTypeWrapper<FeedbackResponse>;
  Float: ResolverTypeWrapper<Scalars['Float']>;
  FreeTextQuestionData: ResolverTypeWrapper<FreeTextQuestionData>;
  FreeTextQuestionOptions: ResolverTypeWrapper<FreeTextQuestionOptions>;
  FreeTextRestrictions: ResolverTypeWrapper<FreeTextRestrictions>;
  FreeTextRestrictionsInput: FreeTextRestrictionsInput;
  GroupAchievementInstance: ResolverTypeWrapper<GroupAchievementInstance>;
  GroupActivity: ResolverTypeWrapper<GroupActivity>;
  GroupActivityClue: ResolverTypeWrapper<GroupActivityClue>;
  GroupActivityClueAssignment: ResolverTypeWrapper<GroupActivityClueAssignment>;
  GroupActivityClueInstance: ResolverTypeWrapper<GroupActivityClueInstance>;
  GroupActivityDecisionInput: GroupActivityDecisionInput;
  GroupActivityDetails: ResolverTypeWrapper<GroupActivityDetails>;
  GroupActivityInstance: ResolverTypeWrapper<GroupActivityInstance>;
  GroupActivityParameter: ResolverTypeWrapper<GroupActivityParameter>;
  GroupLeaderboardEntry: ResolverTypeWrapper<GroupLeaderboardEntry>;
  ID: ResolverTypeWrapper<Scalars['ID']>;
  InstanceEvaluation: ResolverTypeWrapper<InstanceEvaluation>;
  InstanceResult: ResolverTypeWrapper<InstanceResult>;
  Int: ResolverTypeWrapper<Scalars['Int']>;
  Json: ResolverTypeWrapper<Scalars['Json']>;
  LeaderboardEntry: ResolverTypeWrapper<LeaderboardEntry>;
  LeaderboardStatistics: ResolverTypeWrapper<LeaderboardStatistics>;
  LearningElement: ResolverTypeWrapper<LearningElement>;
  LearningElementOrderType: LearningElementOrderType;
  LeaveCourseParticipation: ResolverTypeWrapper<LeaveCourseParticipation>;
  MicroSession: ResolverTypeWrapper<MicroSession>;
  Mutation: ResolverTypeWrapper<{}>;
  NumericalQuestionData: ResolverTypeWrapper<NumericalQuestionData>;
  NumericalQuestionOptions: ResolverTypeWrapper<NumericalQuestionOptions>;
  NumericalRestrictions: ResolverTypeWrapper<NumericalRestrictions>;
  NumericalRestrictionsInput: NumericalRestrictionsInput;
  NumericalSolutionRange: ResolverTypeWrapper<NumericalSolutionRange>;
  OptionsChoicesInput: OptionsChoicesInput;
  OptionsFreeTextInput: OptionsFreeTextInput;
  OptionsNumericalInput: OptionsNumericalInput;
  ParameterType: ParameterType;
  Participant: ResolverTypeWrapper<Participant>;
  ParticipantAchievementInstance: ResolverTypeWrapper<ParticipantAchievementInstance>;
  ParticipantGroup: ResolverTypeWrapper<ParticipantGroup>;
  ParticipantLearningData: ResolverTypeWrapper<ParticipantLearningData>;
  Participation: ResolverTypeWrapper<Participation>;
  PushSubscription: ResolverTypeWrapper<PushSubscription>;
  Query: ResolverTypeWrapper<{}>;
  Question: ResolverTypeWrapper<Question>;
  QuestionData: ResolversTypes['ChoicesQuestionData'] | ResolversTypes['FreeTextQuestionData'] | ResolversTypes['NumericalQuestionData'];
  QuestionFeedback: ResolverTypeWrapper<QuestionFeedback>;
  QuestionInstance: ResolverTypeWrapper<QuestionInstance>;
  QuestionResponse: ResolverTypeWrapper<QuestionResponse>;
  QuestionResponseDetail: ResolverTypeWrapper<QuestionResponseDetail>;
  QuestionType: QuestionType;
  ResponseInput: ResponseInput;
  Session: ResolverTypeWrapper<Session>;
  SessionAccessMode: SessionAccessMode;
  SessionBlock: ResolverTypeWrapper<SessionBlock>;
  SessionBlockStatus: SessionBlockStatus;
  SessionEvaluation: ResolverTypeWrapper<SessionEvaluation>;
  SessionStatus: SessionStatus;
  SolutionRangeInput: SolutionRangeInput;
  Statistics: ResolverTypeWrapper<Statistics>;
  String: ResolverTypeWrapper<Scalars['String']>;
  SubscriptionKeysInput: SubscriptionKeysInput;
  SubscriptionObjectInput: SubscriptionObjectInput;
  TabData: ResolverTypeWrapper<TabData>;
  Tag: ResolverTypeWrapper<Tag>;
  Title: ResolverTypeWrapper<Title>;
  User: ResolverTypeWrapper<User>;
};

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = {
  Achievement: Achievement;
  Attachment: Attachment;
  AttachmentInput: AttachmentInput;
  AttachmentInstance: AttachmentInstance;
  AvatarSettingsInput: AvatarSettingsInput;
  AwardEntry: AwardEntry;
  BlockInput: BlockInput;
  Boolean: Scalars['Boolean'];
  Choice: Choice;
  ChoiceInput: ChoiceInput;
  ChoiceQuestionOptions: ChoiceQuestionOptions;
  ChoicesQuestionData: ChoicesQuestionData;
  ClassAchievementInstance: ClassAchievementInstance;
  ConfusionTimestep: ConfusionTimestep;
  Course: Course;
  Date: Scalars['Date'];
  EvaluationBlock: EvaluationBlock;
  Feedback: Feedback;
  FeedbackResponse: FeedbackResponse;
  Float: Scalars['Float'];
  FreeTextQuestionData: FreeTextQuestionData;
  FreeTextQuestionOptions: FreeTextQuestionOptions;
  FreeTextRestrictions: FreeTextRestrictions;
  FreeTextRestrictionsInput: FreeTextRestrictionsInput;
  GroupAchievementInstance: GroupAchievementInstance;
  GroupActivity: GroupActivity;
  GroupActivityClue: GroupActivityClue;
  GroupActivityClueAssignment: GroupActivityClueAssignment;
  GroupActivityClueInstance: GroupActivityClueInstance;
  GroupActivityDecisionInput: GroupActivityDecisionInput;
  GroupActivityDetails: GroupActivityDetails;
  GroupActivityInstance: GroupActivityInstance;
  GroupActivityParameter: GroupActivityParameter;
  GroupLeaderboardEntry: GroupLeaderboardEntry;
  ID: Scalars['ID'];
  InstanceEvaluation: InstanceEvaluation;
  InstanceResult: InstanceResult;
  Int: Scalars['Int'];
  Json: Scalars['Json'];
  LeaderboardEntry: LeaderboardEntry;
  LeaderboardStatistics: LeaderboardStatistics;
  LearningElement: LearningElement;
  LeaveCourseParticipation: LeaveCourseParticipation;
  MicroSession: MicroSession;
  Mutation: {};
  NumericalQuestionData: NumericalQuestionData;
  NumericalQuestionOptions: NumericalQuestionOptions;
  NumericalRestrictions: NumericalRestrictions;
  NumericalRestrictionsInput: NumericalRestrictionsInput;
  NumericalSolutionRange: NumericalSolutionRange;
  OptionsChoicesInput: OptionsChoicesInput;
  OptionsFreeTextInput: OptionsFreeTextInput;
  OptionsNumericalInput: OptionsNumericalInput;
  Participant: Participant;
  ParticipantAchievementInstance: ParticipantAchievementInstance;
  ParticipantGroup: ParticipantGroup;
  ParticipantLearningData: ParticipantLearningData;
  Participation: Participation;
  PushSubscription: PushSubscription;
  Query: {};
  Question: Question;
  QuestionData: ResolversParentTypes['ChoicesQuestionData'] | ResolversParentTypes['FreeTextQuestionData'] | ResolversParentTypes['NumericalQuestionData'];
  QuestionFeedback: QuestionFeedback;
  QuestionInstance: QuestionInstance;
  QuestionResponse: QuestionResponse;
  QuestionResponseDetail: QuestionResponseDetail;
  ResponseInput: ResponseInput;
  Session: Session;
  SessionBlock: SessionBlock;
  SessionEvaluation: SessionEvaluation;
  SolutionRangeInput: SolutionRangeInput;
  Statistics: Statistics;
  String: Scalars['String'];
  SubscriptionKeysInput: SubscriptionKeysInput;
  SubscriptionObjectInput: SubscriptionObjectInput;
  TabData: TabData;
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
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  href?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  originalName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AttachmentInstanceResolvers<ContextType = any, ParentType extends ResolversParentTypes['AttachmentInstance'] = ResolversParentTypes['AttachmentInstance']> = {
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  href?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  originalName?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type AwardEntryResolvers<ContextType = any, ParentType extends ResolversParentTypes['AwardEntry'] = ResolversParentTypes['AwardEntry']> = {
  description?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  order?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  participant?: Resolver<ResolversTypes['Participant'], ParentType, ContextType>;
  participantGroup?: Resolver<ResolversTypes['ParticipantGroup'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ChoiceResolvers<ContextType = any, ParentType extends ResolversParentTypes['Choice'] = ResolversParentTypes['Choice']> = {
  correct?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  feedback?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  ix?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  value?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ChoiceQuestionOptionsResolvers<ContextType = any, ParentType extends ResolversParentTypes['ChoiceQuestionOptions'] = ResolversParentTypes['ChoiceQuestionOptions']> = {
  choices?: Resolver<Array<ResolversTypes['Choice']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ChoicesQuestionDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['ChoicesQuestionData'] = ResolversParentTypes['ChoicesQuestionData']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  options?: Resolver<ResolversTypes['ChoiceQuestionOptions'], ParentType, ContextType>;
  pointsMultiplier?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ClassAchievementInstanceResolvers<ContextType = any, ParentType extends ResolversParentTypes['ClassAchievementInstance'] = ResolversParentTypes['ClassAchievementInstance']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ConfusionTimestepResolvers<ContextType = any, ParentType extends ResolversParentTypes['ConfusionTimestep'] = ResolversParentTypes['ConfusionTimestep']> = {
  createdAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  difficulty?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  numberOfParticipants?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  speed?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type CourseResolvers<ContextType = any, ParentType extends ResolversParentTypes['Course'] = ResolversParentTypes['Course']> = {
  averageActiveScore?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  averageScore?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  awards?: Resolver<Array<ResolversTypes['AwardEntry']>, ParentType, ContextType>;
  color?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isArchived?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  leaderboard?: Resolver<Array<ResolversTypes['LeaderboardEntry']>, ParentType, ContextType>;
  learningElements?: Resolver<Array<ResolversTypes['LearningElement']>, ParentType, ContextType>;
  microSessions?: Resolver<Array<ResolversTypes['MicroSession']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  numOfActiveParticipants?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  numOfParticipants?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pinCode?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  sessions?: Resolver<Array<ResolversTypes['Session']>, ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface DateScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Date'], any> {
  name: 'Date';
}

export type EvaluationBlockResolvers<ContextType = any, ParentType extends ResolversParentTypes['EvaluationBlock'] = ResolversParentTypes['EvaluationBlock']> = {
  blockIx?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  blockStatus?: Resolver<ResolversTypes['SessionBlockStatus'], ParentType, ContextType>;
  tabData?: Resolver<Array<ResolversTypes['TabData']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FeedbackResolvers<ContextType = any, ParentType extends ResolversParentTypes['Feedback'] = ResolversParentTypes['Feedback']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isPinned?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isPublished?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isResolved?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  resolvedAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  responses?: Resolver<Array<ResolversTypes['FeedbackResponse']>, ParentType, ContextType>;
  votes?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FeedbackResponseResolvers<ContextType = any, ParentType extends ResolversParentTypes['FeedbackResponse'] = ResolversParentTypes['FeedbackResponse']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  createdAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  negativeReactions?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  positiveReactions?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FreeTextQuestionDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['FreeTextQuestionData'] = ResolversParentTypes['FreeTextQuestionData']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  options?: Resolver<ResolversTypes['FreeTextQuestionOptions'], ParentType, ContextType>;
  pointsMultiplier?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FreeTextQuestionOptionsResolvers<ContextType = any, ParentType extends ResolversParentTypes['FreeTextQuestionOptions'] = ResolversParentTypes['FreeTextQuestionOptions']> = {
  restrictions?: Resolver<ResolversTypes['FreeTextRestrictions'], ParentType, ContextType>;
  solutions?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type FreeTextRestrictionsResolvers<ContextType = any, ParentType extends ResolversParentTypes['FreeTextRestrictions'] = ResolversParentTypes['FreeTextRestrictions']> = {
  maxLength?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
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
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GroupActivityClueAssignmentResolvers<ContextType = any, ParentType extends ResolversParentTypes['GroupActivityClueAssignment'] = ResolversParentTypes['GroupActivityClueAssignment']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GroupActivityClueInstanceResolvers<ContextType = any, ParentType extends ResolversParentTypes['GroupActivityClueInstance'] = ResolversParentTypes['GroupActivityClueInstance']> = {
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  participant?: Resolver<ResolversTypes['Participant'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['ParameterType'], ParentType, ContextType>;
  unit?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  value?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GroupActivityDetailsResolvers<ContextType = any, ParentType extends ResolversParentTypes['GroupActivityDetails'] = ResolversParentTypes['GroupActivityDetails']> = {
  activityInstance?: Resolver<Maybe<ResolversTypes['GroupActivityInstance']>, ParentType, ContextType>;
  clues?: Resolver<Array<ResolversTypes['GroupActivityClue']>, ParentType, ContextType>;
  course?: Resolver<ResolversTypes['Course'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  group?: Resolver<ResolversTypes['ParticipantGroup'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  instances?: Resolver<Array<ResolversTypes['QuestionInstance']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  scheduledEndAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  scheduledStartAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GroupActivityInstanceResolvers<ContextType = any, ParentType extends ResolversParentTypes['GroupActivityInstance'] = ResolversParentTypes['GroupActivityInstance']> = {
  clues?: Resolver<Array<ResolversTypes['GroupActivityClueInstance']>, ParentType, ContextType>;
  decisions?: Resolver<Maybe<ResolversTypes['Json']>, ParentType, ContextType>;
  decisionsSubmittedAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GroupActivityParameterResolvers<ContextType = any, ParentType extends ResolversParentTypes['GroupActivityParameter'] = ResolversParentTypes['GroupActivityParameter']> = {
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type GroupLeaderboardEntryResolvers<ContextType = any, ParentType extends ResolversParentTypes['GroupLeaderboardEntry'] = ResolversParentTypes['GroupLeaderboardEntry']> = {
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isMember?: Resolver<Maybe<ResolversTypes['Boolean']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  score?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type InstanceEvaluationResolvers<ContextType = any, ParentType extends ResolversParentTypes['InstanceEvaluation'] = ResolversParentTypes['InstanceEvaluation']> = {
  choices?: Resolver<ResolversTypes['Json'], ParentType, ContextType>;
  feedbacks?: Resolver<Maybe<Array<ResolversTypes['QuestionFeedback']>>, ParentType, ContextType>;
  newPointsFrom?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  percentile?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  pointsAwarded?: Resolver<Maybe<ResolversTypes['Float']>, ParentType, ContextType>;
  score?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type InstanceResultResolvers<ContextType = any, ParentType extends ResolversParentTypes['InstanceResult'] = ResolversParentTypes['InstanceResult']> = {
  blockIx?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  instanceIx?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  participants?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  questionData?: Resolver<ResolversTypes['QuestionData'], ParentType, ContextType>;
  results?: Resolver<ResolversTypes['Json'], ParentType, ContextType>;
  statistics?: Resolver<ResolversTypes['Statistics'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SessionBlockStatus'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export interface JsonScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Json'], any> {
  name: 'Json';
}

export type LeaderboardEntryResolvers<ContextType = any, ParentType extends ResolversParentTypes['LeaderboardEntry'] = ResolversParentTypes['LeaderboardEntry']> = {
  avatar?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  isSelf?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  lastBlockOrder?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  participant?: Resolver<ResolversTypes['Participant'], ParentType, ContextType>;
  participantId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  participation?: Resolver<ResolversTypes['Participation'], ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  score?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  username?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LeaderboardStatisticsResolvers<ContextType = any, ParentType extends ResolversParentTypes['LeaderboardStatistics'] = ResolversParentTypes['LeaderboardStatistics']> = {
  averageScore?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  participantCount?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LearningElementResolvers<ContextType = any, ParentType extends ResolversParentTypes['LearningElement'] = ResolversParentTypes['LearningElement']> = {
  course?: Resolver<ResolversTypes['Course'], ParentType, ContextType>;
  courseId?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  instances?: Resolver<Array<ResolversTypes['QuestionInstance']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  numOfInstances?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  orderType?: Resolver<ResolversTypes['LearningElementOrderType'], ParentType, ContextType>;
  pointsMultiplier?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  previousPointsAwarded?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  previousScore?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  previouslyAnswered?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  resetTimeDays?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  totalTrials?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type LeaveCourseParticipationResolvers<ContextType = any, ParentType extends ResolversParentTypes['LeaveCourseParticipation'] = ResolversParentTypes['LeaveCourseParticipation']> = {
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  participation?: Resolver<ResolversTypes['Participation'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MicroSessionResolvers<ContextType = any, ParentType extends ResolversParentTypes['MicroSession'] = ResolversParentTypes['MicroSession']> = {
  course?: Resolver<ResolversTypes['Course'], ParentType, ContextType>;
  description?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  displayName?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  instances?: Resolver<Array<ResolversTypes['QuestionInstance']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  numOfInstances?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pointsMultiplier?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  scheduledEndAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  scheduledStartAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type MutationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Mutation'] = ResolversParentTypes['Mutation']> = {
  activateSessionBlock?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationActivateSessionBlockArgs, 'sessionBlockId' | 'sessionId'>>;
  addConfusionTimestep?: Resolver<Maybe<ResolversTypes['ConfusionTimestep']>, ParentType, ContextType, RequireFields<MutationAddConfusionTimestepArgs, 'difficulty' | 'sessionId' | 'speed'>>;
  cancelSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationCancelSessionArgs, 'id'>>;
  changeCourseColor?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType, RequireFields<MutationChangeCourseColorArgs, 'color' | 'courseId'>>;
  changeCourseDescription?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType, RequireFields<MutationChangeCourseDescriptionArgs, 'courseId' | 'input'>>;
  changeSessionSettings?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationChangeSessionSettingsArgs, 'id'>>;
  createFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationCreateFeedbackArgs, 'content' | 'sessionId'>>;
  createLearningElement?: Resolver<Maybe<ResolversTypes['LearningElement']>, ParentType, ContextType, RequireFields<MutationCreateLearningElementArgs, 'displayName' | 'multiplier' | 'name' | 'order' | 'questions' | 'resetTimeDays'>>;
  createMicroSession?: Resolver<Maybe<ResolversTypes['MicroSession']>, ParentType, ContextType, RequireFields<MutationCreateMicroSessionArgs, 'displayName' | 'endDate' | 'multiplier' | 'name' | 'questions' | 'startDate'>>;
  createParticipantAndJoinCourse?: Resolver<Maybe<ResolversTypes['Participant']>, ParentType, ContextType, RequireFields<MutationCreateParticipantAndJoinCourseArgs, 'courseId' | 'password' | 'pin' | 'username'>>;
  createParticipantGroup?: Resolver<Maybe<ResolversTypes['ParticipantGroup']>, ParentType, ContextType, RequireFields<MutationCreateParticipantGroupArgs, 'courseId' | 'name'>>;
  createSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationCreateSessionArgs, 'blocks' | 'displayName' | 'multiplier' | 'name'>>;
  deactivateSessionBlock?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationDeactivateSessionBlockArgs, 'sessionBlockId' | 'sessionId'>>;
  deleteFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationDeleteFeedbackArgs, 'id'>>;
  deleteFeedbackResponse?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationDeleteFeedbackResponseArgs, 'id'>>;
  deleteQuestion?: Resolver<Maybe<ResolversTypes['Question']>, ParentType, ContextType, RequireFields<MutationDeleteQuestionArgs, 'id'>>;
  deleteTag?: Resolver<Maybe<ResolversTypes['Tag']>, ParentType, ContextType, RequireFields<MutationDeleteTagArgs, 'id'>>;
  editMicroSession?: Resolver<Maybe<ResolversTypes['MicroSession']>, ParentType, ContextType, RequireFields<MutationEditMicroSessionArgs, 'displayName' | 'endDate' | 'id' | 'multiplier' | 'name' | 'questions' | 'startDate'>>;
  editSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationEditSessionArgs, 'blocks' | 'displayName' | 'id' | 'multiplier' | 'name'>>;
  editTag?: Resolver<Maybe<ResolversTypes['Tag']>, ParentType, ContextType, RequireFields<MutationEditTagArgs, 'id' | 'name'>>;
  endSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationEndSessionArgs, 'id'>>;
  generateLoginToken?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  joinCourse?: Resolver<Maybe<ResolversTypes['ParticipantLearningData']>, ParentType, ContextType, RequireFields<MutationJoinCourseArgs, 'courseId'>>;
  joinCourseWithPin?: Resolver<Maybe<ResolversTypes['Participant']>, ParentType, ContextType, RequireFields<MutationJoinCourseWithPinArgs, 'courseId' | 'pin'>>;
  joinParticipantGroup?: Resolver<Maybe<ResolversTypes['ParticipantGroup']>, ParentType, ContextType, RequireFields<MutationJoinParticipantGroupArgs, 'code' | 'courseId'>>;
  leaveCourse?: Resolver<Maybe<ResolversTypes['LeaveCourseParticipation']>, ParentType, ContextType, RequireFields<MutationLeaveCourseArgs, 'courseId'>>;
  leaveParticipantGroup?: Resolver<Maybe<ResolversTypes['ParticipantGroup']>, ParentType, ContextType, RequireFields<MutationLeaveParticipantGroupArgs, 'courseId' | 'groupId'>>;
  loginParticipant?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType, RequireFields<MutationLoginParticipantArgs, 'password' | 'username'>>;
  loginUser?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType, RequireFields<MutationLoginUserArgs, 'email' | 'password'>>;
  loginUserToken?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType, RequireFields<MutationLoginUserTokenArgs, 'email' | 'token'>>;
  logoutParticipant?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  logoutUser?: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  manipulateChoicesQuestion?: Resolver<Maybe<ResolversTypes['Question']>, ParentType, ContextType, RequireFields<MutationManipulateChoicesQuestionArgs, 'type'>>;
  manipulateFreeTextQuestion?: Resolver<Maybe<ResolversTypes['Question']>, ParentType, ContextType, RequireFields<MutationManipulateFreeTextQuestionArgs, 'type'>>;
  manipulateNumericalQuestion?: Resolver<Maybe<ResolversTypes['Question']>, ParentType, ContextType, RequireFields<MutationManipulateNumericalQuestionArgs, 'type'>>;
  markMicroSessionCompleted?: Resolver<Maybe<ResolversTypes['Participation']>, ParentType, ContextType, RequireFields<MutationMarkMicroSessionCompletedArgs, 'courseId' | 'id'>>;
  pinFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationPinFeedbackArgs, 'id' | 'isPinned'>>;
  publishFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationPublishFeedbackArgs, 'id' | 'isPublished'>>;
  registerParticipantFromLTI?: Resolver<Maybe<ResolversTypes['ParticipantLearningData']>, ParentType, ContextType, RequireFields<MutationRegisterParticipantFromLtiArgs, 'courseId' | 'participantId'>>;
  resolveFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationResolveFeedbackArgs, 'id' | 'isResolved'>>;
  respondToFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationRespondToFeedbackArgs, 'id' | 'responseContent'>>;
  respondToQuestionInstance?: Resolver<Maybe<ResolversTypes['QuestionInstance']>, ParentType, ContextType, RequireFields<MutationRespondToQuestionInstanceArgs, 'courseId' | 'id' | 'response'>>;
  startGroupActivity?: Resolver<Maybe<ResolversTypes['GroupActivityDetails']>, ParentType, ContextType, RequireFields<MutationStartGroupActivityArgs, 'activityId' | 'groupId'>>;
  startSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<MutationStartSessionArgs, 'id'>>;
  submitGroupActivityDecisions?: Resolver<Maybe<ResolversTypes['GroupActivityInstance']>, ParentType, ContextType, RequireFields<MutationSubmitGroupActivityDecisionsArgs, 'activityInstanceId' | 'decisions'>>;
  subscribeToPush?: Resolver<Maybe<ResolversTypes['Participation']>, ParentType, ContextType, RequireFields<MutationSubscribeToPushArgs, 'courseId' | 'subscriptionObject'>>;
  updateParticipantProfile?: Resolver<Maybe<ResolversTypes['Participant']>, ParentType, ContextType, Partial<MutationUpdateParticipantProfileArgs>>;
  upvoteFeedback?: Resolver<Maybe<ResolversTypes['Feedback']>, ParentType, ContextType, RequireFields<MutationUpvoteFeedbackArgs, 'feedbackId' | 'increment'>>;
  voteFeedbackResponse?: Resolver<Maybe<ResolversTypes['FeedbackResponse']>, ParentType, ContextType, RequireFields<MutationVoteFeedbackResponseArgs, 'id' | 'incrementDownvote' | 'incrementUpvote'>>;
};

export type NumericalQuestionDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['NumericalQuestionData'] = ResolversParentTypes['NumericalQuestionData']> = {
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  options?: Resolver<ResolversTypes['NumericalQuestionOptions'], ParentType, ContextType>;
  pointsMultiplier?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type NumericalQuestionOptionsResolvers<ContextType = any, ParentType extends ResolversParentTypes['NumericalQuestionOptions'] = ResolversParentTypes['NumericalQuestionOptions']> = {
  accuracy?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  placeholder?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  restrictions?: Resolver<ResolversTypes['NumericalRestrictions'], ParentType, ContextType>;
  solutionRanges?: Resolver<Array<ResolversTypes['NumericalSolutionRange']>, ParentType, ContextType>;
  unit?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type NumericalRestrictionsResolvers<ContextType = any, ParentType extends ResolversParentTypes['NumericalRestrictions'] = ResolversParentTypes['NumericalRestrictions']> = {
  max?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  min?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type NumericalSolutionRangeResolvers<ContextType = any, ParentType extends ResolversParentTypes['NumericalSolutionRange'] = ResolversParentTypes['NumericalSolutionRange']> = {
  max?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  min?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ParticipantResolvers<ContextType = any, ParentType extends ResolversParentTypes['Participant'] = ResolversParentTypes['Participant']> = {
  achievements?: Resolver<Array<ResolversTypes['ParticipantAchievementInstance']>, ParentType, ContextType>;
  avatar?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  avatarSettings?: Resolver<ResolversTypes['Json'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  isSelf?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  lastLoginAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  level?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  participantGroups?: Resolver<Array<ResolversTypes['ParticipantGroup']>, ParentType, ContextType>;
  rank?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  score?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
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
  averageMemberScore?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  code?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  groupActivityScore?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  participants?: Resolver<Array<ResolversTypes['Participant']>, ParentType, ContextType>;
  score?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ParticipantLearningDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['ParticipantLearningData'] = ResolversParentTypes['ParticipantLearningData']> = {
  course?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType>;
  groupLeaderboard?: Resolver<Maybe<Array<ResolversTypes['GroupLeaderboardEntry']>>, ParentType, ContextType>;
  groupLeaderboardStatistics?: Resolver<Maybe<ResolversTypes['LeaderboardStatistics']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  leaderboard?: Resolver<Maybe<Array<ResolversTypes['LeaderboardEntry']>>, ParentType, ContextType>;
  leaderboardStatistics?: Resolver<Maybe<ResolversTypes['LeaderboardStatistics']>, ParentType, ContextType>;
  participant?: Resolver<Maybe<ResolversTypes['Participant']>, ParentType, ContextType>;
  participantToken?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  participation?: Resolver<Maybe<ResolversTypes['Participation']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type ParticipationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Participation'] = ResolversParentTypes['Participation']> = {
  completedMicroSessions?: Resolver<Array<ResolversTypes['String']>, ParentType, ContextType>;
  course?: Resolver<ResolversTypes['Course'], ParentType, ContextType>;
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
  cockpitSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<QueryCockpitSessionArgs, 'id'>>;
  controlCourse?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType, RequireFields<QueryControlCourseArgs, 'id'>>;
  controlCourses?: Resolver<Maybe<Array<ResolversTypes['Course']>>, ParentType, ContextType>;
  controlSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<QueryControlSessionArgs, 'id'>>;
  course?: Resolver<Maybe<ResolversTypes['Course']>, ParentType, ContextType, RequireFields<QueryCourseArgs, 'id'>>;
  feedbacks?: Resolver<Maybe<Array<ResolversTypes['Feedback']>>, ParentType, ContextType, RequireFields<QueryFeedbacksArgs, 'id'>>;
  getCourseOverviewData?: Resolver<Maybe<ResolversTypes['ParticipantLearningData']>, ParentType, ContextType, RequireFields<QueryGetCourseOverviewDataArgs, 'courseId'>>;
  getLoginToken?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  groupActivityDetails?: Resolver<Maybe<ResolversTypes['GroupActivityDetails']>, ParentType, ContextType, RequireFields<QueryGroupActivityDetailsArgs, 'activityId' | 'groupId'>>;
  learningElement?: Resolver<Maybe<ResolversTypes['LearningElement']>, ParentType, ContextType, RequireFields<QueryLearningElementArgs, 'id'>>;
  learningElements?: Resolver<Maybe<Array<ResolversTypes['LearningElement']>>, ParentType, ContextType>;
  liveSession?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<QueryLiveSessionArgs, 'id'>>;
  microSession?: Resolver<Maybe<ResolversTypes['MicroSession']>, ParentType, ContextType, RequireFields<QueryMicroSessionArgs, 'id'>>;
  participantGroups?: Resolver<Maybe<Array<ResolversTypes['ParticipantGroup']>>, ParentType, ContextType, RequireFields<QueryParticipantGroupsArgs, 'courseId'>>;
  participations?: Resolver<Maybe<Array<ResolversTypes['Participation']>>, ParentType, ContextType, Partial<QueryParticipationsArgs>>;
  pinnedFeedbacks?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<QueryPinnedFeedbacksArgs, 'id'>>;
  question?: Resolver<Maybe<ResolversTypes['Question']>, ParentType, ContextType, RequireFields<QueryQuestionArgs, 'id'>>;
  runningSessions?: Resolver<Maybe<Array<ResolversTypes['Session']>>, ParentType, ContextType, RequireFields<QueryRunningSessionsArgs, 'shortname'>>;
  self?: Resolver<Maybe<ResolversTypes['Participant']>, ParentType, ContextType>;
  session?: Resolver<Maybe<ResolversTypes['Session']>, ParentType, ContextType, RequireFields<QuerySessionArgs, 'id'>>;
  sessionEvaluation?: Resolver<Maybe<ResolversTypes['SessionEvaluation']>, ParentType, ContextType, RequireFields<QuerySessionEvaluationArgs, 'id'>>;
  sessionLeaderboard?: Resolver<Maybe<Array<ResolversTypes['LeaderboardEntry']>>, ParentType, ContextType, RequireFields<QuerySessionLeaderboardArgs, 'sessionId'>>;
  singleMicroSession?: Resolver<Maybe<ResolversTypes['MicroSession']>, ParentType, ContextType, RequireFields<QuerySingleMicroSessionArgs, 'id'>>;
  unassignedSessions?: Resolver<Maybe<Array<ResolversTypes['Session']>>, ParentType, ContextType>;
  userCourses?: Resolver<Maybe<Array<ResolversTypes['Course']>>, ParentType, ContextType>;
  userProfile?: Resolver<Maybe<ResolversTypes['User']>, ParentType, ContextType>;
  userQuestions?: Resolver<Maybe<Array<ResolversTypes['Question']>>, ParentType, ContextType>;
  userSessions?: Resolver<Maybe<Array<ResolversTypes['Session']>>, ParentType, ContextType>;
  userTags?: Resolver<Maybe<Array<ResolversTypes['Tag']>>, ParentType, ContextType>;
};

export type QuestionResolvers<ContextType = any, ParentType extends ResolversParentTypes['Question'] = ResolversParentTypes['Question']> = {
  attachments?: Resolver<Array<ResolversTypes['Attachment']>, ParentType, ContextType>;
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
  questionData?: Resolver<ResolversTypes['QuestionData'], ParentType, ContextType>;
  tags?: Resolver<Array<ResolversTypes['Tag']>, ParentType, ContextType>;
  type?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  updatedAt?: Resolver<ResolversTypes['Date'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type QuestionDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['QuestionData'] = ResolversParentTypes['QuestionData']> = {
  __resolveType: TypeResolveFn<'ChoicesQuestionData' | 'FreeTextQuestionData' | 'NumericalQuestionData', ParentType, ContextType>;
  content?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  pointsMultiplier?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
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
  attachments?: Resolver<Array<ResolversTypes['AttachmentInstance']>, ParentType, ContextType>;
  evaluation?: Resolver<Maybe<ResolversTypes['InstanceEvaluation']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  pointsMultiplier?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  questionData?: Resolver<ResolversTypes['QuestionData'], ParentType, ContextType>;
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
  isConfusionFeedbackEnabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isGamificationEnabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isLiveQAEnabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  isModerationEnabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  linkTo?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  linkToJoin?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  namespace?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  numOfBlocks?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  numOfQuestions?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pinCode?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pointsMultiplier?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  startedAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SessionStatus'], ParentType, ContextType>;
  updatedAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SessionBlockResolvers<ContextType = any, ParentType extends ResolversParentTypes['SessionBlock'] = ResolversParentTypes['SessionBlock']> = {
  execution?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  expiresAt?: Resolver<Maybe<ResolversTypes['Date']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  instances?: Resolver<Array<ResolversTypes['QuestionInstance']>, ParentType, ContextType>;
  order?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  randomSelection?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SessionBlockStatus'], ParentType, ContextType>;
  timeLimit?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type SessionEvaluationResolvers<ContextType = any, ParentType extends ResolversParentTypes['SessionEvaluation'] = ResolversParentTypes['SessionEvaluation']> = {
  blocks?: Resolver<Array<ResolversTypes['EvaluationBlock']>, ParentType, ContextType>;
  confusionFeedbacks?: Resolver<Array<ResolversTypes['ConfusionTimestep']>, ParentType, ContextType>;
  feedbacks?: Resolver<Array<ResolversTypes['Feedback']>, ParentType, ContextType>;
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  instanceResults?: Resolver<Array<ResolversTypes['InstanceResult']>, ParentType, ContextType>;
  isGamificationEnabled?: Resolver<ResolversTypes['Boolean'], ParentType, ContextType>;
  status?: Resolver<ResolversTypes['SessionStatus'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type StatisticsResolvers<ContextType = any, ParentType extends ResolversParentTypes['Statistics'] = ResolversParentTypes['Statistics']> = {
  max?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  mean?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  median?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  min?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  q1?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  q3?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  sd?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
};

export type TabDataResolvers<ContextType = any, ParentType extends ResolversParentTypes['TabData'] = ResolversParentTypes['TabData']> = {
  id?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  name?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  questionIx?: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  status?: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
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
  Choice?: ChoiceResolvers<ContextType>;
  ChoiceQuestionOptions?: ChoiceQuestionOptionsResolvers<ContextType>;
  ChoicesQuestionData?: ChoicesQuestionDataResolvers<ContextType>;
  ClassAchievementInstance?: ClassAchievementInstanceResolvers<ContextType>;
  ConfusionTimestep?: ConfusionTimestepResolvers<ContextType>;
  Course?: CourseResolvers<ContextType>;
  Date?: GraphQLScalarType;
  EvaluationBlock?: EvaluationBlockResolvers<ContextType>;
  Feedback?: FeedbackResolvers<ContextType>;
  FeedbackResponse?: FeedbackResponseResolvers<ContextType>;
  FreeTextQuestionData?: FreeTextQuestionDataResolvers<ContextType>;
  FreeTextQuestionOptions?: FreeTextQuestionOptionsResolvers<ContextType>;
  FreeTextRestrictions?: FreeTextRestrictionsResolvers<ContextType>;
  GroupAchievementInstance?: GroupAchievementInstanceResolvers<ContextType>;
  GroupActivity?: GroupActivityResolvers<ContextType>;
  GroupActivityClue?: GroupActivityClueResolvers<ContextType>;
  GroupActivityClueAssignment?: GroupActivityClueAssignmentResolvers<ContextType>;
  GroupActivityClueInstance?: GroupActivityClueInstanceResolvers<ContextType>;
  GroupActivityDetails?: GroupActivityDetailsResolvers<ContextType>;
  GroupActivityInstance?: GroupActivityInstanceResolvers<ContextType>;
  GroupActivityParameter?: GroupActivityParameterResolvers<ContextType>;
  GroupLeaderboardEntry?: GroupLeaderboardEntryResolvers<ContextType>;
  InstanceEvaluation?: InstanceEvaluationResolvers<ContextType>;
  InstanceResult?: InstanceResultResolvers<ContextType>;
  Json?: GraphQLScalarType;
  LeaderboardEntry?: LeaderboardEntryResolvers<ContextType>;
  LeaderboardStatistics?: LeaderboardStatisticsResolvers<ContextType>;
  LearningElement?: LearningElementResolvers<ContextType>;
  LeaveCourseParticipation?: LeaveCourseParticipationResolvers<ContextType>;
  MicroSession?: MicroSessionResolvers<ContextType>;
  Mutation?: MutationResolvers<ContextType>;
  NumericalQuestionData?: NumericalQuestionDataResolvers<ContextType>;
  NumericalQuestionOptions?: NumericalQuestionOptionsResolvers<ContextType>;
  NumericalRestrictions?: NumericalRestrictionsResolvers<ContextType>;
  NumericalSolutionRange?: NumericalSolutionRangeResolvers<ContextType>;
  Participant?: ParticipantResolvers<ContextType>;
  ParticipantAchievementInstance?: ParticipantAchievementInstanceResolvers<ContextType>;
  ParticipantGroup?: ParticipantGroupResolvers<ContextType>;
  ParticipantLearningData?: ParticipantLearningDataResolvers<ContextType>;
  Participation?: ParticipationResolvers<ContextType>;
  PushSubscription?: PushSubscriptionResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
  Question?: QuestionResolvers<ContextType>;
  QuestionData?: QuestionDataResolvers<ContextType>;
  QuestionFeedback?: QuestionFeedbackResolvers<ContextType>;
  QuestionInstance?: QuestionInstanceResolvers<ContextType>;
  QuestionResponse?: QuestionResponseResolvers<ContextType>;
  QuestionResponseDetail?: QuestionResponseDetailResolvers<ContextType>;
  Session?: SessionResolvers<ContextType>;
  SessionBlock?: SessionBlockResolvers<ContextType>;
  SessionEvaluation?: SessionEvaluationResolvers<ContextType>;
  Statistics?: StatisticsResolvers<ContextType>;
  TabData?: TabDataResolvers<ContextType>;
  Tag?: TagResolvers<ContextType>;
  Title?: TitleResolvers<ContextType>;
  User?: UserResolvers<ContextType>;
};


export const FeedbackDataFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"FeedbackData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Feedback"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]} as unknown as DocumentNode<FeedbackDataFragment, unknown>;
export const QuestionDataFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionData"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"accuracy"}},{"kind":"Field","name":{"kind":"Name","value":"placeholder"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}}]}}]}}]} as unknown as DocumentNode<QuestionDataFragment, unknown>;
export const QuestionDataWithoutSolutionsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"QuestionDataWithoutSolutions"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionInstance"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}}]}}]}}]}}]}}]} as unknown as DocumentNode<QuestionDataWithoutSolutionsFragment, unknown>;
export const ActivateSessionBlockDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ActivateSessionBlock"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionBlockId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"activateSessionBlock"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"sessionBlockId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionBlockId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]}}]} as unknown as DocumentNode<ActivateSessionBlockMutation, ActivateSessionBlockMutationVariables>;
export const AddConfusionTimestepDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"AddConfusionTimestep"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"difficulty"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"speed"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"addConfusionTimestep"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"difficulty"},"value":{"kind":"Variable","name":{"kind":"Name","value":"difficulty"}}},{"kind":"Argument","name":{"kind":"Name","value":"speed"},"value":{"kind":"Variable","name":{"kind":"Name","value":"speed"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"speed"}}]}}]}}]} as unknown as DocumentNode<AddConfusionTimestepMutation, AddConfusionTimestepMutationVariables>;
export const CancelSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CancelSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cancelSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CancelSessionMutation, CancelSessionMutationVariables>;
export const ChangeCourseColorDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangeCourseColor"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"color"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changeCourseColor"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"color"},"value":{"kind":"Variable","name":{"kind":"Name","value":"color"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}}]}}]} as unknown as DocumentNode<ChangeCourseColorMutation, ChangeCourseColorMutationVariables>;
export const ChangeCourseDescriptionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangeCourseDescription"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changeCourseDescription"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"description"}}]}}]}}]} as unknown as DocumentNode<ChangeCourseDescriptionMutation, ChangeCourseDescriptionMutationVariables>;
export const ChangeSessionSettingsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ChangeSessionSettings"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isLiveQAEnabled"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isModerationEnabled"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"changeSessionSettings"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"isLiveQAEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isLiveQAEnabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"isModerationEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isModerationEnabled"}}},{"kind":"Argument","name":{"kind":"Name","value":"isGamificationEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isLiveQAEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isModerationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}}]}}]}}]} as unknown as DocumentNode<ChangeSessionSettingsMutation, ChangeSessionSettingsMutationVariables>;
export const CreateFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"content"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"content"},"value":{"kind":"Variable","name":{"kind":"Name","value":"content"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<CreateFeedbackMutation, CreateFeedbackMutationVariables>;
export const CreateLearningElementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateLearningElement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"questions"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"order"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LearningElementOrderType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"resetTimeDays"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createLearningElement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"displayName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"questions"},"value":{"kind":"Variable","name":{"kind":"Name","value":"questions"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"multiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"order"},"value":{"kind":"Variable","name":{"kind":"Name","value":"order"}}},{"kind":"Argument","name":{"kind":"Name","value":"resetTimeDays"},"value":{"kind":"Variable","name":{"kind":"Name","value":"resetTimeDays"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreateLearningElementMutation, CreateLearningElementMutationVariables>;
export const CreateMicroSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateMicroSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"questions"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createMicroSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"displayName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"questions"},"value":{"kind":"Variable","name":{"kind":"Name","value":"questions"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"multiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"startDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startDate"}}},{"kind":"Argument","name":{"kind":"Name","value":"endDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreateMicroSessionMutation, CreateMicroSessionMutationVariables>;
export const CreateParticipantAndJoinCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateParticipantAndJoinCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pin"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createParticipantAndJoinCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"pin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}}]}}]} as unknown as DocumentNode<CreateParticipantAndJoinCourseMutation, CreateParticipantAndJoinCourseMutationVariables>;
export const CreateParticipantGroupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateParticipantGroup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createParticipantGroup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]}}]} as unknown as DocumentNode<CreateParticipantGroupMutation, CreateParticipantGroupMutationVariables>;
export const CreateSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"blocks"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"BlockInput"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"displayName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"blocks"},"value":{"kind":"Variable","name":{"kind":"Name","value":"blocks"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"multiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"isGamificationEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<CreateSessionMutation, CreateSessionMutationVariables>;
export const DeactivateSessionBlockDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeactivateSessionBlock"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionBlockId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deactivateSessionBlock"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}},{"kind":"Argument","name":{"kind":"Name","value":"sessionBlockId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionBlockId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"activeBlock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]}}]} as unknown as DocumentNode<DeactivateSessionBlockMutation, DeactivateSessionBlockMutationVariables>;
export const DeleteFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteFeedbackMutation, DeleteFeedbackMutationVariables>;
export const DeleteFeedbackResponseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteFeedbackResponse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteFeedbackResponse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteFeedbackResponseMutation, DeleteFeedbackResponseMutationVariables>;
export const DeleteQuestionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteQuestion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteQuestion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteQuestionMutation, DeleteQuestionMutationVariables>;
export const DeleteTagDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteTag"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteTag"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<DeleteTagMutation, DeleteTagMutationVariables>;
export const EditMicroSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EditMicroSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"questions"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"startDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Date"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"editMicroSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"displayName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"questions"},"value":{"kind":"Variable","name":{"kind":"Name","value":"questions"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"multiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"startDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"startDate"}}},{"kind":"Argument","name":{"kind":"Name","value":"endDate"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endDate"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<EditMicroSessionMutation, EditMicroSessionMutationVariables>;
export const EditSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EditSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"description"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"blocks"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"BlockInput"}}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"editSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"displayName"},"value":{"kind":"Variable","name":{"kind":"Name","value":"displayName"}}},{"kind":"Argument","name":{"kind":"Name","value":"description"},"value":{"kind":"Variable","name":{"kind":"Name","value":"description"}}},{"kind":"Argument","name":{"kind":"Name","value":"blocks"},"value":{"kind":"Variable","name":{"kind":"Name","value":"blocks"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"multiplier"},"value":{"kind":"Variable","name":{"kind":"Name","value":"multiplier"}}},{"kind":"Argument","name":{"kind":"Name","value":"isGamificationEnabled"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isGamificationEnabled"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<EditSessionMutation, EditSessionMutationVariables>;
export const EditTagDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EditTag"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"editTag"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<EditTagMutation, EditTagMutationVariables>;
export const EndSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"EndSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"endSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<EndSessionMutation, EndSessionMutationVariables>;
export const GenerateLoginTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"GenerateLoginToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"generateLoginToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"loginToken"}},{"kind":"Field","name":{"kind":"Name","value":"loginTokenExpiresAt"}}]}}]}}]} as unknown as DocumentNode<GenerateLoginTokenMutation, GenerateLoginTokenMutationVariables>;
export const JoinCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}}]}}]}}]}}]} as unknown as DocumentNode<JoinCourseMutation, JoinCourseMutationVariables>;
export const JoinCourseWithPinDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinCourseWithPin"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"pin"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinCourseWithPin"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"pin"},"value":{"kind":"Variable","name":{"kind":"Name","value":"pin"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<JoinCourseWithPinMutation, JoinCourseWithPinMutationVariables>;
export const JoinParticipantGroupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"JoinParticipantGroup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"code"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"joinParticipantGroup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"code"},"value":{"kind":"Variable","name":{"kind":"Name","value":"code"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]}}]} as unknown as DocumentNode<JoinParticipantGroupMutation, JoinParticipantGroupMutationVariables>;
export const LeaveCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LeaveCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"leaveCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}}]}}]}}]}}]} as unknown as DocumentNode<LeaveCourseMutation, LeaveCourseMutationVariables>;
export const LeaveParticipantGroupDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LeaveParticipantGroup"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"leaveParticipantGroup"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"groupId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}}},{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}}]}}]}}]} as unknown as DocumentNode<LeaveParticipantGroupMutation, LeaveParticipantGroupMutationVariables>;
export const LoginParticipantDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginParticipant"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginParticipant"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}]}]}}]} as unknown as DocumentNode<LoginParticipantMutation, LoginParticipantMutationVariables>;
export const LoginUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginUser"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginUser"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}]}]}}]} as unknown as DocumentNode<LoginUserMutation, LoginUserMutationVariables>;
export const LoginUserTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LoginUserToken"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"email"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"token"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginUserToken"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"email"},"value":{"kind":"Variable","name":{"kind":"Name","value":"email"}}},{"kind":"Argument","name":{"kind":"Name","value":"token"},"value":{"kind":"Variable","name":{"kind":"Name","value":"token"}}}]}]}}]} as unknown as DocumentNode<LoginUserTokenMutation, LoginUserTokenMutationVariables>;
export const LogoutParticipantDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LogoutParticipant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logoutParticipant"}}]}}]} as unknown as DocumentNode<LogoutParticipantMutation, LogoutParticipantMutationVariables>;
export const LogoutUserDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"LogoutUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logoutUser"}}]}}]} as unknown as DocumentNode<LogoutUserMutation, LogoutUserMutationVariables>;
export const ManipulateChoicesQuestionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ManipulateChoicesQuestion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"type"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"QuestionType"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"content"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"options"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OptionsChoicesInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasSampleSolution"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"attachments"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AttachmentInput"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tags"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manipulateChoicesQuestion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"Variable","name":{"kind":"Name","value":"type"}}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"content"},"value":{"kind":"Variable","name":{"kind":"Name","value":"content"}}},{"kind":"Argument","name":{"kind":"Name","value":"options"},"value":{"kind":"Variable","name":{"kind":"Name","value":"options"}}},{"kind":"Argument","name":{"kind":"Name","value":"hasSampleSolution"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasSampleSolution"}}},{"kind":"Argument","name":{"kind":"Name","value":"hasAnswerFeedbacks"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasAnswerFeedbacks"}}},{"kind":"Argument","name":{"kind":"Name","value":"attachments"},"value":{"kind":"Variable","name":{"kind":"Name","value":"attachments"}}},{"kind":"Argument","name":{"kind":"Name","value":"tags"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tags"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"href"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"originalName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}}]}}]} as unknown as DocumentNode<ManipulateChoicesQuestionMutation, ManipulateChoicesQuestionMutationVariables>;
export const ManipulateFreeTextQuestionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ManipulateFreeTextQuestion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"content"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"options"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OptionsFreeTextInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasSampleSolution"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"attachments"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AttachmentInput"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tags"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manipulateFreeTextQuestion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"EnumValue","value":"FREE_TEXT"}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"content"},"value":{"kind":"Variable","name":{"kind":"Name","value":"content"}}},{"kind":"Argument","name":{"kind":"Name","value":"options"},"value":{"kind":"Variable","name":{"kind":"Name","value":"options"}}},{"kind":"Argument","name":{"kind":"Name","value":"hasSampleSolution"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasSampleSolution"}}},{"kind":"Argument","name":{"kind":"Name","value":"hasAnswerFeedbacks"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasAnswerFeedbacks"}}},{"kind":"Argument","name":{"kind":"Name","value":"attachments"},"value":{"kind":"Variable","name":{"kind":"Name","value":"attachments"}}},{"kind":"Argument","name":{"kind":"Name","value":"tags"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tags"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"href"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"originalName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}}]}}]} as unknown as DocumentNode<ManipulateFreeTextQuestionMutation, ManipulateFreeTextQuestionMutationVariables>;
export const ManipulateNumericalQuestionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ManipulateNumericalQuestion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"name"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"content"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"options"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"OptionsNumericalInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasSampleSolution"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"attachments"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"AttachmentInput"}}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"tags"}},"type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"manipulateNumericalQuestion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"type"},"value":{"kind":"EnumValue","value":"NUMERICAL"}},{"kind":"Argument","name":{"kind":"Name","value":"name"},"value":{"kind":"Variable","name":{"kind":"Name","value":"name"}}},{"kind":"Argument","name":{"kind":"Name","value":"content"},"value":{"kind":"Variable","name":{"kind":"Name","value":"content"}}},{"kind":"Argument","name":{"kind":"Name","value":"options"},"value":{"kind":"Variable","name":{"kind":"Name","value":"options"}}},{"kind":"Argument","name":{"kind":"Name","value":"hasSampleSolution"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasSampleSolution"}}},{"kind":"Argument","name":{"kind":"Name","value":"hasAnswerFeedbacks"},"value":{"kind":"Variable","name":{"kind":"Name","value":"hasAnswerFeedbacks"}}},{"kind":"Argument","name":{"kind":"Name","value":"attachments"},"value":{"kind":"Variable","name":{"kind":"Name","value":"attachments"}}},{"kind":"Argument","name":{"kind":"Name","value":"tags"},"value":{"kind":"Variable","name":{"kind":"Name","value":"tags"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"href"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"originalName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}}]}}]} as unknown as DocumentNode<ManipulateNumericalQuestionMutation, ManipulateNumericalQuestionMutationVariables>;
export const MarkMicroSessionCompletedDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"MarkMicroSessionCompleted"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"markMicroSessionCompleted"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"completedMicroSessions"}}]}}]}}]} as unknown as DocumentNode<MarkMicroSessionCompletedMutation, MarkMicroSessionCompletedMutationVariables>;
export const PinFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PinFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isPinned"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pinFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"isPinned"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isPinned"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<PinFeedbackMutation, PinFeedbackMutationVariables>;
export const PublishFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"PublishFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isPublished"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publishFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"isPublished"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isPublished"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<PublishFeedbackMutation, PublishFeedbackMutationVariables>;
export const RegisterParticipantFromLtiDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RegisterParticipantFromLTI"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"participantId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"registerParticipantFromLTI"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"participantId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"participantId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participantToken"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]} as unknown as DocumentNode<RegisterParticipantFromLtiMutation, RegisterParticipantFromLtiMutationVariables>;
export const ResolveFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResolveFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"isResolved"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"resolveFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"isResolved"},"value":{"kind":"Variable","name":{"kind":"Name","value":"isResolved"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<ResolveFeedbackMutation, ResolveFeedbackMutationVariables>;
export const RespondToFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RespondToFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"responseContent"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"respondToFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"responseContent"},"value":{"kind":"Variable","name":{"kind":"Name","value":"responseContent"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]}}]} as unknown as DocumentNode<RespondToFeedbackMutation, RespondToFeedbackMutationVariables>;
export const ResponseToQuestionInstanceDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"ResponseToQuestionInstance"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"response"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ResponseInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"respondToQuestionInstance"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"response"},"value":{"kind":"Variable","name":{"kind":"Name","value":"response"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionData"}},{"kind":"Field","name":{"kind":"Name","value":"evaluation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"choices"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}}]}}]}}]}},...QuestionDataFragmentDoc.definitions]} as unknown as DocumentNode<ResponseToQuestionInstanceMutation, ResponseToQuestionInstanceMutationVariables>;
export const StartGroupActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartGroupActivity"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activityId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startGroupActivity"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activityId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activityId"}}},{"kind":"Argument","name":{"kind":"Name","value":"groupId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<StartGroupActivityMutation, StartGroupActivityMutationVariables>;
export const StartSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"StartSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<StartSessionMutation, StartSessionMutationVariables>;
export const SubmitGroupActivityDecisionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SubmitGroupActivityDecisions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activityInstanceId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"decisions"}},"type":{"kind":"NonNullType","type":{"kind":"ListType","type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"GroupActivityDecisionInput"}}}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"submitGroupActivityDecisions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activityInstanceId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activityInstanceId"}}},{"kind":"Argument","name":{"kind":"Name","value":"decisions"},"value":{"kind":"Variable","name":{"kind":"Name","value":"decisions"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}}]}}]} as unknown as DocumentNode<SubmitGroupActivityDecisionsMutation, SubmitGroupActivityDecisionsMutationVariables>;
export const SubscribeToPushDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SubscribeToPush"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"subscriptionObject"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SubscriptionObjectInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"subscribeToPush"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}},{"kind":"Argument","name":{"kind":"Name","value":"subscriptionObject"},"value":{"kind":"Variable","name":{"kind":"Name","value":"subscriptionObject"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"subscriptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"endpoint"}}]}}]}}]}}]} as unknown as DocumentNode<SubscribeToPushMutation, SubscribeToPushMutationVariables>;
export const UpdateParticipantProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateParticipantProfile"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"avatar"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"avatarSettings"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"AvatarSettingsInput"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"password"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateParticipantProfile"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"avatar"},"value":{"kind":"Variable","name":{"kind":"Name","value":"avatar"}}},{"kind":"Argument","name":{"kind":"Name","value":"avatarSettings"},"value":{"kind":"Variable","name":{"kind":"Name","value":"avatarSettings"}}},{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}},{"kind":"Argument","name":{"kind":"Name","value":"password"},"value":{"kind":"Variable","name":{"kind":"Name","value":"password"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"avatarSettings"}}]}}]}}]} as unknown as DocumentNode<UpdateParticipantProfileMutation, UpdateParticipantProfileMutationVariables>;
export const UpvoteFeedbackDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpvoteFeedback"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"feedbackId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"increment"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"upvoteFeedback"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"feedbackId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"feedbackId"}}},{"kind":"Argument","name":{"kind":"Name","value":"increment"},"value":{"kind":"Variable","name":{"kind":"Name","value":"increment"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}}]}}]}}]} as unknown as DocumentNode<UpvoteFeedbackMutation, UpvoteFeedbackMutationVariables>;
export const VoteFeedbackResponseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"VoteFeedbackResponse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"incrementUpvote"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"incrementDownvote"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"voteFeedbackResponse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}},{"kind":"Argument","name":{"kind":"Name","value":"incrementUpvote"},"value":{"kind":"Variable","name":{"kind":"Name","value":"incrementUpvote"}}},{"kind":"Argument","name":{"kind":"Name","value":"incrementDownvote"},"value":{"kind":"Variable","name":{"kind":"Name","value":"incrementDownvote"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]} as unknown as DocumentNode<VoteFeedbackResponseMutation, VoteFeedbackResponseMutationVariables>;
export const GetBasicCourseInformationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetBasicCourseInformation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"basicCourseInformation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}}]}}]} as unknown as DocumentNode<GetBasicCourseInformationQuery, GetBasicCourseInformationQueryVariables>;
export const GetCockpitSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetCockpitSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"cockpitSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isLiveQAEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isModerationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"namespace"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"randomSelection"}},{"kind":"Field","name":{"kind":"Name","value":"execution"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"activeBlock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"confusionFeedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"speed"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"numberOfParticipants"}}]}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetCockpitSessionQuery, GetCockpitSessionQueryVariables>;
export const GetControlCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetControlCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"controlCourse"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"sessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]}}]} as unknown as DocumentNode<GetControlCourseQuery, GetControlCourseQueryVariables>;
export const GetControlCoursesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetControlCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"controlCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}}]}}]}}]} as unknown as DocumentNode<GetControlCoursesQuery, GetControlCoursesQueryVariables>;
export const GetControlSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetControlSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"controlSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"randomSelection"}},{"kind":"Field","name":{"kind":"Name","value":"execution"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"activeBlock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"order"}}]}}]}}]}}]} as unknown as DocumentNode<GetControlSessionQuery, GetControlSessionQueryVariables>;
export const GetCourseOverviewDataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetCourseOverviewData"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getCourseOverviewData"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"username"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"awards"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"order"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}}]}},{"kind":"Field","name":{"kind":"Name","value":"participantGroup"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"leaderboard"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participantId"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"isSelf"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}}]}},{"kind":"Field","name":{"kind":"Name","value":"leaderboardStatistics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"averageScore"}}]}},{"kind":"Field","name":{"kind":"Name","value":"groupLeaderboard"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"score"}}]}},{"kind":"Field","name":{"kind":"Name","value":"groupLeaderboardStatistics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participantCount"}},{"kind":"Field","name":{"kind":"Name","value":"averageScore"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"participantGroups"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"averageMemberScore"}},{"kind":"Field","name":{"kind":"Name","value":"groupActivityScore"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"isSelf"}}]}}]}}]}}]} as unknown as DocumentNode<GetCourseOverviewDataQuery, GetCourseOverviewDataQueryVariables>;
export const GetFeedbacksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetFeedbacks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]}}]} as unknown as DocumentNode<GetFeedbacksQuery, GetFeedbacksQueryVariables>;
export const GetLearningElementDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetLearningElement"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"learningElement"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"resetTimeDays"}},{"kind":"Field","name":{"kind":"Name","value":"orderType"}},{"kind":"Field","name":{"kind":"Name","value":"previouslyAnswered"}},{"kind":"Field","name":{"kind":"Name","value":"previousScore"}},{"kind":"Field","name":{"kind":"Name","value":"previousPointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"totalTrials"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionData"}},{"kind":"Field","name":{"kind":"Name","value":"evaluation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"choices"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}}]}}]}}]}}]}},...QuestionDataFragmentDoc.definitions]} as unknown as DocumentNode<GetLearningElementQuery, GetLearningElementQueryVariables>;
export const GetLearningElementsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetLearningElements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"learningElements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"courseId"}}]}}]}}]} as unknown as DocumentNode<GetLearningElementsQuery, GetLearningElementsQueryVariables>;
export const GetLoginTokenDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetLoginToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"getLoginToken"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"loginToken"}},{"kind":"Field","name":{"kind":"Name","value":"loginTokenExpiresAt"}}]}}]}}]} as unknown as DocumentNode<GetLoginTokenQuery, GetLoginTokenQueryVariables>;
export const GetMicroSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetMicroSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"microSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionData"}},{"kind":"Field","name":{"kind":"Name","value":"evaluation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"choices"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}}]}}]}}]}}]}},...QuestionDataFragmentDoc.definitions]} as unknown as DocumentNode<GetMicroSessionQuery, GetMicroSessionQueryVariables>;
export const GetParticipantGroupsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetParticipantGroups"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participantGroups"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"courseId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"isSelf"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}}]}}]}}]}}]} as unknown as DocumentNode<GetParticipantGroupsQuery, GetParticipantGroupsQueryVariables>;
export const GetPinnedFeedbacksDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetPinnedFeedbacks"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"pinnedFeedbacks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isLiveQAEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isModerationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"confusionFeedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"speed"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"numberOfParticipants"}}]}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetPinnedFeedbacksQuery, GetPinnedFeedbacksQueryVariables>;
export const GetRunningSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRunningSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"session"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isLiveQAEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isConfusionFeedbackEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isModerationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"namespace"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"activeBlock"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"randomSelection"}},{"kind":"Field","name":{"kind":"Name","value":"execution"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"href"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"originalName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionDataWithoutSolutions"}}]}}]}}]}}]}},...QuestionDataWithoutSolutionsFragmentDoc.definitions]} as unknown as DocumentNode<GetRunningSessionQuery, GetRunningSessionQueryVariables>;
export const GetRunningSessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetRunningSessions"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"shortname"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"runningSessions"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"shortname"},"value":{"kind":"Variable","name":{"kind":"Name","value":"shortname"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"linkTo"}}]}}]}}]} as unknown as DocumentNode<GetRunningSessionsQuery, GetRunningSessionsQueryVariables>;
export const GetSessionEvaluationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSessionEvaluation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sessionEvaluation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"blockIx"}},{"kind":"Field","name":{"kind":"Name","value":"blockStatus"}},{"kind":"Field","name":{"kind":"Name","value":"tabData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionIx"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"instanceResults"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"blockIx"}},{"kind":"Field","name":{"kind":"Name","value":"instanceIx"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"participants"}},{"kind":"Field","name":{"kind":"Name","value":"results"}},{"kind":"Field","name":{"kind":"Name","value":"statistics"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"max"}},{"kind":"Field","name":{"kind":"Name","value":"mean"}},{"kind":"Field","name":{"kind":"Name","value":"median"}},{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"q1"}},{"kind":"Field","name":{"kind":"Name","value":"q3"}},{"kind":"Field","name":{"kind":"Name","value":"sd"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isPublished"}},{"kind":"Field","name":{"kind":"Name","value":"isPinned"}},{"kind":"Field","name":{"kind":"Name","value":"isResolved"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"votes"}},{"kind":"Field","name":{"kind":"Name","value":"resolvedAt"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"responses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"positiveReactions"}},{"kind":"Field","name":{"kind":"Name","value":"negativeReactions"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"confusionFeedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"speed"}},{"kind":"Field","name":{"kind":"Name","value":"difficulty"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"sessionLeaderboard"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participantId"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"score"}}]}}]}}]} as unknown as DocumentNode<GetSessionEvaluationQuery, GetSessionEvaluationQueryVariables>;
export const GetSessionLeaderboardDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSessionLeaderboard"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"sessionLeaderboard"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"sessionId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"participantId"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"isSelf"}},{"kind":"Field","name":{"kind":"Name","value":"lastBlockOrder"}}]}}]}}]} as unknown as DocumentNode<GetSessionLeaderboardQuery, GetSessionLeaderboardQueryVariables>;
export const GetSingleCourseDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSingleCourse"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"course"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"courseId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"pinCode"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"color"}},{"kind":"Field","name":{"kind":"Name","value":"numOfParticipants"}},{"kind":"Field","name":{"kind":"Name","value":"numOfActiveParticipants"}},{"kind":"Field","name":{"kind":"Name","value":"averageScore"}},{"kind":"Field","name":{"kind":"Name","value":"averageActiveScore"}},{"kind":"Field","name":{"kind":"Name","value":"sessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}},{"kind":"Field","name":{"kind":"Name","value":"pinCode"}},{"kind":"Field","name":{"kind":"Name","value":"accessMode"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"numOfBlocks"}},{"kind":"Field","name":{"kind":"Name","value":"numOfQuestions"}}]}},{"kind":"Field","name":{"kind":"Name","value":"learningElements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"numOfInstances"}}]}},{"kind":"Field","name":{"kind":"Name","value":"microSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}},{"kind":"Field","name":{"kind":"Name","value":"numOfInstances"}}]}},{"kind":"Field","name":{"kind":"Name","value":"leaderboard"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"rank"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"participation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"isActive"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetSingleCourseQuery, GetSingleCourseQueryVariables>;
export const GetSingleLiveSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSingleLiveSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"liveSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"sessionId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"timeLimit"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"isGamificationEnabled"}}]}}]}}]} as unknown as DocumentNode<GetSingleLiveSessionQuery, GetSingleLiveSessionQueryVariables>;
export const GetSingleMicroSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSingleMicroSession"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"singleMicroSession"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}},{"kind":"Field","name":{"kind":"Name","value":"pointsMultiplier"}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}}]}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]}}]} as unknown as DocumentNode<GetSingleMicroSessionQuery, GetSingleMicroSessionQueryVariables>;
export const GetSingleQuestionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetSingleQuestion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"question"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"ChoicesQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"choices"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"NumericalQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutionRanges"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"min"}},{"kind":"Field","name":{"kind":"Name","value":"max"}}]}}]}}]}},{"kind":"InlineFragment","typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"FreeTextQuestionData"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"options"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"restrictions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"maxLength"}}]}},{"kind":"Field","name":{"kind":"Name","value":"solutions"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"attachments"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"href"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"originalName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"type"}}]}}]}}]}}]} as unknown as DocumentNode<GetSingleQuestionQuery, GetSingleQuestionQueryVariables>;
export const GetUnassignedSessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUnassignedSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"unassignedSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"status"}}]}}]}}]} as unknown as DocumentNode<GetUnassignedSessionsQuery, GetUnassignedSessionsQueryVariables>;
export const GetUserCoursesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userCourses"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"pinCode"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]}}]} as unknown as DocumentNode<GetUserCoursesQuery, GetUserCoursesQueryVariables>;
export const GetUserQuestionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserQuestions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userQuestions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}},{"kind":"Field","name":{"kind":"Name","value":"isArchived"}},{"kind":"Field","name":{"kind":"Name","value":"isDeleted"}},{"kind":"Field","name":{"kind":"Name","value":"hasSampleSolution"}},{"kind":"Field","name":{"kind":"Name","value":"hasAnswerFeedbacks"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"tags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]}}]} as unknown as DocumentNode<GetUserQuestionsQuery, GetUserQuestionsQueryVariables>;
export const GetUserSessionsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"accessMode"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"startedAt"}},{"kind":"Field","name":{"kind":"Name","value":"numOfBlocks"}},{"kind":"Field","name":{"kind":"Name","value":"numOfQuestions"}},{"kind":"Field","name":{"kind":"Name","value":"blocks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"questionData"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"content"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}}]}}]}}]} as unknown as DocumentNode<GetUserSessionsQuery, GetUserSessionsQueryVariables>;
export const GetUserTagsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GetUserTags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userTags"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}}]}}]} as unknown as DocumentNode<GetUserTagsQuery, GetUserTagsQueryVariables>;
export const GroupActivityDetailsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"GroupActivityDetails"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"activityId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"groupActivityDetails"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"activityId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"activityId"}}},{"kind":"Argument","name":{"kind":"Name","value":"groupId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"groupId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}},{"kind":"Field","name":{"kind":"Name","value":"clues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}}]}},{"kind":"Field","name":{"kind":"Name","value":"instances"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"QuestionData"}},{"kind":"Field","name":{"kind":"Name","value":"evaluation"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"feedbacks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"ix"}},{"kind":"Field","name":{"kind":"Name","value":"feedback"}},{"kind":"Field","name":{"kind":"Name","value":"correct"}},{"kind":"Field","name":{"kind":"Name","value":"value"}}]}},{"kind":"Field","name":{"kind":"Name","value":"choices"}},{"kind":"Field","name":{"kind":"Name","value":"score"}},{"kind":"Field","name":{"kind":"Name","value":"pointsAwarded"}},{"kind":"Field","name":{"kind":"Name","value":"percentile"}},{"kind":"Field","name":{"kind":"Name","value":"newPointsFrom"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"color"}}]}},{"kind":"Field","name":{"kind":"Name","value":"group"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"participants"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"isSelf"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"activityInstance"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"clues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"type"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"value"}},{"kind":"Field","name":{"kind":"Name","value":"participant"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"isSelf"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"decisions"}},{"kind":"Field","name":{"kind":"Name","value":"decisionsSubmittedAt"}}]}}]}}]}},...QuestionDataFragmentDoc.definitions]} as unknown as DocumentNode<GroupActivityDetailsQuery, GroupActivityDetailsQueryVariables>;
export const ParticipationsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Participations"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"endpoint"}},"type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"participations"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"endpoint"},"value":{"kind":"Variable","name":{"kind":"Name","value":"endpoint"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"completedMicroSessions"}},{"kind":"Field","name":{"kind":"Name","value":"subscriptions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"endpoint"}}]}},{"kind":"Field","name":{"kind":"Name","value":"course"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"microSessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledStartAt"}},{"kind":"Field","name":{"kind":"Name","value":"scheduledEndAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"sessions"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"displayName"}},{"kind":"Field","name":{"kind":"Name","value":"linkTo"}}]}}]}}]}}]}}]} as unknown as DocumentNode<ParticipationsQuery, ParticipationsQueryVariables>;
export const SelfDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Self"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"self"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"avatar"}},{"kind":"Field","name":{"kind":"Name","value":"avatarSettings"}},{"kind":"Field","name":{"kind":"Name","value":"achievements"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"achievedAt"}},{"kind":"Field","name":{"kind":"Name","value":"achievedCount"}},{"kind":"Field","name":{"kind":"Name","value":"achievement"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"icon"}},{"kind":"Field","name":{"kind":"Name","value":"iconColor"}}]}}]}}]}}]}}]} as unknown as DocumentNode<SelfQuery, SelfQueryVariables>;
export const UserProfileDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"UserProfile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"userProfile"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"isActive"}},{"kind":"Field","name":{"kind":"Name","value":"email"}},{"kind":"Field","name":{"kind":"Name","value":"shortname"}}]}}]}}]} as unknown as DocumentNode<UserProfileQuery, UserProfileQueryVariables>;

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
    