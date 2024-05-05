export default {
  shared: {
    questions: {
      roundedTo: 'Round to {accuracy} decimal places.',
      numInvalidValue:
        'The entered value is not a number or is not in the specified range.',
      ftPlaceholder: 'Your answer...',
    },
    SC: {
      short: 'SC',
      typeLabel: 'Single Choice (SC)',
      text: 'Please select a single option.',
      richtext: 'Please select a <b>single</b> option.',
    },
    MC: {
      short: 'MC',
      typeLabel: 'Multiple Choice (MC)',
      text: 'Please select one or more options.',
      richtext: 'Please select <b>one or more</b> options.',
    },
    KPRIM: {
      short: 'KP',
      typeLabel: 'Kprim (KP)',
      text: 'Evaluate the statements for correctness.',
      richtext: 'Evaluate the statements for <b>correctness</b>.',
    },
    FREE_TEXT: {
      short: 'FT',
      typeLabel: 'Free Text (FT)',
      text: 'Please enter your answer.',
      richtext: 'Please enter your <b>answer</b>.',
    },
    NUMERICAL: {
      short: 'NR',
      typeLabel: 'Numerical (NR)',
      text: 'Please enter a number.',
      richtext: 'Please enter a <b>number</b>.',
    },
    CONTENT: {
      short: 'CT',
      typeLabel: 'Content (CT)',
    },
    FLASHCARD: {
      short: 'FC',
      typeLabel: 'Flashcard (FC)',
    },
    login: {
      installButton: 'Install Now',
    },
    generic: {
      download: 'Download',
      open: 'Open preview',
      profile: 'Profile',
      shortname: 'Shortname',
      yes: 'Yes',
      no: 'No',
      draft: 'Draft',
      scheduled: 'Scheduled',
      published: 'Published',
      points: 'Points',
      title: 'KlickerUZH',
      send: 'Send',
      submit: 'Submit',
      save: 'Save',
      start: 'Start',
      continue: 'Continue',
      cancel: 'Cancel',
      confirm: 'Confirm',
      close: 'Close',
      sendAnswer: 'Send answer',
      begin: 'Begin',
      finish: 'Finish',
      logout: 'Logout',
      login: 'Login',
      username: 'Username',
      usernameOrEmail: 'Username / E-mail',
      email: 'E-mail address',
      password: 'Password',
      token: 'Token',
      passwordRepetition: 'Password (repetition)',
      signin: 'Login',
      usernameError: 'Please enter your username.',
      passwordError: 'Please enter your password.',
      loginError: 'The username or password are incorrect.',
      systemError: 'An unexpected error occurred. Please try again later.',
      error: 'Error',
      back: 'Back',
      home: 'Home',
      questions: 'Questions',
      question: 'Question',
      feedbacks: 'Feedbacks',
      feedback: 'Feedback',
      explanation: 'Explanation',
      leaderboard: 'Leaderboard',
      repetition: 'Repetition',
      evaluation: 'Evaluation',
      liveQuiz: 'Live Quiz',
      practiceQuiz: 'Practice Quiz',
      practiceQuizzes: 'Practice Quizzes',
      microlearnings: 'Microlearning',
      microlearning: 'Microlearning',
      activeSessions: 'Active Quizzes',
      characters: 'characters',
      precision: 'Precision',
      unit: 'Unit',
      min: 'Min',
      minLong: 'Minimum',
      max: 'Max',
      maxLong: 'Maximum',
      free: 'Free',
      congrats: 'Congratulations!',
      thanks: 'Thank you!',
      bookmark: 'Bookmark',
      bookmarks: 'Bookmarks',
      group: 'Group',
      create: 'Create',
      join: 'Join',
      leave: 'Leave',
      documentation: 'Documentation',
      features: 'Features',
      groupActivities: 'Group activities',
      experiencePoints: 'Experience points',
      level: 'Level',
      levelX: 'Level: {number}',
      solution: 'Solution',
      sampleSolution: 'Sample solution',
      gamification: 'Gamification',
      liveQA: 'Live Q&A',
      moderation: 'Moderation',
      feedbackChannel: 'Feedback Channel',
      multiplier: 'Multiplier',
      options: 'Options',
      correct: 'Correct',
      delete: 'Delete',
      edit: 'Edit',
      duplicate: 'Duplicate',
      preview: 'Preview',
      createdAt: 'Created at {date}',
      updatedAt: 'Edited at {date}',
      startAt: 'Start at {time}',
      finishedAt: 'Finished at {time}',
      description: 'Description',
      settings: 'Settings',
      course: 'Course',
      startDate: 'Start date',
      endDate: 'End date',
      repetitionInterval: 'Repetition interval',
      order: 'Order',
      link: 'Link',
      respond: 'Respond',
      responses: 'Responses',
      ok: 'OK',
      language: 'Language',
      english: 'English',
      german: 'German',
      practicePool: 'Practice',
      practiceTitle: 'Practice Pool',
      practice: 'Practice Activities',
    },
    contentInput: {
      boldStyle:
        'Select this setting for bold text. The same can also be achieved with the standard keyboard shortcut cmd/ctrl+b.',
      italicStyle:
        'Select this setting for italic text. The same can also be achieved with the standard keyboard shortcut cmd/ctrl+i.',
      codeStyle: 'Select this setting for code styling.',
      citationStyle:
        'Select this option to insert a citation. Please note that currently new paragraphs (by a line break / Enter) are displayed as separate citations.',
      numberedList:
        'This option creates a numbered list. To create new points, simply insert a new line after an existing element. To return to standard text, press this button again.',
      unnumberedList:
        'This option creates an unnumbered list. To create new points, simply insert a new line after an existing element. To return to standard text, press this button again.',
      image:
        'Select this setting to include an image. Use the same syntax to include formulas in answer options.',
      latex:
        'Select this setting to include an inline LaTeX formula. Use the same syntax to include formulas in answer options.',
      latexCentered:
        'Select this setting to include a LaTeX formula centered on a separate line.',
    },
    leaderboard: {
      sessionTitle: 'Quiz Leaderboard',
      ranks: 'Ranks',
      points: 'Points',
      computed: 'Computed',
      collected: 'Collected',
      pointsCollected: 'Points (collected)',
      participantCount: 'Number of participants: {number}',
      groupCount: 'Number of groups: {number}',
      averagePoints: 'Average points: {number}',
      noPointsCollected:
        'No points have been collected in this quiz so far. As soon as this changes, podium and leaderboard will be displayed here.',
    },
    error: {
      '404': '404 Page not found',
      pwaWithoutUser:
        'Sorry, the page you requested does not exist. You can <login>sign in</login> to see an overview of all KlickerUZH elements your courses offer.',
      pwaWithUser:
        'Sorry, the page you requested does not exist. View an <home>overview</home> of all KlickerUZH elements your courses offer.',
      offlineHint:
        'You seem to be offline at the moment. Connect your device to the Internet to use the KlickerUZH app.',
    },
  },
  auth: {
    authentication: 'Authentication',
    delegatedAccess: 'Delegated Access',
    signedInAs: 'You are already logged in as {username}',
    tosAgreement:
      'I consent to the KlickerUZH <tos></tos> (updated on 26.08.2023) and <privacy></privacy> (updated on 26.08.2023).',
    tosAgreementRequired:
      'Please accept the terms of service and privacy policy before logging in.',
    termsOfService: 'Terms of Service',
    privacyPolicy: 'Privacy Policy',
    tosUrl: 'https://www.klicker.uzh.ch/terms_of_service',
    privacyUrl: 'https://www.klicker.uzh.ch/privacy_policy',
    loginInfo:
      'You do not need a management account to participate in activities or a course, only to create your own activities and courses.',
  },
  pwa: {
    general: {
      myCourses: 'My Courses',
      myBookmarks: 'My Bookmarks',
      joinCourse: 'Join Course',
      setupProfile: 'Setup profile',
      openInBrowser: 'Open in browser',
      selectCourse: 'Select course',
      setup: 'Log-in and App-Installation',
      appSetup: 'Installation of the KlickerUZH-App',
      firstLogin: 'First login and profile setup',
      polls: 'Polls',
      liveQA: 'Live-Q&A',
      userNotLoggedIn:
        'You are currently not logged in. <login>Please log in</login> if you want to collect points and XP and see an overview of your learning progress.',
      noSessionsActive: 'No quizzes active.',
      activeSessionsBy: 'Active quizzes by <i>{name}</i>',
      joinLeaderboardNotice: `
🎊 A warm welcome, {username}, to the course "{courseName}" 🎊

You are currently **not** participating in the course leaderboard, meaning that you can participate in all activities but will not collect any points, will not be listed on the leaderboard, and will not be eligible for achievements and awards. If you would like to participate in the gamified activities throughout this course, **click the button** below to join. You can leave the course leaderboard at any time, upon which all of your collected points will be **deleted**.

Other participants will only see your public **participant profile**, including pseudonym and total points/achievements on leaderboards. You can choose to hide your profile from other participants while still participating in the leaderboard, if you wish to do so (see [here](/editProfile)).
`,
    },
    createAccount: {
      dataProcessingTitle: 'Data Processing and Privacy',
      dataCollectionTitle: 'What data do you collect about me?',
      dataCollectionNotice:
        'We collect and store the profile information of your created participant account (e.g., email, pseudonym, password) as well as the data that arises during your interactions with courses (e.g., created groups) and completed activities (e.g., answers to questions asked). If you decide to participate in the optional leaderboard as part of a course, we additionally collect and store the accumulated scores as part of all activities.',
      dataSharingTitle: 'How will my data be shared with others?',
      dataSharingNotice: `
When you create an account and participate in courses and activities using KlickerUZH, the owners of the KlickerUZH accounts related to your courses will be able to see your **e-mail address** alongside some information on the KlickerUZH activities you participated in, and might use this information for the purpose of teaching their course with KlickerUZH, or, in **anonymized** form, for research purposes outside of KlickerUZH. They are required to inform you about any such use of your data beside the use within KlickerUZH.

The **detailed content** of your questions (e.g., in Live Q&A) or responses (e.g., in quizzes) will be shared with the owners of the KlickerUZH accounts only in **aggregate or anonymized form**. Only **nonsensitive** information like the number of interactions with, and collected points in activities, if you choose to participate in the leaderboard, will be shared in an identifiable way.

Your data will never be shared with other parties beside the above and will never be used for commercial purposes (e.g., marketing).`,
      dataUsageTitle: 'How is my data being used?',
      dataUsageNotice:
        'Your data is being used to provide the functionalities made available to you by KlickerUZH. Further analysis of any of the collected data outside of the KlickerUZH platform may only be performed in anonymized form and only for the purpose of teaching and research. Lecturers are obligated to inform you appropriately about any research that is being performed on your collected data.',
      dataStorageTitle: 'How long do you store my data?',
      dataStorageNotice:
        'Your account data, such as profile information, achievements, and experience points, as well as responses you give to questions in the KlickerUZH, will be stored for the lifetime of your account. Your points and ranking on course activities and leaderboards will be stored for as long as you participate on the respective course leaderboard. You can request deletion of your data and account at any time.',
      confirmationMessage:
        'I agree to the KlickerUZH [privacy policy](https://www.klicker.uzh.ch/privacy_policy) and [terms of service](https://www.klicker.uzh.ch/terms_of_service) and consent to the processing of my data as described therein. I am aware that I can participate in learning activities anonymously and without an account if I do not agree to these conditions.',
      usernameAvailability: 'This username is already taken.',
    },
    studentDocs: {
      pageList: `
In this documentation you will find the most important information about KlickerUZH in your course:

[Feature Overview](docs/features)
[First Login & Account Setup](docs/login)
[App installation](docs/appSetup)
      `,
      featuresTitle: 'Feature Overview',
      features: `
KlickerUZH offers you as a course participant a significant amount of functionalities. This overview summarizes the most important ones. The concrete functions available depend on the settings of your lecturers (e.g., whether group activities or a challenge are available) and will be communicated to you directly by the lecturers.

#### Polls and Live Quizzes

![Live Quiz _on the left_](/img_v3/06_live_quiz.png)

During the lecture, you have the possibility to answer the questions asked by the lecturers on [{pwa_url}/join/{shortname}]({pwa_url}/join/{shortname}) or in the KlickerUZH app (or, if available, in OLAT under the "Live Quiz" module). The results are displayed graphically without delay and can thus be presented and commented on by the lecturers after the answering time has expired.

No login is required to answer the questions. With a login you can participate in the challenge of your course and collect points.

#### Live Q&A and Real-time Feedback

![Live Q&A and Real-time Feedback _on the right_](/img_v3/06_live_quiz.png)

Do you have a question or would you like to give direct feedback on the lecture? With the Live Q&A you can ask the lecturers or assistants a question directly during the lecture - even if you are participating in the lecture from home. In addition, with the KlickerUZH you have the possibility to give the lecturers direct feedback on the speed and difficulty of the lecture during the lecture.

Participation is possible at [{pwa_url}/join/{shortname}]({pwa_url}/join/{shortname}) (also anonymously) or via the KlickerUZH app.

#### Practice Quizzes, Microlearning, and Flashcards

![Practice Quiz in OLAT](/img_v3/07_practice_quiz.png)

Practice quizzes, and microlearning and flashcards allow you to repeat the course content outside of the lecture time and receive direct feedback on your solution. Practice quizzes and flashcards are always and arbitrarily often available, microlearning on the other hand only once and in a limited time frame (e.g., once per week). All elements are directly accessible via the KlickerUZH app, or via the link provided by your lecturers (also anonymously). Flash cards are still being implemented and will be available after around 5 weeks of the fall term 2023.

While answering the questions, you can, if you are logged in, set personal bookmarks on important questions, and create your own question pool through that. You can send feedback on unclear questions to your lecturers using the report function.

#### Groups and Group Activities

During the semester, you might be provided with practical group activities that can only be solved as a group. These activities are intended to be entertaining, promote exchange with fellow students, and support the application of theories. Forming a group of 2-5 people is possible during the first few weeks of a course (as specified by the lecturer), typically before the first group activity begins. After that, the group remains active for the semester and competes against the other groups in the same course. Group formation and activities are only available to participants with a KlickerUZH account.

Within a group, you can compare your points with those of your fellow students; together you can also compare the group's performance with other groups. The accumulated points from group activities together with the aggregated points of all group members (average) result in the total group score.

#### Challenge

![Gamification](/img_v3/08_gamification.png)

All activities in the KlickerUZH are, if activated by the lecturers, part of a gamified challenge. As part of the challenge, you collect points for the course leaderboard (if you participate while logged in), experience points, and achievements.

The following activities are part of the challenge:

- Polls and Live Quizzes: 10 points per participation in a vote and up to 70 bonus points for a fast and correct answer to content questions. The fastest correct answer receives the most points.
- Practice Quizzes: 10 points if the first answer to a question is correct. 5 points for each additional correct repetition of a question (after the specified lock time has expired). In KPRIM questions, one mistake results in a halving of the score, and two or more mistakes yield no points.
- Microlearning: 10 points per correctly answered question in a microlearning. In KPRIM questions, one mistake results in a halving of the score, and two or more mistakes yield no points.
- Group Activities: Points on the group leaderboard based on the correctness of the activity (e.g., 800 of 1000 points if 80% was solved correctly). Additionally, achievements and points on the individual leaderboard can be distributed for each group member when passing a group activity (with a passing threshold of 50% of achievable points).
- Achievements: Collected achievements (e.g., reaching first place in a large live quiz) can result in bonus points, as noted on the corresponding achievements. Achievements are distributed automatically or manually by the lecturers.
- Multipliers: If multipliers are set on questions and/or activities, these multipliers are applied to the score (e.g., 2x, 3x, 4x). Multipliers are shown beside questions in practice quizzes and microlearning, and not visible in live quizzes.
      `,
      firstLoginTitle: 'First Login & Account Setup',
      firstLogin: `
If you are participating in KlickerUZH activities for the first time, you can register for a KlickerUZH participant account. A KlickerUZH participant account allows you to easily manage and access the learning content of your courses using KlickerUZH, as well as to add important elements to your private repetition library and participate in the gamified elements of your courses.

Depending on the technical set up of your course, you can proceed as follows:

#### Courses with LMS integration (e.g., OLAT)

Open the KlickerUZH module in the OLAT course of your lecture. To manage your KlickerUZH account or create a new one, click on "Manage account" within the KlickerUZH module.

![](/img_v3/01_create_account.png)

If you already possess a KlickerUZH account, simply visit any of the KlickerUZH activities in the LMS course and you should be logged in automatically. In case you are not logged in automatically, you can log in using the button on the top right.

If no KlickerUZH account exists for you yet, you will be greeted by a welcome page, which will allow you to create a new account. On this page you set an (anonymous) username and password, as well as your personal avatar.

#### Courses without LMS integration

If you already have a KlickerUZH account (e.g., from other courses), open the KlickerUZH app and click "Join course" below the course overview. Enter the 9-digit PIN you received from your lecturers. You are now part of the course and can participate in all activities.

![](/img_v3/05_join_course.png)

If you are participating in a course with KlickerUZH for the first time, open the access link you received from the lecturers of your course (e.g., _{pwa_url}/course/XYZ/join?pin=111111111_). You can use this to create a new KlickerUZH account with an (anonymous) username and password. With this data you can then log in and create your personal avatar, as well as participate in activities.

#### Anonymous participation

In general, it is also possible to participate anonymously in all elements of KlickerUZH. For live quizzes, you can find these for your course under: [{pwa_url}/join/{shortname}]({pwa_url}/join/{shortname})
Practice quizzes and microlearning are available via direct links that you can receive from your lecturers. When accessing KlickerUZH via the OLAT integration, you can choose to create an account and will thereafter be logged in automatically. If you do not have a KlickerUZH account, your participation in practice quizzes will remain anonymous.
      `,
      appSetupTitle: 'App Installation',
      appSetup: `
In order to be able to access KlickerUZH from anywhere, there is a KlickerUZH app. The app allows you to easily manage and access the learning content of your courses (using KlickerUZH), as well as add important elements to your private repetition library and participate in the gamified elements (Challenge). In addition, you can activate the push notifications for microlearning in your courses.

You can set up the KlickerUZH app as follows:

#### Android

You can download the KlickerUZH app on the Google Play store using the following link:

[https://play.google.com/store/apps/details?id=ch.uzh.bf.klicker.pwa](https://play.google.com/store/apps/details?id=ch.uzh.bf.klicker.pwa)

After installation, you should find the app on your home screen and can log in as usual. You can enable push notifications for your courses by clicking on the bell icon of the respective course, after which you will be informed about, e.g., new microlearning units.

#### iOS

Since the KlickerUZH app is not yet available on the iOS App Store, follow these instructions to add the app onto your home screen.

1. Open the following link on your smartphone: [{pwa_url}/login]({pwa_url}/login)
2. Use the share dialogue and click on the button “Add to Homescreen” / “Zum Startbildschirm zufügen”.
3. Accept that the app is being installed. Once the app is installed, you should be redirected to the log-in. You will also find a new KlickerUZH icon on your home screen.
      `,
    },
    login: {
      installAndroid:
        'Install the KlickerUZH app on your phone to receive push notifications when new learning content is available.',
      installIOS:
        "Open the Share dialog and click 'Add to Home Screen' to install the KlickerUZH app on your phone.",
      createAccountJoin: 'Create Account & Join Course',
      existingParticipantAccount:
        'Should you already have a KlickerUZH participant account, please use the login to sign in. You can join a new course after logging in. Otherwise, you can create a KlickerUZH account here as part of your course.',
      joinCourseTooltip:
        'Enter the PIN of your course here to create a new account and join the course. You can obtain the PIN from your lecturer.',
      signup: 'Sign up',
      coursePinInvalid: 'The entered course PIN is invalid.',
    },
    courses: {
      courseInformation: 'Course Information',
      createJoinGroup: 'Create/Join Group',
      createGroup: 'Create Group',
      joinGroup: 'Join Group',
      groupName: 'Group Name',
      code: 'Code',
      individualLeaderboard: 'Individual Leaderboard',
      groupLeaderboard: 'Group Leaderboard',
      individualLeaderboardUpdate:
        'The individual leaderboard will be updated hourly.',
      noGroups: "No groups have been created yet. Let's go!",
      noGroupPoints: "No group points have been collected yet. Let's go!",
      groupLeaderboardUpdate:
        'The group leaderboard will be updated daily.<b>x</b>Groups with a single member will not receive any points.',
      joinLeaderboardCourse: 'Join the leaderboard for <b>{name}</b>',
      membersScore: 'Points by group members',
      groupActivityScore: 'Points by group activities',
      totalScore: 'Total points',
      bookmarkedQuestionsTitle: 'Bookmarks for {courseName}',
      bookmarkedQuestionsDesc:
        'This page allows you to repeat all questions with bookmarks from the course {courseName}. They will be displayed as a regular practice quiz.',
      noBookmarksSet:
        'You have not bookmarked any questions yet. Simply click on the bookmark symbol on a question for this.',
      awards: 'Awards',
      open: 'open',
      leaveCourseTitle: 'Leave Leaderboard',
      leaveCourseConfirmation:
        'Are you sure you want to leave the course leaderboard?',
      leaveCourseInformation:
        'If you leave the leaderboard, your interactions with activities of this course, as well as collected points in this course, will be deleted. You can join again at any time, but will have to start from scratch.',
      noGamificationOrDescription:
        'Welcome to the course {courseName}! For this KlickerUZH course, gamification has been disabled by the lecturer and no leaderboard will be shown here. KlickerUZH will still list all course-related activities in the corresponding sections of the app for quick access.',
    },
    joinCourse: {
      title: 'Join Course "{name}"',
      introLoggedIn:
        'You are already logged in and can join the course {name} directly by entering the correct PIN.',
      introLoggedInNoCourse:
        'You are already logged in and can join a course directly by entering the corresponding PIN.',
      introNewUser:
        'Create your KlickerUZH account for the course {name} here. If you already have an account, please log-in and return to this page.',
      coursePinFormat: 'Course-PIN (format: ### ### ###)',
      coursePinNumerical: 'Please enter a numerical course PIN.',
      coursePinRequired: 'Please enter the course PIN.',
    },
    practiceQuiz: {
      flashcardClick: 'Click to turn card',
      studentFlashcardResponse: 'Did you know the answer?',
      flashcardNoResponse: 'No',
      flashcardPartialResponse: 'Partially',
      flashcardYesResponse: 'Yes',
      resetAnswers: 'Reset answers',
      markAllAsRead: 'Mark all as read',
      read: 'Read',
      feedbackTransmitted: 'Your feedback has been transmitted successfully.',
      feedbackRequired: 'Please add a text to your feedback.',
      flagElement: 'Report element',
      flagElementText:
        'This feedback form is intended to allow you to make a direct comment on the individual elements of a practice quiz / microlearning, should an error have crept in. The lecturer will receive a message with your feedback. Therefore, please try to describe the error as accurately as possible.',
      addFeedback: 'Add feedback',
      submitFeedback: 'Submit feedback',
      notFound:
        'The corresponding practice quiz is either not available or not yet published.',
      repetitionTitle: 'Repetition practice quizzes',
      noRepetition:
        'There are currently no practice quizzes available for repetition.',
      numOfQuestions: 'Number of questions: {number}',
      orderLAST_RESPONSE: 'Order: last answered questions at the end',
      orderSHUFFLED: 'Order: random order',
      orderSEQUENTIAL: 'Order: ordered in sequence',
      orderSPACED_REPETITION: 'Order: Spaced repetition',
      repetitionDaily: 'Repetition: daily',
      repetitionXDays: 'Repetition: every {days} days',
      answeredMinOnce: 'Min. answered once: {answered}/{total}',
      multiplicatorPoints: 'Multiplicator: {mult}x points',
      multiplicatorEval: '<b>Multiplicator</b> {mult}x',
      solvedPracticeQuiz:
        'You have successfully completed the practice quiz <it>{name}</it>.',
      pointsCollectedPossible: 'Points (collected/computed/available)',
      pointsComputedAvailable: 'Points (computed/available)',
      notAttempted: 'Not attempted',
      totalPoints: 'Total points (collected): {points}',
      totalXp: '{xp} XP collected',
      questionTypeNotSupported:
        'This question type is currently not available for practice quizzes',
      newPointsFrom: 'New points/XP from:',
      othersAnswered: 'Others answered as follows',
      flagQuestion: 'Report question',
      flagQuestionText:
        'This feedback form is intended to allow you to make a direct comment on the individual questions of a practice quiz / microlearning, should an error have crept in. The lecturer will receive a message with your feedback. Therefore, please try to describe the error as accurately as possible.',
      infoStack: 'Information element',
      inactiveParticipation:
        'You have successfully completed the practice quiz <it>{name}</it>. Since you are not part of the leaderboards in this course, your points will not be saved. To collect points in the future, join the leaderboard through the course overview.',
      missingParticipation:
        'You have successfully completed the practice quiz <it>{name}</it>. Since you are not a member of this course, your points and experience points will not be saved. To collect points and XP in the future, join the course now.',
    },
    microLearning: {
      numOfQuestionSets: 'Number of question sets: {number}',
      notFound:
        'The corresponding microlearning is either not available or not yet active.',
      solvedMicrolearning:
        'You have successfully completed the microlearning <it>{name}</it>.',
      inactiveParticipation:
        'You have successfully completed the microlearning <it>{name}</it>. Since you are not part of the leaderboards in this course, your points will not be saved. To collect points in the future, join the leaderboard through the course overview.',
      missingParticipation:
        'You have successfully completed the microlearning <it>{name}</it>. Since you are not a member of this course, your points and experience points will not be saved. To collect points and XP in the future, join the course now.',
      availableFrom: 'Available from {date}',
      availableUntil: 'Available until {date}',
      questionSetN: 'Question set {number}',
    },
    session: {
      noActiveQuestion: 'No question active.',
      allQuestionsAnswered: 'You have already answered all active questions.',
    },
    feedbacks: {
      title: 'Feedback Channel',
      speed: 'Speed',
      difficulty: 'Difficulty',
      openQuestions: 'Open Questions',
      resolvedQuestions: 'Resolved Questions',
      feedbackPlaceholder: 'Enter your question / feedback',
      postedAt: 'Posted at {date}',
      solvedAt: 'Resolved at {date}',
    },
    profile: {
      publicProfile: 'Profile Visibility',
      isProfilePublic:
        'Should your profile and pseudonym be displayed to other participants? If you deactivate this option, you will be displayed as Anonymous to other participants. Note that you will see all other participants as Anonymous as well.',
      editProfile: 'Edit profile',
      editProfileFailed:
        'Unfortunately, an error occurred while saving the changes. The username you have chosen may already be taken. Please check your entries and try again.',
      editProfileSuccess: 'Your profile has been updated successfully.',
      achievements: 'Achievements',
      myProfile: 'My Profile',
      createProfile: 'Create Profile',
      usernameMinLength:
        'The username must be at least {length} characters long.',
      usernameMaxLength:
        'The username must not be longer than {length} characters.',
      passwordMinLength:
        'The password must be at least {length} characters long.',
      identicalPasswords: 'Passwords must match.',
      emailRequired: 'Please enter an e-mail address.',
      emailInvalid: 'Please enter a valid e-mail address.',
      usernameRequired: 'Please enter a username here.',
      passwordRequired: 'Please enter a password here.',
      welcomeMessage:
        'Welcome to KlickerUZH! If this is your first time here, please set a password and define your own username and avatar.',
      deleteProfile: 'Delete Account',
      deleteProfileDescription:
        'Deleting your KlickerUZH account will irreversibly delete all associated data.',
      deleteProfileConfirmation:
        'Are you sure you want to delete your account? All data related to your account will be deleted. This action cannot be undone.',
      privacyDataCollection: '',
      privacyDataSharing: '',
      privacyDataUsage: '',
      privacyDataStorage: '',
      emailMissing:
        'Your KlickerUZH account is missing an email address, which is required to ensure complete functionality. Please provide a valid address below and save your changes.',
    },
    avatar: {
      hair: 'Hair',
      hairColor: 'Hair Color',
      eyes: 'Eyes',
      accessory: 'Glasses',
      mouth: 'Mouth',
      facialHair: 'Facial Hair',
      clothing: 'Clothing',
      clothingColor: 'Clothing Color',
      skinTone: 'Skin Tone',
      breasts: 'Female',
      chest: 'Male',
      normal: 'Normal',
      happy: 'Happy',
      content: 'Content',
      squint: 'Focused',
      heart: 'Hearts',
      light: 'Light',
      dark: 'Dark',
      long: 'Long',
      bun: 'Bun',
      short: 'Short',
      buzz: 'Very short',
      afro: 'Afro',
      blonde: 'Blonde',
      black: 'Black',
      brown: 'Brown',
      white: 'White',
      blue: 'Blue',
      green: 'Green',
      red: 'Red',
      grin: 'Grin',
      openSmile: 'Open Smile',
      open: 'Open',
      serious: 'Serious',
      tongue: 'Tongue',
      none: 'None',
      roundGlasses: 'Standard glasses',
      tinyGlasses: 'Reading glasses',
      shades: 'Sunglasses',
      stubble: 'Stubble',
      mediumBeard: 'Medium beard',
      wink: 'Wink',
      shirt: 'Shirt',
      dressShirt: 'Suit',
      dress: 'Dress',
    },
    achievements: {
      notAchievedYet: 'Not achieved yet',
      noAchievements: 'No achievements yet.',
    },
    groupActivity: {
      openGroupActivity: 'Open Group Activity',
      activityNotYetActive:
        'The group activity is not active or not yet unlocked.',
      initialSituation: 'Situation',
      yourHints: 'Your hints',
      coordinateHints:
        'Each group member receives one or more of the hints above.<br></br> Coordinate with each other to collect all the necessary hints for the tasks.',
      yourGroup: 'Your group',
      groupCompleteQuestion:
        'Is your group complete? If so, click Start to distribute the hints among your group members. Members who join the group after the assignment will not receive any additional hints.',
      startCaps: 'START',
      minTwoPersons:
        'Unfortunately, groups with only one member cannot participate in the group quest.<br></br> Find at least one partner to join or check out the task in Excel, which we will publish after the submission deadline.',
      yourTasks: 'Your tasks',
      sendAnswers: 'Submit answers',
      oneSolutionPerGroup:
        'Each group can only submit one solution. Only submit your solutions when you are sure.',
      alreadySubmittedAt:
        'Your group has already submitted its solutions (on {date}).<br></br> The evaluation will be published later and communicated separately.',
      joinLeaderboard:
        'In order to collect points within the scope of the group activity, you must join the course leaderboard. To do this, switch to the other tab and confirm your participation.',
    },
  },
  manage: {
    general: {
      qrCode: 'QR Code',
      presentQrCode: 'Present QR code',
      questionPool: 'Question Pool',
      sessions: 'Live Quizzes',
      courses: 'Courses',
      migration: 'Migration',
      generateToken: 'Generate login token',
      '404Message':
        'The page you requested does not exist. Please return to the <link>question pool</link> or use the main menu at the top for further navigation.',
      date: 'Date',
      title: 'Title',
      searchPlaceholder: 'Search...',
      sortBy: 'Sort by...',
      catalystRequired:
        'Requires catalyst access. For more information, see <link></link>.',
    },
    support: {
      modalTitle: 'Support KlickerUZH',
      yourFeedback: 'Your Feedback',
      feedbackText:
        'Do you have any feedback for us? Are you experiencing issues when using the KlickerUZH? Please provide us with your feedback so we can continue to improve the KlickerUZH for you.',
      featureRequest: 'Feature Request',
      featureRequestDesc: 'I would like to request a new feature.',
      bugReport: 'Bug Report',
      bugReportDesc: 'I would like to report a bug or issue.',
      selfHosting: 'Self-Hosting',
      selfHostingDesc: 'I have problems when self-hosting the KlickerUZH.',
      furtherResources: 'Further Resources',
      documentationDesc: 'Tutorials, feature documentation, and release notes',
      faq: 'FAQ',
      faqDesc: 'Frequently asked questions',
      connect: 'Connect with Us',
      community: 'Community',
      communityDesc:
        'A place for discussions and questions regarding the KlickerUZH',
      email: 'E-Mail',
      emailDesc: 'Contact us at klicker@bf.uzh.ch',
      aboutProject: 'About the Project',
      projectUpdates: 'Project Updates',
      projectUpdatesDesc:
        'Regular updates regarding the progress of our project',
      roadmap: 'Roadmap',
      roadmapDesc: 'Our current priorities and plans for the future',
      releaseNotes: 'Release Notes',
      releaseNotesDesc: 'Overview of changes in our latest releases',
      openSource: 'Open-Source',
      githubRepository: 'GitHub Repository',
      githubRepositoryDesc: 'Source code of the open-source project',
    },
    login: {
      lecturerLogin: 'Login Lecturers',
      installAndroid:
        'Install the KlickerUZH Manage app on your phone to use certain functions for lecturers at any time.',
      installIOS:
        "Open the Share dialog and click 'Add to Home Screen' to install the KlickerUZH Manage app on your phone.",
    },
    firstLogin: {
      welcome: 'Welcome to KlickerUZH!',
      makeFirstSettings:
        'Since this is your first time with us, we would like to help you make some important settings right away to get you started as efficiently as possible. For now, this includes your preferred language as well as the shortname associated with this account. Both can still be changed at any time in the user settings.',
      relevantLinks:
        'Make sure you have seen and/or bookmarked the following relevant links:',
      watchVideo:
        'Please consider taking the time to watch the following introductory video, covering all core concepts of KlickerUZH v3.0 and its main features. In case you are in a hurry, directly submit your initial settings with the button below the video.',
    },
    settings: {
      userSettings: 'User Settings',
      languageSettings: 'Language Settings',
      languageTooltip:
        'Change the language of the KlickerUZH Manage App here. Please note that this has no influence on your course content or the language settings of other users or students in your courses.',
      confirmDelegatedAcces: 'Confirm delegated login creation',
      confirmDelegatedAccesTooltip:
        'Please check your delegated access login credentials. Make sure to copy the password before closing this dialogue, as it cannot be shown again.',
      FULL_ACCESS: 'Full Access',
      SESSION_EXEC: 'Session Execution',
      READ_ONLY: 'Read Only',
      ACCOUNT_OWNER: 'Account Owner',
      lastUsed: 'last used: {date}',
      lastUsedNever: 'last used: never',
      createDelegatedLogin: 'Create delegated login',
      delegatedLoginDescription:
        'When logging in, use the shortname of your main account and the password of the delegated login.',
      copiedPassword: 'Password has been copied to the clipboard successfully.',
      loginName: 'Login description',
      scope: 'Scope',
      selectScope: 'Select scope',
      createLogin: 'Create login',
      nameRequired: 'Please enter a name for your login.',
      scopeRequired: 'Please select the scope for your login.',
      shortnameTooltip:
        'The shortname is bound to the main account and can be changed via a separate setting above.',
      passwordTooltip:
        'The password is automatically generated. Please write it down before creating the login, it will not be visible anymore afterwards. If you want to change it, you can generate a new one using the button on the right.',
      shortnameRequirements:
        'The shortname plays an important role across KlickerUZH, as it allows for easy access to courses and other practice quizzes in many places. Please follow the following rules when choosing the shortname: <ul><li>The shortname must be at least 5 and at most 8 characters long.</li><li>The shortname may only consist of letters and numbers.</li></ul>',
      shortnameRequired: 'Please enter a shortname.',
      shortnameMin: 'The shortname must be at least 5 characters long.',
      shortnameMax: 'The shortname must be at most 8 characters long.',
      shortnameAlphanumeric:
        'The shortname may only consist of letters and numbers.',
      shortnameTaken: 'The shortname you have chosen is already taken.',
      emailUpdates: 'Project Updates via E-Mail',
      emailUpdatesTooltip:
        'Changing this setting will influence the emails you will receive in connection with KlickerUZH. Emails on major releases will always be sent to your Edu-ID email address (ca. 2x per year), more frequent project updates on, e.g., beta testing or surveys, can be enabled or disabled here.',
    },
    token: {
      pageName: 'Token Generation',
      tokenGenerationTitle: 'Generation of a Login Token',
      tokenGenerationExplanation:
        'On this page you can generate a token to log into the Klicker control app at <link>{displayLink}</link>. This token has a validity of 10 minutes, but can be regenerated at any time.',
      generateToken: 'Generate token!',
      tokenTitle: 'Your login token is:',
      remainingValidity: 'Remaining validity:',
      tokenExpired:
        'Unfortunately, your token has expired, please generate a new one.',
    },
    migration: {
      pageName: 'Migrate Data from KlickerV2',
      step1Title: 'Step 1: Request Migration Token',
      step1Description:
        'To migrate your old account to KlickerUZH v3.0, provide the e-mail linked to your old account (see https://app.klicker.uzh.ch/user/settings). After submitting the e-mail, you will receive a link to proceed. If you do not receive a message on the provided e-mail within the next 5 minutes, please check your spam folder and try starting the migration process again. Please ensure you have access to your old e-mail inbox. In case of issues with the migration, please contact us at klicker@bf.uzh.ch.',
      requestMigrationToken: 'Request Migration Token',
      step2Title: 'Step 2: Insert Migration Link',
      step2Description:
        'You should have received an email containing a migration link to your KlickerUZH-v2.0 mailbox. If it is not in your inbox, check the spam folder, or try starting the migration process again. Click or copy the received link and paste it into the address bar of your browser to proceed. In case of issues with the migration, please contact us at klicker@bf.uzh.ch.',
      step3Title: 'Step 3: Start Migration',
      step3Description:
        'You are almost done! Having verified your email, you are all set to initiate the migration. Please note that the migration may take some time. You can close the page once the migration is started. You will receive an email to {email} once the migration is complete. In case of issues with the migration, please contact us at klicker@bf.uzh.ch.',
      startMigration: 'Start Migration',
      step4Title: 'Step 4: Migration Status Notification',
      step4Description:
        'Please note that the migration may take some time. You can close the page once the migration is started. You will receive an email to {email} once the migration is complete. In case of issues with the migration, please contact us at klicker@bf.uzh.ch.',
    },
    questionPool: {
      createLiveQuiz: 'Create live quiz',
      createMicrolearning: 'Create microlearning',
      createPracticeQuiz: 'Create practice quiz',
      createGroupTask: 'Create group activity',
      createQuestionCaps: 'CREATE QUESTION',
      resetFilters: 'Reset filters',
      showArchived: 'Show archived',
      hideArchived: 'Hide archived',
      elementTypes: 'Element types',
      tags: 'Tags',
      untagged: 'Untagged',
      noTagsAvailable: 'No tags available',
      answerFeedbacks: 'Answer feedbacks',
      noQuestionsWarning:
        'We could not find any questions that meet the desired criteria. Please try other filters or create a new question.',
      deleteQuestion: 'Delete question',
      confirmDeletion:
        'Are you sure you want to delete the following question(s)?',
      noQuestionRecovery:
        'This action cannot be undone. The question(s) will be permanently deleted and cannot be restored. Questions will not be removed from existing activities.',
      numSelected: '{count}/{total}',
      moveToArchive: 'Move to archive',
      restoreFromArchive: 'Restore from archive',
    },
    tags: {
      deleteTag: 'Delete tag',
      confirmTagDeletion: 'Are you sure you want to delete the following tag?',
      tagDeletionHint:
        'Deleted tags cannot be restored. All questions with this tag will remain, but the tag will be removed.',
      validName: 'Please enter a valid name for your tag.',
    },
    questionForms: {
      CREATETitle: 'Create question',
      EDITTitle: 'Edit question',
      DUPLICATETitle: 'Duplicate question',
      questionType: 'Question type',
      selectQuestionType: 'Select question type',
      questionTitle: 'Question title',
      titleTooltip:
        'Enter a short, summary title for the question. This is only used for better overview.',
      tagsTooltip:
        'Add tags to your question to improve organization and reusability (similar to previous folders).',
      tagFormatting:
        'Temporarily required formatting: Enter tags separated by commas, e.g.: Tag1,Tag2,Tag3',
      multiplierTooltip:
        'Select a multiplier with which the points for this question should be multiplied. It can be chosen between 1 and 4.',
      questionTooltip:
        'Enter the question you want to ask the participants. The rich text editor allows you to use the following (block) formatting: bold text, italic text, code, quotes, numbered lists, unordered lists and LaTeX formulas. Hover over the individual buttons for more information.',
      questionPlaceholder: 'Enter your question here...',
      explanationTooltip:
        'Enter a generic explanation of your question here, which will be displayed to students in practice quizzes and microlearning regardless of their answer as an explanation of the correct solution.',
      explanationPlaceholder: 'Enter your explanation here...',
      answerOptions: 'Answer options',
      answerOption: 'Answer option',
      answerOptionsTooltip:
        'Enter the possible answers that students can select for the question here.',
      answerOptionPlaceholder: 'Enter your answer option here...',
      FTOptionsTooltip:
        'Enter optional settings for the open question here. Note that the range of numbers for numerical questions is limited to the interval [-1e30,1e30] for technical reasons. Should you require to use larger numbers, please use a free text question instead.',

      LISTDisplay: 'Display as list',
      GRIDDisplay: 'Display as grid',
      feedbackPlaceholder: 'Enter feedback…',
      addAnswer: 'Add new answer',
      solutionRanges: 'Solution ranges',
      solutionRangesTooltip:
        'Enter the intervals that should be considered correct here.',
      addSolutionRange: 'Add new solution range',
      maximumLength: 'Maximum length',
      answerLength: 'Answer length',
      possibleSolutionN: 'Possible solution {number}',
      possibleSolutions: 'Possible solutions',
      addSolution: 'Add new solution',
      noFeedbackDefined: 'No feedback defined',
      createElement: 'Create {element}',
      editElement: 'Edit {element}',
      cancelCreation: 'Cancel creation',
      cancelEditing: 'Cancel editing',
      mediaLibrary: 'Media Library',
      uploadImageHeader: 'Upload Media',
      uploadImageDescription:
        'Drag an image here to upload or click to open file explorer.',
      updateInstances: 'Update question instances in KlickerUZH elements',
      updateInstancesExplanation:
        'Use this setting to update the question in all planned quizzes, practice quizzes and microlearnings. The content of questions in running and completed elements will not be updated. Changed multipliers will also be applied to the created instances.',
    },
    sessionForms: {
      sessionName: 'Please enter a name for your quiz.',
      sessionDisplayName: 'Please enter a valid display name for your quiz.',
      considerFormErrors: 'Please check the form for error messages.',
      startDate: 'Please enter a start date for your quiz.',
      endDate: 'Please enter an end date for your quiz.',
      endAfterStart: 'The end date has to be later than the start date.',
      validMultiplicator: 'Please enter a valid multiplicator.',
      checkValues:
        'Please check your entries in the previous step before proceeding.',
      name: 'Name',
      displayName: 'Display Name',
      multiplierDefault: 'Default: 1x',
      multiplier1: 'Simple (1x)',
      multiplier2: 'Double (2x)',
      multiplier3: 'Triple (3x)',
      multiplier4: 'Quadruple (4x)',
      changesSaved: 'Changes saved',
      elementCreated: 'Element has been created successfully',
      openOverview: 'Open overview',
      createNewElement: 'Create another element',
      enterContentHere: 'Enter your content here...',
      questionsDragDrop: 'Use drag and drop to add your questions here...',
      newQuestion: 'New question',
      blockSettingsTitle: 'Settings Block {blockIx}',
      timeLimit: 'Time limit',
      optionalTimeLimit: 'Optional time limit',
      timeLimitTooltip: 'Time limit for block {blockIx} in seconds',
      newBlock: 'New block',
      newBlockSelected: 'Add 1 block with {count} questions',
      pasteSelection: 'Add {count} questions',
      pasteSingleQuestions: 'Add {count} blocks with 1 question',
      displayNameTooltip:
        'Der Anzeigename wird den Teilnehmenden bei der Durchführung angezeigt.',
      microlearningTypes:
        'A microlearning can only contain single choice, multiple choice, kprim and numerical questions.',
      microlearningCreated:
        'Your microlearning <b>{name}</b> has been created successfully.',
      microlearningEdited:
        'Your microlearning <b>{name}</b> has been edited successfully.',
      microlearningDescription:
        'In this step, enter the name and description of the microlearning.',
      microlearningSettings:
        'In this step, select the start and end date and make further settings.',
      microlearningQuestions:
        'In this step, select the questions for the microlearning.',
      microlearningEditingFailed: 'Editing the Microlearning failed...',
      microlearningCreationFailed: 'Creating the Microlearning failed...',
      microlearningName:
        'This name should allow you to distinguish this microlearning from others. It will not be shown to the participants, please use the display name (next field) for this.',
      microlearningDescField:
        'Add a description to your microlearning that will be displayed to participants at the beginning.',
      microlearningCourse:
        'For the creation of a microlearning, the selection of the corresponding course is required.',
      microlearningStartDate:
        'Please choose the start date of the microlearning. The microlearning will be displayed to the participants from this point in time.',
      microlearningEndDate:
        'Please choose the end date of the microlearning. The microlearning will no longer be displayed to the participants after this point in time.',
      microlearningMultiplier:
        'The multiplier is a factor with which the points of the participants are multiplied in a gamified microlearning.',
      microlearningUseCase:
        '<link>Microlearnings</link> can be solved by students within a specified timespan. They are particularly suitable for reviewing learning content and preparing for exams.',
      liveQuizGamified:
        'Please specify if the live quiz should be gamified. This is only possible if the quiz is part of a course.',
      liveQuizTypes:
        'Live quizzes can only contain single choice, multiple choice, kprim, numerical and free text questions.',
      liveQuizTimeRestriction: 'Please enter a valid time restriction.',
      liveQuizMinQuestions: 'Block must contain at least one question.',
      liveQuizCreated: 'Live quiz <b>{name}</b> successfully created.',
      liveQuizUpdated: 'Live quiz <b>{name}</b> successfully updated.',
      liveQuizDescription:
        'In this step, enter the name and description of the live quiz.',
      liveQuizSettings:
        'In this step, you can make settings for the live quiz.',
      liveQuizBlocks: 'Questions & Blocks',
      liveQuizDragDrop:
        'Use drag&drop on the plus icon to add questions to your blocks. New blocks can be created either by drag&drop on the corresponding field or by clicking on the button.',
      liveQuizCreationFailed: 'Creating the live quiz failed...',
      liveQuizEditingFailed: 'Editing the live quiz failed...',
      liveQuizName:
        'The name should allow you to distinguish this live quiz from others. It will not be shown to the participants, please use the display name (next field) for this.',
      liveQuizDescField:
        'Here you can enter an optional description of the live quiz. This will be displayed to the students at the beginning of the quiz.',
      liveQuizDescCourse: 'You can assign your live quiz to a course.',
      liveQuizSelectCourse: 'Select course',
      liveQuizNoCourse: 'No course',
      liveQuizMultiplier:
        'The multiplier is a factor with which the points are multiplied when a question is answered. The factor is only used if gamification is activated.',
      liveQuizGamification:
        'Please specify if the live quiz should be gamified. This is only possible if the quiz is part of a course.',
      liveQuizLiveQA:
        'This setting specifies whether the live Q&A channel should be activated at the beginning of the session. It can be changed at any time during the session.',
      liveQuizModeration:
        'This setting specifies whether moderation in the live Q&A channel should be activated at the beginning of the session. It can be changed at any time during the session.',
      liveQuizFeedbackChannel:
        'This setting specifies whether the feedback channel should be activated at the beginning of the session. It can be changed at any time during the session.',
      liveQuizUseCase:
        '<link>Live quizzes</link> can be used to promote interactivity in lectures, seminars and workshops. While participants answer the questions in real time, the results are displayed on an evaluation view.',
      practiceQuizResetDays:
        'Please enter a number of days after which the practice quiz can be repeated.',
      practiceQuizValidResetDays:
        'Please enter a valid number of days after which the practice quiz can be repeated.',
      practiceQuizElementTypes:
        'Practice quizzes can only contain single choice, multiple choice, Kprim and numerical questions as well as content elements and flashcards.',
      practiceQuizSolutionReq: 'Please only add questions with solution.',
      practiceQuizCreated: 'Practice quiz <b>{name}</b> successfully created.',
      practiceQuizUpdated: 'Practice quiz <b>{name}</b> successfully modified.',
      practiceQuizDescription:
        'In this step, enter the name and description of the practice quiz.',
      practiceQuizSettings:
        'In this step, make settings for your practice quiz.',
      practiceQuizContent:
        'In this step, add questions and text elements to your practice quiz.',
      practiceQuizCoursePlaceholder: 'Select course...',
      practiceQuizCreationFailed: 'Creating the practice quiz failed...',
      practiceQuizEditingFailed: 'Editing the practice quiz failed...',
      practiceQuizName:
        'The name should allow you to distinguish this practice quiz from others. It will not be shown to the participants, please use the display name (next field) for this.',
      practiceQuizDescField:
        'Add a description to your practice quiz that will be displayed to participants at the beginning.',
      practiceQuizSelectCourse:
        'For the creation of a practice quiz, the selection of the corresponding course is required.',
      practiceQuizMultiplier:
        'Select a multiplier. All points that students collect in this practice quiz will be multiplied by the multiplier.',
      practiceQuizRepetition:
        'Select a period after which students can repeat the practice quiz.',
      practiceQuizOrder:
        'Select an order in which the questions are to be solved by the students.',
      practiceQuizSelectOrder: 'Select order',
      practiceQuizSEQUENTIAL: 'Sequential',
      practiceQuizSPACED_REPETITION: 'Spaced Repetition',
      practiceQuizUseCase:
        '<link>Practice quizzes</link> can be used to prepare for exams and to review learning content. As part of a compact evaluation, students receive feedback on their answers.',
    },
    formErrors: {
      resolveErrors:
        'Please ensure that the following errors in the form are resolved before saving the question:',
      questionName: 'Please enter a name for the question.',
      questionContent: 'Please add some content to your question.',
      answerContent: 'Please add some content to your answer option.',
      feedbackContent: 'Please add some content to your answer feedback.',
      SCAnswersCorrect:
        'For SC questions exactly one answer has to be marked as correct.',
      MCAnswersCorrect:
        'For MC questions at least one answer has to be marked as correct.',
      enterSolution: 'Please enter a solution.',
      FTMaxLength:
        'The maximum length of a free text question response has to be at least 1.',
      solutionRequired:
        'Please enter at least one solution of deactivate the sample solution.',
      NRPrecision: 'The number of decimal places must be at least 0.',
      solutionRangeRequired: 'Please enter at least one valid solution range.',
      NumberQuestionsRequired: 'At least one answer option must be given',
      NumberQuestionsRequiredKPRIM:
        'There must be exactly four answer options for Kprim questions',
      explanationRequired:
        'Please enter an explanation. On flashcards, this explanation will be displayed to students as an answer to the question.',
      NRUnderflow:
        'Numerical quantities cannot be smaller than -1e30 for technical reasons.',
      NROverflow:
        'Numerical quantities cannot be larger than 1e30 for technical reasons.',
    },
    sessions: {
      runningSessions: 'Running Live Quizzes',
      plannedSessions: 'Planned Live Quizzes',
      preparedSessions: 'Prepared Live Quizzes',
      completedSessions: 'Completed Live Quizzes',
      embeddingEvaluation: 'Embed Evaluation',
      lecturerCockpit: 'Lecturer Cockpit',
      sessionEvaluation: 'Quiz Evaluation',
      startSession: 'Start Quiz',
      editSession: 'Edit Quiz',
      duplicateSession: 'Duplicate Quiz',
      deleteSession: 'Delete Quiz',
      nBlocksQuestions: '{blocks} blocks, {questions} questions',
      blockXQuestions: 'Block {block} ({questions} question(s))',
      deleteLiveQuiz: 'Delete Quiz',
      confirmLiveQuizDeletion:
        'Are you sure you want to delete the following live quiz?',
      liveQuizDeletionHint:
        'Deleting a live quiz is only possible as long as it has not been started. Deleted live quizzes cannot be restored at a later date.',
      pastLiveQuizDeletionHint:
        'Deleting a completed live quiz removes it from your lecturer view. Collected points and answers of the participants remain, and any public evaluation links stay valid. Deleted live quizzes cannot be restored at a later date.',
      evaluationLinksEmbedding: 'Links for Embedding Evaluation Views',
      noSessions: 'No live quizzes available',
      creationExplanation:
        'To create your first live quiz, go back to the <link>question pool</link>. There you can create all different types of KlickerUZH activities and add questions from the question pool.',
    },
    cockpit: {
      qrCodeAccountLinkTitle: 'Account Link',
      qrCodeAccountLinkDescription:
        'Your account link lists all of your active live quizzes. If only one quiz is active, participants will be redirected automatically, otherwise they will be able to choose which quiz to participate in. This link is recommended for addition to slides, as it stays the same as long as you do not change your shortname.',
      qrCodeDirectLinkTitle: 'Direct Link',
      qrCodeDirectLinkDescription:
        'The direct link leads participants directly and only to this quiz. Once the quiz has been completed, the link will no longer be valid. This link is recommended if you run a lot of quizzes in parallel and want participants to join a specific quiz only.',
      firstBlock: 'Start first block',
      blockActive: 'Close block',
      nextBlock: 'Start next block',
      endSession: 'End quiz',
      audienceView: 'Audience view',
      evaluationResults: 'Evaluation (results)',
      abortSession: 'Abort quiz',
      confirmAbortSession:
        'Are you sure you want to abort the following live quiz?',
      abortSessionHint:
        'When aborting a live quiz, the quiz is reset so that it can be started again from the beginning at a later date. Please note that all previous answers, feedbacks, etc. will be lost.',
      blockN: 'Block {number}',
      printTitle: 'Live Quiz "{name}" - Feedback Channel',
      lecturerView: 'Lecturer View',
      liveQA: 'Live Q&A',
      activateQA: 'Activate Live Q&A',
      activateModeration: 'Activate Moderation',
      QaNotActive: 'Live Q&A not active.',
      activateFeedback: 'Activate Feedback',
      feedbackNotActive: 'Feedback not active.',
      noFeedbacksYet: 'No feedbacks received yet...',
      noFeedbackFilterMatch:
        'No feedbacks match the current filter settings...',
      filterSolved: 'Resolved',
      filterOpen: 'Open',
      filterUnpinned: 'Unpinned',
      filterUnpublished: 'Unpublished',
      sortByVotes: 'Sort by votes',
      sortByTime: 'Sort by time',
      answersGiven: '{number} answer(s) given',
      reopenToAnswer: 'Reopen feedback to answer...',
      insertResponseHere: 'Insert your response here...',
      pinFeedback: 'Pin',
      unpinFeedback: 'Unpin',
      reopen: 'Reopen',
      resolve: 'Resolve',
      noDataYet: 'No data available yet.',
      confusionSlow: 'slow',
      confusionOptimal: 'optimal',
      confusionFast: 'fast',
      confusionEasy: 'easy',
      confusionDifficult: 'difficult',
      speed: 'Speed',
      difficulty: 'Difficulty',
      confusionSpeedTooltip:
        'The display below illustrates the aggregated feedback of the students regarding the currently perceived speed of the lecture.',
      confusionDifficultyTooltip:
        'The display below illustrates the aggregated feedback of the students regarding the currently perceived difficulty of the content being taught.',
      skipCooldown: 'Skip cooldown',
    },
    evaluation: {
      evaluationNotYetAvailable:
        'The evaluation for this question cannot be displayed yet. If you want to embed this page somewhere, e.g. via the PowerPoint plugin, the evaluation will be displayed automatically after starting the question.',
      noSignedInStudents:
        'So far, no participants were signed in during this live quiz and collected points.',
      noFeedbacksYet: 'This live quiz does not contain any feedbacks yet.',
      noConfusionFeedbacksYet:
        'This live quiz does not contain any confusion feedbacks yet.',
      totalParticipants: 'Total participants: {number}',
      showSolution: 'Show solution',
      fontSize: 'Font size',
      validSolutionRange: 'Valid solution range',
      correctSolutionRanges: 'Correct solution ranges',
      statistics: 'Statistics',
      keywordsSolution: 'Solution keywords',
      noChartsAvailable: 'There exists no chart for this question type yet',
      count: 'Count',
      value: 'Value',
      histogramRange: 'Range',
      histogramBins: 'Bins',
      resetSorting: 'Reset sorting',
      noFeedbacksMatchFilter:
        'No feedbacks match the current filter settings...',
      resolvedDuringSession: 'Resolved during session',
      confusion: 'Confusion',
      minStep60s: 'The step size must be at least 60 seconds.',
      validMinSteps: 'Please enter a valid minimum step size.',
      minWindowLength: 'The window length must be at least 1.',
      validWindowLength: 'Please enter a valid window length.',
      confusionDiagramsTooltip:
        'The diagrams below show all confusion feedbacks of the participants from the beginning to the end of the live quiz. The values are normalized to the interval [-1,1] and set to 0 if no values are available in a time interval. The exact number of feedbacks can be read out by hovering the mouse over a data point.',
      avgDifficulty: 'Avg. Difficulty',
      avgSpeed: 'Avg. Speed',
      graphSettings: 'Graph settings',
      timestepX: 'Timesteps X-Axis',
      timestepXTooltip:
        'In this field, the step size on the x-axis in seconds for the diagrams can be entered. The minimum value is 60 seconds, the default value is 120 seconds.',
      minTimestep: 'min. 60s',
      windowLength: 'Window length',
      windowLengthTooltip:
        'In this field, a custom factor (multiplied by the step size on the x-axis) for the size of the running window for the average calculation can be set. The smallest possible factor is 1, the default value is 3.',
      minWindow: 'min. 1',
      displayedInterval: 'Displayed interval: {interval} seconds',
      displayedWindow: 'Displayed running window: {window} times interval',
      table: 'Table',
      wordCloud: 'Word Cloud',
      histogram: 'Histogram',
      barChart: 'Bar Chart',
      noStatistics:
        'Because of missing answers, no statistics are available yet.',
    },
    lecturer: {
      noDataAvailable: 'No data available...',
      audienceInteractionNotActivated:
        'Audience interaction has not been activated.',
      noFeedbacks: 'No feedbacks received or pinned yet...',
    },
    courseList: {
      selectCourse: 'Please select a course',
      createNewCourse: 'Create new course',
      noCoursesFound: 'No courses found.',
      createCourseNow: 'Create a course now!',
      courseNameReq: 'Please enter a name for the course.',
      courseDisplayNameReq: 'Please enter a display name for the course.',
      courseColorReq: 'Please select a color for the course.',
      courseStartReq:
        'Please enter a start date for your course. The dates can be changed after creating the course.',
      courseEndReq:
        'Please enter an end date for your course. The dates can be changed after creating the course.',
      endDateFuture: 'The end date must be in the future.',
      endAfterStart: 'The end date must be after the start date.',
      courseName: 'Course name',
      courseNameTooltip:
        'The course name is used for identification purposes. Students will not see this name.',
      courseDisplayName: 'Course display name',
      courseDisplayNameTooltip:
        'The display name is shown to students. It can differ from the course name.',
      courseDescriptionTooltip:
        'The description is shown to students. You can use it to describe the goals of the course.',
      addDescription: 'Add description',
      startDate: 'Start date',
      startDateTooltip:
        "After the start date, students can access the course's content. The start date can be changed after creating the course.",
      endDate: 'End date',
      endDateTooltip:
        'After the end date, the course will be shown as archived to students, but they can still access the content. The end date can be changed after creating the course.',
      courseColor: 'Course color',
      courseCreationFailed: 'Failed to create course...',
    },
    course: {
      nameWithPin: 'Course: {name} (PIN: {pin})',
      joinCourse: 'Join course',
      requiredPin: 'The PIN required to join is: <b>{pin}</b>',
      nParticipants: '{number} participants',
      saveDescription: 'Save description',
      changedDate: 'Date has been successfully adjusted.',
      dateChangeFailed:
        'An error occurred while adjusting the date. Please check the input.',
      noSessions: 'No live quizzes available',
      noPracticeQuizzes: 'No practice quizzes available',
      noMicrolearnings: 'No microlearning available',
      noGroupActivities: 'No group activities available',
      courseLeaderboard: 'Course Leaderboard',
      participantsLeaderboard: 'Participants (leaderboard/total): {number}',
      avgPoints: 'Average points: {points}',
      runningSession: 'Running live quiz',
      publicAccess: 'Public access',
      restrictedAccess: 'Restricted access',
      startAt: 'Start: {time}',
      endAt: 'End: {time}',
      nQuestions: '{number} questions',
      copyAccessLink: 'Copy access link',
      linkMicrolearningCopied:
        'The link to the microlearning has been successfully copied to the clipboard.',
      linkPracticeQuizCopied:
        'The link to the practice quiz has been successfully copied to the clipboard.',
      editMicrolearning: 'Edit microlearning',
      publishMicrolearning: 'Publish microlearning',
      unpublishMicrolearning: 'Unpublish microlearning',
      convertMicroLearningToPracticeQuiz: 'Convert to practice quiz',
      deleteMicrolearning: 'Delete microlearning',
      publishItemPRACTICE_QUIZ: 'Publish practice quiz',
      publishItemMICROLEARNING: 'Publish microlearning',
      confirmPublishing: 'Are you sure you want to publish the following item?',
      publishingHint:
        'Publishing a practice quiz or microlearning makes the item visible to all participants. This process can only be undone later, if the element has not yet started and/or has not received any answers. Changes to the content of an item cannot be made after publishing.',
      microPublishingHint:
        'Microlearnings are additionally only visible within the specified date range.',
      confirmDeletionMicrolearning:
        'Are you sure you want to delete the following microlearing?',
      hintDeletionMicrolearning:
        'Deleting a microlearning is only possible as long as it is not running and is not used in a course. A deleted microlearning cannot be restored at a later date.',
      editPracticeQuiz: 'Edit practice quiz',
      publishPracticeQuiz: 'Publish practice quiz',
      deletePracticeQuiz: 'Delete practice quiz',
      confirmDeletionPracticeQuiz:
        'Are you sure you want to delete the following practice quiz?',
      hintDeletionPracticeQuiz:
        'Deleting a practice quiz is only possible as long as it is not used in an active course. Deleted practice quizzes cannot be restored at a later date.',
      courseElements: 'Course Elements',
      otherActions: 'Other actions',
    },
  },
  control: {
    login: {
      header: 'KlickerUZH Controller-App (Token)',
      installAndroid:
        'Install the KlickerUZH Controller app on your phone to control your sessions directly from your smartphone during lectures.',
      installIOS:
        "Open the share dialog and click 'Add to Home Screen' to install the KlickerUZH Controller app on your phone and control live quizzes directly.",
      shortnameRequired: 'Please enter your shortname.',
      tokenRequired:
        'Enter a valid token. Please note the validity displayed during token generation.',
      checkToken:
        'Login failed. Please check your email address and token. Note the time-limited validity of the token.',
    },
    home: {
      courseSelection: 'Course Selection',
      errorLoadingCourse:
        'An error occurred while loading your courses. Please try again later.',
      selectCourse: 'Please select a course:',
      archivedCourse: '{courseName} (archived)',
      sessionsNoCourse: 'Sessions without course',
      listSessionsNoCourse: 'List of all sessions without course',
    },
    course: {
      courseOverview: 'Course overview',
      loadingFailed:
        'An error occurred while loading your courses. Please try again later.',
      completedSessionsHint:
        'Completed sessions can be viewed with results on the corresponding page in the KlickerUZH management app.',
      runningSessions: 'Running Sessions',
      noRunningSessions: 'No running sessions',
      plannedSessions: 'Planned Sessions',
      noPlannedSessions: 'No planned sessions',
      sessionStartFailed:
        'Unfortunately, your live quiz could not be started due to an error. Please try again later.',
      pptEmbedding: 'PPT-Embedding Evaluation',
      startSession: 'Start live quiz',
      confirmStartSession:
        'Are you sure you want to start the following live quiz?',
      explanationStartSession:
        'Please note that a started live quiz is generally publicly accessible. Running sessions can be canceled or stopped using the KlickerUZH management app.',
    },
    session: {
      sessionControl: 'Live Quiz Control',
      errorLoadingSession:
        'Unfortunately, an error occurred while loading the live quiz. Please make sure that the quiz is still running or try again later.',
      containsNoQuestions:
        'This live quiz does not contain any questions and therefore cannot be controlled via the controller app at the moment. Please use the management app with all functionalities.',
      sessionWithName: 'Live Quiz: {name}',
      activeBlock: 'Active Block:',
      closeBlock: 'Close Block',
      nextBlock: 'Next Block:',
      activateBlockN: 'Activate Block {number}',
      hintAllBlocksClosed:
        'All blocks of this live quiz have already been executed and closed. The feedback channel will be closed when the quiz is ended.',
      endSession: 'End Quiz',
      hintLastBlock:
        'The currently running block is the last of this live quiz. After closing it, the quiz can be ended.',
      blockN: 'Block {number}',
    },
  },
}
