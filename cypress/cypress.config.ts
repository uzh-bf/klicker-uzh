import { prisma } from '@klicker-uzh/prisma'
import {
  AchievementType,
  CourseAuthType,
  ElementBlockStatus,
  ElementType,
  ObjectAccess,
  PermissionLevel,
  PublicationStatus,
  UserLoginScope,
  UserRole,
} from '@klicker-uzh/prisma/client'
import {
  CaseStudyCaseCriterionSolution,
  CaseStudyCaseSolution,
  ElementOptionsCaseStudy,
  ElementOptionsChoices,
  ElementOptionsContent,
  ElementOptionsFlashcard,
  ElementOptionsFreeText,
  ElementOptionsNumerical,
  ElementOptionsSelection,
} from '@klicker-uzh/types'
import bcrypt from 'bcryptjs'
import { createHash } from 'crypto'
import { defineConfig } from 'cypress'
import cypressSplit from 'cypress-split'
// import cypressCodeCoverage from '@cypress/code-coverage/task'

// ! Copy of seeded user ids from prisma/seedUsers.ts
const USER_ID_TEST = '76047345-3801-4628-ae7b-adbebcfe8821'
const USER_ID_TEST2 = '76047345-3801-4628-ae7b-adbebcfe8822'
const USER_ID_TEST3 = '76047345-3801-4628-ae7b-adbebcfe8823'
const USER_ID_TEST4 = '76047345-3801-4628-ae7b-adbebcfe8824'
const USER_ID_TEST5 = '76047345-3801-4628-ae7b-adbebcfe8825'
const USER_ID_TEST6 = '8509238a-cb2e-4d50-832e-971cdf2f9e55'
const USER_ID_TEST7 = '2437de71-b552-48c8-865a-1d9c12fb7975'
const COURSE_ID_TEST = 'b8b1305e-bfe8-458b-bf26-9082fdca953f'
const COURSE_ID_TEST2 = 'e364455a-8eab-428b-b939-21b556e4ab82'
const COURSE_ID_TEST3 = 'efd54f15-ba92-4291-8ea8-911f365ae10b'

const PARTICIPANT_IDS = [
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
const PARTICIPANT_GROUP_IDS = [
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
const PARTICIPANT_GROUP_IDS_SINGLE = [
  'af6758da-8667-43a3-9e7f-02fc1a441261',
  '6f7f65bb-84aa-4ec4-b52e-46b36d1c302b',
  'c07d7f8e-9299-4809-aed7-331cae09f347',
  '38de3f21-abb8-4982-a51d-e654f62ebe34',
  'd9f23367-32b9-45ba-9bd6-06b6d96a5829',
]

async function seedDatabase() {
  try {
    // ? User seeding section (identical to seedUsers logic, different uuids)
    const password = 'abcd'
    const hashedPassword = await bcrypt.hash(password, 12)

    await Promise.all(
      [
        {
          id: USER_ID_TEST,
          name: 'Lecturer',
          email: 'lecturer@df.uzh.ch',
          shortname: 'lecturer',
          catalystIndividual: true,
          catalystInstitutional: true,
          publicPreview: true,
          privatePreview: true,
          role: UserRole.ADMIN,
          firstLogin: false,
          logins: {
            create: {
              name: 'lecturer',
              password: hashedPassword,
              scope: UserLoginScope.FULL_ACCESS,
            },
          },
        },
        {
          id: USER_ID_TEST2,
          name: 'Free Tier User',
          email: 'free@df.uzh.ch',
          shortname: 'free',
          catalystIndividual: false,
          catalystInstitutional: false,
          publicPreview: false,
          privatePreview: false,
          firstLogin: false,
        },
        {
          id: USER_ID_TEST3,
          name: 'Individual Pro User',
          email: 'pro1@df.uzh.ch',
          shortname: 'pro1',
          catalystIndividual: true,
          catalystInstitutional: false,
          publicPreview: true,
          privatePreview: true,
          firstLogin: false,
        },
        {
          id: USER_ID_TEST4,
          name: 'Institutional Pro User',
          email: 'pro2@df.uzh.ch',
          shortname: 'pro2',
          catalystIndividual: false,
          catalystInstitutional: true,
          publicPreview: true,
          privatePreview: true,
          firstLogin: false,
        },
        {
          id: USER_ID_TEST5,
          name: 'Institutional Pro User 2',
          email: 'pro3@df.uzh.ch',
          shortname: 'pro3',
          catalystIndividual: false,
          catalystInstitutional: true,
          publicPreview: true,
          privatePreview: true,
          firstLogin: false,
        },
        {
          id: USER_ID_TEST6,
          name: 'Institutional Pro User 3',
          email: 'pro4@df.uzh.ch',
          shortname: 'pro4',
          catalystIndividual: false,
          catalystInstitutional: true,
          publicPreview: true,
          privatePreview: true,
          firstLogin: false,
        },
        {
          id: USER_ID_TEST7,
          name: 'Institutional Pro User 4',
          email: 'pro5@df.uzh.ch',
          shortname: 'pro5',
          catalystIndividual: false,
          catalystInstitutional: true,
          publicPreview: true,
          privatePreview: true,
          firstLogin: false,
        },
      ].map((userData) =>
        prisma.user.upsert({
          where: { id: userData.id },
          create: userData,
          update: {},
        })
      )
    )

    // ? Test course seeding
    const currentYear = new Date().getFullYear()
    await prisma.course.upsert({
      where: { id: COURSE_ID_TEST },
      create: {
        id: COURSE_ID_TEST,
        name: 'Testkurs',
        displayName: 'Testkurs',
        description: 'Das ist ein Testkurs. Hier wird getestet. Viel Spass!',
        isGamificationEnabled: true,
        isCourseQARolloutEnabled: true,
        isCourseQAEnabled: true,
        isCourseQAAnonymousEnabled: true,
        color: '#016272',
        pinCode: 123456789,
        startDate: new Date(`${currentYear - 1}-01-01T00:00`),
        endDate: new Date(`${currentYear + 10}-01-01T23:59`),
        isGroupCreationEnabled: true,
        groupDeadlineDate: new Date('2021-01-01T00:01'),
        maxGroupSize: 5,
        preferredGroupSize: 3,
        owner: {
          connect: { id: USER_ID_TEST },
        },
      },
      update: {
        isCourseQARolloutEnabled: true,
        isCourseQAEnabled: true,
        isCourseQAAnonymousEnabled: true,
      },
    })
    await prisma.derivedPermission.upsert({
      where: {
        courseId_userId: {
          courseId: COURSE_ID_TEST,
          userId: USER_ID_TEST,
        },
      },
      create: {
        permissionLevel: PermissionLevel.OWNER,
        course: {
          connect: { id: COURSE_ID_TEST },
        },
        user: {
          connect: { id: USER_ID_TEST },
        },
      },
      update: {
        permissionLevel: PermissionLevel.OWNER,
      },
    })

    await prisma.course.upsert({
      where: { id: COURSE_ID_TEST2 },
      create: {
        id: COURSE_ID_TEST2,
        name: 'Testkurs 2',
        displayName: 'Testkurs 2',
        description:
          'Das ist ein abgeschlossener Testkurs. Hier wird getestet. Viel Spass!',
        isGamificationEnabled: true,
        color: '#016272',
        pinCode: 111333555,
        startDate: new Date('2010-01-01T00:00'),
        endDate: new Date('2020-01-01T23:59'),
        isGroupCreationEnabled: true,
        groupDeadlineDate: new Date('2015-01-01T00:01'),
        maxGroupSize: 5,
        preferredGroupSize: 3,
        owner: {
          connect: { id: USER_ID_TEST },
        },
      },
      update: {},
    })
    await prisma.derivedPermission.upsert({
      where: {
        courseId_userId: {
          courseId: COURSE_ID_TEST2,
          userId: USER_ID_TEST,
        },
      },
      create: {
        permissionLevel: PermissionLevel.OWNER,
        course: { connect: { id: COURSE_ID_TEST2 } },
        user: { connect: { id: USER_ID_TEST } },
      },
      update: {
        permissionLevel: PermissionLevel.OWNER,
      },
    })

    await prisma.course.upsert({
      where: {
        id: COURSE_ID_TEST3,
      },
      create: {
        id: COURSE_ID_TEST3,
        name: 'Non-Gamified Course',
        displayName: 'Non-Gamified Course',
        description: 'This is a course without gamification.',
        isGamificationEnabled: false,
        color: '#166b16',
        pinCode: 482748273,
        startDate: new Date('2023-01-01T00:00'),
        endDate: new Date('2030-01-01T23:59'),
        isGroupCreationEnabled: false,
        groupDeadlineDate: new Date('2025-01-01T00:01'),
        maxGroupSize: 5,
        preferredGroupSize: 3,
        owner: {
          connect: { id: USER_ID_TEST },
        },
      },
      update: {},
    })
    await prisma.derivedPermission.upsert({
      where: {
        courseId_userId: {
          courseId: COURSE_ID_TEST3,
          userId: USER_ID_TEST,
        },
      },
      create: {
        permissionLevel: PermissionLevel.OWNER,
        course: {
          connect: { id: COURSE_ID_TEST3 },
        },
        user: {
          connect: { id: USER_ID_TEST },
        },
      },
      update: {
        permissionLevel: PermissionLevel.OWNER,
      },
    })

    // ? Seed participant accounts
    const participantPassword = await bcrypt.hash('abcdabcd', 12)
    await Promise.all(
      PARTICIPANT_IDS.map(async (id, ix) => {
        const username = `testuser${ix + 1}`

        return prisma.participant.upsert({
          where: { id },
          create: {
            id,
            password: participantPassword,
            username: username,
            email: `${username}@test.uzh.ch`,
            participations: { create: { courseId: COURSE_ID_TEST } },
          },
          update: {},
        })
      })
    )

    // ? Seed participant groups
    const participantGroupsTesting = await Promise.all(
      PARTICIPANT_GROUP_IDS.map(async (id, ix) => {
        const code = 100000 + Math.floor(Math.random() * 900000)

        return prisma.participantGroup.upsert({
          where: {
            id,
          },
          create: {
            id,
            name: `Gruppe ${ix + 1}`,
            code: code,
            course: { connect: { id: COURSE_ID_TEST } },
            participants: {
              connect: [
                {
                  id: PARTICIPANT_IDS[ix],
                },
                {
                  id: PARTICIPANT_IDS[ix + PARTICIPANT_GROUP_IDS.length],
                },
              ],
            },
            averageMemberScore: Math.round(ix * 100 + 500),
          },
          update: {
            name: `Gruppe ${ix + 1}`,
            code: code,
          },
        })
      })
    )
    await Promise.all(
      PARTICIPANT_GROUP_IDS_SINGLE.map(async (id, ix) => {
        const code = 100000 + Math.floor(Math.random() * 900000)

        return prisma.participantGroup.upsert({
          where: {
            id,
          },
          create: {
            id,
            name: `Single Gruppe ${ix + 1}`,
            code: code,
            course: { connect: { id: COURSE_ID_TEST } },
            participants: {
              connect: [
                {
                  id: PARTICIPANT_IDS[ix + 29],
                },
              ],
            },
            averageMemberScore: Math.round(ix * 100 + 500),
          },
          update: {
            name: `Single Gruppe ${ix + 1}`,
            code: code,
          },
        })
      })
    )

    // ? Top-level catalog collection seeding
    await prisma.catalogCollection.upsert({
      where: {
        id: 'fde06b3c-d515-4907-99cf-c2ba67583155',
      },
      create: {
        id: 'fde06b3c-d515-4907-99cf-c2ba67583155',
        name: '',
        access: ObjectAccess.PUBLIC,
      },
      update: { name: '', access: ObjectAccess.PUBLIC },
    })

    // ? Achievements
    const ACHIEVEMENTS = [
      {
        id: 8,
        nameDE: 'Dream Team',
        nameEN: 'Dream Team',
        descriptionDE:
          'Du hast im Gruppentask über die Hälfte der Punkte erreicht.',
        descriptionEN:
          'You have reached more than half of the points in the group task.',
        icon: '/achievements/Dreamteam.svg',
        rewardedPoints: 500,
        rewardedXP: 500,
        type: AchievementType.PARTICIPANT,
      },
      {
        id: 9,
        nameDE: 'Teamgeist',
        nameEN: 'Team Spirit',
        descriptionDE: 'Du hast einen Gruppentask absolviert.',
        descriptionEN: 'You have completed a group task.',
        icon: '/achievements/Teamgeist.svg',
        rewardedPoints: 0,
        rewardedXP: 100,
        type: AchievementType.PARTICIPANT,
      },
    ]
    await Promise.all(
      ACHIEVEMENTS.map(async (achievement) => {
        await prisma.achievement.upsert({
          where: { id: achievement.id },
          create: {
            id: achievement.id,
            nameDE: achievement.nameDE,
            nameEN: achievement.nameEN,
            descriptionDE: achievement.descriptionDE,
            descriptionEN: achievement.descriptionEN,
            icon: achievement.icon,
            rewardedPoints: achievement.rewardedPoints,
            rewardedXP: achievement.rewardedXP,
            type: achievement.type,
          },
          update: {
            nameDE: achievement.nameDE,
            nameEN: achievement.nameEN,
            descriptionDE: achievement.descriptionDE,
            descriptionEN: achievement.descriptionEN,
            icon: achievement.icon,
            rewardedPoints: achievement.rewardedPoints,
            rewardedXP: achievement.rewardedXP,
          },
        })
      })
    )

    return true
  } catch (error) {
    throw error
  }
}

async function seedActivities() {
  try {
    const liveQuizId = 'c4196bea-e0c8-49f2-9669-7fdb78bb030c'
    await prisma.liveQuiz.upsert({
      where: { id: liveQuizId },
      create: {
        id: liveQuizId,
        name: 'Seed Live Quiz',
        displayName: 'Seed Live Quiz (Displayname)',
        courseId: COURSE_ID_TEST,
        ownerId: USER_ID_TEST,
      },
      update: {},
    })
    await prisma.derivedPermission.upsert({
      where: {
        liveQuizId_userId: {
          liveQuizId: liveQuizId,
          userId: USER_ID_TEST,
        },
      },
      create: {
        permissionLevel: PermissionLevel.OWNER,
        liveQuiz: { connect: { id: liveQuizId } },
        user: { connect: { id: USER_ID_TEST } },
      },
      update: {
        permissionLevel: PermissionLevel.OWNER,
      },
    })

    const microlearningId = '52a038e5-495e-4262-bd97-f30c3540122a'
    await prisma.microLearning.upsert({
      where: {
        id: microlearningId,
      },
      create: {
        id: microlearningId,
        name: 'Seed Microlearning',
        displayName: 'Seed Microlearning (Displayname)',
        scheduledStartAt: new Date('2020-01-01T00:00'),
        scheduledEndAt: new Date('2050-01-01T23:59'),
        courseId: COURSE_ID_TEST,
        ownerId: USER_ID_TEST,
      },
      update: {},
    })
    await prisma.derivedPermission.upsert({
      where: {
        microLearningId_userId: {
          microLearningId: microlearningId,
          userId: USER_ID_TEST,
        },
      },
      create: {
        permissionLevel: PermissionLevel.OWNER,
        microLearning: { connect: { id: microlearningId } },
        user: { connect: { id: USER_ID_TEST } },
      },
      update: {
        permissionLevel: PermissionLevel.OWNER,
      },
    })

    const practiceQuizId = '8ef0c8b3-b39d-4a3e-8219-c663a7a36063'
    await prisma.practiceQuiz.upsert({
      where: { id: practiceQuizId },
      create: {
        id: practiceQuizId,
        name: 'Seed Practice Quiz',
        displayName: 'Seed Practice Quiz (Displayname)',
        courseId: COURSE_ID_TEST,
        ownerId: USER_ID_TEST,
      },
      update: {},
    })
    await prisma.derivedPermission.upsert({
      where: {
        practiceQuizId_userId: {
          practiceQuizId: practiceQuizId,
          userId: USER_ID_TEST,
        },
      },
      create: {
        permissionLevel: PermissionLevel.OWNER,
        practiceQuiz: { connect: { id: practiceQuizId } },
        user: { connect: { id: USER_ID_TEST } },
      },
      update: {
        permissionLevel: PermissionLevel.OWNER,
      },
    })

    const groupActivityId = '72999654-72b6-47bf-a822-76e1125f4b96'
    await prisma.groupActivity.upsert({
      where: { id: groupActivityId },
      create: {
        id: groupActivityId,
        name: 'Seed Group Activity',
        displayName: 'Seed Group Activity (Displayname)',
        scheduledStartAt: new Date('2020-01-01T00:00'),
        scheduledEndAt: new Date('2050-01-01T23:59'),
        courseId: COURSE_ID_TEST,
        ownerId: USER_ID_TEST,
      },
      update: {},
    })
    await prisma.derivedPermission.upsert({
      where: {
        groupActivityId_userId: {
          groupActivityId: groupActivityId,
          userId: USER_ID_TEST,
        },
      },
      create: {
        permissionLevel: PermissionLevel.OWNER,
        groupActivity: { connect: { id: groupActivityId } },
        user: { connect: { id: USER_ID_TEST } },
      },
      update: {
        permissionLevel: PermissionLevel.OWNER,
      },
    })

    return true
  } catch (error) {
    console.error('Error seeding activities:', error)
    return null
  }
}

async function cleanupDatabase() {
  try {
    // delete all activities
    await prisma.liveQuiz.deleteMany()
    await prisma.microLearning.deleteMany()
    await prisma.practiceQuiz.deleteMany()
    await prisma.groupActivity.deleteMany()

    // delete all courses
    await prisma.course.deleteMany()

    // delete all elements and resources
    await prisma.element.deleteMany(),
      await prisma.answerCollection.deleteMany()
    await prisma.mediaFile.deleteMany()

    // delete all catalog collections
    await prisma.catalogCollection.deleteMany()

    // delete all audit data
    await prisma.auditLogEntry.deleteMany()

    // delete all users, participants and groups
    await prisma.userGroup.deleteMany()
    await prisma.user.deleteMany()
    await prisma.participantGroup.deleteMany()
    await prisma.participant.deleteMany()

    return true
  } catch (error) {
    throw error
  }
}

export default defineConfig({
  watchForFileChanges: true,
  projectId: 'y436dx',
  trashAssetsBeforeRuns: true,
  video: true,
  env: {
    URL_STUDENT: 'http://127.0.0.1:3001',
    URL_STUDENT_LOGIN: 'http://127.0.0.1:3001/login',
    URL_MANAGE: 'http://127.0.0.1:3002',
    URL_CONTROL: 'http://127.0.0.1:3003',
    URL_AUTH: 'http://127.0.0.1:3010',
    LECTURER_ID: USER_ID_TEST,
    LECTURER_EMAIL: 'lecturer@df.uzh.ch',
    LECTURER_SHORTNAME: 'lecturer',
    LECTURER_IND_ID: USER_ID_TEST3,
    LECTURER_IND_SHORTNAME: 'pro1',
    LECTURER_IND_EMAIL: 'pro1@df.uzh.ch',
    LECTURER_INST_ID: USER_ID_TEST4,
    LECTURER_INST_SHORTNAME: 'pro2',
    LECTURER_INST_EMAIL: 'pro2@df.uzh.ch',
    LECTURER_INST2_ID: USER_ID_TEST5,
    LECTURER_INST2_SHORTNAME: 'pro3',
    LECTURER_INST2_EMAIL: 'pro3@df.uzh.ch',
    LECTURER_INST3_ID: USER_ID_TEST6,
    LECTURER_INST3_SHORTNAME: 'pro4',
    LECTURER_INST3_EMAIL: 'pro4@df.uzh.ch',
    LECTURER_INST4_ID: USER_ID_TEST7,
    LECTURER_INST4_SHORTNAME: 'pro5',
    LECTURER_INST4_EMAIL: 'pro5@df.uzh.ch',
    LECTURER_PASSWORD: 'abcd',
    APP_SECRET: 'abcd',
    STUDENT_USERNAME: 'testuser1',
    STUDENT_USERNAME2: 'testuser2',
    STUDENT_USERNAME3: 'testuser3',
    STUDENT_USERNAME4: 'testuser4',
    STUDENT_USERNAME5: 'testuser5',
    STUDENT_USERNAME6: 'testuser6',
    STUDENT_USERNAME7: 'testuser7',
    STUDENT_USERNAME8: 'testuser8',
    STUDENT_USERNAME9: 'testuser9',
    STUDENT_USERNAME10: 'testuser10',
    STUDENT_USERNAME11: 'testuser11',
    STUDENT_USERNAME12: 'testuser12',
    STUDENT_USERNAME15: 'testuser15',
    STUDENT_NOGROUP: 'testuser40',
    STUDENT_EMAIL: 'testuser1@test.uzh.ch',
    STUDENT_PASSWORD: 'abcdabcd',

    // codeCoverage: {
    //   expectBackendCoverageOnly: true,
    //   url: 'http://127.0.0.1:3000/__coverage__',
    // },
  },

  e2e: {
    experimentalStudio: true,
    experimentalMemoryManagement: true,
    //   // includeShadowDom: true,
    setupNodeEvents(on, config) {
      // merge process.env with config.env
      config.env = { ...config.env, ...process.env }

      // cypressCodeCoverage(on, config)
      cypressSplit(on, config)

      on('before:run', async () => {
        await cleanupDatabase()
        await seedDatabase()
      })

      on('task', {
        // ! Helper functions
        // #region
        async connectToDB() {
          return prisma
        },
        // #endregion

        // ! Element creation
        // #region
        async createQuestionChoices({
          type,
          name,
          content,
          explanation,
          multiplier,
          choices,
          isArchived,
          userId,
        }: {
          type: ElementType
          name: string
          content: string
          explanation?: string
          multiplier?: number
          choices: { value: string; correct?: boolean; feedback?: string }[]
          isArchived: boolean
          userId: string
        }) {
          if (type === ElementType.SC && choices.length < 2) {
            throw new Error('SC questions require at least 2 choices')
          }

          if (type === ElementType.MC && choices.length < 2) {
            throw new Error('MC questions require at least 2 choices')
          }

          if (type === ElementType.KPRIM && choices.length !== 4) {
            throw new Error('KPRIM questions require exactly 4 choices')
          }

          const hasSampleSolution = choices.some(
            (choice) => typeof choice.correct !== 'undefined'
          )
          const hasAnswerFeedbacks = choices.every(
            (choice) => typeof choice.feedback !== 'undefined'
          )

          try {
            const ChoicesQuestion = await prisma.element.create({
              data: {
                type,
                name,
                content,
                explanation: explanation ?? undefined,
                basePoints: true,
                pointsMultiplier: multiplier,
                isArchived,
                options: {
                  hasSampleSolution,
                  hasAnswerFeedbacks,
                  displayMode: 'LIST',
                  choices: choices.map((choice, ix) => ({
                    ix,
                    value: choice.value,
                    correct: hasSampleSolution
                      ? (choice.correct ?? false)
                      : undefined,
                    feedback: hasAnswerFeedbacks ? choice.feedback : undefined,
                  })),
                } as ElementOptionsChoices,
                owner: {
                  connect: {
                    id: userId,
                  },
                },
              },
            })

            // create a derived permission for the newly created element
            await prisma.derivedPermission.upsert({
              where: {
                elementId_userId: {
                  elementId: ChoicesQuestion.id,
                  userId: userId,
                },
              },
              create: {
                permissionLevel: PermissionLevel.OWNER,
                element: {
                  connect: { id: ChoicesQuestion.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
              update: {
                permissionLevel: PermissionLevel.OWNER,
              },
            })

            return true
          } catch (error) {
            throw error
          }
        },
        async createQuestionNumerical({
          name,
          content,
          explanation,
          multiplier,
          min,
          max,
          unit,
          accuracy,
          solutionRanges,
          exactSolutions,
          isArchived,
          userId,
        }: {
          name: string
          content: string
          explanation?: string
          multiplier?: number
          min?: string
          max?: string
          unit?: string
          accuracy?: string
          solutionRanges?: { min: string; max: string }[] | null
          exactSolutions?: string[] | null
          isArchived: boolean
          userId: string
        }) {
          const hasSampleSolution =
            typeof solutionRanges !== 'undefined' &&
            solutionRanges !== null &&
            solutionRanges.length > 0

          try {
            const NumericalQuestion = await prisma.element.create({
              data: {
                type: 'NUMERICAL',
                name,
                content,
                explanation: explanation ?? undefined,
                basePoints: true,
                pointsMultiplier: multiplier,
                isArchived,
                options: {
                  hasSampleSolution,
                  unit,
                  accuracy: accuracy ? parseFloat(accuracy) : undefined,
                  restrictions:
                    typeof min !== 'undefined' || typeof max !== 'undefined'
                      ? {
                          min: min ? parseFloat(min) : null,
                          max: max ? parseFloat(max) : null,
                        }
                      : undefined,
                  solutionRanges: solutionRanges
                    ? solutionRanges.map((range) => ({
                        min: parseFloat(range.min),
                        max: parseFloat(range.max),
                      }))
                    : undefined,
                  exactSolutions: exactSolutions
                    ? exactSolutions.map((solution) => parseFloat(solution))
                    : undefined,
                } as ElementOptionsNumerical,
                owner: {
                  connect: {
                    id: userId,
                  },
                },
              },
            })

            // create a derived permission for the newly created element
            await prisma.derivedPermission.upsert({
              where: {
                elementId_userId: {
                  elementId: NumericalQuestion.id,
                  userId: userId,
                },
              },
              create: {
                permissionLevel: PermissionLevel.OWNER,
                element: {
                  connect: { id: NumericalQuestion.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
              update: {
                permissionLevel: PermissionLevel.OWNER,
              },
            })

            return true
          } catch (error) {
            throw error
          }
        },
        async createQuestionFreeText({
          name,
          content,
          explanation,
          multiplier,
          maxLength,
          solutions,
          isArchived,
          userId,
        }: {
          name: string
          content: string
          explanation?: string
          multiplier?: number
          maxLength?: string
          solutions?: string[]
          isArchived: boolean
          userId: string
        }) {
          const hasSampleSolution =
            typeof solutions !== 'undefined' && solutions.length > 0

          try {
            const FreeTextQuestion = await prisma.element.create({
              data: {
                type: 'FREE_TEXT',
                name,
                content,
                explanation: explanation ?? undefined,
                basePoints: true,
                pointsMultiplier: multiplier,
                isArchived,
                options: {
                  hasSampleSolution,
                  restrictions: {
                    maxLength: maxLength ? parseInt(maxLength) : undefined,
                  },
                  solutions,
                } as ElementOptionsFreeText,
                owner: {
                  connect: {
                    id: userId,
                  },
                },
              },
            })

            // create a derived permission for the newly created element
            await prisma.derivedPermission.upsert({
              where: {
                elementId_userId: {
                  elementId: FreeTextQuestion.id,
                  userId: userId,
                },
              },
              create: {
                permissionLevel: PermissionLevel.OWNER,
                element: {
                  connect: { id: FreeTextQuestion.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
              update: {
                permissionLevel: PermissionLevel.OWNER,
              },
            })

            return true
          } catch (error) {
            throw error
          }
        },
        async createQuestionSelection({
          name,
          content,
          explanation,
          multiplier,
          collectionName,
          numberOfInputs,
          correctAnswers,
          isArchived,
          userId,
        }: {
          name: string
          content: string
          explanation?: string
          multiplier?: number
          collectionName: string
          numberOfInputs: number
          correctAnswers?: string[]
          isArchived: boolean
          userId: string
        }) {
          try {
            const dbAnswerCollection = await prisma.answerCollection.findFirst({
              where: {
                name: collectionName,
                isDeleted: false,
                permissions: { some: { userId: userId } },
              },
            })

            if (!dbAnswerCollection) {
              throw new Error(`Answer collection ${collectionName} not found`)
            }

            const hasSampleSolution =
              typeof correctAnswers !== 'undefined' && correctAnswers.length > 0
            const dbAnswerCollectionItems = hasSampleSolution
              ? await prisma.answerCollectionEntry.findMany({
                  where: {
                    collectionId: dbAnswerCollection.id,
                    value: {
                      in: correctAnswers,
                    },
                  },
                })
              : []

            if (
              hasSampleSolution &&
              correctAnswers.length !== dbAnswerCollectionItems.length
            ) {
              throw new Error(
                `Answer collection ${collectionName} does not contain all correct answers`
              )
            }

            const SelectionQuestion = await prisma.element.create({
              data: {
                type: 'SELECTION',
                name,
                content,
                explanation,
                pointsMultiplier: multiplier,
                isArchived,
                options: {
                  hasSampleSolution,
                  numberOfInputs,
                } as ElementOptionsSelection,
                // connect answer collection
                answerCollection: {
                  connect: {
                    id: dbAnswerCollection.id,
                  },
                },
                // connect answer collection entries (if defined)
                answerCollectionItems: hasSampleSolution
                  ? {
                      connect: dbAnswerCollectionItems.map((item) => ({
                        id: item.id,
                      })),
                    }
                  : undefined,
                owner: {
                  connect: {
                    id: userId,
                  },
                },
              },
            })

            // create a derived permission for the newly created element
            await prisma.derivedPermission.upsert({
              where: {
                elementId_userId: {
                  elementId: SelectionQuestion.id,
                  userId: userId,
                },
              },
              create: {
                permissionLevel: PermissionLevel.OWNER,
                element: {
                  connect: { id: SelectionQuestion.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
              update: {
                permissionLevel: PermissionLevel.OWNER,
              },
            })

            // create a derived permission for the answer collection (if not already created)
            // (existing permission level does not need to be checked - can only be equal or larger)
            await prisma.derivedPermission.upsert({
              where: {
                answerCollectionId_userId: {
                  answerCollectionId: dbAnswerCollection.id,
                  userId: userId,
                },
              },
              create: {
                permissionLevel: PermissionLevel.READ,
                derived: true,
                answerCollection: {
                  connect: { id: dbAnswerCollection.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
              update: {},
            })

            return true
          } catch (error) {
            throw error
          }
        },
        async createQuestionCaseStudy({
          name,
          content,
          explanation,
          multiplier,
          collectionName,
          selectedItems,
          criteria,
          cases,
          solutions,
          isArchived,
          userId,
        }: {
          name: string
          content: string
          explanation?: string
          multiplier?: number
          collectionName: string
          selectedItems: string[]
          criteria: {
            mode: 'range' | 'steps'
            id: string
            name: string
            // range criterion attributes
            min?: number
            max?: number
            step?: number
            unit?: string
            // steps criterion attribute
            steps?: number
            labels?: {
              min: string
              mid?: string
              max: string
            }
          }[]
          cases: {
            id: string
            title: string
            description: string
          }[]
          solutions?: {
            [caseIx: string]: {
              [itemIx: string]: {
                [criterionIx: string]: { lower: number; upper: number }
              }
            }
          }
          isArchived: boolean
          userId: string
        }) {
          try {
            const dbAnswerCollection = await prisma.answerCollection.findFirst({
              where: {
                name: collectionName,
                isDeleted: false,
                permissions: { some: { userId: userId } },
              },
            })

            if (!dbAnswerCollection) {
              throw new Error(`Answer collection ${collectionName} not found`)
            }

            const dbAnswerCollectionItems =
              await prisma.answerCollectionEntry.findMany({
                where: {
                  collectionId: dbAnswerCollection.id,
                  value: { in: selectedItems },
                },
              })

            if (
              !dbAnswerCollectionItems ||
              selectedItems.length !== dbAnswerCollectionItems.length
            ) {
              throw new Error(
                `Answer collection ${collectionName} does not contain all required items for this case study`
              )
            }

            const hasSampleSolution = !!solutions
            const CaseStudyQuestion = await prisma.element.create({
              data: {
                type: 'CASE_STUDY',
                name,
                content,
                explanation,
                pointsMultiplier: multiplier,
                isArchived,
                options: {
                  hasSampleSolution,
                  criteria: criteria.map((criterion, ix) => ({
                    id: criterion.id,
                    name: criterion.name,
                    order: ix,
                    min: criterion.mode === 'steps' ? 1 : criterion.min,
                    max:
                      criterion.mode === 'steps'
                        ? criterion.steps
                        : criterion.max,
                    step: criterion.mode === 'steps' ? 1 : criterion.step,
                    unit: criterion.unit,
                    labels:
                      criterion.mode === 'steps' ? criterion.labels : undefined,
                  })),
                  cases: cases.map((caseItem, caseIx) => {
                    const caseSolutionsObject = solutions
                      ? solutions[caseIx]
                      : undefined

                    if (!!solutions && !caseSolutionsObject) {
                      throw new Error(
                        `Case study ${name} does not contain all required solutions`
                      )
                    }

                    const caseSolutions = solutions
                      ? Object.entries(caseSolutionsObject).reduce<
                          CaseStudyCaseSolution[]
                        >((acc, [itemIx, itemSolutions]) => {
                          const item = dbAnswerCollectionItems[parseInt(itemIx)]

                          if (!item) {
                            throw new Error(
                              `Case study ${name} does not contain all required solutions`
                            )
                          }

                          const criteriaSolutions = Object.entries(
                            itemSolutions
                          ).reduce<CaseStudyCaseCriterionSolution[]>(
                            (criterionAcc, [criterionIx, solution]) => {
                              const criterion = criteria[parseInt(criterionIx)]

                              if (!criterion) {
                                throw new Error(
                                  `Case study ${name} does not contain all required solutions`
                                )
                              }

                              criterionAcc.push({
                                criterionId: criterion.id,
                                min: solution.lower,
                                max: solution.upper,
                              })

                              return criterionAcc
                            },
                            []
                          )

                          acc.push({
                            itemId: item.id,
                            criteriaSolutions,
                          })

                          return acc
                        }, [])
                      : undefined

                    return {
                      id: caseItem.id,
                      order: caseIx,
                      title: caseItem.title,
                      description: caseItem.description,
                      solutions: caseSolutions,
                    }
                  }),
                } as ElementOptionsCaseStudy,
                // connect answer collection
                answerCollection: {
                  connect: {
                    id: dbAnswerCollection.id,
                  },
                },
                // connect answer collection entries (if defined)
                answerCollectionItems: {
                  connect: dbAnswerCollectionItems.map((item) => ({
                    id: item.id,
                  })),
                },
                owner: {
                  connect: {
                    id: userId,
                  },
                },
              },
            })

            // create a derived permission for the newly created element
            await prisma.derivedPermission.upsert({
              where: {
                elementId_userId: {
                  elementId: CaseStudyQuestion.id,
                  userId: userId,
                },
              },
              create: {
                permissionLevel: PermissionLevel.OWNER,
                element: {
                  connect: { id: CaseStudyQuestion.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
              update: {
                permissionLevel: PermissionLevel.OWNER,
              },
            })

            // create a derived permission for the answer collection (if not already created)
            // (existing permission level does not need to be checked - can only be equal or larger)
            await prisma.derivedPermission.upsert({
              where: {
                answerCollectionId_userId: {
                  answerCollectionId: dbAnswerCollection.id,
                  userId: userId,
                },
              },
              create: {
                permissionLevel: PermissionLevel.READ,
                derived: true,
                answerCollection: {
                  connect: { id: dbAnswerCollection.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
              update: {},
            })

            return true
          } catch (error) {
            throw error
          }
        },
        async createContentElement({
          name,
          content,
          isArchived,
          userId,
        }: {
          name: string
          content: string
          isArchived: boolean
          userId: string
        }) {
          try {
            const ContentElement = await prisma.element.create({
              data: {
                type: 'CONTENT',
                name,
                content,
                options: {} as ElementOptionsContent,
                isArchived,
                owner: {
                  connect: {
                    id: userId,
                  },
                },
              },
            })

            // create a derived permission for the newly created element
            await prisma.derivedPermission.upsert({
              where: {
                elementId_userId: {
                  elementId: ContentElement.id,
                  userId: userId,
                },
              },
              create: {
                permissionLevel: PermissionLevel.OWNER,
                element: {
                  connect: { id: ContentElement.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
              update: {
                permissionLevel: PermissionLevel.OWNER,
              },
            })

            return true
          } catch (error) {
            throw error
          }
        },
        async createFlashcard({
          name,
          content,
          explanation,
          isArchived,
          userId,
        }: {
          name: string
          content: string
          explanation: string
          isArchived: boolean
          userId: string
        }) {
          try {
            const Flashcard = await prisma.element.create({
              data: {
                type: 'FLASHCARD',
                name,
                content,
                explanation,
                options: {} as ElementOptionsFlashcard,
                isArchived,
                owner: {
                  connect: {
                    id: userId,
                  },
                },
              },
            })

            // create a derived permission for the newly created element
            await prisma.derivedPermission.upsert({
              where: {
                elementId_userId: {
                  elementId: Flashcard.id,
                  userId: userId,
                },
              },
              create: {
                permissionLevel: PermissionLevel.OWNER,
                element: {
                  connect: { id: Flashcard.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
              update: {
                permissionLevel: PermissionLevel.OWNER,
              },
            })

            return true
          } catch (error) {
            throw error
          }
        },
        async deleteElements() {
          try {
            await prisma.element.deleteMany({})
            return true
          } catch (error) {
            throw error
          }
        },
        // #endregion

        // ! Practice Quiz queries / mutations
        // #region
        async getPracticeQuizInfo({ quizName }) {
          try {
            const practiceQuizzes = await prisma.practiceQuiz.findMany({
              where: {
                name: quizName,
              },
            })

            if (!practiceQuizzes || practiceQuizzes.length === 0) {
              return null
            }

            return {
              id: practiceQuizzes[0].id,
              courseId: practiceQuizzes[0].courseId,
            }
          } finally {
            await prisma.$disconnect()
          }
        },
        async removeSoftDeletedPracticeQuiz({ quizName }) {
          try {
            const practiceQuizzes = await prisma.practiceQuiz.deleteMany({
              where: {
                name: quizName,
                isDeleted: true,
              },
            })

            if (!practiceQuizzes) {
              return false
            }

            return true
          } catch (error) {
            throw error
          }
        },
        // #endregion

        // ! Microlearning queries / mutations
        // #region
        async getMicroLearningInfo({ mlName }) {
          try {
            const microLearnings = await prisma.microLearning.findMany({
              where: {
                name: mlName,
              },
            })

            if (!microLearnings || microLearnings.length === 0) {
              return null
            }

            return {
              id: microLearnings[0].id,
              courseId: microLearnings[0].courseId,
            }
          } finally {
            await prisma.$disconnect()
          }
        },
        async removeSoftDeletedMicrolearning({ mlName }) {
          try {
            const microLearnings = await prisma.microLearning.deleteMany({
              where: {
                name: mlName,
                isDeleted: true,
              },
            })

            if (!microLearnings) {
              return false
            }

            return true
          } catch (error) {
            throw error
          }
        },
        // #endregion

        // ! Answer Collection queries / mutations
        // #region
        async createAnswerCollection({
          name,
          description,
          entries,
          userId,
        }: {
          name: string
          description: string
          entries: string[]
          userId: string
        }) {
          try {
            const answerCollection = await prisma.answerCollection.create({
              data: {
                name,
                description,
                entries: {
                  create: entries.map((entry) => ({
                    value: entry,
                  })),
                },
                owner: {
                  connect: {
                    id: userId,
                  },
                },
              },
            })

            // create a derived permission for the newly created answer collection
            await prisma.derivedPermission.upsert({
              where: {
                answerCollectionId_userId: {
                  answerCollectionId: answerCollection.id,
                  userId: userId,
                },
              },
              create: {
                permissionLevel: PermissionLevel.OWNER,
                answerCollection: {
                  connect: { id: answerCollection.id },
                },
                user: {
                  connect: { id: userId },
                },
              },
              update: {
                permissionLevel: PermissionLevel.OWNER,
              },
            })

            return true
          } catch (error) {
            throw error
          }
        },
        // #endregion

        // ! Live Quiz queries / mutations
        // #region
        async removeSoftDeletedLiveQuiz({ lqName }) {
          try {
            const liveQuizzes = await prisma.liveQuiz.deleteMany({
              where: {
                name: lqName,
                isDeleted: true,
              },
            })

            if (!liveQuizzes) {
              return false
            }

            return true
          } catch (error) {
            throw error
          }
        },
        async verifyLiveQuizPin({ pin, name }) {
          try {
            const liveQuiz = await prisma.liveQuiz.findFirst({
              where: { name, isDeleted: false },
            })

            if (!liveQuiz) {
              throw new Error('Live quiz not found')
            }

            return liveQuiz.pinCode === pin
          } catch (error) {
            throw error
          }
        },
        async getLiveQuizPin({ name }) {
          try {
            const liveQuiz = await prisma.liveQuiz.findFirst({
              where: { name, isDeleted: false },
            })

            if (!liveQuiz) {
              throw new Error('Live quiz not found')
            }

            return liveQuiz.pinCode
          } catch (error) {
            throw error
          }
        },
        async seedWordCloudLiveQuizResponses({
          freeTextAnswer,
          freeTextTitle,
          numericalAnswer,
          numericalTitle,
          quizName,
          secondFreeTextAnswer,
          secondFreeTextTitle,
        }: {
          freeTextAnswer: string
          freeTextTitle: string
          numericalAnswer: string
          numericalTitle: string
          quizName: string
          secondFreeTextAnswer: string
          secondFreeTextTitle: string
        }) {
          try {
            const liveQuiz = await prisma.liveQuiz.findFirst({
              where: { name: quizName, isDeleted: false },
              include: {
                blocks: {
                  include: { elements: true },
                  orderBy: { order: 'asc' },
                },
              },
            })

            if (!liveQuiz) {
              throw new Error(`Live quiz ${quizName} not found`)
            }

            const block = liveQuiz.blocks[0]
            if (!block) {
              throw new Error(`Live quiz ${quizName} has no blocks`)
            }

            const instances = liveQuiz.blocks.flatMap((block) => block.elements)
            const getInstance = (title: string, type: ElementType) => {
              const instance = instances.find(
                (element) =>
                  element.elementType === type &&
                  typeof element.elementData === 'object' &&
                  element.elementData !== null &&
                  'name' in element.elementData &&
                  element.elementData.name === title
              )

              if (!instance) {
                throw new Error(
                  `Instance ${title} (${type}) not found in live quiz ${quizName}`
                )
              }

              return instance
            }

            const numericalInstance = getInstance(
              numericalTitle,
              ElementType.NUMERICAL
            )
            const freeTextInstance = getInstance(
              freeTextTitle,
              ElementType.FREE_TEXT
            )
            const secondFreeTextInstance = getInstance(
              secondFreeTextTitle,
              ElementType.FREE_TEXT
            )

            const openResults = (value: string, normalize: boolean) => {
              const normalizedValue = normalize
                ? value.trim().toLowerCase()
                : String(parseFloat(value))
              const hash = createHash('md5')
                .update(normalizedValue)
                .digest('hex')

              return {
                responses: {
                  [hash]: {
                    value: normalizedValue,
                    count: 1,
                  },
                },
                total: 1,
              }
            }

            await prisma.$transaction([
              prisma.elementInstance.update({
                where: { id: numericalInstance.id },
                data: {
                  anonymousResults: openResults(numericalAnswer, false),
                },
              }),
              prisma.elementInstance.update({
                where: { id: freeTextInstance.id },
                data: {
                  anonymousResults: openResults(freeTextAnswer, true),
                },
              }),
              prisma.elementInstance.update({
                where: { id: secondFreeTextInstance.id },
                data: {
                  anonymousResults: openResults(secondFreeTextAnswer, true),
                },
              }),
              prisma.elementBlock.update({
                where: { id: block.id },
                data: {
                  closedAt: new Date(),
                  status: ElementBlockStatus.EXECUTED,
                },
              }),
              prisma.liveQuiz.update({
                where: { id: liveQuiz.id },
                data: { activeBlockId: null },
              }),
            ])

            return true
          } catch (error) {
            throw error
          }
        },
        async deleteLiveQuiz({ name }: { name: string }) {
          try {
            const liveQuiz = await prisma.liveQuiz.findFirst({
              where: { name, isDeleted: false },
            })

            if (!liveQuiz) {
              throw new Error('Live quiz not found')
            }

            await prisma.liveQuiz.delete({
              where: { id: liveQuiz.id },
            })

            return true
          } catch (error) {
            throw error
          }
        },
        // #endregion

        // ! Group Activity queries / mutations
        // #region
        async removeSoftDeletedGroupActivity({ gaName }) {
          try {
            const groupActivities = await prisma.groupActivity.deleteMany({
              where: {
                name: gaName,
                isDeleted: true,
              },
            })

            if (!groupActivities) {
              return false
            }

            return true
          } catch (error) {
            throw error
          }
        },
        // #endregion

        // ! Activity status modifications
        // #region
        async changeActivityStatus({
          activityName,
          activityType,
          status,
        }: {
          activityName: string
          activityType: string
          status: PublicationStatus
        }) {
          try {
            if (activityType === 'LIVE_QUIZ') {
              const liveQuiz = await prisma.liveQuiz.findFirst({
                where: { name: activityName, isDeleted: false },
              })

              if (!liveQuiz) {
                throw new Error(`Live quiz ${activityName} not found`)
              }

              await prisma.liveQuiz.update({
                where: { id: liveQuiz.id },
                data: { status },
              })
            } else if (activityType === 'PRACTICE_QUIZ') {
              const practiceQuiz = await prisma.practiceQuiz.findFirst({
                where: { name: activityName, isDeleted: false },
              })

              if (!practiceQuiz) {
                throw new Error(`Practice quiz ${activityName} not found`)
              }

              await prisma.practiceQuiz.update({
                where: { id: practiceQuiz.id },
                data: { status },
              })
            } else if (activityType === 'MICRO_LEARNING') {
              const microLearning = await prisma.microLearning.findFirst({
                where: { name: activityName, isDeleted: false },
              })

              if (!microLearning) {
                throw new Error(`Microlearning ${activityName} not found`)
              }

              await prisma.microLearning.update({
                where: { id: microLearning.id },
                data: { status },
              })
            } else if (activityType === 'GROUP_ACTIVITY') {
              const groupActivity = await prisma.groupActivity.findFirst({
                where: { name: activityName, isDeleted: false },
              })

              if (!groupActivity) {
                throw new Error(`Group activity ${activityName} not found`)
              }

              await prisma.groupActivity.update({
                where: { id: groupActivity.id },
                data: { status },
              })
            }
          } finally {
            await prisma.$disconnect()
            return true
          }
        },
        // #endregion

        // ! Permission queries / mutations
        // #region
        async updateLecturerPreviewFlags({
          publicPreview,
          privatePreview,
        }: {
          publicPreview: boolean
          privatePreview: boolean
        }) {
          try {
            const user = await prisma.user.update({
              where: {
                shortname: 'lecturer',
              },
              data: {
                publicPreview,
                privatePreview,
              },
            })

            return !!user
          } finally {
            await prisma.$disconnect()
          }
        },
        // #endregion

        // ! Course Management / PINs
        // #region
        async createCourse({
          name,
          displayName,
          description,
          notificationEmail,
          startDate,
          endDate,
          color,
          isAssessmentEnabled = true,
          isGamificationEnabled = true,
          isGroupCreationEnabled = true,
          groupDeadlineDate,
          maxGroupSize = 4,
          preferredGroupSize = 2,
          participants = [],
        }: {
          name: string
          displayName: string
          description?: string
          notificationEmail?: string
          startDate?: Date
          endDate?: Date
          color?: string
          isAssessmentEnabled?: boolean
          isGamificationEnabled?: boolean
          isGroupCreationEnabled?: boolean
          groupDeadlineDate?: Date
          maxGroupSize?: number
          preferredGroupSize?: number
          participants?: string[]
        }) {
          try {
            const course = await prisma.course.create({
              data: {
                name,
                displayName,
                description,
                notificationEmail,
                isAssessmentEnabled,
                isGamificationEnabled,
                color,
                pinCode: !isAssessmentEnabled
                  ? Math.floor(100000000 + Math.random() * 900000000)
                  : null,
                startDate,
                endDate,
                isGroupCreationEnabled,
                groupDeadlineDate: groupDeadlineDate ?? endDate,
                maxGroupSize,
                preferredGroupSize,
                authType: isAssessmentEnabled
                  ? CourseAuthType.SSO
                  : CourseAuthType.PIN,
                owner: { connect: { id: USER_ID_TEST } },
              },
            })

            await prisma.derivedPermission.upsert({
              where: {
                courseId_userId: {
                  courseId: course.id,
                  userId: USER_ID_TEST,
                },
              },
              create: {
                permissionLevel: PermissionLevel.OWNER,
                course: { connect: { id: course.id } },
                user: { connect: { id: USER_ID_TEST } },
              },
              update: { permissionLevel: PermissionLevel.OWNER },
            })

            for (const username of participants) {
              const participant = await prisma.participant.findUnique({
                where: { username },
              })

              if (participant) {
                await prisma.participation.create({
                  data: {
                    participant: { connect: { id: participant.id } },
                    course: { connect: { id: course.id } },
                  },
                })
              }
            }

            return !!course
          } finally {
            await prisma.$disconnect()
          }
        },

        async getCoursePin({ courseName }: { courseName: string }) {
          try {
            const course = await prisma.course.findFirst({
              where: { name: courseName },
            })

            if (!course) {
              throw new Error(`Course with name ${courseName} not found.`)
            }

            return course.pinCode
          } finally {
            await prisma.$disconnect()
          }
        },
        // #endregion

        // ! Cleanup / Seeding
        // #region
        cleanupDatabase,
        seedDatabase,
        seedActivities,
        // #endregion

        // ! Course Q&A helpers
        // #region
        async setCourseQAFlags({
          courseName,
          isCourseQARolloutEnabled,
          isCourseQAEnabled,
          isCourseQAAnonymousEnabled,
          isGamificationEnabled,
          isAssessmentEnabled,
          description,
        }: {
          courseName: string
          isCourseQARolloutEnabled?: boolean
          isCourseQAEnabled?: boolean
          isCourseQAAnonymousEnabled?: boolean
          isGamificationEnabled?: boolean
          isAssessmentEnabled?: boolean
          description?: string | null
        }) {
          try {
            const course = await prisma.course.findFirst({
              where: { name: courseName },
            })
            if (!course) return false

            await prisma.course.update({
              where: { id: course.id },
              data: {
                ...(typeof isCourseQARolloutEnabled === 'boolean' && {
                  isCourseQARolloutEnabled,
                }),
                ...(typeof isCourseQAEnabled === 'boolean' && {
                  isCourseQAEnabled,
                }),
                ...(typeof isCourseQAAnonymousEnabled === 'boolean' && {
                  isCourseQAAnonymousEnabled,
                }),
                ...(typeof isGamificationEnabled === 'boolean' && {
                  isGamificationEnabled,
                }),
                ...(typeof isAssessmentEnabled === 'boolean' && {
                  isAssessmentEnabled,
                }),
                ...(description !== undefined && { description }),
              },
            })
            return true
          } catch (error) {
            throw error
          }
        },
        async getCourseOverviewSettings({
          courseName,
        }: {
          courseName: string
        }) {
          return prisma.course.findFirst({
            where: { name: courseName },
            select: {
              isGamificationEnabled: true,
              isAssessmentEnabled: true,
              description: true,
            },
          })
        },
        async grantCourseReadAccess({
          courseName,
          userEmail,
        }: {
          courseName: string
          userEmail: string
        }) {
          const [course, user] = await Promise.all([
            prisma.course.findFirst({ where: { name: courseName } }),
            prisma.user.findUnique({ where: { email: userEmail } }),
          ])
          if (!course || !user) return false

          await prisma.derivedPermission.upsert({
            where: {
              courseId_userId: {
                courseId: course.id,
                userId: user.id,
              },
            },
            create: {
              courseId: course.id,
              userId: user.id,
              permissionLevel: PermissionLevel.READ,
            },
            update: {
              permissionLevel: PermissionLevel.READ,
            },
          })
          return true
        },
        // #endregion
      })

      return config
    },
  },

  retries: {
    runMode: 3,
  },
})
