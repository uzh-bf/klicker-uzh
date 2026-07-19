// ! Copy of seeded user ids from prisma/seedUsers.ts (kept in sync with cypress.config.ts)
export const USER_ID_TEST = '76047345-3801-4628-ae7b-adbebcfe8821'
export const USER_ID_TEST2 = '76047345-3801-4628-ae7b-adbebcfe8822'
export const USER_ID_TEST3 = '76047345-3801-4628-ae7b-adbebcfe8823'
export const USER_ID_TEST4 = '76047345-3801-4628-ae7b-adbebcfe8824'
export const USER_ID_TEST5 = '76047345-3801-4628-ae7b-adbebcfe8825'
export const USER_ID_TEST6 = '8509238a-cb2e-4d50-832e-971cdf2f9e55'
export const USER_ID_TEST7 = '2437de71-b552-48c8-865a-1d9c12fb7975'

export const COURSE_ID_TEST = 'b8b1305e-bfe8-458b-bf26-9082fdca953f'
export const COURSE_ID_TEST2 = 'e364455a-8eab-428b-b939-21b556e4ab82'
export const COURSE_ID_TEST3 = 'efd54f15-ba92-4291-8ea8-911f365ae10b'
export const COURSE_ID_ASSESSMENT_REPORT =
  '2e44f7cd-f841-41c8-a46e-49870a729d69'
export const LIVE_QUIZ_ID_ASSESSMENT_REPORT =
  '6cd47c82-957e-4d03-a5a4-8aca3811e217'
export const ASSESSMENT_REPORT_COURSE_NAME = 'Credential Assessment Course'
export const ASSESSMENT_REPORT_COURSE_REFERENCE = 'credential-assessment-course'
export const ASSESSMENT_REPORT_SUBJECT_EMAIL =
  'assessment-report-student@example.org'
export const ASSESSMENT_REPORT_PARTICIPANT_IDS = Array.from(
  { length: 10 },
  (_, index) => `a1000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`
)

export const PARTICIPANT_IDS = [
  '6f45065c-667f-4259-818c-c6f6b477eb48',
  '0b7c946c-cfc9-4b82-ac97-b058bf48924b',
  '52c20f0f-f5d4-4354-a5d6-a0c103f2b9ea',
  '16c39a69-03b4-4ce4-a695-e7b93d535598',
  'c48f624e-7de9-4e1b-a16d-82d22e64828f',
  '7cf9a94a-31a6-4c53-85d7-608dfa904e30',
  'f53e6a95-689b-48c0-bfab-6625c04f39ed',
  '46407010-0e7c-4903-9a66-2c8d9d6909b0',
  '84b0ba5d-34bc-45cd-8253-f3e8c340e5ff',
  '05a933a0-b2bc-4551-b7e1-6975140d996d',
  'bb822996-97d6-41e4-b648-d93057d1b49c',
  'abf8ddf8-f90d-4d29-af8b-6f007d41dd23',
  'de19e261-7848-4f4a-8992-e1e5db4b6825',
  'c9e11f3f-d485-4ed3-bd05-5eefedf4987f',
  '1b3ebc59-b93c-414d-a69e-cc2783221e28',
  '1b348636-d665-4618-9ed0-90ddb27a36b0',
  'e9c2e5da-0954-4970-a7c8-c752cb76b8df',
  '6283a267-1e66-4429-b7b8-3449d52ca87a',
  'f99c2387-56b6-407c-9b9a-19eba6bde857',
  '60f451a4-9005-4f08-90b6-3df7ff648aff',
  '2d7f7f11-c7ab-4223-acbf-c248c07a2e90',
  'd9fc5c24-4357-4a8f-ac5b-d56e6b22690d',
  '7013c323-12c5-45c4-8af4-40474bb08f27',
  'ef14f3c6-24b1-44eb-a464-63cede2255b3',
  'ed9e23c5-4187-48ba-9d73-07db86dbea08',
  '3e88cf14-7399-437a-addc-ef59087351de',
  'b155f01d-5bad-4378-9509-d96153b90d7e',
  '24e623bb-3d98-4a48-a2a0-f46b4dda4501',
  'ee6ff037-5d39-495b-ade3-295c23ed0cd7',
  '26544dd7-1688-43ec-9dba-8ed374c0a164',
  '30e328cd-f4c8-4c03-8e64-301fcffa410c',
  '783d3c6a-0a27-4caf-a2d3-ff30ec08e463',
  '13cda4e6-3971-4b70-b938-3f6afd936870',
  '7ac7ba41-f652-4218-b3b3-b5b11110c0e8',
  '88bfe576-5d29-4311-a699-e4f87bf82d7b',
  '794e1197-5aca-4354-a121-67c5ecb437a8',
  '7b6e18cb-346f-44e6-88fe-cc31d217b01b',
  '12099d4e-c36f-4e4d-bef7-f92496081129',
  '24f3192e-90e9-45b9-80f7-059eb683ec9a',
  'cbda0cb9-0c71-4efd-a2ef-b2c9eea60598',
  '03759c75-62e5-4f78-9ccc-4672d8f0a091',
  '9151b3c4-4e20-4b0c-8d44-2e7d274c1914',
  '2f726355-e304-4bb0-b2ad-b734a3b3603f',
  'f9b17cc1-d83a-4c3d-94f9-8a200bb8cd1b',
  '6bdd44c1-248b-4581-a971-6db8d2b24534',
  '1500f62b-4a56-4405-af08-4b12bb103ac1',
  '6c832cc9-17ab-4923-a7fc-c72cef128c31',
  '0c586267-55fb-4aba-9cb6-cee09cd737ae',
  'ec8952c2-2972-4160-ad90-3ecf96425f8d',
  'b687a300-b5e7-43dd-a49e-aea9ff30aadc',
]

export const PARTICIPANT_GROUP_IDS = [
  '9c4940c1-87ca-47a7-afc4-cd85656df3e7',
  '4fc5c849-5a2b-437c-a6fd-91daac4e556a',
  '0de95dcb-1802-47f7-9fb9-01085d1d2281',
  '6f4ae38f-5866-4d24-8844-cd380998591c',
  'e91fe13f-4394-496f-b12f-993f9a1a8dba',
  'ac6a7361-f71e-4fcd-821f-8904954af90f',
  'f30a99f8-3d66-4f28-8aaf-af64b392de05',
  'e5ddf45a-89e3-466a-9d17-e60354470925',
  'fb1c3685-f51e-4585-8444-dbbe2ddb76a4',
  'f2f843c6-a35e-46d7-9574-902e1d134d6c',
  'd822a233-c6d4-4cb5-a7b8-4a265d7ffaa0',
  '7d9571fd-fdf4-4392-8293-768539896c09',
  '278057ff-f1c2-49a0-9ab1-bcbc4c6473b7',
  '11c06c89-0cb4-4d8e-b052-b711f327b8c4',
]

export const PARTICIPANT_GROUP_IDS_SINGLE = [
  'af6758da-8667-43a3-9e7f-02fc1a441261',
  '6f7f65bb-84aa-4ec4-b52e-46b36d1c302b',
  'c07d7f8e-9299-4809-aed7-331cae09f347',
  '38de3f21-abb8-4982-a51d-e654f62ebe34',
  'd9f23367-32b9-45ba-9bd6-06b6d96a5829',
]

// URLs (mirrors cypress.config.ts env block)
export const URL_API = 'http://127.0.0.1:3000'
export const URL_STUDENT = 'http://127.0.0.1:3001'
export const URL_STUDENT_LOGIN = 'http://127.0.0.1:3001/login'
export const URL_MANAGE = 'http://127.0.0.1:3002'
export const URL_CONTROL = 'http://127.0.0.1:3003'
export const URL_CHAT = 'http://127.0.0.1:3004'
export const URL_AUTH = 'http://127.0.0.1:3010'

// Lecturer accounts
export const LECTURER_ID = USER_ID_TEST
export const LECTURER_EMAIL = 'lecturer@df.uzh.ch'
export const LECTURER_SHORTNAME = 'lecturer'
export const LECTURER_IND_ID = USER_ID_TEST3
export const LECTURER_IND_SHORTNAME = 'pro1'
export const LECTURER_IND_EMAIL = 'pro1@df.uzh.ch'
export const LECTURER_INST_ID = USER_ID_TEST4
export const LECTURER_INST_SHORTNAME = 'pro2'
export const LECTURER_INST_EMAIL = 'pro2@df.uzh.ch'
export const LECTURER_INST2_ID = USER_ID_TEST5
export const LECTURER_INST2_SHORTNAME = 'pro3'
export const LECTURER_INST2_EMAIL = 'pro3@df.uzh.ch'
export const LECTURER_INST3_ID = USER_ID_TEST6
export const LECTURER_INST3_SHORTNAME = 'pro4'
export const LECTURER_INST3_EMAIL = 'pro4@df.uzh.ch'
export const LECTURER_INST4_ID = USER_ID_TEST7
export const LECTURER_INST4_SHORTNAME = 'pro5'
export const LECTURER_INST4_EMAIL = 'pro5@df.uzh.ch'
export const LECTURER_PASSWORD = 'abcd'

// Student accounts
export const APP_SECRET = 'abcd'
export const STUDENT_USERNAME = 'testuser1'
export const STUDENT_USERNAME2 = 'testuser2'
export const STUDENT_USERNAME3 = 'testuser3'
export const STUDENT_USERNAME4 = 'testuser4'
export const STUDENT_USERNAME5 = 'testuser5'
export const STUDENT_USERNAME6 = 'testuser6'
export const STUDENT_USERNAME7 = 'testuser7'
export const STUDENT_USERNAME8 = 'testuser8'
export const STUDENT_USERNAME9 = 'testuser9'
export const STUDENT_USERNAME10 = 'testuser10'
export const STUDENT_USERNAME11 = 'testuser11'
export const STUDENT_USERNAME12 = 'testuser12'
export const STUDENT_USERNAME15 = 'testuser15'
export const STUDENT_NOGROUP = 'testuser40'
export const STUDENT_EMAIL = 'testuser1@test.uzh.ch'
export const STUDENT_PASSWORD = 'abcdabcd'

export const SEED = {
  liveQuiz: 'Seed Live Quiz',
  microlearning: 'Seed Microlearning',
  practiceQuiz: 'Seed Practice Quiz',
  groupActivity: 'Seed Group Activity',
}
export const SEEDED_COURSE = 'Testkurs'

// general
export const viewPorts = {
  default: { width: 1920, height: 1080 },
  mobile: { width: 375, height: 812 },
  iphone6: { width: 375, height: 667 },
}

// D-elements-content spec fixture data
export const CONTENT_DATA = {
  title: 'Content Title',
  content: 'Content Text',
  titleEdited: 'Content Title Edited',
  contentEdited: 'Content Text Edited',
}

// C-control spec fixture data
export const CONTROL_DATA = {
  questionTitle: 'Geography',
  questionContent: 'What is the capital of France?',
  quizName: 'World Capitals (Lecturer)',
  quizDisplayName: 'World Capitals (Display)',
}

// G-elements-mc spec fixture data
export const MC_DATA = {
  title: 'Multiple Choice Title',
  content: 'Multiple Choice Text',
  choices: ['25%', '50%', '75%', '100%'],
  titleEdited: 'Multiple Choice Title Edited',
  contentEdited: 'Multiple Choice Text Edited',
  choicesEdited: ['10%', '20%', '30%', '40%', '50%', '60%', '70%'],
  choicesFeedbacks: [
    'Feedback 1',
    'Feedback 2',
    'Feedback 3',
    'Feedback 4',
    'Feedback 5',
    'Feedback 6',
    'Feedback 7',
  ],
}

// H-elements-kprim spec fixture data
export const KP_DATA = {
  title: 'KPRIM Title',
  content: 'KPRIM Text',
  choices: ['25%', '50%', '75%', '100%'],
  titleEdited: 'KPRIM Title Edited',
  contentEdited: 'KPRIM Text Edited',
  choicesEdited: ['10%', '20%', '30%', '40%'],
  choicesFeedbacks: ['Feedback 1', 'Feedback 2', 'Feedback 3', 'Feedback 4'],
}

// I-elements-numerical spec fixture data
export const NR_DATA = {
  title: 'Numerical Range Title',
  content: 'Numerical Range Text',
  min: 0,
  max: 100,
  accuracy: 0,
  unit: '%',
  titleEdited: 'Numerical Range Title Edited',
  contentEdited: 'Numerical Range Text Edited',
  minEdited: -200,
  maxEdited: 50,
  accuracyEdited: 2,
  unitEdited: 'kg',
  solutionRanges: [
    { min: 40, max: null },
    { min: -50, max: 20 },
    { min: null, max: -80 },
  ] as { min: number | null; max: number | null }[],
  exactSolutions: [-10, 10, 50],
}

// E-elements-flashcards spec fixture data
export const FLASHCARD_DATA = {
  title: 'Flashcard Title',
  content: 'Flashcard Text',
  explanation: 'Flashcard Explanation',
  titleEdited: 'Flashcard Title Edited',
  contentEdited: 'Flashcard Text Edited',
  explanationEdited: 'Flashcard Explanation Edited',
}

// F-elements-sc spec fixture data
export const SC_DATA = {
  title: 'Single Choice Title',
  content: 'Single Choice Text',
  choices: ['50%', '100%'],
  titleEdited: 'Single Choice Title Edited',
  contentEdited: 'Single Choice Text Edited',
  choicesEdited: ['25%', '50%', '100%'],
  choicesFeedbacks: ['Feedback 1', 'Feedback 2', 'Feedback 3'],
}
