export default {
  chat: {
    common: {
      opensInNewTab: '(opens in new tab)',
    },
    a11y: {
      skipToContent: 'Skip to content',
    },
    modes: {
      switcherLabel: 'Chat mode',
      tutor: 'Tutor',
      tutorDescription: 'Get patient, step-by-step help with your questions.',
      explainer: 'Explainer',
      explainerDescription: 'Get clear explanations of difficult concepts.',
    },
    settingsPanel: {
      title: 'Settings',
      aiModelLabel: 'AI Model',
      selectAiModel: 'Select AI Model',
      autoModelDescription:
        'Automatically chooses a suitable model for each message.',
      reasoningModelDescription:
        'Built for difficult, multi-step questions. It may take longer and use more credits.',
      standardModelDescription:
        'A general-purpose model for everyday questions.',
      fallbackModelDescription:
        'Uses fewer credits and remains available when your credits run out.',
      autoSelectionInfo:
        'KlickerUZH chooses a suitable model for each message.',
      usingPrimaryModel:
        'The standard model is used while credits are available.',
      usingFallbackModel:
        'No credits remain. Some models may no longer be available.',
      reasoningEffortLabel: 'Reasoning Effort',
      selectReasoningEffort: 'Select reasoning effort',
      reasoningEffortHint:
        'Higher effort can improve difficult responses at the cost of additional latency.',
      reasoningEfforts: {
        none: 'None',
        minimal: 'Minimal',
        low: 'Low',
        medium: 'Medium',
        high: 'High',
        xhigh: 'Extra high',
      },
    },
    credits: {
      title: 'Available credits',
      costHint:
        'Every message uses credits — how many depends on the model and the length of the exchange.',
      resetAt: 'Refills on {date}.',
      resetNone: 'These credits do not refill automatically.',
      exhausted:
        'Your credits are used up. Some models may no longer be available.',
      fallbackNotice:
        'Your credits are used up. Some models may no longer be available.',
    },
    sidebar: {
      newChat: 'New Chat',
      closeSidebar: 'Close sidebar',
      openSidebar: 'Open sidebar',
      toggleSidebar: 'Toggle sidebar',
      conversationsLabel: 'Conversations',
      logoAlt: 'Klicker Logo',
      copyright:
        '©{year} DF Teaching Center, Department of Finance, University of Zurich. All rights reserved.',
    },
    assistant: {
      participationRequiredTitle: 'Course Access Required',
      participationRequiredDefaultMessage:
        'You need to join the corresponding KlickerUZH course before you can use this chatbot. Please enrol in the course or contact your instructor for access.',
      openKlickerUzh: 'Open KlickerUZH',
      loading: 'Loading chatbot...',
      disclaimerDeclinedTitle: 'Chatbot unavailable',
      disclaimerDeclinedMessage:
        'You declined the chatbot disclaimer. Accept the terms to continue using the chatbot.',
      showDisclaimerAgain: 'Show disclaimer again',
    },
    ownerPreview: {
      badge: 'Owner preview',
      description:
        'Test the current chatbot configuration. This conversation is not added to your saved conversations.',
      backToManage: 'Back to chatbot settings',
      loginTitle: 'Lecturer login required',
      loginMessage:
        'Sign in to KlickerUZH Manage with the account that owns this chatbot to open its preview.',
      loginButton: 'Go to KlickerUZH Manage',
      opensInNewTab: '(opens in a new tab; return here after signing in)',
    },
    recovery: {
      notFoundTitle: 'Chatbot not found',
      notFoundMessage:
        'This chat link is no longer available. Return to KlickerUZH to choose another course or chatbot.',
      errorTitle: 'Chatbot unavailable',
      errorMessage:
        'We could not load this chatbot. Try again or return to KlickerUZH.',
      retry: 'Try again',
      openKlickerUzh: 'Open KlickerUZH',
    },
    branchPicker: {
      previous: 'Previous version',
      next: 'Next version',
    },
    historyRail: {
      label: 'Conversation history',
      mobileLabel: 'History {current}/{total}',
      item: 'Item {current} of {total}',
      itemRange: 'Items {start}-{end} of {total}',
      openHistory: 'Open full history',
      closeHistory: 'Close full history',
      turn: 'Conversation turn',
      you: 'You',
      assistant: 'Assistant',
      noText: 'No text',
      noResponse: 'No response yet',
      inProgress: 'In progress',
      partial: 'Partial response',
      error: 'Error',
    },
    disclaimer: {
      mediaTitle: 'Disclaimer media',
      introAlt: 'Chatbot Introduction',
      studentResponsibilityTitle: 'Student Responsibility',
      studentResponsibilityText:
        'Chatbot answers may contain more or less information than what is required to pass the course and are therefore not exam relevant on their own (only the underlying course material is). While we aim to provide accurate information through the chatbot, we do not guarantee the correctness, completeness, or timeliness of the responses. Please verify important information against the official course materials and references.',
      dataProtectionTitle: 'Data Protection',
      dataProtectionText:
        'Do not share any personal information with the chatbot. Your prompts are processed exclusively via Azure OpenAI instances hosted in the EU or Switzerland. Conversations may be reviewed in anonymised form by the KlickerUZH team or your lecturers to improve chatbot quality and course content.',
      consentText:
        'By using the chatbot you acknowledge and accept these conditions. If you have feedback or concerns, please contact your lecturers.',
      decline: 'Decline',
      saving: 'Saving...',
      acceptAndContinue: 'Accept and continue',
      consequenceTitle: 'What happens after your choice:',
      consequenceAccept:
        'Accept: You can use the chatbot and access all features.',
      consequenceDecline:
        'Decline: The chatbot remains blocked and you cannot send messages.',
      actionError: 'Something went wrong. Please try again.',
    },
    markdown: {
      copyCode: 'Copy',
    },
    attachments: {
      hydrationError:
        'Image attachments for this message could not be loaded. Please try again.',
      attachedImageAlt: 'Attached image {index}',
    },
    imageViewer: {
      previewUnavailable: 'Preview unavailable',
      title: 'Image attachment',
      loading: 'Loading full image...',
      retry: 'Retry',
    },
    threadList: {
      groupToday: 'Today',
      groupYesterday: 'Yesterday',
      groupThisWeek: 'This Week',
      groupEarlier: 'Earlier',
      newChatTitle: 'New Chat',
      save: 'Save',
      cancel: 'Cancel',
      editName: 'Edit name',
      deleteChat: 'Delete chat',
      deleteConfirm: 'Delete?',
      deleteConfirmAria: 'Confirm deleting this chat',
      deleteArmedStatus:
        'Confirmation required: activate delete again to delete this chat.',
      emptyState: 'Start your first conversation with a message.',
      loadError: 'Your chats could not be loaded.',
      retry: 'Retry',
      loading: 'Loading conversations...',
    },
    thread: {
      viewportLabel: 'Conversation transcript',
      scrollToBottom: 'Scroll to bottom',
      loading: 'Loading the conversation...',
      thinking: 'Preparing an answer …',
      runStarted: 'Generating an answer …',
      runCompleted: 'Answer complete.',
      runStopped: 'Answer stopped.',
      runFailed: 'Answer failed.',
      welcomeTitle: 'Welcome!',
      welcomeTo: 'You are chatting with {chatbot}.',
      welcomeSubtitle: 'Choose a starter or write your own question.',
      welcomeMode: 'Selected mode: {mode}',
    },
    suggestions: {
      sectionLabel: 'Conversation starters',
      editHint: 'Choose a starter to edit it before sending.',
      practiceTopic: 'Practise a topic',
      practiceTopicPrompt:
        'I want to practise a specific topic from the course materials. Ask me one question at a time and give hints instead of revealing the answer immediately.',
      workThroughProblem: 'Work through a problem',
      workThroughProblemPrompt:
        'Help me work through a problem from the course materials step by step. Ask me questions and give hints before revealing the solution.',
      explainConcept: 'Explain a concept',
      explainConceptPrompt:
        'Explain a difficult concept from the course materials in simple terms, using one worked example and citations.',
      compareConcepts: 'Compare two concepts',
      compareConceptsPrompt:
        'Compare two concepts from the course materials. Explain the key difference, when each applies, and cite the relevant sources.',
    },
    message: {
      creditsUsed:
        '{count, plural, one {{credits} credit} other {{credits} credits}}',
      reasoningToggle: 'Reasoning',
      editUnavailable: 'Edit unavailable',
      edit: 'Edit',
      editDisabledTooltip:
        'Cannot edit: selected model does not support images',
      copy: 'Copy',
      refresh: 'Refresh',
      retry: 'Try again',
      rateUp: 'Helpful answer',
      rateDown: 'Not a helpful answer',
      ratingError: 'Rating could not be saved.',
      stoppedNotice: 'You stopped this answer.',
      toolCallsGroupLabel:
        '{count, plural, one {1 tool call} other {{count} tool calls}}',
    },
    composer: {
      placeholder: 'Write a message...',
      send: 'Send message',
      stop: 'Stop response',
      disclaimerHint:
        'Chatbot answers can be wrong — verify against your course materials.',
      attachmentLimitError: 'You can only attach up to {max} images.',
      attachmentReadError:
        'The image could not be read. Please try a different file.',
      dismissError: 'Dismiss error',
      dropImages: 'Drop images to attach',
      attachmentPreviewAlt: 'Attachment preview',
      removeAttachment: 'Remove attachment',
      attachImage: 'Attach image',
      attachmentFallbackLabel: 'Attachment',
      editCancel: 'Cancel',
      editSend: 'Send',
    },
    toolFallback: {
      running: 'Using {tool}...',
      done: 'Used {tool}',
      failed: 'Failed to use {tool}',
      showLess: 'Show less',
      showMore:
        '{count, plural, one {Show more (# more line)} other {Show more (# more lines)}}',
      docQueryQueryLabel: 'Search query',
      docQuerySourcesHint: 'The results appear as sources below the answer.',
    },
    tools: {
      searchingCourseMaterial: 'Searching course materials...',
      searchedCourseMaterial: 'Searched course materials',
      searchedCourseMaterialEmpty: 'Searched course materials · no results',
      searchCourseMaterialFailed: 'Course material search failed',
      imageAnalyzed: 'Image analyzed',
    },
    sources: {
      title: 'Sources',
      page: 'p. {page}',
      video: 'Video',
      image: 'Image',
    },
    citations: {
      label: 'Source {index}: {title}',
      goToSource: 'Go to source',
    },
    noLogin: {
      title: 'Login Required',
      message:
        'You need to create a KlickerUZH account or log in before you can access this chatbot.',
      redirectNotice: 'After logging in, you will return to this chatbot.',
      loginButton: 'Go to KlickerUZH Login',
    },
    response: {
      errorLabel: 'Error',
      networkError:
        "I'm sorry, I couldn't reach the server. Please check your connection and try again.",
      genericError:
        "I'm sorry, something went wrong while processing your request. Please try again.",
      connectionInterrupted:
        'Connection interrupted — response may be incomplete.',
      truncated:
        'Response truncated — ask “continue” or request a shorter answer.',
    },
  },
  shared: {
    table: {
      download: 'Download as CSV',
      noResults: 'No results.',
      previous: 'Previous',
      next: 'Next',
    },
    questions: {
      roundedTo: 'Round to {accuracy} decimal places.',
      numInvalidValue:
        'The entered value is not a number or is not in the specified range.',
      ftPlaceholder: 'Your answer...',
      seSelectOption: 'Enter & choose option...',
      seSelectNCorrectOptions:
        'Please choose <b>{number} correct answer options</b> from the provided selection.',
      seCorrectAnswerN: 'Answer {number}',
      noMatchingOptionFound: 'No matching option found.',
    },
    DRAFT: {
      statusLabel: 'Draft',
    },
    SCHEDULED: {
      statusLabel: 'Scheduled',
    },
    PUBLISHED: {
      statusLabel: 'Published / Running',
      statusLabel1: 'Published',
      statusLabel2: 'Running',
    },
    ENDED: {
      statusLabel: 'Ended / Ready for Grading',
      statusLabel1: 'Ended',
      statusLabel2: 'Ready for Grading',
    },
    GRADED: {
      statusLabel: 'Graded',
    },
    TEMPLATE: {
      statusLabel: 'Template',
    },
    REVIEW: {
      statusLabel: 'Review',
    },
    READY: {
      statusLabel: 'Ready',
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
    SELECTION: {
      short: 'SE',
      typeLabel: 'Selection (SE)',
      text: 'Please select the correct answer from the list.',
      richtext: 'Please select the <b>correct answer</b> from the list.',
    },
    CASE_STUDY: {
      short: 'CS',
      typeLabel: 'Case Study (CS)',
      text: 'Please evaluate all options with respect to the given criteria.',
      richtext:
        'Please evaluate all options with respect to the given criteria.',
    },
    login: {
      installButton: 'Install Now',
    },
    comments: {
      title: 'Comments',
      viewComments: 'View Comments',
      noActivity: 'No activity yet',
      noUnresolvedActivity: 'No unresolved messages',
      addMessage: 'Add a message to start a conversation',
      messageInputPlaceholder: 'Write a message...',
      sending: 'Sending...',
      send: 'Send',
      tooltip: 'View Comments',
      markResolved: 'Mark as resolved',
      markUnresolved: 'Mark as unresolved',
      resolved: 'Resolved',
      hideResolved: 'Hide resolved messages',
      resolvedAt: 'Resolved {time}',
      messageMESSAGE: '',
      messageCREATION: '{username} created this object.',
      messageMODIFICATION:
        '{username} modified {field} ({oldValue} -> {newValue}).',
      messageSHARING: '', // TODO: implement once available
      fieldtitle: 'title',
      fieldstatus: 'status',
      fieldcontent: 'content',
    },
    generic: {
      date: 'Date',
      percentage: 'Percentage',
      status: 'Status',
      groupMessages: 'Group Messages',
      preferred: 'preferred',
      groupSize: 'Group Size',
      courseDuration: 'Course Duration',
      enabled: 'Enabled',
      disabled: 'Disabled',
      download: 'Download',
      profile: 'Profile',
      shortname: 'Shortname',
      yes: 'Yes',
      no: 'No',
      draft: 'Draft',
      scheduled: 'Scheduled',
      published: 'Published',
      grading: 'Grading',
      completed: 'Completed',
      running: 'Running',
      points: 'Points',
      pointsSmall: 'points',
      title: 'KlickerUZH',
      send: 'Send',
      next: 'Next',
      submit: 'Submit',
      save: 'Save',
      start: 'Start',
      startNoun: 'Start',
      end: 'End',
      continue: 'Continue',
      cancel: 'Cancel',
      confirm: 'Confirm',
      close: 'Close',
      approve: 'Approve',
      apply: 'Apply',
      sendAnswer: 'Send answer',
      begin: 'Begin',
      finish: 'Finish',
      logout: 'Logout',
      openApplication: 'Open Application',
      login: 'Login',
      username: 'Username',
      usernameOrEmail: 'Username / E-mail',
      email: 'E-mail address',
      password: 'Password',
      token: 'Token',
      passwordRepetition: 'Password (repetition)',
      signin: 'Login',
      usernameError: 'Please enter your username or email.',
      passwordError: 'Please enter your password.',
      studentLoginError:
        'The username or password are incorrect. If you have forgotten your password, please use the "E-Mail Login" function.',
      usernameAvailability: 'This username is already taken.',
      systemError: 'An unexpected error occurred. Please try again later.',
      error: 'Error',
      back: 'Back',
      home: 'Home',
      questions: 'Questions',
      question: 'Question',
      activities: 'Activities',
      element: 'Element',
      block: 'Block',
      stack: 'Stack',
      feedbacks: 'Feedbacks',
      feedback: 'Feedback',
      explanation: 'Explanation',
      leaderboard: 'Leaderboard',
      repetition: 'Repetition',
      evaluation: 'Evaluation',
      liveQuiz: 'Live Quiz',
      liveQuizzes: 'Live Quizzes',
      practiceQuiz: 'Practice Quiz',
      practiceQuizzes: 'Practice Quizzes',
      microlearnings: 'Microlearnings',
      microlearning: 'Microlearning',
      activeLiveQuizzes: 'Active Live Quizzes',
      assessmentLiveQuizzes: 'Assessment Live Quizzes',
      activePracticeQuizzes: 'Active Practice Quizzes',
      activeMicroLearnings: 'Active Microlearnings',
      groupActivity: 'Group Activity',
      groupActivities: 'Group Activities',
      loading: 'Loading...',
      tryAgain: 'Try again',
      characters: 'characters',
      precision: 'Precision',
      unit: 'Unit',
      min: 'Min',
      minLong: 'Minimum',
      max: 'Max',
      maxLong: 'Maximum',
      lowerEnd: 'Lower End',
      midValue: 'Mid Value',
      upperEnd: 'Upper End',
      steps: 'Steps',
      textInput: 'Text Input',
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
      community: 'Community',
      roadmap: 'Roadmap',
      features: 'Features',
      experiencePoints: 'Experience points',
      level: 'Level',
      levelX: 'Level: {number}',
      solution: 'Solution',
      sampleSolution: 'Sample solution',
      gamification: 'Gamification',
      interaction: 'Interaction',
      basePoints: 'Base points',
      awardedPoints: 'Awarded points',
      additionalPoints: 'Additional points',
      correctnessPoints: 'correctness points',
      bonusPoints: 'bonus points',
      scoring: 'Scoring',
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
      endAt: 'End at {time}',
      finishedAt: 'Finished at {time}',
      introduction: 'Introduction',
      information: 'Information',
      description: 'Description',
      settings: 'Settings',
      activitySettings: 'Activity Settings',
      course: 'Course',
      courses: 'Courses',
      availableFrom: 'Available from',
      startDate: 'Start date',
      endDate: 'End date',
      repetitionInterval: 'Repetition interval',
      order: 'Order',
      link: 'Link',
      respond: 'Respond',
      responses: 'Responses',
      update: 'Update',
      recompute: 'Recompute',
      ok: 'OK',
      language: 'Language',
      en: 'English',
      enShort: 'en',
      de: 'German',
      deShort: 'de',
      practicePool: 'Practice',
      practiceTitle: 'Practice Pool',
      practice: 'Practice Activities',
      clues: 'Clues',
      server: 'Server',
      value: 'Value',
      passed: 'Passed',
      failed: 'Failed',
      survey: 'Survey',
      avatar: 'Avatar',
      gamified: 'Gamified',
      nonGamified: 'Non-Gamified',
      blockN: 'Block {number}',
      elementN: 'Element {number}',
      Nelements: '{number} element(s)',
      stackN: 'Stack {number}',
      questionN: 'Question {number}',
      clueN: 'Clue {number}',
      availability: 'Availability',
      taskDescription: 'Task description',
      color: 'Color',
      groups: 'Groups',
      pleaseReview:
        'Please review the following instructions. This action cannot be undone.',
      comingSoon: 'Coming soon...',
      pinCode: 'PIN Code',
      forgotPassword: 'Forgot password?',
      archive: 'Archive',
      archived: 'Archived',
      ended: 'Ended',
      assessment: 'Assessment',
      pin: 'PIN',
      pinProtected: 'PIN Protected',
      learningAnalytics: 'Learning Analytics',
      monday: 'Monday',
      tuesday: 'Tuesday',
      wednesday: 'Wednesday',
      thursday: 'Thursday',
      friday: 'Friday',
      saturday: 'Saturday',
      sunday: 'Sunday',
      mean: 'Mean',
      median: 'Median',
      q1: 'Q1',
      q3: 'Q3',
      weeks: 'Weeks',
      student: 'Student',
      activity: 'Activity',
      featurePreview: 'Feature Preview',
      new: 'New',
      search: 'Search',
      accept: 'Accept',
      decline: 'Decline',
      user: 'User',
      correctness: 'Correctness',
      answerCollection: 'Answer Collection',
      users: 'Users',
      unknown: 'Unknown',
      name: 'Name',
      minimum: 'Minimum',
      maximum: 'Maximum',
      stepSize: 'Step Size',
      criterion: 'Criterion',
      criteria: 'Criteria',
      minimumShort: 'Min',
      maximumShort: 'Max',
      step: 'Step',
      case: 'Case',
      cases: 'Cases',
      entries: 'entries',
      content: 'Content',
      instructions: 'Instructions',
      caseStudyItems: 'Case study items',
      results: 'Results',
      never: 'Never',
      actions: 'Actions',
      object: 'Object',
      read: 'Read',
      execute: 'Execute',
      write: 'Write',
      admin: 'Admin',
      owner: 'Owner',
      userGroup: 'User group',
      permissionLevel: 'Access level',
      template: 'Template',
      noPoints: 'no points',
      criterionN: 'Criterion {number}',
      propagation: 'Propagation',
      sharing: 'Sharing',
      shared: 'Shared',
      imported: 'Imported',
      dependency: 'Dependency',
      legend: 'Legend',
      collections: 'Collections',
      objects: 'Objects',
      pseudonym: 'Pseudonym',
      selected: 'Selected',
      seconds: 'seconds',
      moreInformation: 'More information',
      today: 'Today',
      month: 'Month',
      week: 'Week',
      day: 'Day',
      total: 'Total',
      reviewStatus: 'Review Status',
      reviewStatusINCOMPLETE: 'Review pending',
      reviewStatusREVIEWED: 'Reviewed',
      reviewStatusMODIFIED_AFTER_REVIEW: 'Modified after review',
      modifiedAfterReviewInformation:
        'The content of this object was modified after the last review. Please mark it as reviewed again if you agree with the updated content.',
      availableActions: 'Available Actions',
      configuration: 'Configuration',
      unknownUser: 'Unknown User',
      deletedUser: 'Deleted User',
      correction: 'Correction',
      filter: 'Filter',
      listExamples: 'e.g.',
    },
    types: {
      ACTIVITIES: 'Activities',
      LIVE_QUIZ: 'Live Quiz',
      LIVE_QUIZ_TEMPLATE: 'Live Quiz Template',
      PRACTICE_QUIZ: 'Practice Quiz',
      PRACTICE_QUIZ_TEMPLATE: 'Practice Quiz Template',
      MICRO_LEARNING: 'Microlearning',
      MICRO_LEARNING_TEMPLATE: 'Microlearning Template',
      GROUP_ACTIVITY: 'Group Activity',
      GROUP_ACTIVITY_TEMPLATE: 'Group Activity Template',
      ANSWER_COLLECTION: 'Answer Collection',
      CATALOG_COLLECTION: 'Catalog Collection',
      ELEMENT: 'Element',
      COURSE: 'Course',
      SC: 'Single Choice Question',
      MC: 'Multiple Choice Question',
      KPRIM: 'Kprim Question',
      NUMERICAL: 'Numerical Question',
      FREE_TEXT: 'Free Text Question',
      SELECTION: 'Selection Question',
      CASE_STUDY: 'Case Study',
      FLASHCARD: 'Flashcard',
      CONTENT: 'Content Element',
    },
    short: {
      LIVE_QUIZ: 'LQ',
      PRACTICE_QUIZ: 'PQ',
      MICRO_LEARNING: 'ML',
      GROUP_ACTIVITY: 'GA',
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
      video: 'Embed a YouTube or Kaltura video.',
      videoUrl: 'YouTube or Kaltura URL',
      videoUrlPlaceholder: 'Paste a YouTube or Kaltura video URL',
      videoUrlInvalid: 'Enter a valid YouTube or Kaltura video URL.',
      insertVideo: 'Insert video',
      latex:
        'Select this setting to include an inline LaTeX formula. Use the same syntax to include formulas in answer options.',
      latexCentered:
        'Select this setting to include a LaTeX formula centered on a separate line.',
    },
    leaderboard: {
      lqLeaderboard: 'Quiz Leaderboard',
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
      liveQuizGamifiedNoGamifiedCourse:
        'This live quiz is gamified but not part of a gamified course. Since you are logged in, any points collected by you in the quiz will be automatically displayed on the leaderboard. If you do not wish to appear on the leaderboard, please <logout>log out</logout> and rejoin the quiz via the link.',
      liveQuizGamifiedCourseNoParticipation:
        'This live quiz is part of a gamified course. Since you have not joined this course, you will only collect points within this quiz. Your points will appear on the quiz leaderboard. If you do not want this, please <logout>log out</logout> and rejoin the quiz via the link.',
      liveQuizCourseParticipationInactive:
        'This live quiz is part of a gamified course, but you are currently not participating in the gamification. To join the leaderboard and collect points in this quiz, join the <link>leaderboard on the course overview</link> and rejoin the quiz.',
      liveQuizGamifiedAssessment:
        'Diese Live Quiz ist gamifiziert und gleichzeitig Teil eines Assessment-Kurses. Um nicht mit Ihrem Pseudonym auf dem Leaderboard zu erscheinen, gehen Sie bitte in die Profileinstellungen und stellen Sie die Anzeigeoption Ihres Profils entsprechend um.',
      rank: 'Rank',
      username: 'Username',
      email: 'Email',
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
      magicLinkLogin: 'Login with E-Mail',
      passwordLogin: 'Login with Password',
      magicLinkSent:
        'If an account exists, a one-time login link has been sent to the e-mail address.',
      activationMailSent:
        'An activation link has been sent to your e-mail address. Please check your inbox.',
      processingLogin:
        'Your e-mail login is being processed. Please wait a moment.',
      processingActivation:
        'Your account activation is being processed. Please wait a moment.',
      magicLinkLoginFailed:
        'The e-mail login failed. You will be redirected to the login page.',
      accountActivationFailed:
        'The account activation failed. You will be redirected to the login page.',
      waitingForActivation:
        'Your account has been created. Please check your inbox for an activation link.',
      myCourses: 'My Courses',
      myAssessmentCourses: 'My Assessment Courses',
      noAssessmentCourseAssignments:
        'You have not been assigned to any assessment courses yet. Please contact your lecturers.',
      insights: 'Insights',
      timeline: 'Timeline',
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
      userNotLoggedInFrame:
        'You are currently not logged in. Please log in through the platform embedding this page if you want to collect points and XP and see an overview of your learning progress.',
      noLiveQuizzesActive: 'No live quizzes active.',
      activeLiveQuizzesBy: 'Active live quizzes by {name}',
      activeLiveQuizzesInCourse: 'Active live quizzes in {name}',
      noPracticeQuizzesActive: 'No practice quizzes active.',
      activePracticeQuizzesInCourse: 'Active practice quizzes in {name}',
      noMicroLearningsActive: 'No microlearnings active.',
      activeMicroLearningsInCourse: 'Active microlearnings in {name}',
      joinLeaderboardNotice: `
🎊 A warm welcome, {username}, to the course "{courseName}" 🎊

You are currently **not** participating in the course leaderboard, meaning that you can participate in all activities but will not collect any points, will not be listed on the leaderboard, and will not be eligible for achievements and awards. If you would like to participate in the gamified activities throughout this course, **click the button** below to join. You can leave the course leaderboard at any time, upon which all of your collected points will be **deleted**.

Other participants will only see your public **participant profile**, including pseudonym and total points/achievements on leaderboards. You can choose to hide your profile from other participants while still participating in the leaderboard, if you wish to do so (see [here](/editProfile)).
`,
      activityPreview:
        'You are seeing an activity preview for the {activity} "{name}" (display name "{displayName}"). Please note that this preview is meant for the lecturer to test the activity from a student perspective. While most interaction functionalities are supported, no submitted responses are stored or will appear in the evaluation view.',
    },
    chatbot: {
      loginRequiredMessage:
        'You need a KlickerUZH account to access this chatbot. Please log in or create an account first.',
      goToLogin: 'Go to login',
      openCourseChat: 'AI tutor',
      participationRequiredMessage:
        'We could not activate your participation for this course. Open the course in OLAT/KlickerUZH and ensure you have joined it before trying again.',
      goToCourse: 'Open course',
      courseChat: 'Course chatbot',
      selectChatbot: 'Select chatbot',
      openInNewTab: 'Open chat in new tab',
      activeContext: 'Using current page context',
      questionContext: 'Question {currentStep}/{totalSteps}',
      noCourseChatbot: 'No course chatbot is available for this course yet.',
      retrieval: {
        searching: 'Searching lecture content for “{query}”…',
        errorTitle: 'Search unavailable',
        errorDescription:
          'The lecture content could not be searched. Please try again.',
        contentTitle: 'Lecture content',
        questionLabel: 'Question',
        noContent: 'No content available',
      },
    },
    insights: {
      noCourseDataAvailable:
        'No courses with timeline data are available yet. Please join a course and participate in activities first.',
      totalPoints: 'Total Points',
      totalXp: 'Total XP',
      completed: 'Completed',
      upcoming: 'Upcoming',
      ongoing: 'Ongoing',
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
        'Your account data, such as profile information, achievements, and experience points, as well as responses you give to questions in KlickerUZH, will be stored for the lifetime of your account. Your points and ranking on course activities and leaderboards will be stored for as long as you participate on the respective course leaderboard. You can request deletion of your data and account at any time.',
      confirmationMessage:
        'I agree to the KlickerUZH [privacy policy](https://www.klicker.uzh.ch/privacy_policy) and [terms of service](https://www.klicker.uzh.ch/terms_of_service) and consent to the processing of my data as described therein. I am aware that I can participate in learning activities anonymously and without an account if I do not agree to these conditions.',
    },
    studentDocs: {
      assessmentInstanceWarning:
        'Please note that you are currently in the <b>assessment instance</b> of KlickerUZH. The following documentation refers to the regular student application, which may differ from the assessment instance.',
      pageList: `
In this documentation you will find the most important information about KlickerUZH in your course:

[Feature Overview](docs/features)
[First Login & Account Setup](docs/login)
[App installation](docs/appSetup)
      `,
      featuresTitle: 'Feature Overview',
      features: `
KlickerUZH offers a comprehensive set of functionalities for course participants. This overview summarizes the most important ones. The specific activities that are available to you depend on the content offered by your lecturers (e.g., whether group activities or a challenge are available) and will be communicated to you directly by them.

#### Polls and Live Quizzes

![Live Quiz _on the left_](/img/06_live_quiz.png)

During the lecture, you have the possibility to answer questions asked by the lecturers through live quizzes in the KlickerUZH app, via your LMS (e.g., OLAT under the "Live Quiz" module), or directly at
\`https://pwa.klicker.uzh.ch/join/&lt;shortname&gt;\`. Results are shown live in the lecturer evaluation view and can be presented and discussed once the answering time has expired.

No login is required to answer questions during a live quiz. However, using a KlickerUZH account, you can participate in the course challenge and collect points. If available, you can also join the KlickerUZH course with your Klicker account, allowing us to directly display a list of all ongoing live quizzes to you.
If you want to collect points in one specific gamified quiz only, KlickerUZH also offers you the possibility to define a temporary pseudonym and avatar.

#### Live Q&A and Real-time Feedback

![Live Q&A and Feedback _on the right_](/img/06_live_quiz.png)

Have a question or want to give direct feedback on the lecture? Live Q&A lets you ask questions to the lecturer or teaching assistants during the lecture — even when participating remotely. In addition, you may provide direct feedback on the speed and difficulty of the lecture via two simple sliders.

Participation is possible at \`https://pwa.klicker.uzh.ch/join/&lt;shortname&gt;\` (also anonymously) or via the KlickerUZH app. Availability of the live Q&A and live feedback functionalities depends on whether the lecturer enables these features during a live quiz.

#### Practice Quizzes, Microlearning, and Flashcards

![Practice Quiz in OLAT](/img/07_practice_quiz.png)

Practice quizzes, microlearnings, and flashcards help you repeat course content outside of lecture time and receive immediate feedback. Practice quizzes (optionally with flashcards) are available at any time and can be repeated arbitrarily often; microlearnings are available only once and within a limited time frame. All elements are accessible via the KlickerUZH app or via links provided by your lecturers (also supporting anonymous participation).

While answering questions, logged-in participants can set personal bookmarks on important questions to build a private study pool. If you spot issues with a question, use the flagging function to report them to your lecturers.

#### Groups and Group Activities

Some courses use group activities that can only be solved collaboratively. Lecturers may enable randomized group creation and specify a preferred group size. Once groups are formed and a group activity is published, hints are distributed across group members, and the group can solve the activity together within a limited time window (one submission per group). Group formation and activities are available to participants with a KlickerUZH account.

Within a group, you can compare your points with your peers; together you can also compare your group's performance with other groups. The total group score combines points from group activities with the aggregated points of all group members.

#### Courses, Leaderboards, and Achievements

Lecturers can enable course leaderboards and define challenges and achievements. By joining a leaderboard, you collect points across activities and can see your rank, level, XP, and achievements (if allowed by your privacy settings). By activating anonymous participation in your profile settings, you can hide your profile from other participants while still participating in the leaderboard.

#### Challenge and Scoring

![Leaderboard (for gamified courses) and course information](/img/08_gamification.png)

All activities in KlickerUZH can be part of a gamified challenge. As part of the challenge, you collect points for the course leaderboard (if you participate while logged in), experience points, and achievements.

The following activities are part of the challenge:

- Polls and Live Quizzes: 10 points per participation in a question and up to 50 bonus points for fast and correct answers. The fastest correct answer receives the most points. Lecturers may customize the scoring scheme or apply multipliers to individual activities / questions; for more information, please contact your lecturers.
- Practice Quizzes: 10 points are awarded if the first answer to a question is correct. On repetition, the same amount of points is awarded only after the specified lock time.
- Microlearnings: 10 points are awarded for a correct answer to a question. Microlearnings cannot be repeated.
- Group Activities: By default, up to 25 points can be awarded per question in the group activity. Group activities are graded manually by the lecturers alongside the pass/fail decision.
- Achievements: Certain achievements (e.g., winning a large live quiz) yield bonus points. Achievements are awarded automatically or manually by lecturers.
- Multipliers: Question- and activity-level multipliers (e.g., 2x/3x/4x) increase the awarded points. In asynchronous activities (practice quizzes and microlearnings), activity multipliers are displayed at the beginning of the activity.
`,
      firstLoginTitle: 'First Login & Account Setup',
      firstLogin: `
If you are participating in KlickerUZH activities for the first time, you can register for a KlickerUZH participant account. A KlickerUZH participant account allows you to easily manage and access the learning content of your courses using KlickerUZH, add important elements to your private repetition library, and participate in the gamified elements of your courses. For practice quizzes, accounts are required to unlock core functionalities like spaced repetition practice modes (only available with accounts for data protection reasons). Depending on the technical setup of your course, you can proceed as follows:

#### Courses with LMS integration (e.g., OLAT)

Open the KlickerUZH module in the OLAT course of your lecture. To manage your KlickerUZH account or create a new one, click on "Manage account" within the KlickerUZH module. Please note that this block might be named differently in your course; your lecturers will inform you about this.

![](/img/01_create_account.png)

If you already have a valid KlickerUZH account and joined the course (either using the PIN or by visiting the account management block), simply visit any of the KlickerUZH activities in the LMS course and you should be logged in automatically. In case you are not logged in automatically, you can log in using the button on the top right.

If no KlickerUZH account exists for you yet, you will be greeted by a welcome page, which will allow you to create a new account. On this page you set an (anonymous) username and password, as well as your personal avatar.

#### Courses without LMS integration

If you already have a KlickerUZH account (e.g., from other courses), open the KlickerUZH app and click "Join course" on your home screen. Enter the 9-digit PIN you received from your lecturers. You are now part of the course and can participate in all activities.

![](/img/05_join_course.png)

If you are participating in a course with KlickerUZH for the first time, open the access link you received from the lecturers of your course (e.g.,
\`https://pwa.klicker.uzh.ch/course/XYZ/join?pin=111111111\`). You can use this to create a new KlickerUZH account with an (anonymous) username and password. With this data you can then log in and create your personal avatar, as well as participate in activities.

#### Anonymous participation

In general, it is also possible to participate anonymously in all activities of KlickerUZH except group activities. For live quizzes, you can access the running quizzes of an account via
\`https://pwa.klicker.uzh.ch/join/&lt;shortname&gt;\`. Practice quizzes and microlearnings are available via direct links provided by lecturers. When accessing KlickerUZH via the OLAT integration, you can choose to create an account and will thereafter be logged in automatically. Without a KlickerUZH account, your participation in embedded activities will remain anonymous.
`,
      appSetupTitle: 'App Installation',
      appSetup: `
In order to be able to access KlickerUZH from anywhere, we offer a KlickerUZH mobile application. The app allows you to easily manage and access the learning content of your courses (using KlickerUZH), as well as add important elements to your private repetition library and participate in the gamified elements (challenge). In addition, you can activate the push notifications for microlearning in your courses.

You can set up the KlickerUZH app as follows:

#### Android

You can download the KlickerUZH app from the Google Play store using the following link:

[https://play.google.com/store/apps/details?id=ch.uzh.bf.klicker.pwa](https://play.google.com/store/apps/details?id=ch.uzh.bf.klicker.pwa)

After installation, you should find the app on your home screen and can log in as usual. You can enable push notifications for your courses by clicking on the bell icon of the respective course, after which you will be informed about, e.g., new microlearning units.

#### iOS

Since the KlickerUZH app is not yet available in the iOS App Store, follow these instructions to add the app to your home screen. The version added to the home screen then behaves like a regular app.

1. Open the following link on your smartphone: [{pwa_url}/login]({pwa_url}/login)
2. Use the share dialogue and click on the button “Add to Home Screen / “Zum Startbildschirm zufügen”.
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
      randomGroup: 'Random Group',
      assessmentResults: 'Assessment Results',
      createJoinRandomGroup:
        'Click here to be automatically assigned to a random group with other students.',
      joinGroupError:
        'An error occurred while joining the group. Please try again.',
      joinGroupFull:
        'This group has already reached the maximum number of participants. Please choose a different group.',
      inRandomGroupPool:
        'You selected to be assigned automatically to a group of participants in your course. We are currently waiting for more people to join the pool and will assign you to a group as soon as possible. Should you want to join another group manually instead, or create your own group, you can leave the pool with the button below.',
      leaveRandomGroupPool: 'Leave Pool',
      code: 'Code',
      individualLeaderboard: 'Individual Leaderboard',
      biWeekly: 'Bi-weekly',
      groupLeaderboard: 'Group Leaderboard',
      individualLeaderboardUpdate:
        'The individual leaderboard will be updated hourly.',
      courseOverviewOnlyWithLogin:
        "The course overview of this course is only accessible to logged-in participants. Please log in to KlickerUZH and join the course before accessing the course overview. If you are accessing KlickerUZH from an LMS (e.g. OLAT), please visit the 'Manage Account' module to manage your account information.",
      gamificationOnlyForLoggedInUsers:
        'Gamification elements at the course level are only accessible to logged-in users and course members.',
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
      leaveLeaderboardTitle: 'Leave Leaderboard',
      leaveLeaderboardConfirmation:
        'Are you sure you want to leave the course leaderboard?',
      leaveLeaderboardInformation:
        'If you leave the leaderboard, your interactions with activities of this course, as well as collected points in this course, will be deleted. You can join again at any time, but will have to start from scratch.',
      noGamificationOrDescription:
        'Welcome to the course {courseName}! For this KlickerUZH course, gamification has been disabled by the lecturer and no leaderboard will be shown here. KlickerUZH will still list all course-related activities in the corresponding sections of the app for quick access.',
      groupActivityEndedToast:
        'Group activity "{activityName}" ended, no more submissions are possible.',
      groupActivityStartedToast:
        'Group activity "{activityName}" has just opened, start it now!',
      microLearningEndedToast:
        'Microlearning "{activityName}" ended, no more submissions are possible.',
      coursePracticeArea:
        'This is the practice pool for the course {courseName}. Here you have access to the content from all practice quizzes combined. For targeted repetitions, batches of 25 questions are selected according to our spaced repetition logic and based on your previous answers.',
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
      invalidPin: 'PIN invalid',
      genericError:
        'There was an error when trying to join the course. Please try again or ask your lecturer for assistance.',
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
      updateFeedback: 'Update feedback',
      errorRatingElement:
        'Your rating of the element was unfortunately not successful. Please try again later.',
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
      infoStack: 'Information element',
      scheduledAvailableFrom:
        'The practice quiz {name} will be available from {date}.',
      inactiveParticipation:
        'You have successfully completed the practice quiz <it>{name}</it>. Since you are not part of the leaderboards in this course, your points will not be saved. To collect points in the future, join the leaderboard through the course overview.',
      missingParticipation:
        'You have successfully completed the practice quiz <it>{name}</it>. Since you are not a member of this course, your points and experience points will not be saved. To collect points and XP in the future, join the course now.',
      correctAnswerOptions: 'Correct answer options',
      topNAnswers: 'Top {number} answers',
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
      activityExpired:
        'This microlearning has expired and no new answers can be submitted anymore.',
    },
    liveQuiz: {
      noActiveQuestion:
        'Currently, no question is active... Once a new question is activated, it will be shown automatically. Alternatively, you may also <reload>refresh</reload> the page to enforce an update.',
      allQuestionsAnswered:
        'You have already answered all active questions or the block has been closed.',
      previousCase: 'Previous case',
      nextCase: 'Next case',
      thisLiveQuizGamified: 'This live quiz is gamified!',
      loginSelectionHint:
        'You are about to join a gamified live quiz. Please choose between the following options: <ul><li>Login with <b>KlickerUZH-Account</b>: Collect points and XP</li><li>Create a <b>temporary pseudonym</b>: Collect points in this live quiz only (points not available in course)</li><li>Particiate <b>anonymously</b>: Do not participate in the gamification elements</li></ul>',
      loginWithAccount: 'Login with Klicker-Account',
      createTemporaryPseudonym: 'Create temporary pseudonym',
      participateAnonymously: 'Participate anonymously',
      changeLoginMode: 'Change login mode',
      pseudonymExplanation:
        'By entering a <b>pseudonym</b> here, you can collect points in this gamified live quiz without having to create a KlickerUZH account. Collected points are only stored in connection with this live quiz and will not be visible on the course leaderboard.',
      pseudonymRequired: 'Please enter a pseudonym.',
      pseudonymMinLength:
        'The pseudonym must be at least {length} characters long.',
      pseudonymMaxLength:
        'The pseudonym must not be longer than {length} characters.',
      joinedSuccessfullyWithPseudonym:
        'You have successfully joined the live quiz with the pseudonym <b>{pseudonym}</b>.',
      pseudonymAlreadyExists:
        'The chosen pseudonym is unfortunately already taken. Please choose another one.',
      pseudonymCreationFailed:
        'The creation of the pseudonym failed. Please try again.',
      temporaryParticipantsLeaderboard:
        'Temporary participants (only collect points in this gamified live quiz)',
      pseudonymSelection: 'Pseudonym Selection',
      avatarExplanation:
        'If you wish, you can select your <b>avatar</b> for the live quiz here.',
      noQuizTitle: 'No Live Quiz Available',
      noQuizDescription:
        'There is currently no running live quiz available under this link. Please check your link or contact your instructor.',
      refreshPage: 'Refresh Page',
      pinRequired: 'A PIN is required to access this quiz.',
      enterPinTitle: 'Enter PIN Code',
      invalidPin: 'The provided PIN is invalid.',
      enterPinLabel: 'PIN Code',
      enterPinPlaceholder: 'Enter PIN',
      submitPin: 'Submit PIN',
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
      feedbackSubmitted:
        'Your feedback / question has been successfully submitted.',
    },
    profile: {
      publicProfile: 'Profile Visibility',
      isProfilePublic:
        'Should your profile and pseudonym be displayed to other participants? If you deactivate this option, you will be displayed as Anonymous to other participants. Note that you will see all other participants as Anonymous as well.',
      editProfile: 'Edit profile',
      editProfileFailed:
        'Unfortunately, an error occurred while saving the changes. The username you have chosen may already be taken. Please check your entries and try again.',
      createProfileFailed:
        'Unfortunately, your account could not be created or linked. Please check your entries and try again.',
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
      forgotPasswordInfo:
        'If you forgot your password, use the login with email function to receive a one-time login link and change your password afterwards.',
      errorLogoutTemporaryParticipant:
        'An error occurred while logging out of your temporary pseudonym. Please try again.',
      loggedInAs: 'Logged in as',
      temporaryPseudonym: 'temporary pseudonym',
    },
    serverError: {
      warning: 'An unexpected error has occurred',
      serverSideError:
        'An unexpected error occurred while processing your request. Please reset your cookies and try again. If the problem persists, contact your course instructor.',
      tryAgain: 'Try Again',
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
    groups: {
      messageRequired: 'Please enter a message before submitting.',
      nameRequired: 'Please enter a group name.',
      pinRequired: 'Please enter a valid group PIN.',
      pinNumeric: 'The PIN must have a six-digit numeric value.',
    },
    groupActivity: {
      startAt: 'Start: {time}',
      endAt: 'End: {time}',
      available: 'Available',
      started: 'Started',
      submitted: 'Submitted',
      past: 'Past',
      groupActivityPassed:
        'Congratulations! Your group has passed the group activity.',
      groupActivityFailed:
        'Oh no! Your group has unfortunately not passed the group activity.',
      groupActivityFeedback: 'Feedback: {feedback}',
      answerCORRECT: 'Your answer is correct.',
      answerPARTIAL: 'Your answer is partially correct.',
      answerINCORRECT: 'Your answer is incorrect.',
      openGroupActivity: 'Open Group Activity',
      openGroupActivitySubmission: 'Open Submission',
      openActivityFeedback: 'Open Feedback',
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
      singleParticipantAutomaticAssignment:
        'You are the only participant in your group. Once the group creation deadline has passed at {groupFormationDeadline} or the lecturer has manually stopped group formation, you will be automatically assigned to a random group.',
      maxNumberOfGroupMembers:
        'Your group has reached the maximum number of participants as specified by your lecturer. No further students will be able to join this group.',
      nOfMaxParticipants: '{numParticipants}/{maxParticipants} participants',
      groupActivityEnded:
        'This group activity has ended already. You cannot start it anymore or submit any answers.',
    },
    assessment: {
      homepageHint:
        'Welcome to the assessment instance of KlickerUZH! If you want to use activities outside of an assessment course, please log in at <link>{pwa_url}</link> instead.',
      title: 'Assessment Login',
      warning:
        'This is an assessment application. All your data and activities will be visible to your lecturers.',
      loginWithEduId: 'Login with Edu-ID',
      eduIdRequired: 'Edu-ID authentication is required for assessments',
      submissionInputsInvalid:
        'An error occurred while submitting your answer. Please check your inputs for error messages.',
      submissionSuccessful:
        'Your answer has been successfully submitted and saved.',
      submissionGeneralError:
        'An error occurred while submitting your answer. Please try again.',
      submissionAlreadyRecorded:
        'You have already answered this question. Your previous response has been saved.',
      submissionUnauthorizedError:
        'Your login could not be verified correctly. Please log in again and answer the question again.',
      submissionServerError:
        'A server error occurred while submitting your answer. Please try again.',
      missingAssessmentCourseParticipation:
        'You are not part of the assessment course to which this quiz belongs. Please contact your lecturers.',
      accountDeletionMessage:
        'Since you are currently using your KlickerUZH account to participate in an assessment course, you cannot delete your account yourself. For more information on how to delete your account and leave the course, please contact your course instructors.',
      respondedAt: 'Responded at {date}',
      failedToLoadActivityResults:
        'An error occurred while loading the results for the activities in this assessment course. Please try again or contact your lecturers if the problem persists.',
      activityResultsDescription:
        'The following overview lists all activities that were made available to you in the assessment course. Activities that are conducted live in the lecture hall or are only available for a certain period of time (e.g., microlearnings) will appear in this overview once they have been completed by the lecturer. For more information regarding the correctness of your specific answers within an activity, please contact your lecturers.',
      noCompletedLiveQuizzesYet:
        'No live quizzes have been completed in this assessment course yet.',
      completedOn: 'Completed on {date}',
      notCompletedYet: 'Not completed yet',
      multiplier: 'Multiplier',
      basePoints: 'Base points',
      correctnessPoints: 'Correctness points',
      bonusPoints: 'Bonus points',
      ofAvailable: 'of {value} available',
      totalPoints: 'Total points',
      aggregatedTitle: 'Aggregated totals',
      excludingBonus: '(excluding bonus: {value})',
      corrections: 'Corrections',
      noPointsCorrection: '+ 0 Points (no change): {reason}',
      nonZeroPointCorrection:
        '{points} Points ({basePoints} base points, {correctnessPoints} correctness points, {bonusPoints} bonus points): {reason}',
      reportTitle: 'Assessment performance report',
      issuedAt: 'Issued at',
      reportTimeZone: 'Europe/Zurich',
      courseReferenceLabel: 'Internal course reference',
      identitySourceLabel: 'Verified identity source',
      identitySourceCourseInvitation:
        'Accepted assessment-course invitation email',
      identitySourceEduId: 'SWITCH edu-ID',
      achievedPointsLabel: 'Achieved',
      availablePointsLabel: 'Available',
      performanceInsightsTitle: 'Peer comparison',
      percentileText: 'Percentile rank: {percentile}.',
      percentileExplanation:
        'The percentile indicates the percentage of participants who achieved a score less than or equal to yours. For example, a percentile of 75% means your performance was equal to or better than 75% of the peer group.',
      histogramTitle: 'Score Distribution',
      histogramDescription:
        'The chart shows the aggregated distribution of total scores for active participants. Your score range is highlighted.',
      histogramUserRange: 'Your score range: {range}.',
      notEnoughDataForComparison:
        'No peer comparison is available. It is only included for at least 10 active participants and a non-zero available score range.',
      exportReportButton: 'Export Performance Report',
      exportReportExplanation:
        'Issue a report from the current assessment record. Once it is ready, you can view it in your browser or use the browser print dialog to save a single-page A4 PDF. The report includes a link for checking its current status and claims.',
      exportReportReady:
        'Your assessment report is ready. View it in a new tab or use Save as PDF to open the browser print dialog.',
      viewReportButton: 'View report',
      downloadReportButton: 'Save as PDF',
      refreshReportButton: 'Refresh report',
      exportReportNotEligibleError:
        'No assessment report can be issued for this course. Confirm that you are enrolled and that assessed activities have ended, or contact your lecturers.',
      exportReportIdentityUnverifiedError:
        'No accepted assessment-course invitation email could be confirmed. Please contact the course administrator or support.',
      exportReportRevokedError:
        'This unchanged assessment report was revoked and cannot be issued again. Contact your lecturers if the authoritative report data should be corrected.',
      exportReportInvalidDataError:
        'The assessment data could not be validated for a report. Please try again later or contact your lecturers.',
      exportReportIssuanceError:
        'The assessment report could not be issued. Check your connection and try again.',
      exportReportGenerationError:
        'The report was issued, but its browser document could not be created. Please try again.',
      exportReportViewError:
        'The report could not be opened in a new tab. Allow pop-ups for this page and try again.',
      exportReportPrintError:
        'The report could not be opened for printing. Allow pop-ups for this page and try again.',
      privacyAndTransparencyNotice:
        'Peer comparison is released only for at least 10 active participants. Ten initial score ranges are merged until every displayed range represents at least 3 participants. The report contains no peer scores or identifiers.',
      courseNameLabel: 'Course',
      studentNameLabel: 'Student name',
      studentEmailAddressLabel: 'Email address',
      matriculationNumberLabel: 'Matriculation number',
      studentEmailLabel: 'Student',
      pointsSummaryLabel: 'Points Summary',
      yourScoreLabel: 'You',
      countLabel: 'Count',
      binLabel: 'Points Range',
      privacyNoticeTitle: 'Privacy & Transparency',
      verificationTitle: 'Check this assessment record',
      verificationText:
        'KlickerUZH stores the assessment snapshot represented in this report. Open the verification page to check the record status and compare its current claims with this file.',
      verificationLink: 'Open verification page',
      verificationQrAlt: 'QR code for the KlickerUZH verification page',
      verificationPageTitle: 'Verify assessment report | KlickerUZH',
      verificationHeading: 'Assessment report verification',
      verificationIntro:
        'Check the current status and server-held claims of a KlickerUZH assessment report.',
      verificationLoading: 'Loading assessment record',
      verificationInvalidLinkTitle: 'Invalid verification link',
      verificationMissingToken:
        'This link does not contain a verification token.',
      verificationInvalidToken:
        'The verification token in this link has an invalid format.',
      verificationLoadError:
        'The assessment record could not be loaded. Please try again later.',
      verificationNotFoundTitle: 'Assessment record not found',
      verificationNotFoundText:
        'No assessment report exists for this verification link.',
      verificationActiveTitle: 'Active assessment record',
      verificationActiveText:
        'The claims below match the active snapshot stored by KlickerUZH. Compare them with the printed or on-screen report.',
      verificationRevokedTitle: 'Revoked assessment record',
      verificationRevokedText:
        'This report, issued on {date}, was revoked and must no longer be treated as active. Its claims are not disclosed.',
      verificationSupersededTitle: 'Superseded assessment record',
      verificationSupersededText:
        'A changed assessment snapshot was issued later. This older report is no longer active, and its claims are not disclosed.',
      verificationDataUnavailableTitle: 'Assessment data unavailable',
      verificationDataUnavailableText:
        'The record exists, but its stored claims cannot be validated safely. No claims are disclosed.',
      verificationIdentityTitle: 'Report identity',
      cohortSizeLabel: 'Comparison cohort: {count} active participants',
    },
  },
  kb: {
    title: 'Knowledge Bases',
    create: 'Create knowledge base',
    nameLabel: 'Name',
    descriptionLabel: 'Description (optional)',
    createSuccess: 'Knowledge base created.',
    createError: 'The knowledge base could not be created.',
    deleteTitle: 'Delete knowledge base',
    deleteDescription:
      '“{name}” will disappear immediately. Its stored files and external index are removed in the background. This action cannot be undone.',
    deleteSuccess: 'Knowledge base removed. Background cleanup is in progress.',
    deleteError: 'The knowledge base could not be deleted.',
    emptyTitle: 'No knowledge bases yet',
    emptyDescription: 'Create a knowledge base to add your first resources.',
    noDescription: 'No description',
    loadError: 'The knowledge bases could not be loaded.',
    searchKnowledgeBases: 'Search knowledge bases',
    searchKnowledgeBasesPlaceholder: 'Search by name or description',
    noSearchResults: 'No matching knowledge bases',
    noSearchResultsDescription: 'Try a different name or description.',
    searchResultCount:
      '{count, plural, =0 {No knowledge bases} one {# knowledge base} other {# knowledge bases}}',
    catalogMetrics:
      '{resources, plural, one {# resource} other {# resources}} · {chatbots, plural, one {# connected chatbot} other {# connected chatbots}}',
    loadMore: 'Load more knowledge bases',
    notFound: 'The knowledge base could not be found.',
    detailFallbackTitle: 'Knowledge base',
    backToList: 'Back to knowledge bases',
    metricsTitle: 'Usage and connections',
    metricVisibleResources: 'Visible resources',
    metricReservedResources:
      '{count, plural, =0 {No upload reservations} one {# upload reservation} other {# upload reservations}}',
    metricStorage: 'Storage quota',
    metricStorageBreakdown:
      '{visible} visible · {reserved} reserved for uploads',
    unknownSizesReserved:
      '{count, plural, one {# legacy resource reserves up to 25 MiB} other {# legacy resources reserve up to 25 MiB each}}',
    metricPendingCleanup: 'Pending cleanup',
    metricPendingCleanupSize: '{size} awaiting cleanup',
    metricLinkedConsumers: 'Connected chatbots',
    metricQuotaResources: '{count} resources count toward the quota',
    quotaReleaseMessage:
      'Deleted resources continue to count toward the quota until background cleanup finishes.',
    fileUploadTitle: 'Upload a file',
    fileUploadDescription: 'Add course material from your computer.',
    fileDropPrompt: 'Drop a file here or click to choose one',
    fileUploadFormats: 'PDF, TXT or MD · maximum 25 MB',
    uploading: 'Uploading…',
    fileUploadSuccess: 'File added to the knowledge base.',
    fileUploadError: 'The file could not be uploaded.',
    fileRejected: 'Choose a supported file of no more than 25 MB.',
    linkTitle: 'Add a link',
    linkDescription: 'Register a website or media resource for ingestion.',
    resourceTitleLabel: 'Title',
    urlLabel: 'URL',
    invalidUrl: 'Enter a valid URL starting with http:// or https://.',
    linkSuccess: 'Link added to the knowledge base.',
    linkError: 'The link could not be added.',
    resourcesTitle: 'Resources',
    resourceColumn: 'Resource',
    resourceActions: 'Actions',
    resourcesLoadError: 'The resources could not be loaded.',
    searchResources: 'Search resources',
    searchResourcesPlaceholder: 'Search title, filename or URL',
    filterType: 'Type',
    filterStatus: 'Latest ingestion',
    filterAll: 'All',
    typeFile: 'File',
    typeUrl: 'Link',
    addResource: 'Add resource',
    addResourceTitle: 'Add a resource',
    addResourceDescription: 'Choose how you want to add this resource.',
    addWebsite: 'Website',
    addWebsiteDescription: 'Register a website URL for ingestion.',
    addDocument: 'Document',
    addDocumentDescription: 'Upload a PDF, TXT or Markdown file.',
    addVideo: 'Video',
    comingSoon: 'Coming soon',
    configure: 'Configure',
    backToResourceTypes: 'Back',
    noResourceResults: 'No resources match these filters.',
    resourceResultCount:
      '{count, plural, =0 {No resources} one {# resource} other {# resources}}',
    selectAllPage: 'Select up to 50 available resources',
    selectResource: 'Select “{title}”',
    loadMoreResources: 'Load more resources',
    noResources: 'No resources have been added yet.',
    emptyResourceHint: 'Use Add resource above to add a website or document.',
    updatedAtLabel: 'Updated',
    updatedAt: 'Updated {date}',
    statusAdded: 'Added',
    statusQueued: 'Queued',
    statusProcessing: 'Processing',
    statusReady: 'Ready',
    statusFailed: 'Failed',
    deleteResourceTitle: 'Delete resource',
    deleteResourceDescription:
      '“{title}” will disappear immediately. Its stored file and external index are removed in the background. This action cannot be undone.',
    deleteResourceSuccess:
      'Resource removed. Background cleanup is in progress.',
    deleteResourceError: 'The resource could not be deleted.',
    bulkDelete: 'Delete selected ({count})',
    bulkDeleteTitle:
      '{count, plural, one {Delete # resource} other {Delete # resources}}',
    bulkDeleteConfirm:
      '{count, plural, one {Delete resource} other {Delete # resources}}',
    bulkDeleteDescription:
      '{count, plural, one {The selected resource will disappear immediately. Stored files and external indexes are removed in the background. This action cannot be undone.} other {The # selected resources will disappear immediately. Stored files and external indexes are removed in the background. This action cannot be undone.}}',
    bulkDeleteSuccess:
      '{count, plural, one {Resource removed. Background cleanup is in progress.} other {# resources removed. Background cleanup is in progress.}}',
    bulkDeleteError:
      'The deletion could not be confirmed. Refresh the list before trying again.',
    ingestResource: 'Ingest',
    retryIngestion: 'Retry',
    reingestResource: 'Re-ingest',
    ingestResourceSuccess: 'Resource queued for ingestion.',
    ingestResourceError: 'The resource could not be queued for ingestion.',
    operationStatus: 'Latest ingestion',
    operationInProgress:
      'This operation is running in the background. You can leave this page.',
    backgroundOperationsMessage:
      'One or more operations are still running. Statuses update automatically, and you can safely leave this page.',
    servingStatus: 'Available to AI',
    notServing: 'Not available yet',
    servingCurrentVersion: 'Current version {version}',
    servingPreviousVersion: 'Version {version} remains available',
    servingSince: 'Available since {date}',
    version: 'Version {version}',
    recentAttempts: 'Recent attempts',
    noRecentAttempts: 'No ingestion attempts yet.',
    historyLoadError: 'Recent attempts could not be loaded.',
    runStatusQueued: 'Queued',
    runStatusProcessing: 'Processing',
    runStatusSucceeded: 'Succeeded',
    runStatusFailed: 'Failed',
    runStatusSuperseded: 'Superseded',
    ingestionStartError: 'The ingestion operation could not be started.',
    storageLimitError:
      'This resource exceeds the 500 MiB knowledge base storage limit.',
    resourceLimitError:
      'This knowledge base has reached its limit of 100 resources.',
    uploadMismatchError:
      'The uploaded file no longer matches its upload reservation. Please upload it again.',
    ingestionFailed: 'The ingestion operation failed.',
    ingestionSuperseded: 'The ingestion operation was superseded.',
    inspectResource: 'Inspect',
    inspectorTitle: 'Resource details',
    sourceType: 'Source type',
    sourceLocation: 'Source URL',
    fileName: 'Original filename',
    mimeType: 'Media type',
    fileSize: 'File size',
    createdAt: 'Created',
    chatbotsTitle: 'Connected chatbots',
    chatbotsDescription:
      'Choose which chatbot can use this knowledge base. A chatbot can use one knowledge base at a time.',
    chatbotsLoadError: 'The chatbots could not be loaded.',
    noChatbots: 'Create a chatbot before connecting a knowledge base.',
    chatbotSelectLabel: 'Chatbot',
    chatbotSelectPlaceholder: 'Choose a chatbot',
    attachChatbot: 'Connect chatbot',
    replaceChatbot: 'Replace knowledge base',
    detachChatbot: 'Disconnect',
    linkedChatbots: 'Using this knowledge base',
    noLinkedChatbots: 'No chatbot is using this knowledge base.',
    chatbotReplacementWarning:
      'This chatbot currently uses “{kbName}”. Connecting it here replaces that knowledge base.',
    chatbotAttachSuccess: 'Chatbot connected to the knowledge base.',
    chatbotAttachError: 'The chatbot could not be connected.',
    chatbotDetachSuccess: 'Chatbot disconnected from the knowledge base.',
    chatbotDetachError: 'The chatbot could not be disconnected.',
    previewAccessError:
      'The knowledge base workspace is not available for your account yet.',
    graphTitle: 'Knowledge graph',
    graphDescription:
      'Build a graph from the knowledge base resources and inspect the published result.',
    graphQualityTierLabel: 'Build quality',
    graphQualityStandard: 'Standard (lower cost)',
    graphQualityHigh: 'High (higher cost)',
    graphBuild: 'Build graph',
    graphRebuild: 'Rebuild graph',
    graphBuildCost: 'Estimated cost for this build: {amount}.',
    graphEnableLabel: 'Enable the knowledge graph for this KB',
    graphEnabledDescription:
      'A published graph can be used by enabled chatbot bindings for this knowledge base.',
    graphDisabledDescription:
      'Enable this knowledge base before starting a graph build or serving it to students.',
    graphCostUnavailable:
      'Graph cost controls are not configured yet. Building remains disabled.',
    graphEnableError: 'The knowledge graph setting could not be updated.',
    graphBillingLabel: 'Billing mode',
    graphBillingSemesterQuota: 'Semester quota',
    graphBillingProvider: 'Provider-billed',
    graphRemainingQuota: 'Remaining semester quota',
    graphWorstCaseBalance: 'Balance after the maximum build',
    graphMaxCost: 'Maximum reserved cost',
    graphCostStatus: 'Cost reservation',
    graphCostStatusReserved: 'Reserved',
    graphCostStatusSettled: 'Settled',
    graphCostStatusReleased: 'Released',
    graphCostStatusNeedsHumanReview: 'Held for human review',
    graphActualCost: 'Actual cost',
    graphActualUsage:
      'Actual usage: {requests} requests, {inputTokens} input tokens, {outputTokens} output tokens, {embeddingTokens} embedding tokens.',
    graphStatusLabel: 'Status',
    graphStatusEmpty: 'No build',
    graphStatusQueued: 'Queued',
    graphStatusProcessing: 'Processing',
    graphStatusSucceeded: 'Succeeded',
    graphStatusFailed: 'Failed',
    graphStale: 'Stale',
    graphBuildId: 'Build {buildId}',
    graphLoading: 'Loading graph status…',
    graphLoadError: 'The graph status could not be loaded.',
    graphRetry: 'Retry',
    graphBuildError: 'The graph build could not be started.',
    graphPreviewTitle: 'Published graph',
    graphGenerateElements: 'Generate Klicker elements',
    graphElementGenerationUnavailable:
      'This published graph does not include an element-generation bundle yet. Rebuild it to generate Klicker elements.',
    graphPreviewUnavailable:
      'Build and publish a graph before opening the lecturer viewer.',
    ingestionDisabledError:
      'Adding new content to knowledge bases is temporarily disabled.',
  },
  manage: {
    assistant: {
      open: 'Assistant',
      title: 'KlickerUZH Assistant',
      subtitle: 'AI assistant for your courses and question pool',
      openInNewTab: 'Open assistant in a new tab',
      elementCreatedToast: 'Draft "{name}" added to your question pool',
    },
    ai: {
      unavailableTitle: 'AI features unavailable',
      unavailableDescription:
        'The AI features are in beta and not yet available for your account. Please contact your administrator for access.',
    },
    general: {
      qrCode: 'QR Code',
      presentQrCode: 'Present QR code',
      questionPool: 'Question Pool',
      library: 'Library',
      quizzes: 'Quizzes',
      analytics: 'Analytics',
      liveQuizzes: 'Live Quizzes',
      courses: 'Courses',
      resources: 'Resources',
      ai: 'AI',
      betaFeatures: 'Beta features',
      catalog: 'Catalog',
      mediaLibrary: 'Media Library',
      userGroups: 'User Groups',
      adminPanel: 'Admin Panel',
      '404Message':
        'The page you requested does not exist. Please return to the <link>library</link> or use the main menu at the top for further navigation.',
      date: 'Date',
      dateCreated: 'Creation Date',
      dateModified: 'Modification Date',
      title: 'Title',
      elementType: 'Element Type',
      activityType: 'Activity Type',
      status: 'Status',
      searchPlaceholder: 'Search...',
      sortBy: 'Sort by...',
      catalystRequired:
        'Requires catalyst access. For more information, see <link></link>.',
      elementPreview: 'Element Preview: {element}',
      elementPreviewRedirect: 'Open preview in a new tab',
      elementTypeDescription: 'Type',
      elementPreviewDescription: 'Preview',
      basePointsDescription: 'Base Points',
      correctnessPointsDescription: 'Correctness Points',
      bonusPointsDescription: 'Bonus Points',
      totalPointsSynchronousDescription: 'Maximum Achievable Points',
      totalPointsAsynchronousDescription: 'Achievable Points',
      pointTypeDescription: 'Point Type',
      pointAmountDescription: 'Amount',
      pointsMultiplierDescription: 'Multiplier',
      sampleSolutionDescription: 'Sample Solution',
      gradingDescription: 'Documentation',
      showingResults: 'Showing {start} to {end} of {total} results',
      NEntriesPerPage: '{N} entries per page',
      previousPage: 'Previous',
      nextPage: 'Next',
    },
    admin: {
      pageName: 'Admin Panel',
      privatePreviewAvailability: 'Availability: Private Features',
      privatePreviewDescription:
        'All users on the following list have access to functionalities that are currently marked as "Private Preview". New users can be added by entering their email address (primary Edu-ID email).',
      grantAccessEmailLabel: 'User E-Mail Address',
      grantAccessTooltip:
        'Please enter the primary Edu-ID email address of the user who should be granted access to the private features. All users must have logged in to KlickerUZH beforehand. The stored email address can be viewed in the user profile.',
      grantAccess: 'Grant Access',
      grantAccessEmailError: 'Please enter a valid email address.',
      grantAccessEmailRequired:
        'To grant access, please enter an email address.',
      accessGranted:
        'Access to private preview features has been successfully granted to the specified user.',
      alreadyAccess:
        'The specified user already has access to private preview features.',
      userNotExist:
        'The specified user does not exist. Please check the email address and ensure that the user has logged in to KlickerUZH at least once.',
      grantAccessError:
        'An error occurred while granting access to private preview features. This might be due to insufficient permissions or a system error.',
      aiFeaturesAvailability: 'Availability: AI Features',
      aiFeaturesDescription:
        'All users on the following list may use the AI features, which spend model budget. Only enable an account once a cost center has been supplied that the usage can be billed to. Enabling or disabling is done by entering the email address (primary Edu-ID email).',
      aiFeaturesEnable: 'Enable',
      aiFeaturesDisable: 'Disable',
      aiFeaturesEnabled:
        'The specified user has been enabled for the AI features.',
      aiFeaturesDisabled:
        'The specified user has been disabled for the AI features.',
      aiFeaturesUnchanged:
        'The specified user already had the requested AI feature setting.',
      aiFeaturesError:
        'An error occurred while changing the AI feature setting. This might be due to insufficient permissions or a system error.',
    },
    activities: {
      activityType: 'Activity Type',
      modeFilters: 'Mode',
      noActivitiesAvailable:
        'Currently, no activities are available. You can easily create new activities by combining elements in the <link>library</link>.',
      noActivitiesWarning:
        'We could not find any activities that meet the desired criteria.',
      liveQuizInfo: '{numOfBlocks} block(s), {numOfElements} element(s)',
      activityInfo: '{numOfStacks} stack(s), {numOfElements} element(s)',
      activityDetails: 'Activity Details',
      lastModifiedAt: 'Last modified at {date}',
      instancesOutdated: 'Activity contains outdated elements',
      instanceUpdateDraftScheduled:
        'For some of the elements included in this activity, newer versions are available in the library. This happens when you modify an element with the activity already being published or without having the instance updates in activities activate.<ul><li>To update outdated versions of elements, <b>edit the activity</b> and choose the instances you would like to update in the last step of the wizard.</li><li>Alternatively, when modifying the corresponding elements, you can also choose to update the instances included in draft and scheduled activities.</li><li>To get a list of all outdated instances, please check out the activity information by clicking on the activity title in the overview.</li></ul>',
      instanceUpdateTemplate:
        'For some of the elements included in this template, newer versions are available in the library. This happens when you modify an elements without enabling updates in templates.<ul><li>To update outdated versions of elements, re-create the template.</li><li>Alternatively, when modifying the corresponding elements, you can also choose to update the instances included in templates.</li><li>To get a list of all outdated instances, please check out the template information by clicking on the template title in the overview.</li></ul>',
      automaticPublicationAt: 'Automatic publication at {date}',
      availability: 'Availability: {startDate} - {endDate}',
      removeActivity: 'Remove Activity',
      confirmActivityRemoval:
        'Please confirm the following consequences of removing the activity <b>{name}</b> from your user account.',
      activityRemovalFinal:
        'Removing the activity will remove it from your account, but not delete any of its content. Additionally, published activities will remain available to all students. The removal cannot be undone.',
      activityRemovalDerivedAccessHint:
        'If this activity is assigned to a course that you have access to, it cannot be completely removed for technical reasons. In this case, you will automatically receive a derived permission on the activity after triggering its removal. Once the associated course is deleted or removed, the element will be automatically removed as well.',
      activityRemovalDependencyAccess:
        'Derived access rights to included elements and resources will be automatically revoked (unless technically required).',
      activeFiltersWarning:
        'There are currently active filters that might affect the activities listed here. To view all activities, please <reset>reset</reset> the filters or update them on the right side.',
      changeActivityName: 'Change Activity Name',
      activityNameChangeSuccess:
        'The name of the activity has been successfully changed.',
      activityNameChangeError:
        'The name of the activity could not be changed. Please try again later.',
      noCourseAssigned: 'No course assigned',
      actionsLegend: 'Actions Legend',
      activityDetailsNoInstanceSelected:
        'Please select an element from a block to view a preview and the corresponding scoring.',
      previewElement: 'Preview Element',
      editElement: 'Edit Element',
      noElementEditPermissions:
        'You do not have sufficient permissions to edit this element.',
      deletedElement:
        'This element has been deleted and can no longer be edited.',
      activityInformation: 'Activity Information',
      activityMultiplier: 'Activity Multiplier',
      reviewCompleted: 'Review completed',
      resetReview: 'Reset Review',
      reviewStatusUpdated: 'Review status updated successfully',
      reviewStatusUpdateFailed: 'Update of review status failed',
      openElementsInLibrary: 'Open elements in library',
      batchOperations:
        'Batch operations ({numActivities, plural, =1 {1 activity} other {# activities}})',
      batchOperationsOnlyDraftScheduled:
        'Batch operations can only be performed on draft or scheduled activities.',
      batchOperationsActivities: 'Activities - Batch Operations',
      batchNotApplicableExplanation:
        'The selected batch operations cannot be applied to this activity for the following reasons:',
      modifyMultiplier: 'Modify multiplier',
      changeCourse: 'Change course assignment',
      modifyLiveQuizPoints: 'Adjust scoring (Live Quiz only)',
      deleteSelectedActivities: 'Delete activities',
      batchDeleteDescription:
        'Permanently delete eligible activities. Deletion cannot be combined with other batch actions.',
      enableLiveQuizPointsModification:
        'Modify base, correctness and bonus points',
      bonusTime: 'Bonus time',
      bonusTimeNonNegative:
        'The time period during which bonus points are awarded must be at least 1 second. To not award any bonus points, set the bonus points to 0.',
      noActivitiesWillBeUpdated: 'No activities will be updated',
      nActivitiesWillBeUpdated: '{number} activities will be updated',
      noActivitiesWillBeDeleted: 'No activities will be deleted',
      nActivitiesWillBeDeleted:
        '{number, plural, =1 {# activity will be deleted} other {# activities will be deleted}}',
      nOfMActivitiesWillBeDeleted:
        '{affected}/{total} activities will be deleted',
      activityContainsNoElements:
        'This {activity} does not contain any elements.',
      multiplierRequiresGamifiedAssessmentCourse:
        'A multiplier can only be defined for gamified activities or activities in assessment courses, as points can only be collected in these courses. You have chosen an assignment to a course that does not meet these requirements.',
      liveQuizPointsRequireGamifiedAssessmentCourse:
        'The scoring can only be adjusted for gamified live quizzes or live quizzes in assessment courses, as points can only be collected in these courses. You have chosen an assignment to a course that does not meet these requirements.',
      batchNoCoursesAvailable:
        'There are no ongoing or planned courses available to which you could assign your activities. Please create a corresponding course under "Courses" first.',
      batchOperationsInformation: `Depending on the selected actions and the available permissions for the selected activities, the following rules apply:
<ul>
<li>Changes to the multiplier are only possible for gamified activities or activities that are part of assessment courses. If a new course assignment is chosen as a batch operation in the same step, the gamification and assessment settings of that course will apply.</li>
<li>Activities can generally be assigned to all ongoing and future courses. For microlearnings and group activities, only assignments where the availability interval of the activity is fully within the course duration are allowed.</li>
<li>Base, correctness, and bonus points can only be defined and adjusted for live quizzes. If this option is activated, other activity types will not be updated.</li>
<li>All adjustments require at least write permissions on the respective activities. Permanent deletion requires admin access.</li>
</ul>
      `,
      selectedActivitiesDescription:
        'You have selected the following activities. All activities affected by the selected actions are marked. Hover over the icon for unaffected activities for more information. Please note: Some actions can only be performed individually or require specific access rights (see tooltip). Carefully review the selected actions before applying them.',
      batchInvalidStatus:
        'Only draft and scheduled activities can be adjusted via batch operations.',
      batchNeedEditorPermissions:
        'To adjust an activity via batch operations, you need at least write access.',
      batchNeedManagerPermissions:
        'To permanently delete an activity, you need admin access.',
      batchMultiplierRequiresGamificationOrAssessment:
        'A multiplier can only be set for gamified activities or activities in assessment courses, as points can only be collected in these courses.',
      batchGroupActivityRequiresGroupsEnabled:
        'Group activities can only be assigned to courses where group formation is enabled.',
      batchAssessmentRemovalAdminOnly:
        'Activities that are in assessment mode (assigned to an assessment course) can only be removed from it by administrators of the corresponding course.',
      batchAssessmentDeletionAdminOnly:
        'Assessment live quizzes can only be deleted by administrators of the corresponding assessment course.',
      batchActivityDatesOutsideCourse:
        'The availability interval of group activities and microlearnings must be fully within the course duration.',
      batchGroupActivityRequiresFinalizedGroups:
        'Group activities can only be assigned to courses where group formation is completed by the start date of the activity.',
      batchPointsOnlyLiveQuiz:
        'Base, correctness, and bonus points can only be defined and adjusted for live quizzes.',
      batchPracticeQuizScheduledWithinCourse:
        'Scheduled practice quizzes (with a defined publication time) must have their publication time within the course duration.',
      batchOperationSuccess: 'Your batch operation was successfully applied.',
      batchOperationPartialSuccess:
        'Only a part of your batch operation could be applied successfully. Please check the affected activities and your permissions.',
      batchOperationFailed:
        'An error occurred while applying the batch operation. Please check your permissions and try again.',
      confirmBatchDeletionTitle: 'Delete selected activities',
      confirmBatchDeletionMessage:
        'You are about to permanently delete {number, plural, =1 {1 activity} other {# activities}}, including their associated participant data and results. This action cannot be undone.',
      confirmBatchDeletionIrreversible:
        'I understand that {number, plural, =1 {the activity and its associated data} other {all # activities and their associated data}} will be permanently deleted and cannot be restored.',
      confirmBatchDeletionAcknowledge: 'Acknowledge',
      confirmBatchDeletionSubmit: 'Delete activities',
      batchDeletionProgress:
        'Deletion in progress: {completed} of {total, plural, =1 {1 activity} other {# activities}} completed. Please keep this window open.',
      batchDeletionRefreshFailed:
        'Deletion finished, but the activity list could not be refreshed. Reload the list before continuing.',
      batchDeletionNoEligibleActivities:
        'No selected activities were eligible for deletion. The selection was reset; review the activity list before trying again.',
      batchDeletionSuccess:
        'The eligible selected activities were successfully deleted.',
      batchDeletionPartialSuccess:
        'Only some of the selected activities could be deleted. Please check the remaining activities and your permissions.',
      batchDeletionUncertain:
        'The result of some deletions could not be confirmed. Please check the activity list and refresh it if needed before trying again.',
      batchDeletionFailed:
        'The selected activities could not be deleted. Please check your permissions and try again.',
    },
    assessment: {
      assessmentResults: 'Assessment Results',
      participantInvitations: 'Participant invitations',
      participantInvitationsDescription:
        'Invite participants to this assessment course and track whether they have accepted their invitation.',
      invitationBackToCourse: 'Back to course',
      invitationImportTitle: 'Import invitations',
      invitationImportDescription:
        'Select a CSV file containing the participant email addresses and matriculation numbers. The file is parsed in your browser before the invitations are submitted.',
      invitationAffiliationWarning:
        'Use the exact email address listed as a verified Swiss Edu-ID affiliation (for example, an @uzh.ch address). Personal email addresses may not be matched when the participant signs in.',
      invitationDownloadTemplate: 'Download CSV template',
      invitationCsvPrompt: 'Select a participant CSV file',
      invitationCsvHeaders:
        'Required headers: email and matriculationNumber (comma or semicolon separated).',
      invitationCsvReady:
        '{count, plural, one {# row ready to import} other {# rows ready to import}}',
      invitationSelectCsv: 'Select CSV file',
      invitationImportButton:
        '{count, plural, one {Import # invitation} other {Import # invitations}}',
      invitationCsvMissingHeaders:
        'The CSV must contain email and matriculationNumber columns.',
      invitationCsvInvalidHeaders:
        'The CSV must contain exactly one email column and one matriculationNumber column.',
      invitationCsvInvalidRows:
        'Every CSV row must contain the same number of columns as the header.',
      invitationCsvEmpty: 'The CSV does not contain any participant rows.',
      invitationCsvParseError:
        'The CSV could not be read. Check its format and try again.',
      invitationCsvTooLarge:
        'The CSV file is too large. Choose a file no larger than 1 MB.',
      invitationCsvTooManyRows:
        'The CSV contains more than {count} participant rows. Split it into smaller files.',
      invitationImportCompleted: 'The invitation import has completed.',
      invitationImportFailed:
        'The invitations could not be imported. Please try again.',
      invitationImportInvalidEmail: 'Invalid email format',
      invitationImportSummary:
        'Processed {total, plural, one {# row} other {# rows}}: {created} pending, {accepted} accepted, {duplicates} already present, {errors, plural, one {# error} other {# errors}}.',
      invitationListTitle: 'Invitations',
      invitationListDescription:
        'Accepted invitations remain visible as a record. Pending invitations can be deleted.',
      invitationCount:
        '{count, plural, one {# invitation} other {# invitations}}',
      invitationEmail: 'Email',
      invitationMatriculationNumber: 'Matriculation number',
      invitationStatus: 'Status',
      invitationInvitedAt: 'Invited',
      invitationActions: 'Actions',
      invitationStatusPending: 'Pending',
      invitationStatusAccepted: 'Accepted',
      invitationDeleteLabel: 'Delete pending invitation for {email}',
      invitationDeleteTitle: 'Delete pending invitation',
      invitationDeleteDescription:
        'Delete the pending invitation for {email}? The participant will no longer be able to accept it.',
      invitationDeleteSuccess: 'The pending invitation has been deleted.',
      invitationDeleteFailed:
        'The pending invitation could not be deleted. Refresh the page and try again.',
      invitationEmpty: 'No participant invitations have been created yet.',
      invitationLoadingError:
        'The participant invitations could not be loaded. Check your permissions and try again.',
      liveQuizStudentResultsTitle: 'Student Results',
      liveQuizStudentEmailColumn: 'Student (email)',
      liveQuizStudentGivenNameColumn: 'Student given name',
      liveQuizStudentSurnameColumn: 'Student surname',
      liveQuizStudentMatriculationNumberColumn: 'Student matriculation number',
      liveQuizStudentResultsEmpty: 'No student results available yet.',
      errorLoadingLiveQuizResults:
        'An error occurred while loading the results. Please try again.',
      errorLoadingCourseResults:
        'An error occurred while loading the course results. Please try again.',
      liveQuizSelectStudentInfo:
        'To view the answers submitted by a specific student, please select them from the list on the left side. You will then receive an overview of all the questions included in the quiz, along with the respective submitted answers and their scoring.',
      courseSelectStudentInfo:
        'To view the points achieved by a specific student at the quiz level, please select them from the list on the left side. You will then receive an overview of all quizzes included in the course, the points achieved for each, and the maximum achievable points.',
      liveQuizElement: 'Element',
      liveQuizStudentHasNoResponses:
        'This student has not submitted any responses yet.',
      liveQuizResponse: 'Response',
      liveQuizOpenResponse: 'View response',
      liveQuizOpenCorrection: 'Open point correction modal',
      liveQuizNoResponseSubmitted: 'No response submitted',
      liveQuizQuestionAnswered: 'Answered',
      liveQuizQuestionNotAnswered: 'Not answered',
      liveQuizResponseFromBlock: 'Response from {block}',
      liveQuizCorrect: 'Correct',
      liveQuizPartiallyCorrect: 'Partially correct',
      liveQuizIncorrect: 'Incorrect',
      liveQuizNotAnswered: 'Not answered',
      errorLoadingStudentLiveQuizResponses:
        'An error occurred while loading the student responses. Please try again.',
      responseBy: 'Response by {email}',
      noSampleSolution: 'No sample solution',
      detailedResultsLiveQuiz: 'Detailed results for this live quiz',
      reportRecordsButton: 'Assessment reports ({count})',
      reportRecordsTitle: 'Issued assessment reports',
      reportRecordsLoadError:
        'The assessment reports could not be loaded. Check your permissions and try again.',
      reportRecordsEmpty: 'No matching assessment reports were found.',
      reportSearchPlaceholder: 'Search recipient email',
      reportStatusAll: 'All statuses',
      reportStatusActive: 'Active',
      reportStatusRevoked: 'Revoked',
      reportStatusSuperseded: 'Superseded',
      reportRecipient: 'Recipient',
      reportToken: 'Verification token',
      reportIssuedAt: 'Issued',
      reportStatus: 'Status',
      reportStatusChangedAt: 'Status changed',
      reportActions: 'Actions',
      reportCopyLinkTooltip: 'Copy verification link',
      reportLinkCopied: 'The verification link was copied.',
      reportLinkCopyError: 'The verification link could not be copied.',
      reportRevoke: 'Revoke',
      reportRevokeTitle: 'Revoke assessment report',
      reportRevokeConfirm: 'Revoke report',
      reportRevokeMessage:
        'Revoke the active assessment report for {email}? The existing verification link will immediately show the record as revoked.',
      reportRevokePolicy:
        'The same unchanged assessment snapshot cannot be issued again. If authoritative identity, course, or score claims later change, the student can issue a new active report.',
      reportRevocationSuccess: 'The assessment report was revoked.',
      reportAlreadyInactive:
        'The assessment report became inactive before it could be revoked. Its current status is shown in the list.',
      reportRevocationError:
        'The assessment report could not be revoked. No local status was changed.',
      reportRecordsRefreshError:
        'The report status changed, but the visible list could not be refreshed. Close and reopen the dialog to load the current status.',
      reportTimeZone: 'Europe/Zurich',
    },
    support: {
      modalTitle: 'Support KlickerUZH',
      yourFeedback: 'Your Feedback',
      feedbackText:
        'What works well for you, and what should we improve? Share ideas, positive experiences, and problems on our public feedback platform. Please do not include personal or course data.',
      feedbackDesc: 'Share ideas, positive experiences, and problems.',
      furtherResources: 'Further Resources',
      documentationDesc: 'Tutorials, feature documentation, and release notes',
      faq: 'FAQ',
      faqDesc: 'Frequently asked questions',
      connect: 'Connect with Us',
      community: 'Community',
      communityDesc:
        'A place for discussions and questions regarding KlickerUZH',
      email: 'E-Mail',
      emailDesc: 'Contact us at klicker@df.uzh.ch',
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
      survey:
        'We would like to know what you think about KlickerUZH and our future plans! Please give us your feedback in a <link>short survey (5 - 10min)</link>.',
      catalystRequest: {
        title: 'Request Catalyst Access',
        subtitle: 'Tell us about your use case and we will get back to you.',
        explanation:
          'Send your request to klicker@df.uzh.ch. We will reply to your account email and use your data only to process this request.',
        institution: 'Institution',
        institutionRequired: 'Please enter your institution.',
        institutionMin: 'Please enter at least 2 characters.',
        institutionMax: 'Please enter at most 160 characters.',
        useCase: 'Intended Use',
        useCaseRequired: 'Please describe your intended use.',
        useCaseMin: 'Please enter at least 20 characters.',
        useCaseMax: 'Please enter at most 2000 characters.',
        submit: 'Send Request',
      },
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
      seedDemoElements: 'Generate Demo Elements',
      seedDemoElementsExplanation:
        'Please choose whether demo elements should be generated in your library for demonstration purposes. They can be deleted at any time.',
      seedDemoElementsDecisionRequired:
        'Please choose whether demo elements should be generated or not.',
    },
    settings: {
      advancedModelUsage: 'Advanced model usage',
      baseModelUsage: 'Base model usage',
      chatAccountUsageDescription:
        'Review the current monthly usage estimates for each usage class.',
      chatAccountUsageBoundaryDescription:
        'Budgets are managed by operations as soft targets for planning. They are not hard stops, and requests already in progress may exceed them.',
      chatAccountUsageTitle: 'Chatbot usage',
      chatAccountUsageUnauthorized:
        'Chatbot usage is not authorized for this account.',
      usageBudget: 'Budget',
      usageBudgetEmpty: 'No budget is set for this usage class.',
      usageBudgetExhausted: 'The monthly budget is exhausted.',
      usageCredits: 'credits',
      usageRemaining: 'Remaining',
      usageResetDate: 'Reset date',
      usageUsed: 'Used',
      userSettings: 'User Settings',
      languageSettings: 'Language Settings',
      storedEmail: 'E-Mail (Edu-ID)',
      languageTooltip:
        'Change the language of the KlickerUZH Manage App here. Please note that this has no influence on your course content or the language settings of other users or students in your courses.',
      confirmDelegatedAccess: 'Confirm delegated login creation',
      confirmDelegatedAccessTooltip:
        'Please check your delegated access login credentials. Make sure to copy the password before closing this dialogue, as it cannot be shown again.',
      FULL_ACCESS: 'Full Access',
      SESSION_EXEC: 'Live Quiz Execution',
      READ_ONLY: 'Read Only',
      ACCOUNT_OWNER: 'Account Owner',
      OTP: 'One-Time Password',
      EDUID: 'Edu-ID',
      ACTIVATION: 'Activation',
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
        'The shortname plays an important role across KlickerUZH, as it allows for easy access to courses and other practice quizzes in many places. Please follow the following rules when choosing the shortname: <ul><li>The shortname must be at least 5 and at most 10 characters long.</li><li>The shortname may only consist of letters and numbers.</li></ul>',
      shortnameRequired: 'Please enter a shortname.',
      shortnameMin: 'The shortname must be at least 5 characters long.',
      shortnameMax: 'The shortname must be at most 10 characters long.',
      shortnameAlphanumeric:
        'The shortname may only consist of letters and numbers.',
      shortnameTaken: 'The shortname you have chosen is already taken.',
      emailUpdates: 'Project Updates via E-Mail',
      emailUpdatesTooltip:
        'Changing this setting will influence the emails you will receive in connection with KlickerUZH. Emails on major releases will always be sent to your Edu-ID email address (ca. 2x per year), more frequent project updates on, e.g., beta testing or surveys, can be enabled or disabled here.',
      newPassword: 'New Password',
      betaFeatures: 'Beta Features',
      betaFeaturesTooltip:
        'Enable early access to KlickerUZH features that are still in testing. Beta features can change or be withdrawn at short notice, and are not recommended for use in a graded assessment. You can turn this off again at any time.',
      betaFeaturesError:
        'The beta setting could not be saved. Please try again in a moment.',
      changePassword: 'Change Password',
      changeDelegatedLoginPassword: 'Change delegated login password',
      changeDelegatedLoginPasswordMessage:
        'Here you can change the password of the selected delegated login. Please note that the password will only be displayed once, so please write it down before confirming.',
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
    elementGeneration: {
      eyebrow: 'AI-assisted creation',
      title: 'Generate elements',
      description:
        'Create Klicker elements from a published knowledge graph. Single-choice, multiple-choice, KPRIM, and flashcards share the same workflow.',
      actions: {
        generate: 'Generate elements',
        newGeneration: 'New generation',
        retry: 'Retry',
        publishIncomplete: 'Use generated elements',
      },
      configure: {
        sourceTitle: 'Knowledge source',
        sourceHelp:
          'Choose a knowledge base with a published graph. The generation remains linked to this graph build for traceability.',
        sourceCount: '{count, plural, one {# source} other {# sources}}',
        indexedAt: 'Published {date}',
        staleGraph: 'Update available',
        staleGraphHelp:
          'This published graph is still usable, but the knowledge base has newer changes. Rebuild it first if those changes should be included.',
        sourceDetails: 'Included sources',
        pageFrom: 'From page',
        pageTo: 'To page',
        elementTypeTitle: 'Klicker element type',
        elementTypeHelp:
          'All types are generated as Klicker elements. Choose the format that best matches your learning goal.',
        bloomTitle: "Bloom's taxonomy",
        bloomHelp: 'Select the cognitive levels to cover.',
        settingsTitle: 'Generation settings',
        elementCount: 'Number of elements',
        language: 'Language',
        difficulty: 'Difficulty distribution',
        objectives: 'Learning objectives',
        objectivesHelp: 'Optional guidance for the generated elements.',
        addObjective: 'Add objective',
        remove: 'Remove',
        start: 'Generate elements',
        starting: 'Starting…',
        noSources: 'No published knowledge graph available',
        noSourcesHelp:
          'Create a knowledge base and publish its knowledge graph before generating elements.',
      },
      elementTypes: {
        SC: {
          label: 'Single choice',
          description: 'One correct option among several choices.',
        },
        MC: {
          label: 'Multiple choice',
          description: 'One or more correct options among several choices.',
        },
        KPRIM: {
          label: 'KPRIM',
          description: 'Evaluate four statements as true or false.',
        },
        FLASHCARD: {
          label: 'Flashcard',
          description: 'A front-and-back element for active recall.',
        },
      },
      language: {
        de: 'German',
        en: 'English',
      },
      bloom: {
        remember: 'Remember',
        understand: 'Understand',
        apply: 'Apply',
        analyze: 'Analyze',
        evaluate: 'Evaluate',
      },
      difficulty: {
        EASY: 'Easy',
        MIXED: 'Mixed',
        HARD: 'Hard',
      },
      summary: {
        title: 'Generation summary',
        source: 'Knowledge base',
        type: 'Element type',
        count: 'Elements',
      },
      validation: {
        sourceRequired: 'Select a knowledge source.',
        sourceScopeRequired: 'Select at least one source.',
        countRange: 'Choose between 1 and 20 elements.',
        pagePair: 'Enter both the first and last page for a page range.',
        pageRange: 'Use a valid page range starting at page 1.',
        bloomRequired: 'Select at least one Bloom level.',
      },
      statuses: {
        QUEUED: 'Queued',
        RUNNING: 'Running',
        PREPARING_INPUT: 'Preparing input',
        DESIGNING: 'Designing',
        WAITING_FOR_DESIGN_REVIEW: 'Design review',
        WAITING_FOR_PLAN_REVIEW: 'Plan review',
        GENERATING_ITEMS: 'Generating elements',
        FINALIZING: 'Finalizing',
        AWAITING_INCOMPLETE_PUBLICATION: 'Needs a decision',
        PUBLISHING_INCOMPLETE: 'Preparing available elements',
        COMPLETED: 'Ready for review',
        INCOMPLETE: 'Partially ready',
        FAILED: 'Failed',
        REJECTED: 'Rejected',
      },
      build: {
        title: '{type} generation',
        stage: 'Current stage: {stage}',
        generatedCount: '{generated} of {requested} generated',
        generated: 'Generated',
        unresolved: 'Unresolved',
        warnings: 'Warnings',
        retries: 'Retries',
        processing: 'The elements are being prepared',
        processingHelp:
          'This page updates automatically. You can safely leave and return using this URL.',
        failed: 'Generation failed',
        failedHelp: 'The worker could not complete this generation.',
        incompleteTitle: 'Some elements could not be generated',
        incompleteHelp:
          '{generated} of {requested} elements are available. Retry, or continue with the available elements.',
        incompleteAcknowledge:
          'I understand that the resulting set contains fewer elements than requested.',
        rejected: 'This generation was rejected during review.',
        noDrafts: 'The generation completed without reviewable elements.',
      },
      gate: {
        eyebrow: 'Review gate',
        designTitle: 'Review the generation design',
        designDescription:
          'Check how the requested elements are distributed across modules and objectives before generation continues.',
        planTitle: 'Review the element plan',
        planDescription:
          'Check the planned prompts, cognitive levels, difficulty, and source coverage before generation continues.',
        elementCount: '{count, plural, one {# element} other {# elements}}',
        elementNumber: 'Element {number}',
        objectives: 'Learning objectives',
        noObjectives: 'No explicit learning objectives.',
        difficulty: 'Difficulty {difficulty}',
        warnings: '{count, plural, one {# warning} other {# warnings}}',
        acknowledgeWarnings: 'I reviewed and acknowledge these warnings.',
        reject: 'Reject generation',
        approve: 'Approve and continue',
        submitting: 'Submitting…',
      },
      review: {
        title: 'Review generated elements',
        summary: '{total} total · {accepted} accepted · {open} still undecided',
        elementNumber: 'Element {number}',
        copy: 'Copy {number}',
        name: 'Internal name',
        prompt: 'Prompt',
        front: 'Front',
        back: 'Back',
        context: 'Context',
        choices: 'Choices',
        correctChoice: 'Mark choice {label} as correct',
        explanation: 'Explanation',
        cardType: 'Card type',
        tags: 'Tags',
        tagsPlaceholder: 'Separate tags with commas',
        qualityFlags:
          '{count, plural, one {Quality flag} other {Quality flags}}',
        citations:
          '{count, plural, one {# source citation} other {# source citations}}',
        accept: 'Accept',
        reject: 'Reject',
        duplicate: 'Duplicate',
        saveDraft: 'Save changes',
        savingDraft: 'Saving…',
        saveElements: 'Save {count} to library',
        savingElements: 'Saving elements…',
        savedElements:
          '{count, plural, one {# element is in your library.} other {# elements are in your library.}}',
        actionError: 'The element could not be updated. Please try again.',
        saveElementsError:
          'The accepted elements could not be saved. Please try again.',
      },
      decisions: {
        OPEN: 'Open',
        ACCEPTED: 'Accepted',
        REJECTED: 'Rejected',
      },
      cardTypes: {
        definition: 'Definition',
        formula: 'Formula',
        calculation: 'Calculation',
      },
      errors: {
        load: 'Element generation settings could not be loaded.',
        notConfigured:
          'Element generation is not configured for this environment.',
        start: 'The generation could not be started. Please try again.',
        buildLoad: 'This generation could not be loaded.',
        action: 'The generation could not be updated. Please try again.',
        withCode: 'The operation failed ({code}). Please try again.',
      },
    },
    questionPool: {
      createLiveQuiz: 'Create live quiz',
      createMicrolearning: 'Create microlearning',
      createPracticeQuiz: 'Create practice quiz',
      createGroupTask: 'Create group activity',
      createElement: 'Create Element',
      resetFilters: 'Reset filters',
      showArchived: 'Show archived',
      hideArchived: 'Hide archived',
      elementTypes: 'Element Types',
      elementStatus: 'Status',
      tags: 'Tags',
      selectOrType: 'Select or Type...',
      untagged: 'Untagged',
      noTagsAvailable: 'No tags available',
      activityUsage: 'Activity Usage',
      selectActivity: 'Select Activity...',
      answerFeedbacks: 'Answer feedbacks',
      noElementsWarning:
        'We could not find any elements that meet the desired criteria.',
      activeFiltersWarning:
        'There are currently active filters that might affect the elements shown here. To view all elements (except archived ones), please <reset>reset</reset> the filters or update them on the right side.',
      deleteElement: 'Delete element',
      confirmDeletion:
        'Please confirm the following consequences of deleting the element <b>{name}</b>.',
      elementDeletionFinal:
        'The deletion of an element is irreversible and deleted elements cannot be restored. The element will not be removed from existing activities.',
      elementDeletionOtherUsers:
        'Other users are using this element in activities. They will retain access to the element.',
      elementDeletionDerivedAccessHint:
        'You are using the element in an activity for which you have at least admin access. For technical reasons, the element cannot be completely deleted. You will automatically receive a derived permission on the element after its deletion. Once the associated activity is deleted, the element will be automatically deleted as well.',
      elementDeletionDependencyAccess:
        'Derived access rights to included resources will be automatically revoked.',
      elementDeletionOtherUsersNotApplicable:
        'The element is not used by other users in activities.',
      elementDeletionDerivedAccessNotApplicable:
        'You are not using the element in any activity. The element can be completely deleted.',
      elementDeletionDependencyAccessNotApplicable:
        'No derived resources are affected by the deletion of the element.',
      removeElement: 'Remove Element',
      confirmElementRemoval:
        'Please confirm the following consequences of removing the element <b>{name}</b> from your user account.',
      elementRemovalFinal:
        'The removal of this element from your account is irreversible and cannot be undone.',
      elementRemovalDerivedAccessHint:
        'You are using the element in an activity for which you have at least admin access. For technical reasons, the element cannot be completely removed. You will automatically receive a derived permission on the element after its deletion. Once the associated activity is deleted, the element will be automatically removed as well.',
      elementRemovalDerivedAccessHintNotApplicable:
        'You are not using the element in any activity. The element can be completely removed.',
      numSelected: '{count}/{total}',
      moveToArchive: 'Move to archive',
      restoreFromArchive: 'Restore from archive',
      elementArchivedSuccessfully: 'The element was moved to the archive.',
      elementRestoredSuccessfully: 'The element was restored from the archive.',
      elementArchiveActionUnchanged:
        'The element was already in the requested archive state.',
      elementArchiveActionFailed:
        'The archive state of the element could not be changed.',
      elementArchiveActionUncertain:
        'The archive state could not be confirmed. Please check the element list before trying again.',
      elementArchiveRefreshFailed:
        'The archive state could not be confirmed because the element list could not be refreshed. Reload the page to see the current state.',
      showFeedbacksExplanation: 'Show answer feedbacks & explanation',
      showExplanation: 'Show explanation',
      showFeedbacksExplanationTooltip:
        'View a preview of how the explanation and answer feedbacks will be shown in <b>asynchronous activities</b> once a student has responded to the element.',
      showExplanationTooltip:
        'View a preview of how the explanation will be shown in <b>asynchronous activities</b> once a student has responded to the element.',
      sampleSolutionUnavailableTypes:
        'Sample solutions can only be added to questions. Content elements and flashcards do not support sample solutions.',
      answerFeedbacksUnavailableTypes:
        'Answer feedbacks can only be recorded for single-choice, multiple-choice, and Kprime questions.',
      batchOperations: 'Batch operations ({numElements} elements)',
      batchOperationsElements: 'Elements - Batch Operations',
      batchOperationsApplying: 'Applying batch operations…',
      selectedElementsDescription:
        'You have selected the following elements. All elements, which are affected by the selected actions, are marked. Focus or hover over the icon for unaffected elements for more information. Please note: Some actions can only be performed separately or require specific permissions (see tooltip). Carefully review the selected actions and affected elements before applying them.',
      batchElementName: 'Element',
      batchElementPermission: 'Your permission',
      batchUpdateStatus: 'Element update eligibility',
      batchUpdateStatusInactive: 'No element update configured',
      batchSharingStatus: 'Element sharing eligibility',
      actionApplies: 'Action applies',
      batchSharingApplies: 'Sharing applies',
      modifyStatus: 'Modify status',
      modifyMultiplier: 'Modify multiplier',
      modifyBasePoints: 'Modify base points',
      awardBasePoints: 'Award base points',
      noElementsWillBeUpdated: 'No elements will be updated',
      nElementsWillBeUpdated: '{number} elements will be updated',
      batchSharing: 'Share elements',
      batchSharingDescription:
        'Grant the same direct permission on all selected elements. Sharing does not propagate to activities, but linked answer collections receive the required derived read access.',
      batchSharingLimit:
        'Sharing is limited to {max} elements per operation. Reduce the selection or disable sharing.',
      batchSharingUserOrEmail: 'User',
      batchSharingGroup: 'User group',
      batchSharingPermission: 'Permission',
      noElementsWillBeShared: 'No elements can be shared',
      nElementsWillBeShared: '{number} elements can be shared',
      batchSharingNotApplicableExplanation:
        'The selected sharing action cannot be applied to this element for the following reasons:',
      batchSharingInsufficientPermission:
        'Sharing elements requires at least admin permissions.',
      batchOperationsResult: 'Batch operation result',
      batchOperationsResultDescription:
        'Review the completed and skipped operations below. This result is read-only.',
      batchUpdateResultSuccess:
        'The selected element updates were applied successfully.',
      batchUpdateResultPartial:
        '{updated}/{total} selected element updates were applied.',
      batchUpdateResultFailed:
        'The selected element updates could not be applied.',
      batchUpdateResultSkipped:
        'Element updates were skipped because none of the selected elements were eligible.',
      batchSharingResult: 'Sharing result',
      batchSharingResultShared: 'Shared',
      batchSharingResultSkippedInsufficientPermission:
        'Skipped: admin permission required',
      batchSharingResultElementUnavailable: 'Skipped: element unavailable',
      batchSharingResultFailed: 'Sharing failed',
      batchSharingResultNotProcessed: 'Not processed',
      batchSharingRequestFailed:
        'The sharing request failed before all results could be returned.',
      batchSharingTargetInvalidOrSelf:
        'The target user does not exist or is your own account.',
      batchSharingTargetGroupUnavailable:
        'The selected user group is no longer available.',
      batchOperationsRefreshFailed:
        'The operations finished, but the element list could not be refreshed.',
      batchUpdatesInformation: `Depending on the selected actions and the permissions on the selected elements, the following rules apply:
<ul>
<li>Archiving elements / recovering elements from the archive only applies to non-archived / archived elements, respectively. This action can only be executed by users with admin permissions on the elements in question.</li>
<li>Multipliers can only be changed for questions with a defined sample solution. This action requires at least write permissions.</li>
<li>Base points can only be enabled / disabled for questions (not flashcards or content elements). This action requires at least write permissions.</li>
<li>Element status changes can be performed by all users.</li>
<li>Sharing requires at least admin permissions for each element. It does not propagate to activities, but linked answer collections receive the required derived read access.</li>
</ul>
      `,
      updateActivitiesBatchInfo:
        'Choose here if the modifications made to the selected elements should also be applied to all activities in draft and scheduled state. Optionally, you can also include activity templates with this element in the update.',
      activityUpdates: 'Activity updates',
      draftScheduledActivities: 'Draft and scheduled activities',
      templateUpdates: 'Activity template updates',
      batchOperationSuccess: 'Your batch operation was successfully applied.',
      batchOperationPartialSuccess:
        'Only a part of your batch operation could be applied successfully. Please check the affected elements and your permissions.',
      batchOperationFailed:
        'An error occurred while applying the batch operation. Please check your permissions and try again.',
      batchNotApplicableExplanation:
        'The selected batch operations cannot be applied to this element for the following reasons:',
      batchUnarchiveOnlyArchivedElements:
        'Restoring elements from the archive is only possible for archived elements',
      batchUnarchiveOnlyManagerElements:
        'Restoring elements from the archive requires at least admin permissions',
      batchArchiveOnlyUnarchivedElements:
        'Archiving elements is only possible for non-archived elements',
      batchArchiveOnlyManagerElements:
        'Archiving elements requires at least admin permissions',
      batchMultiplierOnlyEditorElements:
        'Changing the element multiplier requires at least write permissions.',
      batchMultiplierOnlySampleSolution:
        'Changing the element multiplier is only possible for questions with a defined sample solution.',
      batchBasePointsOnlyEditorElements:
        'Changing the element base points requires at least write permissions.',
      batchBasePointsOnlyQuestions:
        'Base points can only be enabled / disabled for questions (not flashcards or content elements).',
    },
    tags: {
      deleteTag: 'Delete tag',
      confirmTagDeletion:
        'Please confirm that you want to delete the tag <b>{name}</b>. Questions with this tag will remain, but the tag will be removed. This action cannot be undone.',
      validName: 'Please enter a valid name for your tag.',
      uniqueTagName:
        'Please ensure that you do not have multiple tags with the same name.',
      tagNameUpdatedSuccessfully: 'The tag name has been updated successfully.',
    },
    elements: {
      CREATETitle: 'Create Element',
      EDITTitle: 'Edit Element',
      DUPLICATETitle: 'Duplicate Element',
      deleteElement: 'Delete Element',
      shareElement: 'Share Element',
      viewElement: 'View Element',
      modifyElement: 'Modify Element',
      useElementInActivities: 'Use Element in Activities',
      elementType: 'Element type',
      selectQuestionType: 'Select question type',
      selectQuestionStatus: 'Select status',
      questionStatus: 'Status',
      elementTitle: 'Element title',
      recoverData: 'Data Recovery',
      temporaryStorageCreation:
        'The element creation process was aborted without saving. Please choose if you want to recover the last automatic data backup or discard this information.',
      temporaryStorageEditing:
        'The element editing process was aborted without saving. Please choose if you want to recover the last automatic data backup or discard this information.',
      discard: 'Discard',
      loadData: 'Load data',
      titleTooltip:
        'Enter a short, summary title for the element. This is only used for better overview.',
      tagsTooltip:
        'Add tags to your question to improve organization and reusability (similar to previous folders).',
      tagFormatting:
        'Temporarily required formatting: Enter tags separated by commas, e.g.: Tag1,Tag2,Tag3',
      basePointInformation:
        'Base points are awarded to all participants for answering the question in a live quiz. These points are not influenced by point multipliers.',
      multiplierInformation:
        'Select a multiplier with which the correctness and bonus points for this question should be multiplied. It can be chosen between 1 and 4.',
      multiplierNoEffect:
        'Multipliers only influence the scoring of a question if a sample solution is defined and correctness and bonus points (live quiz) are awarded.',
      liveQuizBasePoints: 'Live quiz base points',
      zeroPoints: '0 points',
      questionTooltip:
        'Enter the question you want to ask the participants. The rich text editor allows you to use the following (block) formatting: bold text, italic text, code, quotes, numbered lists, unordered lists and LaTeX formulas. Hover over the individual buttons for more information.',
      contentTooltip:
        'Enter the content you want to present to the participants. The rich text editor allows you to use the following (block) formatting: bold text, italic text, code, quotes, numbered lists, unordered lists and LaTeX formulas. Hover over the individual buttons for more information.',
      instructionsTooltip:
        'Enter the instructions for the students here, which serve as a guide for answering the case study.',
      enableSampleSolution: 'Enable sample solution',
      sampleSolutionAndScoring: 'Sample Solution and Scoring',
      scoringDocumentation: 'Scoring documentation',
      questionPlaceholder: 'Enter your question here...',
      contentPlaceholder: 'Enter your content here...',
      instructionsPlaceholder: 'Enter your instructions here...',
      explanationTooltip:
        'Enter a generic explanation of your question here, which will be displayed to students in practice quizzes and microlearning regardless of their answer as an explanation of the correct solution.',
      explanationPlaceholder: 'Enter your explanation here...',
      answerOptions: 'Answer options',
      answerOption: 'Answer option',
      answerOptionsTooltip:
        'Enter the possible answers that students can select for the question here.',
      answerOptionPlaceholder: 'Enter your answer option here...',
      FTOptionsTooltip:
        'Enter optional settings for the open question here. Note that the answer to open questions is graded without checking for upper and lower case.',
      NUMERICALOptionsTooltip:
        'Enter optional settings for the numerical question here. Please note that the range of numbers for numerical questions is limited to the interval [-1e30,1e30] for technical reasons. Should you require to use larger numbers, please use a free text question instead.',
      SELECTIONOptionsTooltip:
        'Please select the answer collection from which the students should select the correct answers.',
      CSAnswerCollectionRequired:
        'To create a case study question, you need access to an answer collection or can choose to <link>enter the case study items manually</link>. To use an answer collection, you can either create one yourself under <link2>Resources → Answer Collections</link2> or import existing collections from other users through the <link3>Catalog</link3>.',
      SEAnswerCollectionRequired:
        'To create a selection question, you need access to an answer collection or can choose to <link>enter the available options manually</link>. To use an answer collection, you can either create one yourself under <link2>Resources → Answer Collections</link2> or import existing collections from other users through the <link3>Catalog</link3>.',
      selectCollection: 'Select collection...',
      answerCollection: 'Answer collection',
      notSufficientPermissionsEditCollection:
        'Your permissions for this answer collection are not sufficient to edit it.',
      noAnswerCollectionSelected:
        'Please select an answer collection with sufficient permissions before you can edit it.',
      caseStudyAnswerCollectionTooltip:
        'Please select an answer collection from which you want to select the elements to be evaluated in the case study.',
      numberOfInputs: 'Number of inputs',
      correctAnswerOptions: 'Correct answer options',
      correctAnswerOptionsTooltip:
        'Please select the correct answer options from the list of answer options. The number of correct answer options must correspond to the number of input fields.',
      selectCorrectAnswerOptions: 'Select correct answer options...',
      noMatchingOptionFound: 'No matching option found',
      changeOfAnswerCollection: 'Change of answer collection',
      confirmCollectionChange:
        'Are you sure you want to change the answer collection? The previously selected elements of the case study and all defined sample solutions will be lost due to this change.',
      selectedItems: 'Selected items',
      selectionItems: 'Items for Selection',
      newSelectionItemsTooltip:
        'Please enter the items from which the students should select the correct options. They will automatically be combined into a new answer collection when saving the question.',
      definedItems: 'New case study items',
      caseStudyItemsTooltip:
        'Please select the elements from the answer collection that participants should evaluate in the case study according to the criteria recorded below.',
      newCaseStudyItemsTooltip:
        'Please enter the case study items that should be evaluated with respect to the specified criteria. They will automatically be combined into an answer collection when saving the question.',
      enterItemsManually:
        'Want to enter the case study items manually instead?',
      enterItemsManuallyExplanation:
        'This interface allows you to enter your case study items manually. When saving the question, the corresponding items will automatically be <b>combined into a new answer collection</b>, which you can re-use or extend later. <button>You may also switch back to the selection of case study items from an existing collection.</button>',
      returnItemsCollectionSelection:
        'Do you want to switch back to the selection of items from an existing collection?',
      enterSelectionItemsManually:
        'Do you want to enter the items to be selected manually?',
      enterSelectionItemsManuallyExplanation:
        'This interface allows you to enter the items for your selection question directly in the context of the question. When saving the question, the corresponding items will automatically be <b>combined into a new answer collection</b>, which you can re-use or extend later.',
      returnSelectionItemsCollection:
        'Do you want to switch back to the selection of an existing collection?',
      selectCaseStudyItems: 'Select items...',
      insertNewItems: 'Enter case study items...',
      caseStudyRangeCriterion: 'Numerical range criterion',
      caseStudyStepCriterion: 'Step / Likert criterion',
      caseStudyCriteriaDescription:
        'Please define the criteria according to which the selected elements of the case study above should be evaluated. You can choose between purely numerical criteria (ideal e.g. for probability / cost estimates) and step / Likert criteria (ideal for case studies without exact / known solutions). For more information on the individual fields, please also refer to the corresponding tooltips.',
      caseStudyCriteriaNameTooltip:
        'The name of the criterion is displayed to the students (e.g. "Probability").',
      caseStudyCriteriaMinTooltip:
        'The minimum value determines the lower limit of the slider.',
      caseStudyCriteriaMaxTooltip:
        'The maximum value determines the upper limit of the slider.',
      caseStudyCriteriaStepTooltip:
        'The step size determines the steps when setting the slider.',
      caseStudyCriteriaUnitTooltip:
        'The optional unit is displayed to the students next to the corresponding values (e.g. "%").',
      caseStudyCriteriaMinLabelTooltip:
        'This text describes the lower end of your step or Likert criterion (e.g. "very unlikely").',
      caseStudyCriteriaMidLabelTooltip:
        'This text describes the middle range of your step or Likert criterion (e.g. "possible").',
      caseStudyCriteriaMaxLabelTooltip:
        'This text describes the upper end of your step or Likert criterion (e.g. "very likely").',
      caseStudyCriteriaStepsTooltip:
        'Enter the number of steps the slider should have here (at least 3).',
      addCriterion: 'Add new criterion',
      addRangeCriterion: 'Add numerical range criterion',
      addStepsCriterion: 'Add step / Likert criterion',
      addCase: 'Add new case',
      removeCase: 'Remove case',
      caseTitle: 'Case name',
      caseStudyCaseTitleTooltip:
        'Please enter a name for the case that will be displayed to the students (e.g. "Scenario 1: Lorem ipsum").',
      confirmCaseDelete: 'Are you sure you want to delete this case?',
      confirmCaseDeleteSolutions:
        'Are you sure you want to delete this case including all defined sample solutions?',
      confirmCaseDeletion: 'Delete case',
      caseDescription: 'Case description',
      caseStudyCaseDescriptionTooltip:
        'The case description is used to provide a detailed description of the scenario. It must contain all the information that students need to evaluate the given elements against the criteria.',
      caseDescriptionPlaceholder: 'Enter detailed case description here...',
      caseStudySolutions: 'Sample Solutions for Case {number}',
      caseStudySolutionsTooltip:
        'Please enter the range for each element and criterion that should be considered correct.',
      caseStudySolutionIntervalStep:
        'in the interval [{lower}, {upper}], step size {step}',
      lowerLimit: 'Lower limit',
      upperLimit: 'Upper limit',
      LISTDisplay: 'Display as list',
      GRIDDisplay: 'Display as grid',
      feedbackPlaceholder: 'Enter feedback…',
      addAnswer: 'Add new answer',
      restrictions: 'Restrictions',
      solutionRanges: 'Solution ranges',
      solutionRangesTooltip:
        'Enter the intervals that should be considered correct here.',
      exactSolutions: 'Exact solutions',
      exactSolutionsTooltip:
        'Enter the exact solutions that should be considered correct here.',
      solutionTypeNumerical: 'Solution Type',
      solutionTypeNumericalTooltip:
        'Choose between the option of solution ranges and exact solutions for this question',
      addSolutionRange: 'Add new solution range',
      addExactSolution: 'Add new exact solution',
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
      updateInstances: 'Update element instances in KlickerUZH activities',
      includeTemplateInstanceUpdates:
        'Include instances in template activities for update',
      updateInstancesExplanation:
        'Use this setting to update the instances of this element in all planned live quizzes, practice quizzes, microlearnings, and group activities shown below. The content of elements in ongoing and completed activities will not be updated. Changed multipliers will be applied to the created instances. Please note that when deactivating the sample solution, only content elements, flashcards, and free text questions in practice quizzes and microlearnings will be updated.',
      questionSavedSuccessfully: 'The question has been saved successfully.',
      questionSavedFailed:
        'An error occurred while saving the question. Please check the error messages in the form and review the entries.',
    },
    activityWizard: {
      activityName: 'Please enter a name for your activity.',
      activityDisplayName:
        'Please enter a valid display name for your activity.',
      considerFormErrors: 'Please check the form for error messages.',
      startDate: 'Please enter a start date for your activity.',
      endDate: 'Please enter an end date for your activity.',
      endAfterStart: 'The end date has to be later than the start date.',
      endInFuture: 'The end date has to be in the future.',
      validMultiplicator: 'Please enter a valid multiplicator.',
      checkValues:
        'Please check your entries in the previous step before proceeding.',
      closeWizard: 'Close wizard',
      name: 'Name',
      displayName: 'Display Name',
      multiplierDefault: 'Default: 1x',
      multiplier1: 'Simple (1x)',
      multiplier2: 'Double (2x)',
      multiplier3: 'Triple (3x)',
      multiplier4: 'Quadruple (4x)',
      changesSaved: 'Changes saved',
      elementCreated: 'Element has been created successfully',
      openPreview: 'Open preview',
      openOverview: 'Open overview',
      createAnotherActivity: 'Create another activity',
      enterContentHere: 'Enter your content here...',
      questionsDragDrop: 'Use drag and drop to add your questions here...',
      newQuestion: 'New question',
      blockCountdownTitle: 'Countdown Block {blockIx}',
      timeLimit: 'Time limit',
      noTimeLimit: 'No time limit',
      optionalTimeLimit: 'Optional time limit',
      timeLimitTooltip: 'Time limit for block {blockIx} in seconds',
      newBlock: 'New block',
      newStack: 'New stack',
      newBlockSelected: 'Add 1 block with {count} elements',
      newStackSelected: 'Add 1 stack with {count} elements',
      pasteSelection: 'Add {count} questions',
      pasteSelectionElements: 'Add {count} elements',
      pasteSingleElementsBlock: 'Add {count} blocks with 1 element',
      pasteSingleElementsStack: 'Add {count} stacks with 1 element',
      pinProtected: 'PIN protection',
      pinProtectedTooltip:
        'When enabled, the system automatically generates a PIN that students must enter when joining the quiz.',
      displayNameTooltip: 'The display name is shown to participants.',
      stackDescriptionTitle: 'Stack {stackIx}: Description (optional)',
      stackDisplayName: 'Stack title',
      stackDisplayNameTooltip:
        'The title of the stack is displayed above the description at the top of the stack.',
      stackDescription: 'Description',
      stackDescriptionTooltip:
        'The description of the stack is displayed above the questions in the stack.',
      stackDescriptionPlaceholder: 'Enter description here...',
      stackFTQuestionsNoSL:
        'You included a free text question in without a sample solution in this stack. While this is possible for free text questions, please note that the participants will receive a default number of points for answering and no grading logic is applied.',
      outdatedElementsWarning:
        'Your activity contains outdated versions of elements.',
      updateAllElements: 'Update all Elements',
      elementInstancesFrozen:
        'When creating the activity, the content of the elements was frozen. When enabled, changes to elements are applied to draft activities.',
      noInstanceUpdatePublishedActivities:
        'No changes made to elements are applied to published activities (accessible to students).',
      choiceOnDuplication:
        "When duplicating an activity, you can choose whether to keep an activity's content unmodified or update the elements to their latest version.",
      microlearningTypes:
        'A microlearning can contain all available element types.',
      microlearningCreated:
        'Your microlearning <b>{name}</b> has been created successfully.',
      microlearningEdited:
        'Your microlearning <b>{name}</b> has been edited successfully.',
      microLearningIntroductionName:
        'Please enter a name for your microlearning. For more information on the specific fields during creation, you can refer to the corresponding tooltips.',
      microLearningInformation:
        'In this step, enter the name and description of the microlearning and find helpful information for creating the element.',
      microLearningNoCourse:
        'Microlearnings must always be assigned to a running course. Please create a course first via the corresponding menu or extend an existing one before continuing with the creation.',
      microLearningLecturerDocs:
        'For more information on the creation and execution of microlearnings, visit the <link>Lecturer Documentation</link>.',
      microLearningStudentDocs:
        'For more information on the student view, visit the <link>Student Documentation</link>.',
      microlearningDescription:
        'In this step, enter the name and description of the microlearning.',
      microlearningSettings:
        'In this step, select the start and end date and make further settings.',
      microLearningMissingCourse:
        'Microlearnings must be assigned to a course.',
      microLearningCourseNotGamified:
        'With the current course selection the microlearning will not be gamified.',
      microlearningQuestions:
        'In this step, select the questions for the microlearning.',
      microlearningEditingFailed: 'Editing the Microlearning failed...',
      microlearningCreationFailed: 'Creating the Microlearning failed...',
      microlearningName:
        'This name should allow you to distinguish this microlearning from others. It will not be shown to the participants, please use the display name (next field) for this.',
      microlearningDescField:
        'Add a description to your microlearning that will be displayed to participants at the beginning.',
      microlearningCourse:
        'For the creation of a microlearning, the selection of the corresponding course is required. The microlearning will automatially assume the gamification settings of the course.',
      microlearningStartDate:
        'Please choose the start date of the microlearning. Once published, it will be displayed to the participants from this point in time.',
      microlearningEndDate:
        'Please choose the end date of the microlearning. It will no longer be displayed to the participants after this point in time.',
      microlearningStartAfterCourseStart:
        'The start date of the microlearning must be after the start date of the course.',
      microlearningEndBeforeCourseEnd:
        'The end date of the microlearning must be before the end date of the course.',
      microlearningMultiplier:
        'The multiplier is a factor with which the points of the participants are multiplied in a gamified microlearning.',
      microlearningUseCase:
        '<link>Microlearnings</link> can be solved by students within a specified timespan. They are particularly suitable for reviewing learning content and preparing for exams.',
      minOneElementPerStack: 'Every stack must contain at least one element.',
      minOneElementPerBlock: 'Every block must contain at least one element.',
      minOneQuestionGroupActivity:
        'A group activity must contain at least one question.',
      liveQuizGamified:
        'Please specify if the live quiz should be gamified. This is only possible if the quiz is part of a course.',
      liveQuizTypes:
        'Live quizzes support all question types as well as content elements. Flashcards cannot be used in live quizzes.',
      liveQuizTimeRestriction: 'Please enter a valid time restriction.',
      liveQuizMinQuestions: 'Block must contain at least one question.',
      liveQuizCreated: 'Live quiz <b>{name}</b> successfully created.',
      liveQuizUpdated: 'Live quiz <b>{name}</b> successfully updated.',
      liveQuizInformation:
        'In this step, enter the name and description of the live quiz and find helpful information for creating the element.',
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
      liveQuizDescCourse:
        'You can assign your live quiz to a course. If your course is gamified or has assessment enabled, these settings will automatically propagate to the activity. For non-gamified courses or live quizzes without course assignment, you may activate gamification separately. For more information, please also refer to the documentation on <link>gamified live quizzes</link>.',
      liveQuizSelectCourse: 'Select course',
      liveQuizNoCourse: 'No course',
      assessmentCourseRemovalRestricted:
        'Activities in assessment mode can only be removed from it by an administrator of the corresponding course.',
      liveQuizEnableGamification:
        'Select a gamified course to activate gamification.',
      liveQuizMultiplier:
        'The multiplier is a factor with which the points are multiplied when a question is answered. The factor is only used if gamification is activated.',
      liveQuizGamification:
        'The quiz automatically adopts the gamification setting of the course. If the quiz is not assigned to a course, gamification cannot be activated.',
      liveQuizLiveQA:
        'This setting specifies whether the live Q&A channel should be activated at the beginning of the live quiz. It can be changed at any time during the live quiz.',
      liveQuizModeration:
        'This setting specifies whether moderation in the live Q&A channel should be activated at the beginning of the live quiz. It can be changed at any time during the live quiz.',
      liveQuizFeedbackChannel:
        'This setting specifies whether the feedback channel should be activated at the beginning of the live quiz. It can be changed at any time during the live quiz.',
      liveQuizIntroductionName:
        'Please enter a name for your live quiz. For more information on the specific fields during creation, you can refer to the corresponding tooltips.',
      liveQuizUseCase:
        '<link>Live quizzes</link> can be used to promote interactivity in lectures, seminars and workshops. While participants answer the questions in real time, the results are displayed on an evaluation view.',
      liveQuizLecturerDocs:
        'For more information on the creation and execution of live quizzes, visit the <link>Lecturer Documentation</link>.',
      liveQuizStudentDocs:
        'For more information on the student view, visit the <link>Student Documentation</link>.',
      liveQuizStartNow: 'Start now',
      liveQuizAdvancedSettings: 'Advanced Settings',
      liveQuizCustomizedGrading: 'Customized Grading',
      liveQuizPointsExplanation:
        'These advanced settings allow you to change the point allocation in a live quiz. Please note that all point settings and the illustrations of the point allocation refer to elements with a multiplier of 1x. Larger multipliers are applied to all components except from the standard points. The multiplier set on the activity is already included in the illustration. The answer time starts running as soon as the first participant has answered the question completely correctly. For more information, please consult our <link>documentation</link>.',
      liveQuizNoCustomizedScoring:
        'Questions in this live quiz are currently not scored. To enable scoring, assign it to a gamified and/or assessment course or manually activate gamification.',
      liveQuizDefaultPoints: 'Standard points',
      liveQuizDefaultPointsTooltip:
        'Participants in a live quiz receive this number of points for participating in a question. If no sample solution is defined, only standard points are awarded. The default value is {defaultValue}.',
      liveQuizDefaultCorrectPoints: 'Points for correct answer',
      liveQuizDefaultCorrectPointsTooltip:
        'Participants in a live quiz receive this number of points for a correct answer to a question with a sample solution. The default value is {defaultValue}.',
      liveQuizMaxBonusPoints: 'Maximum bonus points',
      liveQuizMaxBonusPointsTooltip:
        'This is the maximum number of points a participant will receive during a gamified live quiz for a correct answer to a question with sample solution. The default value is {defaultValue}.',
      liveQuizTimeToZeroBonus: 'Time to zero bonus points',
      liveQuizTimeToZeroBonusTooltip:
        'This is the time in seconds after the first correct answer at which a participant will receive zero bonus points for a correct answer. The default value is {defaultValue}.',
      liveQuizAnswerTime: 'Answer time: {answerTime} s',
      liveQuizCorrectAnswersPoints: 'Points for correct answer',
      liveQuizIncorrectAnswersPoints:
        'Points for incorrect answer / no sample solution',
      liveQuizTotalAwardedPointsCorrect:
        'Total points (correct): {totalPoints}',
      liveQuizTotalAwardedPointsIncorrect:
        'Total points (incorrect): {totalPoints}',
      liveQuizDefaultPointsReq:
        'Please enter a valid number of default points that are awarded for every answer.',
      liveQuizDefaultPointsMin: 'The default points must be at least 0.',
      liveQuizDefaultCorrectPointsReq:
        'Please enter a valid number of points that are awarded for every correct answer.',
      liveQuizDefaultCorrectPointsMin:
        'The points for correct answers must be at least 0.',
      liveQuizMaxBonusPointsReq:
        'Please enter a valid number of maximum bonus points.',
      liveQuizMaxBonusPointsMin: 'The maximum bonus points must be at least 0.',
      liveQuizTimeToZeroBonusReq:
        'Please enter a valid time to zero bonus points.',
      liveQuizTimeToZeroBonusMin:
        'The time to zero bonus points must be at least 1.',
      liveQuizTSinceFirstCorrect: 'Time since first correct answer [s]',
      practiceQuizNoCourse:
        'Practice quizzes must be assigned to a running course. Please create a course first via the corresponding menu or extend an existing one before continuing with the creation.',
      practiceQuizIntroductionName:
        'Please enter a name for your practice quiz. For more information on the specific fields during creation, you can refer to the corresponding tooltips.',
      practiceQuizInformation:
        'In this step, enter the name and description of the practice quiz and find helpful information for creating the element.',
      practiceQuizLecturerDocs:
        'For more information on the creation and execution of practice quizzes, visit the <link>Lecturer Documentation</link>.',
      practiceQuizStudentDocs:
        'For more information on the student view, visit the <link>Student Documentation</link>.',
      practiceQuizResetDays:
        'Please enter a number of days after which the practice quiz can be repeated.',
      practiceQuizStartAfterCourseStart:
        'The start date of the practice quiz must be after the start date of the course.',
      practiceQuizStartRequired:
        'Please choose the start date of the practice quiz.',
      practiceQuizValidResetDays:
        'Please enter a valid number of days after which the practice quiz can be repeated.',
      practiceQuizElementTypes:
        'Practice quizzes can only contain single choice, multiple choice, Kprim and numerical questions as well as content elements and flashcards.',
      elementSolutionReq:
        'For all element types except from free text questions, a sample solution must be defined.',
      practiceQuizCreated: 'Practice quiz <b>{name}</b> successfully created.',
      practiceQuizUpdated: 'Practice quiz <b>{name}</b> successfully modified.',
      practiceQuizDescription:
        'In this step, enter the name and description of the practice quiz.',
      practiceQuizSettings:
        'In this step, make settings for your practice quiz.',
      practiceQuizMissingCourse:
        'Practice quizzes must be assigned to a course.',
      practiceQuizCourseNotGamified:
        'With the current course selection the practice quiz will not be gamified.',
      practiceQuizContent:
        'In this step, add questions and text elements to your practice quiz.',
      selectCourse: 'Select course...',
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
      practiceQuizTypes:
        'Practice quizzes can contain all available element types.',
      practiceQuizUseCase:
        '<link>Practice quizzes</link> can be used to prepare for exams and to review learning content. As part of a compact evaluation, students receive feedback on their answers.',
      selectGamifiedCourse:
        'Please select a gamified course for the creation of this element.',
      groupActivityInformation:
        'In this step, enter the name and description of the group activity and find helpful information for creating the element.',
      groupActivityMissingCourse:
        'Group activities must be assigned to a course.',
      groupActivityTypes:
        'A group activity can only contain content elements, single choice, multiple choice, kprim, numerical, free-text, and selection questions.',
      groupActivityCreated:
        'Your group activity <b>{name}</b> has been created successfully.',
      groupActivityEdited:
        'Your group activity <b>{name}</b> has been edited successfully.',
      groupActivityNoCourse:
        'Group activities must always be assigned to a running course, where gamification and group creation are enabled. Please make sure that there exists at least one course with both options enabled.',
      groupActivityIntroductionName:
        'Please enter a name for your group activity. For more information on the specific fields during creation, you can refer to the corresponding tooltips.',
      groupActivityLecturerDocs:
        'For more information on the creation and execution of group activities, visit the <link>Lecturer Documentation</link>.',
      groupActivityStudentDocs:
        'For more information on the student view, visit the <link>Student Documentation</link>.',
      groupActivityDescription:
        'In this step, enter the name and description of the group activity.',
      groupActivitySettings:
        'In this step, select the start and end date and define clues that are distributed to the group members.',
      groupActivityQuestions:
        'In this step, select the questions for the group activity.',
      groupActivityEditingFailed: 'Editing the group activity failed...',
      groupActivityCreationFailed: 'Creating the group activity failed...',
      groupActivityName:
        'This name should allow you to distinguish this group activity from others. It will not be shown to the participants, please use the display name (next field) for this.',
      groupActivityDescField:
        'Add a task description to your group activity that contains all information necessary to solve all questions with the provided clues.',
      groupActivityCourse:
        'For the creation of a group activity, the selection of the corresponding course is required.',
      groupActivityStartDate:
        'Please choose the start date of the group activity. The group activity will be available to participants from this point in time.',
      groupActivityEndDate:
        'Please choose the end date of the group activity. The group activity will no longer be available for submission to the participants after this point in time.',
      groupActivityStartAfterCourseStart:
        'The start date of the group activity must be after the start date of the course.',
      groupActivityStartAfterGroupDeadline:
        'The start date of the group activity must be after the group formation deadline.',
      groupActivityEndBeforeCourseEnd:
        'The end date of the group activity must be before the end date of the course.',
      groupActivityMultiplier:
        'The multiplier is a factor with which the points of the participants are multiplied in a gamified group activity.',
      groupActivityUseCase:
        '<link>Group activities</link> can be solved once per group and require collaboration to gather information from a set of clues and to respond to a set of questions.',
      groupActivityCluesDescription:
        'Clues are distributed among group members and should be required to solve the questions added to the group activity in the next step.',
      groupActivityAddClue: 'Add new clue',
      groupActivityCluesUniqueNames: 'All clues must have unique names.',
      groupActivityClueType: 'Clue type',
      textClue: 'Text clue',
      numericalClue: 'Numerical clue',
      groupActivityNameError: 'Please enter a name for your group activity.',
      groupActivityDisplayNameError:
        'Please enter a valid display name for your group activity.',
      groupActivityDescriptionError:
        'Please enter a task description for your group activity.',
      groupActivityMin2Clues:
        'Please add at least two clues to your group activity.',
      clueNameMissing: 'Please enter a name for your clue.',
      clueDisplayNameMissing:
        'Please enter a valid display name for your clue.',
      clueContentMissing: 'Please enter a content for your clue.',
      clueValueMissing: 'Please enter a value for your numerical clue.',
    },
    template: {
      convertToTemplate: 'Convert {activityType} to Template',
      conversionType: 'Select Conversion Type',
      convertOption: 'Convert to Template',
      copyOption: 'Create Copy as Template',
      convertCopyTemplateInfo:
        'Templates help you to create structurally similar activities in KlickerUZH or share the structure of one of your activities. Please choose whether the existing activity or a copy of it should be converted into a template. Templates are no longer available for editing and cannot be executed.',
      noInstances:
        'The selected activity does not contain any elements and cannot be converted into a template.',
      resourcesRequiredMissing:
        'Some elements in this activity depend on resources (e.g., answer collections) that have been deleted, modified (required answer options removed), or removed from the account (in case of shared access). Please replace these elements before converting the activity into a template.',
      noResourceAccessRequired:
        'This activity does not contain any elements that depend on resources (e.g., answer collections).',
      confirmationsTitle: 'Required Confirmations',
      confirmContentVisibility:
        'I understand that the content of this entire activity (including questions) will be visible to anyone with access to this template.',
      confirmQuestionAccess:
        'I understand that access to my questions will not be shared. If another user uses this template without modifications, new questions with the same content will be created in their account.',
      confirmResourceAccess:
        'I understand that elements in this activity depend on resources (e.g., answer collections), access to them will be automatically shared (read permissions) if a user does not replace this information and does not have access to the corresponding resource already.',
      templateInformation: 'Template Information',
      templateInformationDescription:
        'Please provide the following information for your template. It will be shown to users when they import it through a catalog collection or use your template for the creation of an activity, respectively.',
      nameTooltip:
        'The name will be shown to users when they browse available templates in the catalog.',
      nameRequired: 'A name for the activity template is required',
      descriptionTooltip:
        'The description will be shown to users when they browse available templates in the catalog.',
      descriptionPlaceholder:
        'Enter a description of what this template contains and what it can be used for...',
      instructionsTooltip:
        'The instructions will be shown at the top of the template when a user creates a new activity from it.',
      instructionsPlaceholder:
        'Enter instructions on how to use this template effectively...',
      createTemplate: 'Create Template',
      createTemplateCopy: 'Create Template Copy',
      descriptionRequired: 'A description is required',
      instructionsRequired: 'Instructions are required',
      templateCreationSuccess: 'Template was successfully created',
      templateCreationError: 'Template could not be created',
      deleteTemplate: 'Delete template',
      editTemplate: 'Edit template',
      templateEditSuccess: 'Template updated successfully',
      templateEditError: 'Error updating template',
      templateDeletionSuccess: 'Template deleted successfully',
      templateDeletionError: 'Error deleting template',
      deleteTemplateExplanation:
        'Please confirm that you want to delete the selected template. It will be automatically removed from all catalog collections and cannot be used by other users anymore.',
      editTemplateDescription:
        'Modify any meta information of the activity template you want to change. Changes will go into effect immediately upon saving and are shown to all users of the template.',
      saveChanges: 'Save Changes',
      activityFromTemplate: 'Create Activity from Template',
      errorLoadingTemplate: 'An error occurred while loading the template...',
      templateInfoLIVE_QUIZ:
        'This view allows you to create your own live quiz activity from the live quiz template "{templateName}". You will be guided step by step through the creation and adjust or replace the existing content in each step. Please pay particular attention to the following instructions left by the creators of the template.',
      templateInfoPRACTICE_QUIZ:
        'This view allows you to create your own practice quiz from the practice quiz template "{templateName}". You will be guided step by step through the creation and adjust or replace the existing content in each step. Please pay particular attention to the following instructions left by the creators of the template.',
      templateInfoGROUP_ACTIVITY:
        'This view allows you to create your own group activity from the group activity template "{templateName}". You will be guided step by step through the creation and adjust or replace the existing content in each step. Please pay particular attention to the following instructions left by the creators of the template.',
      templateInfoMICRO_LEARNING:
        'This view allows you to create your own microlearning from the microlearning template "{templateName}". You will be guided step by step through the creation and adjust or replace the existing content in each step. Please pay particular attention to the following instructions left by the creators of the template.',
      recoverTemplateActivityInputs: 'Recover Template Activity Inputs',
      notFoundNotAccessible:
        'The requested activity template was not found or is not accessible. Please ensure that you have sufficient permissions to access this template.',
      incompleteActivity:
        'An incomplete state of this activity template has been auto-saved. Please choose whether you would like to continue editing the activity and recover the auto-saved state or start over with the original version of the template.',
      startOver: 'Start Over',
      continueEditing: 'Continue Editing',
      settingsInstructions:
        'Here you can change the basic settings of the activity. Please refer to the corresponding tooltips or consult the documentation for further information. Some settings such as point multipliers cannot be changed directly in templates.',
      reusingElement: 'element reused',
      replacingElement: 'element replaced',
      creatingElement: 'element created',
      forGamifiedCourses: 'for gamified courses',
      gamificationDisabled: 'Gamification & Assessment disabled',
      gamificationDisabledInfo:
        'Please select a gamified or assessment course, or enable gamification for your live quiz to view the scoring logic here.',
      confirmSettings: 'Confirm Settings',
      settingsNotSaved:
        'Please save your changes to the settings before continuing to edit the template.',
      confirmTimeLimit: 'Confirm time limit',
      elementActionsTemplate:
        'Elements in this template can either be accepted as they are in the template, replaced by an existing element of the same type and partially matching settings (e.g. sample solution), or replaced by new content. Elements created or accepted without modifications will be available in your library afterwards. Please choose the desired action for this element.',
      selectActionOptionElement: 'Please select an action for this element',
      previewTemplateElement: 'Preview template content',
      acceptTemplateElement: 'Accept template element without modifications',
      replaceWithExistingElement: 'Replace with existing element from library',
      insertContentNewElement: 'Insert content for new element',
      editContentNewElement: 'Continue editing content for new element',
      selectExistingElement: 'Select existing element',
      selectElementInstructions:
        'Select one of your existing elements to replace the template content. Please note that the element type must match the following requirements: {element}. The selection below has already been filtered according to these criteria.',
      noMatchingQuestionsFound:
        'No elements were found in your account that match the requirements of the template. Please create your element directly in the template or accept the existing content.',
      withSampleSolution: 'with sample solution',
      withoutSampleSolution: 'without sample solution',
      withAnswerFeedbacks: 'with answer feedbacks',
      withoutAnswerFeedbacks: 'without answer feedbacks',
      nextElement: 'Next element',
      availableActions: 'Available actions',
      sameNamedElementExists:
        'Your library already contains an element with the name "{elementName}". Please consider selecting an existing element or creating a new one. If you choose to accept the template element without modifications, a copy of it will be added to your account.',
      discardEnteredElementContent: 'Discard Data for Element Creation',
      confirmDiscardEnteredElementContent:
        'By performing this action, all entered data for the creation of a new element at this point in the template will be discarded. This action cannot be undone.',
      createLIVE_QUIZ: 'Create Live Quiz',
      templateInputsIncomplete:
        'The template contains incomplete inputs. Please check the settings and elements, not yet edited components are marked with an orange status.',
      errorCreatingLiveQuizFromTemplate:
        'An error occurred while creating the live quiz. Please check that all your inputs are valid and try again.',
      activityRemainsAvailable:
        'When creating the template as a copy, the original activity remains unchanged and available.',
      confirmActivityConversion:
        'Your activity will be converted into a template and can no longer be executed subsequently.',
      expandAll: 'Expand all',
      collapseAll: 'Collapse all',
      basedOnObject: 'based on {object}',
      recoveredTemplateData:
        'The template contains auto-saved data from your previous inputs. If you want to reset the template, please use the corresponding button.',
      resetTemplateData: 'Reset inputs',
      resetConfirmation: 'Reset Template Confirmation',
      resetWarning:
        'Please confirm that you want to reset all inputs for this template. All entered data, including potential element content entered in the template, will be deleted and cannot be restored.',
      confirmReset: 'Confirm reset',
    },
    formErrors: {
      resolveErrors:
        'Please ensure that the following errors in the form are resolved before saving the question:',
      questionName: 'Please enter a name for the question.',
      questionContent: 'Please add some content to your question.',
      answerContent: 'Please add some content to your answer option.',
      feedbackContent: 'Please add some content to all your answer feedbacks.',
      SCAnswersCorrect:
        'For SC questions exactly one answer has to be marked as correct.',
      MCAnswersCorrect:
        'For MC questions at least one answer has to be marked as correct.',
      enterSolution: 'Please enter a solution.',
      FTMaxLength:
        'The maximum length of a free text question response has to be at least 1.',
      solutionRequired:
        'Please enter at least one solution or deactivate the sample solution.',
      NRMinLessThanMaxSol:
        'The minimum value of a solution interval must be less than its maximum value.',
      NRMinLessThanMax:
        'The minimum value must be less than the maximum value.',
      NROneValueRequired:
        'For solution ranges at least one boundary value must be entered.',
      NRPrecision: 'The number of decimal places must be at least 0.',
      chooseSolutionType:
        'Please choose a solution type for your numerical question or deactivate the sample solution.',
      solutionRangeRequired: 'Please enter at least one valid solution range.',
      exactSolutionRequired: 'Please enter at least one exact solution.',
      NumberQuestionsRequired: 'At least one answer option must be given',
      NumberQuestionsRequiredKPRIM:
        'There must be exactly four answer options for Kprim questions',
      explanationRequired:
        'Please enter an explanation. On flashcards, this explanation will be displayed to students as an answer to the question.',
      NumericalUnderflow:
        'Numerical quantities cannot be smaller than -1e30 for technical reasons.',
      NumericalOverflow:
        'Numerical quantities cannot be larger than 1e30 for technical reasons.',
      NRSolutionRangesWithinRestrictions:
        'The solution ranges must lie within the specified restrictions.',
      NRExactSolutionsWithinRestrictions:
        'The exact solutions must lie within the specified restrictions.',
      SEnumberOfInputsRequired: 'Please specify the number of input fields.',
      SEnumberOfInputsMin: 'The number of inputs must be at least 1.',
      SEnumberOfInputsMax:
        'The number of input fields must be at most the number of options in the answer collection - 1.',
      SEanswerCollectionRequired: 'Please select an answer collection.',
      SEcorrectAnswersRequired:
        'Please select the correct answer options from your collection.',
      SEcorrectAnswersMatchInputs:
        'The number of correct answers must be larger or equal to the number of input fields.',
      CSAnswerCollectionRequired:
        'Please select an answer collection from which the elements to be evaluated in the case study are selected.',
      CSItemsRequired:
        'Please select at least one item from the answer collection that participants should evaluate against the created criteria.',
      CSNewItemsRequired:
        'Please define at least one item that should be evaluated by the participants against the created criteria.',
      CSCriteriaNameRequired: 'Please enter a name for the criterion.',
      CSCriteriaMinRequired: 'Please enter a minimum value for the criterion.',
      CSCriteriaMinLessThanMax:
        'The minimum value must be less than the maximum value.',
      CSCriteriaMaxRequired: 'Please enter a maximum value for the criterion.',
      CSCriteriaStepRequired: 'Please enter a step size for the criterion.',
      CSStepSizeTooLarge:
        'The step size must be less than or equal to half of the interval width.',
      CSLabelsRequired:
        'Please define at least one label for the lower and upper limit for the step / Likert criterion.',
      CSStepsDefinitionRequired:
        'Please define a number of steps for the step / Likert criterion (at least 3).',
      CSCriteriaRequired:
        'At least one criterion is required to create a case study.',
      CSCasesRequired: 'At least one case is required to create a case study.',
      CSCaseTitleRequired: 'Please enter a title for the case.',
      CSCaseDescriptionRequired: 'Please enter a description for the case.',
      CSSolutionsRequired:
        'For case studies with sample solutions, a correct solution range must be defined for each item and the corresponding criteria.',
      CSSolutionsMissingCertainItems:
        'Please provide a solution for all items and criteria.',
      CSSolutionsMissingCriteriaItem:
        'Please make sure that a correct solution has been defined for all criteria for item {itemNumber}.',
      CSSolutionsMinMaxRequired:
        'Please enter both the lower and upper limits for the solution range for item {itemNumber} and criterion "{criterionName}".',
      CSSolutionsMinMaxOrder:
        'The minimum value must be less than the maximum value (item {itemNumber}, criterion "{criterionName}").',
      CSSolutionsMinMaxBounds:
        'The lower and upper limits of the solution interval must lie within the value range of the criterion (item {itemNumber}, criterion "{criterionName}").',
      CSSolutionsMinMaxStep:
        'The lower and upper limits of the solution interval must be at least one step size apart for numerical criteria (item {itemNumber}, criterion "{criterionName}").',
      CSSolutionsMinMaxIntegers:
        'The lower and upper limits of the solution interval must be integers for step / Likert criteria (item {itemNumber}, criterion "{criterionName}").',
    },
    liveQuizzes: {
      runningLiveQuizzes: 'Running Live Quizzes',
      plannedLiveQuizzes: 'Planned Live Quizzes',
      preparedLiveQuizzes: 'Prepared Live Quizzes',
      completedLiveQuizzes: 'Completed Live Quizzes',
      liveQuizTemplates: 'Live Quiz Templates',
      embeddingEvaluation: 'Embed Evaluation',
      lecturerCockpit: 'Lecturer Cockpit',
      liveQuizEvaluation: 'Quiz Evaluation',
      startLiveQuiz: 'Start Quiz',
      scheduleLiveQuiz: 'Schedule Live Quiz',
      unpublishLiveQuiz: 'Unpublish Live Quiz',
      editLiveQuiz: 'Edit Quiz',
      duplicateLiveQuiz: 'Duplicate Live Quiz',
      viewLiveQuiz: 'View Live Quiz',
      executeLiveQuiz: 'Execute Live Quiz',
      manageFeedbacksExecution: 'Manage Feedbacks, ... during Execution',
      viewLiveQuizEvaluation: 'View Live Quiz Evaluation',
      modifyActivitySettings: 'Modify Activity Settings',
      modifyContainedElements: 'Manage Elements in Live Quiz',
      modifyCourseAssignment: 'Modify Course Assignment',
      nBlocksQuestions: '{blocks} blocks, {questions} questions',
      blockXQuestions: 'Block {block} ({questions} question(s))',
      shareLiveQuiz: 'Share Live Quiz',
      removeLiveQuiz: 'Remove Live Quiz',
      resetLiveQuiz: 'Reset Live Quiz',
      deleteLiveQuiz: 'Delete Live Quiz',
      resetLiveQuizMessage:
        'Please confirm the reset of this assessment live quiz. All responses from students and collected points will be deleted. This action will be documented in the audit log and cannot be undone.',
      deleteLiveQuizMessage:
        'Please confirm the deletion of all results and feedbacks associated with this live quiz. Points collected by participants will not be affected by the deletion.',
      noResponsesToDelete:
        'For this live quiz no responses have been collected yet.',
      deleteResponses:
        '{number} response(s) in this live quiz submitted by students will be deleted.',
      noFeedbacksToDelete:
        'For this live quiz no questions have been submitted in the Q&A channel yet.',
      deleteFeedbacks:
        '{number} questions(s) in the live Q&A channel and their answers will be irreversibly deleted.',
      noConfusionFeedbacksToDelete:
        'For this live quiz no confusion feedbacks have been submitted yet.',
      deleteConfusionFeedbacks:
        '{number} confusion feedback(s) will be irreversibly deleted.',
      noLeaderboardEntriesToDelete:
        'For this live quiz no quiz leaderboard entries have been created yet.',
      deleteLeaderboardEntries:
        '{number} quiz leaderboard entries will be deleted and all participants will lose their collected points.',
      evaluationLinksEmbedding: 'Links for Embedding Evaluation Views',
      noLiveQuizzes: 'No live quizzes available',
      creationExplanation:
        'To create your first live quiz, go back to the <link>question pool</link>. There you can create all different types of KlickerUZH activities and add questions from the question pool.',
      embeddingLinkCopied:
        'The embedding link has been copied to the clipboard successfully.',
      liveQuizSchedulingDateRequired:
        'Please enter a date for the automatic start of the live quiz.',
      liveQuizSchedulingFutureAfterCourseStart:
        'The date for the automatic start of the live quiz must be in the future and, if associated with a course, after the start time of that course.',
      scheduleLiveQuizHint:
        'When scheduling the live quiz "{title}", it will automatically start at the time you set. Before the scheduled publication date is reached, the quiz can still be unpublished and edited.',
    },
    practiceQuizzes: {
      viewPracticeQuiz: 'View Practice Quiz',
      publishUnpublishPracticeQuiz: 'Publish / Unpublish Practice Quiz',
      viewPracticeQuizEvaluation: 'View Practice Quiz Evaluation',
      modifyActivitySettings: 'Modify Activity Settings',
      modifyContainedElements: 'Manage Elements in Practice Quiz',
      modifyCourseAssignment: 'Modify Course Assignment',
      duplicatePracticeQuiz: 'Duplicate Practice Quiz',
    },
    microLearnings: {
      viewMicroLearning: 'View Microlearning',
      publishUnpublishMicroLearning: 'Publish / Unpublish Microlearning',
      viewMicroLearningEvaluation: 'View Microlearning Evaluation',
      modifyActivitySettings: 'Modify Activity Settings',
      modifyContainedElements: 'Manage Elements in Microlearning',
      modifyCourseAssignment: 'Modify Course Assignment',
      duplicateMicroLearning: 'Duplicate Microlearning',
    },
    groupActivities: {
      viewGroupActivity: 'View Group Activity',
      publishUnpublishGroupActivity: 'Publish / Unpublish Group Activity',
      gradeGroupActivitySubmissions: 'Grade Group Activity Submissions',
      modifyActivitySettings: 'Modify Activity Settings',
      modifyContainedElements: 'Manage Elements in Group Activity',
      modifyCourseAssignment: 'Modify Course Assignment',
      duplicateGroupActivity: 'Duplicate Group Activity',
    },
    cockpit: {
      liveQuizQRCodes: 'Live Quiz QR-Code',
      qrCodeAccountLinkTitle: 'Account Link',
      qrCodeAccountLinkPinWarning: 'PIN not included',
      qrCodeDirectLinkIncluded: 'PIN included',
      qrCodeAccountLinkDescription:
        'Your account link lists all of your active live quizzes. If only one quiz is active, participants will be redirected automatically, otherwise they will be able to choose which quiz to participate in. This link is recommended for addition to slides, as it stays the same as long as you do not change your shortname. For quizzes assigned to a course, the course language will be automatically embedded in the link.',
      qrCodeDirectLinkTitle: 'Direct Link',
      qrCodeDirectLinkDescription:
        'The direct link leads participants directly and only to this quiz. Once the quiz has been completed, the link will no longer be valid. This link is recommended if you run a lot of quizzes in parallel and want participants to join a specific quiz only. For quizzes assigned to a course, the course language will be automatically embedded in the link. If a PIN code is enabled, it is directly embedded in the link.',
      firstBlock: 'Start first block',
      blockActive: 'Close block',
      nextBlock: 'Start next block',
      endQuiz: 'End quiz',
      audienceView: 'Audience view',
      evaluationResults: 'Evaluation (results)',
      abortLiveQuiz: 'Abort quiz',
      confirmAbortLiveQuiz: 'Abort live quiz {title}?',
      noAbortionAssessmentQuiz:
        'Assessment quizzes cannot be aborted once a block has been started. If you have started the quiz for testing purposes, please proceed through all blocks and end the quiz. Users with administrator rights in the assessment course can then reset the live quiz.',
      cancelLiveQuizMessage:
        'Please confirm the deletion of all elements associated with this live quiz and confirm the irreversible abortion of this live quiz.',
      noResponsesToDelete:
        'For this live quiz no responses have been collected yet.',
      deleteResponses:
        '{number} response(s) in this live quiz submitted by students will be deleted.',
      noFeedbacksToDelete:
        'For this live quiz no feedbacks have been submitted yet.',
      deleteFeedbacks:
        '{number} feedback(s) in the live Q&A channel will be irreversibly deleted.',
      noConfusionFeedbacksToDelete:
        'For this live quiz no confusion feedbacks have been submitted yet.',
      deleteConfusionFeedbacks:
        '{number} confusion feedback(s) will be irreversibly deleted.',
      noLeaderboardEntriesToDelete:
        'For this live quiz no quiz leaderboard entries have been created yet.',
      deleteLeaderboardEntries:
        '{number} quiz leaderboard entries will be deleted and all participants will lose their collected points.',
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
      filterPinned: 'Pinned',
      filterUnpinned: 'Unpinned',
      filterPublished: 'Published',
      filterUnpublished: 'Unpublished',
      pinning: 'Pinning',
      visibility: 'Visibility',
      sortByVotes: 'Sort by votes',
      sortByTime: 'Sort by time',
      answersGiven: '{number} answer(s) given',
      reopenToAnswer: 'Reopen feedback to answer...',
      enterResponseHere: 'Enter your response here...',
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
      deleteFeedback: 'Delete Feedback',
      deleteFeedbackMessage:
        'Are you sure you want to delete this feedback: "{feedback}"?',
      moderationTip: 'Alternative to deletion',
      moderationTipMessage:
        'You can enable moderation to hide selected feedbacks from the student view without deleting them permanently.',
      confirmDeleteFeedback:
        'I understand that this action will permanently delete the feedback.',
      disableModerationTitle: 'Disable Moderation',
      disableModerationMessage:
        'You are about to disable moderation. This will automatically publish {count} unpublished feedback(s).',
      autoPublishWarning: 'Auto-Publish Warning',
      autoPublishWarningMessage:
        'These will become visible to all students immediately.',
      confirmDisableModeration:
        'I understand that moderation will be disabled.',
      confirmPublishUnpublished:
        'I confirm that all {count} unpublished feedback(s) should be published.',
      confirmCloseBlockTitle: 'Close Active Block',
      confirmCloseBlock:
        'Please confirm that the active block should be closed. After your confirmation, the system will not accept any further answers from the students and the complete evaluation (including sample solution) can be displayed.',
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
      totalParticipantsInclAnon:
        'Total participants: {number} ({anonymous} anonymous)',
      showSolution: 'Show solution',
      showExplanation: 'Show explanation',
      showSolutionInfo:
        'This option allows you to pre-select whether or not the sample solution should be shown on the embedded evaluation view, as soon as you open the corresponding page or slide. This setting can be modified once the corresponding view has been opened.',
      showExplanationInfo:
        'This option allows you to pre-select whether or not the explanation (if captured) should be shown on the embedded evaluation view, as soon as you open the corresponding page or slide. This setting can be modified once the corresponding view has been opened.',
      solutionHiddenWhileActive:
        'The sample solution and explanation will only be shown in the evaluation view after closing the active block.',
      fontSize: 'Font size',
      validSolutionRange: 'Valid solution range',
      correctSolutionRanges: 'Correct solution ranges',
      correctExactSolutions: 'Correct solutions',
      statistics: 'Statistics',
      keywordsSolution: 'Solution keywords',
      noChartsAvailable: 'There exists no chart for this question type yet',
      count: 'Count',
      value: 'Value',
      selection: 'Selection',
      histogramRange: 'Range',
      histogramBins: 'Bins',
      histogramBinsError: 'Please enter a number of bins between 2 and 100.',
      histogramLowerLimit: 'Lower Limit',
      histogramUpperLimit: 'Upper Limit',
      histogramLowerLimitError:
        'The lower limit must be greater than {minValue}.',
      histogramUpperLimitError:
        'The upper limit must be smaller than {maxValue}.',
      histogramRangeError:
        'Please ensure that the lower limit is smaller than the upper limit.',
      correctLabel: 'Correct',
      correctLabelValue: 'Correct: {value}',
      resetSorting: 'Reset sorting',
      noFeedbacksMatchFilter:
        'No feedbacks match the current filter settings...',
      resolvedDuringLiveQuiz: 'Resolved during live quiz',
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
      wordCloudFilterMode: 'Filter Mode',
      wordCloudLanguageFilter: 'Language Filter',
      wordCloudLanguageFilterTooltip:
        'When a language is selected, stopwords for that language (e.g. "the", "and") are filtered out. Disable the filter to show all words.',
      wordCloudLanguageNone: 'Disabled',
      wordCloudDisplayLimit: 'Display limit',
      wordCloudDisplayLimitAll: 'All',
      wordCloudModeWords: 'Individual words',
      wordCloudOmittedWords:
        '{count} {count, plural, one {word} other {words}} could not be displayed due to the display limit or space constraints.',
      wordCloudOmittedSentences:
        '{count} {count, plural, one {response} other {responses}} could not be displayed due to the display limit or space constraints.',
      wordCloudModeSentences: 'Full responses',
      wordCloudNoResponses:
        'No participants have submitted responses for this question 😔.',
      wordCloudNoResponsesFiltered:
        'No responses match the current filter settings 🧐.',
      wordCloudNoResponsesDisplayed:
        'No responses are displayed due to the current filter settings or the provided font sizes 😰.',
      numberOfVotes: 'Frequency: {number}',
      histogram: 'Histogram',
      barChart: 'Bar Chart',
      scatterPlot: 'Scatter Plot',
      unset: 'Unset',
      noStatistics:
        'Because of missing answers, no statistics are available yet.',
      practiceQuizEvaluation: 'Practice Quiz Evaluation',
      microLearningEvaluation: 'Microlearning Evaluation',
      chartTypeNotSupported:
        'At the moment, the selected chart type is not supported for this element type.',
      histogramNotSupported:
        'Histograms are not supported for this question type.',
      criterionXAxis: 'Criterion X-Axis',
      criterionYAxis: 'Criterion Y-Axis',
      aggregation: 'Aggregation',
      caseStudySelectCasesCriteria:
        'Please select at least one case and corresponding criteria to display the evaluation.',
      caseStudyHistogramSelection:
        'You can either select multiple cases or multiple case study elements to compare the corresponding results. A combination of multiple cases and multiple case study elements cannot be displayed.',
      caseStudySelectCasesItemsCriteria:
        'Please select at least one case, one case study item and criteria to display the evaluation.',
      answerNotRemembered: 'Answer not remembered',
      answerPartiallyRemembered: 'Answer partially remembered',
      answerRemembered: 'Answer remembered',
      frontSide: 'Front Side',
      backSide: 'Back Side',
      blockActive: 'Block is active',
      blockActiveInfo:
        'The currently selected block has not been closed yet. Participants in your quiz can still submit answers. Please confirm that you want to display the results.',
      showResults: 'Show Results',
      showQRCodes: 'Show QR Codes',
    },
    lecturer: {
      noDataAvailable: 'No data available...',
      audienceInteractionNotActivated:
        'Audience interaction has not been activated.',
      noFeedbacks: 'No feedbacks received or pinned yet...',
    },
    courseList: {
      showDetails: 'Show course details',
      selectCourse: 'Please select a course',
      createNewCourse: 'Create new course',
      changeAvailabilityDateMicrolearnings:
        'The availability of microlearnings will be adjusted according to the new course dates based on the offset to the original course start date.',
      changeAvailabilityDateGroupActivities:
        'The availability of group activities will be adjusted according to the new course dates based on the offset to the original course start date.',
      courseDatesForCourseDuplicationTooltip:
        'Due to technical reasons, the course dates are fixed to a range as defined by the original course. You can change the dates for the duplicated course afterwards.',
      fixedDateInterval:
        'Fixed date interval: {years, plural, =0 {} one {# year } other {# years }}{months, plural, =0 {} one {# month } other {# months }}{days, plural, =0 {} one {# day} other {# days}}',
      groupCreationDeadlineForCourseDuplicationTooltip:
        'Changing the course dates recalculates this deadline based on its original offset. You can adjust it afterwards.',
      copyLiveQuizzesTooltip:
        'If you activate this setting, all live quizzes in the course will be copied to the new course.',
      copyPracticeQuizzesTooltip:
        'If you activate this setting, all practice quizzes in the course will be copied to the new course.',
      copyMicroLearningsTooltip:
        'If you activate this setting, all microlearnings in the course will be copied to the new course.',
      copyGroupActivitiesTooltip:
        'If you activate this setting, all group activities in the course will be copied to the new course. When disabling group creation, this setting is disabled.',
      courseDuplicationCopyInfo:
        'Duplicating a course creates independent activity copies and preserves direct sharing permissions. The copied activity instances still reference the same underlying elements. If you duplicate a course owned by somebody else, the original owner keeps administrative access to the copy.',
      courseCopySuffix: 'Copy',
      courseDuplicationEndDateInPast:
        'The selected end date lies in the past. The duplicated course will already have ended when it is created - shift the start date if students should be able to access it.',
      courseDuplicationFailed: 'Failed to duplicate course.',
      courseDuplicationAlreadyInProgress:
        'This course is already being duplicated.',
      courseDuplicationNoAccess:
        'You no longer have sufficient permissions to duplicate this course.',
      courseDuplicationPartialFailure:
        'Not all selected activities or activity instances could be duplicated. No partial course was created.',
      courseDuplicationInProgress:
        'Duplicating large courses can take a while.',
      courseDuplicationBackgroundInfo:
        'You can close this dialog. When the copy is ready, you will get a notification with a link to open it.',
      courseDuplicationStatusTab: 'Course duplications',
      courseDuplicationStatusCount:
        '{count, plural, one {# active course duplication request} other {# active course duplication requests}}',
      courseDuplicationStatusTitle: 'Active course duplications',
      courseDuplicationStatusDescription:
        'You can continue working while these courses are copied.',
      courseDuplicationStatusSource: 'Copying from "{source}"',
      courseDuplicationSucceeded:
        'Course "{name}" has been duplicated successfully.',
      courseDuplicationOpenCourse: 'Open course',
      noCoursesFound: 'No courses found. Please create a new course.',
      createCourseNow: 'Create a course now!',
      courseNameReq: 'Please enter a name for the course.',
      courseDisplayNameReq: 'Please enter a display name for the course.',
      courseColorReq: 'Please select a color for the course.',
      courseStartReq:
        'Please enter a start date for your course. The dates can be changed after creating the course.',
      courseEndReq:
        'Please enter an end date for your course. The dates can be changed after creating the course.',
      courseStartBeforeEarliestActivityStart:
        'The course start date must be before the start date of the earliest activity ({date}).',
      endBeforeEarliestActivityEnd:
        'The course end date must be after the end date of the last activity ({date}).',
      groupDeadlineBeforeFirstGroupActivity:
        'The group creation deadline must be before the start of the first group activity ({date}).',
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
      notificationEmail: 'Notification Email',
      notificationEmailTooltip:
        'The email address to which course-specific notifications are sent (e.g. comments from students on incorrect questions). This email address can be changed later in the course settings and is not visible to students.',
      notificationEmailPlaceholder: 'finance@uzh.ch',
      notificationEmailInvalid: 'Please enter a valid email address.',
      notificationEmailReq:
        'Please enter a course-specific notification email address.',
      courseLanguage: 'Course Language',
      startDate: 'Start date',
      startDateTooltip:
        "After the start date, students can access the course's content. The start date can be changed after creating the course.",
      endDate: 'End date',
      endDateTooltip:
        'After the end date, the course will be shown as archived to students, but they can still access the content. The end date can be changed after creating the course.',
      courseColor: 'Course color',
      languageTooltip:
        'Choose a language that will be used as the default when exporting activity access links, etc. Students can still change the language in the student app.',
      courseCreationFailed: 'Failed to create course...',
      groupDeadlineFuture: 'The group creation deadline must be in the future.',
      groupDeadlineBeforeEnd:
        'The group creation deadline must be before the course end date.',
      groupDeadlineAfterStart:
        'The group creation deadline must be after the course start date.',
      groupDeadlineReq: 'Please specify a valid group creation deadline.',
      maxGroupSizeMin: 'The maximum group size must be at least 2.',
      maxGroupSizeLargerThanPreferred:
        'The maximum group size must be strictly larger than the preferred group size to ensure that automatically generated groups never exceed the maximum group size.',
      maxGroupSizeReq: 'Please specify a valid maximum group size.',
      preferredGroupSizeMin: 'The preferred group size must be at least 2.',
      preferredGroupSizeReq: 'Please specify a valid preferred group size.',
      gamificationTooltip:
        'Gamification can only be activated (not deactivated) after the course has been created.',
      groupCreationEnabled: 'Group Creation',
      groupCreationDisabledTooltip:
        'To enable group creation for your students, please first activate gamification for this course.',
      groupCreationEnabledTooltip:
        'If you deactivate this setting, students cannot create groups in this course and you will not be able to create group activities. If deactivated initially, this option can be activated later on the course overview.',
      groupCreationDeadline: 'Group Creation Deadline',
      groupCreationDeadlineTooltip:
        'Students can create new groups or join an existing one until the deadline.',
      maxGroupSize: 'Maximum Group Size',
      maxGroupSizeTooltip:
        'The maximum number of students in a group. After the creation of the course, this setting cannot be modified anymore. The minimum group size is fixed to two participants to enable randomized group creation',
      preferredGroupSize: 'Preferred Group Size',
      preferredGroupSizeTooltip:
        'The preferred number of students in a group. After the creation of the course, this setting cannot be modified anymore. In case the students choose the automated group formation function, the algorithm will create as many groups as possible with this size.',
      groupDeadlineChangedToPast:
        'The group creation deadline is in the past. With this settings, students will no longer be able to create or join groups and students, which selected random group formation, will be automatically assigned to groups within a day, if possible. Should you want to finalize the group formation immediately, please use the corresponding button on the group overview.',
      gamificationGroupsFixed:
        'Gamification and group creation are enabled for this course. These settings cannot be disabled once gamified activities or participant groups exist. Initially disabled options can be enabled later.',
      gamificationFixed:
        'Gamification is enabled for this course. This setting cannot be disabled once gamified activities are assigned. Initially disabled options can be enabled later.',
      openPreview: 'Open Preview',
      openEvaluation: 'Open Evaluation',
      archiveOnlyPastCourses:
        'Only courses with an end date in the past can be archived.',
      noDeletionAssessment: 'Courses in assessment mode cannot be deleted.',
      archiveCourse: 'Archive course',
      unarchiveCourse: 'Unarchive course',
      confirmCourseArchive:
        'Please confirm that you want to archive this course. Archived courses and their activities will remain accessible to students.',
      confirmCourseUnarchive:
        'Please confirm that you want to reactivate this course. Unarchived courses are displayed differently to students.',
      showArchive: 'Show archive',
      hideArchive: 'Hide archive',
      deleteCourse: 'Delete course',
      courseDeletionMessage:
        'Please confirm the deletion of all elements associated with this course and the irreversible deletion of the course. Note that all students will lose access to the course alongside all associated course materials and activities.',
      noParticipationsToDelete: 'This course contains no participations.',
      deleteParticipations:
        '{number} participant(s) of this course will lose their collected points and access to all course materials and activities.',
      noLiveQuizzesDisconnected: 'This course contains no live quizzes.',
      disconnectLiveQuizzes:
        '{number} live quizze(s) will be disconnected from the course. They can still be accessed through the activity list.',
      deleteDraftActivitiesOption:
        'Also irreversibly delete all linked draft activities.',
      deleteDraftActivities:
        'All linked draft activities will be irreversibly deleted. Any remaining live quizzes will be disconnected from the course and remain accessible through the activity list.',
      noPracticeQuizzesToDelete: 'This course contains no practice quizzes.',
      deletePracticeQuizzes:
        '{number} practice quizze(s) (including their results) will be irreversibly deleted.',
      noMicroLearningsToDelete: 'This course contains no microlearnings.',
      deleteMicroLearnings:
        '{number} microlearning(s) (including their results) will be irreversibly deleted.',
      noGroupActivitiesToDelete: 'This course contains no group activities.',
      deleteGroupActivities:
        '{number} group activitie(s) (including their submissions) will be irreversibly deleted.',
      noParticipantGroupsToDelete:
        'This course contains no participant groups.',
      deleteParticipantGroups:
        '{number} participant group(s) will be irreversibly deleted.',
      noLeaderboardEntriesToDelete:
        'This course contains no leaderboard entries.',
      deleteLeaderboardEntries:
        '{number} leaderboard entrie(s) will be irreversibly deleted.',
      activityAnalytics: 'Activity Analytics',
    },
    course: {
      modifyCourse: 'Modify course',
      shareCourse: 'Share course',
      duplicateCourse: 'Duplicate course',
      learningAnalytics: 'Learning Analytics',
      moreCourseActions: 'More course actions',
      pointCorrections: 'Point Corrections',
      assessmentResults: 'Assessment Results',
      participantInvitations: 'Participant Invitations',
      appliedCorrections: 'Applied Point Corrections',
      nameWithPin: 'Course: {name} (PIN: {pin})',
      joinCourse: 'Join course',
      viewCourse: 'View Course',
      viewActivities: 'View Activities',
      executeActivities: 'Execute Activities',
      modifyCourseSettings: 'Modify Course Settings',
      modifyContainedActivities: 'Modify Activities in Course',
      manageParticipantGroups: 'Manage Participant Groups',
      deleteCourse: 'Delete Course',
      removeCourse: 'Remove Course',
      confirmCourseRemoval:
        'Please confirm the following effects of removing the course <b>{name}</b> from your account.',
      courseRemovalFinal:
        'Through the removal of the course, it will be disappear from your user account, but its content will not be deleted. The visibility of the course content towards students will not be affected. The action cannot be undone.',
      courseRemovalDependencyAccess:
        'Potential derived permissions on course content (activities, elements, etc.) will be automatically revoked, unless their retention is technically required.',
      requiredPin: 'The PIN required to join is: <b>{pin}</b>',
      nParticipants: '{number} participants',
      saveDescription: 'Save description',
      noDescriptionNotification: 'No description available.',
      reviewProgress: 'Review progress',
      activityNotAvailableAssessment:
        '{activityType} are currently not supported in assessment courses.',
      withGroups: 'With Groups',
      assessmentWithGroups: 'With Groups (Assessment)',
      withoutGroups: 'Without Groups',
      changedDate: 'Date has been successfully adjusted.',
      dateChangeFailed:
        'An error occurred while adjusting the date. Please check the input.',
      noLiveQuizzes: 'No live quizzes available',
      noPracticeQuizzes: 'No practice quizzes available',
      noMicrolearnings: 'No microlearning available',
      noGroupActivities: 'No group activities available',
      courseLeaderboard: 'Course Leaderboard',
      groupLeaderboard: 'Group Leaderboard',
      groups: 'Groups',
      assignRandomGroups: 'Assign random groups',
      emailsInLeaderboardExport:
        'To see the email addresses of the students in addition to the usernames, please export the table below using the CSV export function. Participants without points are only listed on the leaderboard for the entire course (not on weekly leaderboards).',
      lastModified: 'Last modified',
      participantsLeaderboard: 'Participants (leaderboard/total): {number}',
      avgPoints: 'Average points: {points}',
      quickSelection: 'Quick selection',
      entireCourse: 'Entire course',
      weekly: 'Weekly',
      lastWeek: 'Last week',
      lastTwoWeeks: 'Last 2 weeks',
      rolling7: '7 days (rolling)',
      rolling14: '14 days (rolling)',
      custom: 'Custom',
      leaderboardType: 'Leaderboard type',
      leaderboardTypeTooltip:
        'Select the data to be displayed in the leaderboard. The weekly and custom leaderboards show the amount of points collected within the selected time frame. All data is updated daily at midnight or when manually updated using the corresponding button.',
      timeRange: 'Time range',
      runningLiveQuiz: 'Running live quiz',
      publicAccess: 'Public access',
      restrictedAccess: 'Restricted access',
      startAt: 'Start: {time}',
      endAt: 'End: {time}',
      nQuestions: '{number} questions',
      courseQRDescription:
        'Share this link or QR code with your course participants to allow them to join.',
      calendarView: 'Calendar View',
      backToListView: 'Back to List View',
      calendarAllDay: 'All day',
      calendarMore: 'more',
      calendarNoEntries: 'No entries',
      calendarCourseStart: 'Course Start',
      calendarCourseEnd: 'Course End',
      calendarCourseGroupFormationDeadline: 'Group Formation Deadline',
      copyAccessLink: 'Copy Access Link',
      copyLTIAccessLink: 'Copy LTI Link',
      liveQuizList: 'Live Quiz List',
      practiceQuizList: 'Practice Quiz List',
      microLearningList: 'Microlearning List',
      linkAccessCopied:
        'The link for accessing the item has been copied to the clipboard.',
      linkLTICopied:
        'The link for embedding the item via LTI (e.g. in OpenOLAT) has been copied to the clipboard.',
      linkLTIError:
        'An error occurred while copying the LTI link. Please try again.',
      linkLTILeaderboardLabel: 'Leaderboard',
      linkLTIDocsLabel: 'Documentation',
      linkLTILiveQuizzesLabel: 'Live Quizzes',
      linkLTIPracticeQuizzesLabel: 'Practice Quizzes',
      linkLTIMicroLearningsLabel: 'Microlearnings',
      linkLTIAccountManagement: 'Account Management',
      editMicrolearning: 'Edit Microlearning',
      duplicateMicroLearning: 'Duplicate Microlearning',
      extendMicroLearning: 'Extend Microlearning',
      extendMicroLearningDescription:
        'Use this dialogue to modify the end date of the microlearning. Please note that only future dates can be set as end dates.',
      newEndDate: 'New end date',
      futureEndDateRequired:
        'Please enter an end date that lies in the future.',
      unpublishMicrolearning: 'Unpublish Microlearning',
      convertMicroLearningToPracticeQuiz: 'Convert to practice quiz',
      shareMicroLearning: 'Share Microlearning',
      removeMicroLearning: 'Remove Microlearning',
      deleteMicroLearning: 'Delete Microlearning',
      deleteMicroLearningMessage:
        'Please confirm the deletion of all results associated with this microlearning. Note that all students will lose access to the microlearning, its contents and all their results.',
      publishItemPRACTICE_QUIZ: 'Publish Practice Quiz',
      publishItemMICROLEARNING: 'Publish Microlearning',
      publishItemGROUP_ACTIVITY: 'Publish Group Activity',
      confirmPublishingMicrolearning:
        'Please confirm that you want to publish the microlearning <b>{name}</b>. This action will make it available to all participants in the following time window:',
      microlearningPublishingHint:
        'This process can only be undone if the start time is in the future. Changes to the content of contained elements are no longer possible after publishing.',
      confirmPublishingGroupActivity:
        'Please confirm that you want to publish the group activity <b>{name}</b>. This action will make it available to all groups in the following time window:',
      groupActivityPublishingHint:
        'This process can only be undone if the start time lies in the future. Changes to the content of contained elements are no longer possible after publishing.',
      practicePublishingHint:
        'Publishing a practice quiz makes the element immediately visible to all participants through the provided access link and the KlickerUZH App. This process cannot be undone.',
      practiceSchedulingHint:
        'Publishing this practice quiz activates the automatic publication on the date you set: {date}. From this point on, the practice quiz will be automatically visible to all participants. Until {date}, you can still undo the publication.',
      editPracticeQuiz: 'Edit Practice Quiz',
      duplicatePracticeQuiz: 'Duplicate Practice Quiz',
      sharePracticeQuiz: 'Share Practice Quiz',
      removePracticeQuiz: 'Remove Practice Quiz',
      deletePracticeQuiz: 'Delete Practice Quiz',
      deletePracticeQuizMessage:
        'Please confirm the deletion of all results associated with this practice quiz. Note that all students will lose access to the practice quiz, its contents and all their results.',
      noResponsesToDelete:
        'No logged in participants have submitted responses for this activity',
      deleteResponses:
        '{number} response(s) of logged in participants will be deleted.',
      noAnonymousResponsesToDelete:
        'No anonymous responses have been submitted for this activity',
      deleteAnonymousResponses:
        '{number} anonymous response(s) for this activity will be deleted.',
      unpublishPracticeQuiz: 'Unpublish Practice Quiz',
      editGroupActivity: 'Edit Group Activity',
      endGroupActivity: 'End Group Activity',
      endGroupActivityMessage:
        'Please confirm that you want to end this group activity. Note that no further submissions will be accepted after triggering this action.',
      endMicroLearning: 'End microlearning',
      endMicroLearningMessage:
        'Please confirm that you want to end this microlearning. Note that no further submissions will be accepted after triggering this action.',
      noResponsesToMicroLearning:
        'No logged in participants have submitted answers for elements in this microlearning yet.',
      responsesToMicroLearning:
        '{number} response(s) have been submitted for elements in this microlearning by logged in participants.',
      noAnonResponsesToMicroLearning:
        'No anonymous responses have been submitted for elements in this microlearning yet.',
      anonResponsesToMicroLearning:
        '{number} anonymous response(s) have been submitted for elements in this microlearning.',
      noStartedInstancesLosingAccess:
        'There are no groups that have started the group activity but not submitted their decisions yet.',
      startedInstancesLosingAccess:
        '{number} group(s) have started the group activity but have not submitted any results yet. They will lose access to the group activity.',
      noSubmissionsToActivity:
        'There are no submissions for this group activity yet.',
      unaffectedSubmissions:
        '{number} group(s) have successfully submitted their results to this group activity and will not be affected by ending the group activity.',
      startGroupActivityNow: 'Start Group Activity Now',
      startGroupActivityNowMessage:
        'Please confirm that you want to start the group activity now. Note that a group activity cannot be edited after starting.',
      noParticipantGroupsAvailable:
        'No participant groups have been formed in this course yet. Please wait for the group formation to be completed or move the corresponding deadline to the future in the course settings.',
      groupFormationNotCompleted:
        'Group formation has not been completed yet. Please wait for the set deadline or choose immediate group assignment.',
      numOfParticipantGroupsGettingAccess:
        '{number} group(s) will get immediate access to the corresponding content after the group activity is started.',
      groupActivityAvailableUntil:
        'The end date of the group activity is not influenced by the early start. The group activity ends as planned on {date}. You can end the group activity early using the corresponding action.',
      shareGroupActivity: 'Share Group Activity',
      removeGroupActivity: 'Remove Group Activity',
      deleteGroupActivity: 'Delete Group Activity',
      deleteGroupActivityMessage:
        'Please confirm the deletion of all submissions associated with this group activity. Note that all students will lose access to the group activity, its contents and all their submissions and grading results.',
      noStartedInstancesToDelete:
        'There are no groups that have outstanding submissions for this group activity.',
      deleteStartedInstance:
        '{number} group(s) that have started the group activity will lose access to it.',
      noSubmissionsToDelete:
        'There are no submissions for this group activity.',
      deleteSubmissions:
        '{number} submission(s) by separate groups for this activity will be deleted.',
      unpublishGroupActivity: 'Unpublish Group Activity',
      extendGroupActivity: 'Extend Group Activity',
      extendGroupActivityDescription:
        'Use this dialogue to modify the end date of the group activity. Please note that only future dates can be set as end dates.',
      gradeGroupActivity: 'Grade Group Activity',
      courseElements: 'Course Elements',
      ltiLinks: 'LTI Links',
      enableGamification: 'Enable gamification',
      enableGamificationWarning:
        'Are you sure you want to enable gamification for this course? This allows you to assign gamified elements to the course, view leaderboards, etc. Please note that gamification cannot be disabled afterwards!',
      poolForRandomAssignment: 'Pool for Random Assignment',
      randomGroupsNotPossible:
        'No random groups can be formed with a single student in the assignment pool or in a group with one participant. Please consider extending the group formation deadline in the course settings at the top.',
      groupAssignmentFinalizedMessage:
        'The group assignment has been finalized either manually by you or automatically by the system, since the group deadline passed. To re-enable the creation of groups, simply move the group deadline date in the course settings to the future.',
      finalizeRandomGroupAssignment: 'Finalize Random Group Assignment',
      confirmRandomGroupAssignment: `Once you confirm the finalization of the random group assignment, the following actions will be performed automatically by KlickerUZH:
        <ul><li>All students remaining in the random assignment pool will be assigned to randomized groups.</li>
        <li>Groups with a single participant will be deleted and the corresponding students will be assigned to randomized groups.</li>
        <li>The assignment to random groups cannot be undone!</li>
        <li>The possibility for students to create / leave groups manually through the student app will be automatically deactivated. Should you wish to re-enable this possibility, simply move the group deadline date in the course settings to the future.</li></ul>`,
      groupAssignmentFailed:
        'An error occurred during the group assignment. Please check that sufficiently many students are in the assignment pool and try again.',
      groupAssignmentSuccessful:
        'The group assignment was successful. All students from the pool were assigned to random groups.',
      practiceQuizPublishImmediately: 'Publish Immediately',
      practiceQuizPublishingHint:
        'When choosing this option, the practice quiz "{title}" will become immediately visible to all students in your course. Since students can submit answers to all published practice quizzes, they can only be deleted, but no longer be unpublished.',
      confirmPublication: 'Confirm Publication',
      schedulePublication: 'Schedule Publication',
      practiceQuizSchedulingHint:
        'Scheduling the practice quiz "{title}" for publication at a certain point in time, it will automatically become available to all students in the course at that time. Before the scheduled publication date is reached, the activity can still be unpublished and edited again. When entering a date in the past, the practice quiz will be published immediately.',
      confirmScheduling: 'Confirm Scheduling',
    },
    pointCorrections: {
      stepIndicator: 'Step {current} of {total}',
      actionApply: 'Apply Corrections',
      errorNoAdjustment: 'Please select at least one point adjustment.',
      scopeTitle: 'Select scope',
      scopeDescription:
        'Please decide whether you want to update the points for a single element in a live quiz or for all elements in a quiz at the same time.',
      scopeLabel: 'Scope',
      scopePlaceholder: 'Choose a scope',
      scopeOptionInstanceTitle: 'Single quiz element',
      scopeOptionInstanceDescription:
        'Modification of the base, correctness, or bonus points for a single question within a quiz.',
      scopeOptionQuizTitle: 'Entire quiz',
      scopeOptionQuizDescription:
        'Modification of the base, correctness, or bonus points for all questions within a quiz.',
      selectQuizAndInstanceDescription:
        'Please select the quiz and, if applicable, the specific question to which the point correction should be applied.',
      quizLabel: 'Quiz',
      quizPlaceholder: 'Select a quiz',
      instanceLabel: 'Instance',
      instancePlaceholder: 'Select an instance',
      historyTitle: 'Previously Applied Corrections',
      historyToggleShow: 'Show all previous corrections',
      historyToggleHide: 'Hide previous corrections',
      historyPlaceholder:
        'Once points corrections have been made for the selected quiz, they will appear here.',
      historyPlaceholderInstance:
        'Once points corrections have been made specifically for the selected quiz question, they will appear here. Point corrections applied to the entire live quiz are not shown when one single question is selected for corrections.',
      historyApplied: 'Applied on {appliedAt} by {user}',
      historyScopeParticipantUnknown: 'Unknown participant',
      historyScopeParticipantsUnknown: 'Unknown participants',
      historyScopeSingle: 'Single participant ({participant})',
      historyScopeMultiple: 'Multiple participants ({participants})',
      historyScopeParticipatingQuiz:
        'All students with at least one answer in this quiz',
      historyScopeParticipatingInstance:
        'All students who submitted an answer for the following question: {name}',
      historyScopeCourse: 'All assessment course participants',
      historyScopeUnknown: 'Scope unavailable',
      audienceTitle: 'Choose the Audience',
      audienceDescription:
        'Select to whose responses the point correction should be applied to. You can choose a single participant, all participating users in scope, or all assessment course participants. Participating users for a question are those who have submitted an answer for the corresponding question in the quiz, while participating users of a quiz must have submitted an answer for at least one question in the respective quiz. Users that are selected but have not submitted a corresponding response will still receive the specified points.',
      audienceLabel: 'Audience',
      audiencePlaceholder: 'Select an audience',
      audienceOptionSingle: 'Single participant',
      audienceOptionMultiple: 'Multiple participants',
      audienceOptionParticipating: 'All participating users',
      audienceOptionCourse: 'All assessment course participants',
      participantLabel: 'Participant',
      participantsLabel: 'Participants',
      participantPlaceholder: 'Select a participant',
      participantsPlaceholder: 'Select participants',
      participantScopeSingle: 'Selected participant',
      participantScopeMultiple: 'Selected participants',
      participantScopeParticipating: 'All participating users',
      participantScopeCourse: 'All assessment course participants',
      adjustmentsTitle: 'Adjust Points',
      adjustmentsDescription:
        'Select which point categories should be awarded or deducted. Awarding and deducting the same category is mutually exclusive. Awarding one type of points means that all affected students will receive the <b>maximum amount of available points</b> for this category, while deducting them <b>sets the value to zero</b> on all affected submissions.',
      adjustmentsBaseLabel: 'Base points',
      adjustmentsCorrectnessLabel: 'Correctness points',
      adjustmentsBonusLabel: 'Bonus points',
      adjustmentsAwardLabel: 'Award points',
      adjustmentsDeductLabel: 'Deduct points',
      reasonTitle: 'Explain the Correction',
      reasonDescription:
        'Please document why this correction is necessary. Provide an internal note for your own reference or for other administrators of the assessment course and formulate the message that will be displayed to students in connection with the correction.',
      reasonLecturerLabel: 'Internal note for reference',
      reasonLecturerPlaceholder:
        'Reason for the point correction (not visible to students).',
      reasonUseSameMessageLabel: 'Use the internal note as the student message',
      reasonStudentLabel: 'Message for students (visible to students)',
      reasonStudentPlaceholder:
        'Reason for the point correction (visible to students).',
      summaryTitle: 'Review and Confirm',
      summaryDescription:
        'Please review your entries and confirm the application of the specified point correction. Applied corrections cannot be undone. In case of an error, please create another correction.',
      summaryScopeLabel: 'Scope',
      summaryQuizLabel: 'Quiz',
      summaryInstanceLabel: 'Instance',
      summaryParticipantLabel: 'Audience',
      summaryAdjustmentsLabel: 'Point changes',
      summaryLecturerReasonLabel: 'Lecturer note',
      summaryStudentReasonLabel: 'Student note',
      summaryQuizNotSelected: 'No quiz selected yet',
      summaryInstanceNotSelected: 'No instance selected yet',
      summaryAllInstances: 'All instances within the quiz',
      summaryParticipantScopeNotSelected: 'No audience selected yet',
      summaryParticipantNotSelected: 'No participant selected yet',
      summaryAdjustmentBaseAward: 'Award base points',
      summaryAdjustmentBaseDeduct: 'Deduct base points',
      summaryAdjustmentCorrectnessAward: 'Award correctness points',
      summaryAdjustmentCorrectnessDeduct: 'Deduct correctness points',
      summaryAdjustmentBonusAward: 'Award bonus points',
      summaryAdjustmentBonusDeduct: 'Deduct bonus points',
      summaryNoAdjustments: 'No point adjustments selected yet.',
      errorQuizRequired: 'Please select a quiz.',
      errorInstanceRequired:
        'Please select an instance if you want to make a point correction for a single quiz question.',
      errorParticipantRequired:
        'Please select a participant if you want to make a point correction for a single person.',
      errorParticipantsRequired:
        'Please select at least one participant if you want to make a point correction for multiple people.',
      errorLecturerReasonRequired:
        'Please provide a note for this correction that allows you to reference it at a later time.',
      errorStudentReasonRequired:
        'Please provide a message for the students that will be displayed in connection with the correction.',
      missingInputsSubmission:
        'Your inputs for the point correction are incomplete. Please review your entries and try again.',
      successSubmission: 'The point correction was successfully applied.',
      errorSubmission:
        'An error occurred while applying the point correction. Please try again.',
      responseCorrectionsApplied:
        'Point corrections that have been applied to this response and their effects on the awarded points:',
      noAdjustmentsApplied:
        'No point corrections have been applied to this response.',
    },
    resources: {
      mediaLibrary: 'Media Library',
      mediaLibraryAvailableSoon:
        'Your media library will be available here soon, allowing you to access all your uploaded resources.',
      chatbots: 'Chatbots',
      resources: 'Resources',
      switchChatbot: 'Switch chatbot',
      chatbotNotFound:
        'This chatbot could not be found or you do not have access to it.',
      availableChatbots: 'Available Chatbots',
      noChatbots: 'No chatbots have been created yet.',
      chatbotDetails: 'Chatbot Details',
      overview: 'Overview',
      chatbotId: 'Chatbot ID',
      avatarUrl: 'Avatar URL',
      avatarNone: 'No avatar',
      linkedCourses: 'Linked Courses',
      linkedCoursesList: 'Linked to: {courses}',
      noLinkedCourses: 'No courses linked yet.',
      chatbotStatusDraft: 'Draft',
      chatbotStatusPendingApproval: 'Pending approval',
      chatbotStatusPublished: 'Published',
      chatbotStatusPaused: 'Paused',
      chatbotStatusRejected: 'Rejected',
      chatbotStatusUnknown: 'Unknown status',
      chatbotNotLive: 'Participant access is unavailable in this status.',
      credits: 'Credits',
      creditInitialCredits: 'Initial credits',
      creditResetPeriod: 'Reset period',
      creditResetAmount: 'Reset amount',
      creditMaxCredits: 'Max credits',
      modelSelection: 'Model selection',
      modelSelectionEnabled: 'Enabled',
      modelSelectionDisabled: 'Disabled',
      modelSelectionEnabledDescription:
        'Participants can choose among the allowed models.',
      modelSelectionDisabledDescription:
        'Model selection is automatic and based on credit availability.',
      allowedModels: 'Allowed models',
      allowedModelsAll: 'All',
      chatbotModelSettings: 'Model & Reasoning Settings',
      reasoningEffortsByModel: 'Reasoning efforts by model',
      singleReasoningEffortFixed: 'Fixed by model: {effort}',
      chatbotModelSettingsSave: 'Save model settings',
      chatbotModelSettingsSaving: 'Saving...',
      chatbotModelSettingsSaveSuccess: 'Model settings saved.',
      chatbotModelSettingsSaveError:
        'Could not save chatbot model settings. Please try again.',
      creditResetPeriodDaily: 'Daily',
      creditResetPeriodWeekly: 'Weekly',
      creditResetPeriodBiweekly: 'Biweekly',
      creditResetPeriodMonthly: 'Monthly',
      creditResetPeriodNone: 'No reset',
      usageSummary: 'Usage Summary',
      usageThreads: 'Threads',
      usageMessages: 'Messages',
      usageParticipants: 'Participants',
      usageLastActivity: 'Last activity',
      usageTotalCredits: 'Total credits',
      usageCurrentCredits: 'Current credits',
      usageTotalResets: 'Total resets',
      usageLastReset: 'Last reset',
      disclaimer: 'Disclaimer',
      noDisclaimer: 'No disclaimer assigned.',
      disclaimerName: 'Name',
      disclaimerTitle: 'Title',
      disclaimerAccepted: 'Accepted',
      disclaimerDeclined: 'Declined',
      disclaimerPending: 'Pending',
      mcpConfigurations: 'MCP Configurations',
      knowledgeBase: 'Knowledge base',
      noEnabledKnowledgeBase:
        'No knowledge base is connected. This chatbot cannot search course material.',
      noMcpConfigurations: 'No MCP configurations.',
      mcpServerActive: 'Server active',
      mcpServerInactive: 'Server inactive',
      mcpChatMode: 'Chat mode',
      mcpStatus: 'Status',
      mcpStatusEnabled: 'Enabled',
      mcpStatusDisabled: 'Disabled',
      mcpPriority: 'Priority',
      mcpAllowedTools: 'Allowed tools',
      openChatbot: 'Open Chatbot',
      openOwnerPreview: 'Open owner preview',
      responseExamples: 'Response examples',
      responseExamplesDescription:
        'Review response examples before making them live.',
      responseExamplesLoading: 'Loading response examples...',
      responseExamplesError:
        'Response examples could not be loaded. Please try again.',
      responseExamplesEmpty:
        'No response examples are available for this chatbot.',
      responseExampleCandidate: 'Candidate',
      responseExampleApproved: 'Approved',
      responseExampleRejected: 'Rejected',
      responseExampleNeedsReview: 'Needs review',
      responseExampleQuestion: 'Question',
      responseExampleReferenceAnswer: 'Expected chatbot answer',
      responseExampleResponseStyle: 'Response style',
      responseExampleSources: 'Evidence lineage',
      responseExampleSourcesDescription:
        'These references show where citations point. Source content is not shown here.',
      responseExampleCitationParityComplete:
        'All attached evidence is cited in this answer.',
      responseExampleCitationParityIncomplete:
        'The evidence and citations need review before approval.',
      responseExampleNoSources: 'No evidence lineage is attached.',
      responseExampleSourceId: 'Source ID',
      responseExampleChunkId: 'Chunk ID',
      responseExampleCitationIndex: 'Citation',
      responseExampleCitationAnchor: 'Citation anchor',
      responseExampleContentHash: 'Content hash',
      responseExampleSourceDetails: 'Technical source details',
      responseExampleCitationLabel: 'Citation {index}',
      responseExampleSourceAvailable: 'Evidence is eligible',
      responseExampleSourceUnavailable: 'Evidence needs review',
      responseExampleStyleGuidedQuestions: 'Ask guiding questions',
      responseExampleStyleStepByStepExplanation: 'Explain step by step',
      responseExampleStyleConciseAnswer: 'Give a concise answer',
      responseExampleStyleClarifyingQuestion: 'Ask for clarification',
      responseExampleStyleWorkedExample: 'Work through an example',
      responseExampleStyleCompareOptions: 'Compare options',
      responseExampleSourcesRequired:
        'A source must be attached and cited as [1], [2], ... before approving.',
      responseExampleModeUnavailable:
        'Select one of this chatbot’s available chat modes.',
      responseExampleDuplicate:
        'A response example with this question already exists for this chat mode.',
      responseExampleApprove: 'Approve',
      responseExampleEditAndApprove: 'Edit and approve',
      responseExampleReject: 'Reject',
      responseExampleEditTitle: 'Edit response example',
      responseExampleEditChatMode: 'Chat mode',
      responseExampleEditQuestion: 'Question',
      responseExampleEditReferenceAnswer: 'Expected chatbot answer',
      responseExampleEditReferenceAnswerPlaceholder:
        'Write the full expected chatbot answer. Formatting is applied automatically; cite sources as [1], [2], ...',
      responseExampleEditReferenceAnswerLength: '{count} / {max} characters',
      responseExampleEditResponseStyle: 'Response style',
      responseExampleSave: 'Save and approve',
      responseExampleReviewActionError:
        'This response example could not be updated. Please try again.',
      responseExampleStaleUpdate:
        'This example changed while you were editing. Your draft is still open. Close this dialog and reopen the example before saving again.',
      responseExampleReviewForbidden:
        'Only the chatbot owner can review response examples.',
      answerCollections: 'Answer Collections',
      answerCollectionsDescription:
        'Here you can find all your answer collections. You need these to create certain complex question types, such as selection questions and case studies. To import existing answer collections form other users or request access to these, please visit the <link>catalog</link>.',
      selectCreateAnswerCollection:
        'Please select an action on a specific answer collection or create a new one.',
      newAnswerCollection: 'New Answer Collection',
      addSharedAnswerCollection: 'Add Shared Answer Collection',
      answerOptionUsed:
        'Answer options marked with the warning symbol are already used as sample solutions or case study items in a question or activity template by you or other users (in case of a shared collection). Please keep this in mind when editing the answer. The option cannot be deleted.',
      name: 'Name',
      nameTooltip:
        'Choose a name for your answer collection so it can be identified when creating elements or as a shared collection. The name will not be shown to students.',
      access: 'Access',
      accessTooltip:
        'Choose whether this object can be imported / used by all users with access to the selected catalog collection. With "restricted" access, other users must explicitly request access.',
      catalogCollection: 'Catalog Collection',
      descriptionTooltip:
        'Describe the content and purpose of the answer collection. For shared answer collections, this description will be shown to other users before importing or granting access.',
      descriptionPlaceholder:
        'Describe the content and purpose of the answer collection...',
      answerEntry: 'Answer Entry {index}',
      addValue: 'Add Value',
      nameRequired: 'Please enter a name for the answer collection.',
      descriptionRequired:
        'Please enter a description for the answer collection.',
      valueRequired: 'Please enter a value for the answer entry.',
      minTwoEntriesRequired:
        'At least two answer entries are required to create an answer collection.',
      uniqueValuesRequired:
        'All options in an answer collection need to have a unique value. Please make sure that no two answers options coincide.',
      collectionCreationSuccess:
        'The answer collection was created successfully.',
      collectionCreationError:
        'An error occurred while creating the answer collection. Please make sure that the name of the collection is unique and try again.',
      availableAnswerCollections: 'Available Answer Collections',
      noAnswerCollections:
        'No answer collections have been created or imported form the catalog yet.',
      createAnswerCollection: 'Create Answer Collection',
      numOfAnswers: '{number} Answers',
      byOwner: 'by {owner}',
      cancelRequest: 'Cancel Request',
      answerCollection: 'Answer Collection: {name}',
      nameAndDescription: 'Name and Description',
      saveBeforeClosing: 'Please save your changes before closing the section.',
      searchAnswerOptions: 'Search answer option...',
      noMatchingOptions: 'No matching answer options found.',
      saveChanges: 'Save changes',
      saveMetadata: 'Save Metadata',
      successfulCollectionEdit:
        'The changes to the answer collection have been saved successfully.',
      changesImmediateEffect:
        'Changes to answer options (and deletions) are immediately saved and applied to corresponding questions. Question in existing activities must be updated via the element editor to apply any changes.',
      answerOptions: 'Answer Options',
      addAnswerOption: 'Add Answer Option',
      showAnswers: 'Show Answers',
      viewCollection: 'View Collection',
      editCollection: 'Edit Collection',
      shareCollection: 'Share Collection',
      duplicateCollection: 'Duplicate Collection',
      viewUseCollectionContent: 'View Content / Use Collection',
      modifyContent: 'Modify Content',
      modifyCatalogAssignments: 'Modify Catalog Assignments',
      modifyPermissions: 'Modify Permissions',
      revokeAccess: 'Revoke Access',
      requestedAccess: 'Requested Access',
      deleteCollection: 'Delete Collection',
      deletionDisabledInUse:
        'This collection is used by at least one of your questions or templates. Therefore, you cannot delete the collection. To delete the collection, please first remove it from all questions that use it.',
      removeCollection: 'Remove collection',
      removalDisabledInUse:
        'This collection is used by at least one of your questions or templates or shared with you through a user group. Therefore, you cannot remove the collection.',
      deleteAnswerCollection: 'Delete Answer Collection',
      confirmCollectionDeletion:
        'Are you sure you want to delete the answer collection "{name}" from your profile? For shared answer collections, access for other users remains as long as they use the collection. All users who are not using the collection will lose access to it.',
      confirmDeletion: 'Confirm deletion',
      deletionSuccessful: 'The answer collection was successfully deleted.',
      deletionFailed:
        'An error occurred while deleting the answer collection. Please try again or contact the support.',
      cancelSharingRequest: 'Cancel Sharing Request',
      transferOwnershipTitle: 'Transfer Collection Ownership',
      duplicationNote:
        'The collection will be duplicated in its current state and can be modified afterwards. Please note that ...',
      duplicationNote1:
        '... the new collection is not linked to any of the previously dependent questions / templates.',
      duplicationNote2:
        '... the new collection is not shared with any other users.',
      duplicationNote3:
        '... the new collection should be renamed to avoid confusion with the original when integrating into questions.',
      duplicationFailure: 'Collection duplication failed. Please try again.',
      duplicationSuccess: 'Collection has been duplicated successfully.',
    },
    userGroups: {
      description:
        'On this page, you can create and manage user groups. To simplify the process of sharing multiple objects with the same users or collaboratively create content with them, they can first be grouped together. Permissions that are granted to user groups behave the same way as if they were granted to all users individually. However, always keep in mind that depending on the granted permission levels, the group members might be able to re-use objects, making their access to an object potentially irrevokable. For more details, please also consult the official documentation.',
      existingUserGroups: 'Existing User Groups',
      noGroups:
        'You have not created or been added to any user groups yet. To create your first user group, please click the button on the right side.',
      userGroupCreation: 'User Group Creation',
      creationExplanation:
        'Please fill in all the fields of the following form to create a user group. The selection of the group admins can still be modified after the creation. Admin users can add or remove members from the group and change its name.',
      newUserGroup: 'New User Group',
      nameTooltip:
        'Please enter a name for the user group. This name will be used to identify the group.',
      nameRequired: 'Please enter a name for the group.',
      member: 'Member',
      members: 'Members',
      admin: 'Admin',
      admins: 'Admins',
      addMember: 'Add Member',
      emailOrShortname: 'Email or shortname',
      emailShortnameRequired:
        'Please make sure that an email address or a short name is provided for each user.',
      minOneMemberRequired: 'At least one member is required to form a group.',
      uniqueUsersRequired:
        'Please make sure that all users are unique. Different entries belonging to the same user will be combined on creation.',
      creationSuccessMessage: 'The user group was created successfully.',
      creationErrorMessage:
        'An error occurred while creating the user group. Please ensure that at information for at least one valid member (not yourself) was provided and that no other user group with the same name already exists.',
      viewGroup: 'View User Group',
      editGroup: 'Edit User Group',
      leaveGroup: 'Leave User Group',
      deleteGroup: 'Delete User Group',
      confirmLeaveGroup:
        'You are about to leave the user group {groupName}. By leaving this group, you will lose access to all objects that are shared with this group. If you are sure, please confirm this action.',
      leaveGroupSuccess: 'You have successfully left the user group.',
      leaveGroupError:
        'An error occurred while leaving the user group. Please try again or contact the support.',
      deleteGroupSuccess: 'You have successfully deleted the user group.',
      deleteGroupError:
        'An error occurred while deleting the user group. Please try again or contact the support.',
      confirmDeleteGroup:
        'Please review the effects of deleting this user group "{groupName}" carefully and confirm them before finalizing the deletion.',
      resolveGroupConfirmation:
        'By resolving this group, all members and admins will be removed from it.',
      revokeDirectPermissionsConfirmation:
        'All direct permissions granted to the group will be revoked, all group members will lose access to the corresponding objects.',
      irreversibleActionConfirmation:
        'This action is irreversible and cannot be undone.',
      availableActions: 'Available Actions',
      promoteUserToAdmin: 'Promote User to Admin',
      demoteAdminToMember: 'Demote Admin to Member',
      removeUserFromGroup: 'Remove User from Group',
      transferOwnership: 'Transfer Ownership',
      noAdmins: 'No users have been assigned as admins to this group.',
      noMembers:
        'No users have been assigned as members (without admin rights) to this group.',
      addAdminPlaceholder: 'Enter shortname or e-mail for new admin...',
      addMemberPlaceholder: 'Enter shortname or e-mail for new member...',
      addUser: 'Add User',
      addUserGroupSuccess: 'User successfully added to the group.',
      addUserGroupError:
        'An error occurred while adding the user to the group. Please use the promotion / demotion functionalities if the user is already a member of the group.',
    },
    catalog: {
      accessTypes: 'Access Types',
      accessPUBLIC: 'Public',
      accessRESTRICTED: 'Restricted',
      infoAccessPUBLIC:
        'Public objects can be viewed and copied by all users with access to the corresponding catalog collection. Answer collections can additionally be used directly in questions by the corresponding users (with read access).',
      infoAccessRESTRICTED:
        'Restricted objects can be requested by other users in the catalog and used after your approval depending on the granted rights.',
      objectType: 'Object Type',
      all: 'All',
      sharingRequests: 'Sharing Requests',
      unresolved: 'Unresolved',
      noObjectsFoundInCatalog:
        'No public or restricted objects were found for the entered search criteria and filters.',
      requestAccess: 'Request Access',
      useTemplate: 'Use template',
      copyObjectToAccount: 'Copy Object to own Account',
      copyObjectType: 'Copy {object} to own account',
      importObjectType: 'Import {object} (reading rights)',
      accessRequested: 'Access requested',
      accessGranted: 'Access granted',
      copyPublicResource: 'Copy Public Resource',
      importPublicResource: 'Import Public Resource',
      requestPublicResource:
        "By requesting access to a public resource, you will be able to inspect and/or modify the original shared object, depending on the provided permissions. Granted permissions can be revoked by the owner. To import an independent copy of the object into your own account, please use the 'Import' option.",
      sharingRequestsExplanation:
        'Please review the following access requests for your shared objects. Accepting a sharing request will grant the requesting user access to the corresponding object without creating a copy. Any modifications other users with write access to your objects make are directly visible to all users of the object.',
      approveSharingRequest: 'Approve sharing request',
      specifyObjectPermissionLevel:
        'Please select an access level for sharing the object {objectName} (type: {objectType}) with the user {userShortname}. Please note that when granting editing rights, any changes by other users directly take effect on the shared object. For more information on the permission levels, please refer to the table below.',
      approvalSuccessful: 'The sharing request was successfully approved.',
      approvalFailed:
        'An error occurred while approving the sharing request. Please try again or contact the support.',
      declineSuccessful: 'The sharing request was successfully declined.',
      declineFailed:
        'An error occurred while declining the sharing request. Please try again or contact the support.',
      addObjectToCatalog: 'Add Object',
      addObjectToCatalogTitle: 'Add Object to Catalog Collection',
      selectObjectType: 'Select Object Type',
      selectSpecificObject: 'Select Object',
      selectObjectTypeInstructions: 'Select the type of object you want to add',
      selectObjectTypeDescription:
        'Please select the object type and visibility first and then the specific object you want to add to this catalog collection.',
      objectTypeTooltip:
        'The type of object that will be added to the catalog collection',
      objectTypeRequired: 'Please select an object type',
      accessRequired: 'Please select an access level',
      objectRequired: 'Please select an object to add',
      selectSpecificObjectInstructions: 'Select a specific object to add',
      selectSpecificObjectDescription:
        'Choose a {type} from the list below to add to this catalog collection.',
      selectObject: 'Select an object',
      searchObjects: 'Search objects...',
      noObjectsFound: 'No objects found',
      noObjectsAvailable: 'No objects available for the selected type',
      objectAddedSuccess: 'Object successfully added to the catalog collection',
      objectAddedError: 'Failed to add object to the catalog collection',
      objectRemovalSuccess:
        'The object was successfully removed from the catalog collection',
      objectRemovalFailed:
        'An error occurred while removing the object from the catalog collection, please try again',
      selectObjectTypeFirst: 'Please select an object type first',
      changeAccessTitle: 'Change Access Level',
      changeAccessDescription:
        'Are you sure you want to change the access level of the {objectType} "{objectName}" to {newAccess}?',
      changeAccessConfirm: 'Change Access',
      removeCATALOG_COLLECTION: 'Remove Catalog Collection',
      removeCATALOG_COLLECTIONtitle: 'Remove Catalog Collection',
      removeANSWER_COLLECTION: 'Remove Answer Collection',
      removeANSWER_COLLECTIONtitle: 'Remove Answer Collection from Catalog',
      removeELEMENT: 'Remove Element',
      removeELEMENTtitle: 'Remove Element from Catalog',
      removeLIVE_QUIZ_TEMPLATE: 'Remove Live-Quiz Template',
      removeLIVE_QUIZ_TEMPLATEtitle: 'Remove Live-Quiz Template from Catalog',
      removePRACTICE_QUIZ_TEMPLATE: '',
      removePRACTICE_QUIZ_TEMPLATEtitle: '',
      removeMICRO_LEARNING_TEMPLATE: '',
      removeMICRO_LEARNING_TEMPLATEtitle: '',
      removeGROUP_ACTIVITY_TEMPLATE: '',
      removeGROUP_ACTIVITY_TEMPLATEtitle: '',
      removeLIVE_QUIZ: 'Remove Live-Quiz',
      removeLIVE_QUIZtitle: 'Remove Live-Quiz from Catalog',
      removePRACTICE_QUIZ: 'Remove Practice Quiz',
      removePRACTICE_QUIZtitle: '',
      removeMICRO_LEARNING: 'Remove Microlearning',
      removeMICRO_LEARNINGtitle: '',
      removeGROUP_ACTIVITY: 'Remove Group Activity',
      removeGROUP_ACTIVITYtitle: '',
      removeCOURSE: 'Remove Course',
      removeCOURSEtitle: '',
      removeObjectTitle: 'Remove Object from Catalog Collection',
      removeObjectDescription:
        'Are you sure you want to remove the {objectType} "{objectName}" from the catalog collection? Users will then no longer be able to import it or request access to it.',
      createCatalogCollection: 'Create Collection',
      createCatalogCollectionTitle: 'Create Catalog Collection',
      createCatalogCollectionDescription:
        'Catalog collections are used to organize content and make it visible to specific users or user groups. Access to objects within the catalog collection is handled separately. The existence of the catalog collection is always visible to everyone, but only public catalog collections can be accessed by anyone, allowing them to request access to everything within. Access and managing privileges for restricted catalog collections can be defined after creation in a separate sharing dialog after creation.',
      collectionName: 'Collection Name',
      collectionNameTooltip: 'Enter a unique name for your catalog collection.',
      collectionNamePlaceholder: 'Name of the catalog collection',
      catalogAccessTooltip:
        'Choose whether the collection should be visible to all users or if access should be restricted.',
      accessDescriptionPUBLIC:
        'Public collections are visible to all users and can be browsed by anyone.',
      accessDescriptionRESTRICTED:
        'Restricted collections can only be browsed by users with access. All users of KlickerUZH can request such access or be provided access directly through the sharing functionalitiy upon creation.',
      nameRequired: 'Please enter a name.',
      collectionCreationSuccess: 'Catalog collection was successfully created.',
      collectionCreationError:
        'An error occurred while creating the catalog collection. Please try again.',
      backToCatalogOverview: 'Back to Catalog Overview',
      deleteCatalogCollection: 'Delete Catalog Collection',
      openCatalogCollection: 'Open Collection',
      browseCatalogCollection: 'Browse Collection / Request Included Objects',
      modifyContent: 'Modify Content',
      modifyPermissions: 'Modify Permissions',
      revokeAccess: 'Revoke Access',
      deleteCollection: 'Delete Collection',
      removeObject: 'Remove Object',
      deleteCatalogCollectionTitle: 'Delete Catalog Collection',
      deleteCatalogCollectionDescription:
        'Are you sure you want to delete the catalog collection "{name}"? This will remove all objects from the catalog collection and prevent users from accessing these objects through the catalog collection.',
      deleteConfirm: 'Delete',
      deletionSuccessful: 'The catalog collection was successfully deleted.',
      deletionFailed:
        'An error occurred while deleting the catalog collection. Please try again or contact the support.',
      requestCatalogObjectAccess: 'Request Access to {object}',
      requestCatalogObjectAccessDescription:
        'Here you can request access to "{name}" (by {owner}). The owner will be able to see your <b>shortname</b> and <b>e-mail address</b> on your sharing request.',
      requestSuccessInfoCATALOG_COLLECTION:
        'Once the owner accepts your request, you will have access to the catalog collection and can request/import/copy objects within.',
      requestSuccessInfoANSWER_COLLECTION:
        'Once the owner accepts your request, you will have access to the answer collection and can use it in your selection questions and case studies.',
      requestSuccessInfoLIVE_QUIZ: '',
      requestSuccessInfoPRACTICE_QUIZ: '',
      requestSuccessInfoMICRO_LEARNING: '',
      requestSuccessInfoGROUP_ACTIVITY: '',
      requestSuccessInfoCOURSE: '',
      requestSuccessInfoELEMENT:
        'Once the owner accepts your request, you will be able to view the element and potentially re-use it in your own activities, depending on the granted permissions.',
      requestCatalogObjectSuccess:
        'The access request was successfully submitted.',
      requestCatalogObjectFailed:
        'An error occurred while requesting the access. Please try again or contact the support.',
      copyCatalogObjectDescription:
        'Here you can copy "{name}" (by {owner}) into your own account. After the copying is completed, you can directly use the copied object or modify it as needed. Changes to the original object will not affect your copy.',
      importCatalogObjectDescription:
        'Here you can import the object "<b>{name}</b>" (by {owner}) with read permissions into your own account. Changes to the original object will automatically be visible to you as well.',
      copyCatalogObjectSuccess:
        'The object was successfully copied into your account.',
      copyCatalogObjectFailed:
        'An error occurred while copying the object. Please try again or contact the support.',
      importCatalogObjectSuccess:
        'The object was successfully imported into your account.',
      importCatalogObjectFailed:
        'An error occurred while importing the object. Please try again or contact the support.',
      cancelCatalogObjectRequest: 'Cancel Object Sharing Request',
      cancelCatalogObjectRequestDescription: `Please confirm that you want to cancel the sharing request for "{name}" (by {owner})? You can request access to the object again later.`,
      cancelRequest: 'Cancel Request',
      requestCancellationSuccess:
        'The access request was successfully withdrawn.',
      requestCancellationFailed:
        'An error occurred while withdrawing the access request. Please try again or contact the support.',
      collectionNameRequired: 'Please enter a name for the catalog collection.',
      changeCatalogCollectionName: 'Change Catalog Collection Name',
      catalogCollectionNameChangeSuccess:
        'The name of the catalog collection was successfully changed.',
      catalogCollectionNameChangeError:
        'An error occurred while changing the name of the catalog collection. Please try again.',
      changeAccessError:
        'An error occurred while changing the object visibility. Please try again.',
    },
    sharing: {
      noAccess: 'No access',
      permissionsREAD: 'Read permissions',
      permissionsWRITE: 'Write permissions',
      permissionsADMIN: 'Admin permissions',
      permissionsEXECUTE: 'Execution permissions',
      permissionsOWNER: 'Owner permissions',
      labelOWNED: 'Owned',
      labelSHARED: 'Shared',
      labelDEPENDENCY: 'Dependency',
      grantedPermissions: 'Granted Permissions',
      transferOwnership: 'Transfer Ownership',
      showDerivedPermissions: 'Show Derived Permissions',
      hideDerivedPermissions: 'Hide Derived Permissions',
      minimumRequired: 'Minimum Required',
      propagationOfPermissions: 'Propagation of Permissions',
      derivedPermissions: 'Derived Permissions',
      derivedPermissionsDescription:
        'Derived permissions are permissions that allow users to access this element without having a direct permission (anymore). This is for example due to the inheritance of access rights when other objects are based on this object and therefore require it. Derived access rights cannot be changed or revoked and always correspond to the minimum technically required permissions. For more details, please refer to the official documentation.',
      noDerivedPermissions:
        'No derived permissions are available for this object.',
      whereDoesThisPermissionOriginate:
        'Where does this permission originate from?',
      derivedPermissionOrigin: 'Origin of the derived permission',
      derivedAccessFor:
        'The derived access of user {user} to this object originates from the following object:',
      originalObjectOwner: 'Owner of the parent object',
      originalObjectType: 'Type of the parent object',
      originalObjectName: 'Name of the parent object',
      reasonDerivedAccess: 'Reason for the derived access',
      ownerOfOriginalObject: 'Owner of the parent object',
      originalObjectSharedREAD: 'Read permissions on parent object',
      originalObjectSharedEXECUTE: 'Execution permissions on parent object',
      originalObjectSharedWRITE: 'Write permissions on parent object',
      originalObjectSharedADMIN: 'Admin permissions on parent object',
      viaUserGroup: 'via user group {name}',
      importantInformation: 'Important Information',
      shortnameOrEmailRequired: 'Please enter a username or email address.',
      confirmTransferOwnership: 'Transfer Ownership',
      ownershipTransferSuccess: 'Ownership successfully transferred',
      ownershipTransferError:
        'An error occurred while transferring ownership. Please make sure the email address or username is correct and try again.',
      modifyOwnPermissionsTitle: 'Modify your own access',
      ownAccess: '(you)',
      removeOwnPermissionsWarning:
        'You are about to revoke your individual access rights to this resource. Once confirmed, you might no longer be able to access or modify this resource. This action cannot be undone. Are you sure you want to proceed?',
      changeOwnPermissionsWarning:
        'You are about to change your own access level to {permissionLevel}. This might limit your ability to perform certain actions on this resource, including changing your access level back. Are you sure you want to proceed?',
      revokeAccessDisabledTooltip:
        'The access to the answer collection cannot be revoked because this user is actively using the collection.',
      noUserGroupSelected: 'No user group selected',
      noUserGroupsAvailable: 'No user groups available',
      shortnameEmailOrGroupRequired:
        'Please enter a shortname / email address or select a user group.',
      noSelfSharing: 'You cannot share objects with yourself.',
      infoTransferOwnershipCATALOG_COLLECTION:
        'You are about to transfer all ownership rights of the catalog collection <b>{objectName}</b> to another user. After transferring the ownership, the new owner will have full control over this collection, while you will retain admin access. This action cannot be undone.',
      infoTransferOwnershipANSWER_COLLECTION:
        'You are about to transfer all ownership rights of the answer collection <b>{objectName}</b> to another user. After transferring the ownership, the new owner will have full control over this collection, while you will retain admin access. This action cannot be undone.',
      infoTransferOwnershipLIVE_QUIZ_TEMPLATE:
        'You are about to transfer all ownership rights of the live quiz template <b>{objectName}</b> to another user. After transferring the ownership, the new owner will have full control over this template, while you will retain admin access. This action cannot be undone.',
      infoTransferOwnershipPRACTICE_QUIZ_TEMPLATE: '',
      infoTransferOwnershipMICRO_LEARNING_TEMPLATE: '',
      infoTransferOwnershipGROUP_ACTIVITY_TEMPLATE: '',
      infoTransferOwnershipELEMENT:
        'You are about to transfer all ownership rights of the element <b>{objectName}</b> to another user. After transferring the ownership, the new owner will have full control over this element, while you will retain admin access. This action cannot be undone.',
      infoTransferOwnershipLIVE_QUIZ:
        'You are about to transfer all ownership rights of the live quiz <b>{objectName}</b> to another user. After transferring the ownership, the new owner will have full control over this quiz and get irrevokable admin access to all contained elements (according to the permission propagation), while you will retain admin access to the live quiz. This action cannot be undone.',
      infoTransferOwnershipPRACTICE_QUIZ:
        'You are about to transfer all ownership rights of the practice quiz <b>{objectName}</b> to another user. After transferring the ownership, the new owner will have full control over this quiz and get irrevokable admin access to all contained elements (according to the permission propagation), while you will retain admin access to the practice quiz. This action cannot be undone.',
      infoTransferOwnershipMICRO_LEARNING:
        'You are about to transfer all ownership rights of the microlearning <b>{objectName}</b> to another user. After transferring the ownership, the new owner will have full control over this microlearning and get irrevokable admin access to all contained elements (according to the permission propagation), while you will retain admin access to the microlearning. This action cannot be undone.',
      infoTransferOwnershipGROUP_ACTIVITY:
        'You are about to transfer all ownership rights of the group activity <b>{objectName}</b> to another user. After transferring the ownership, the new owner will have full control over this group activity and get irrevokable admin access to all contained elements (according to the permission propagation), while you will retain admin access to the group activity. This action cannot be undone.',
      infoTransferOwnershipCOURSE:
        'You are about to transfer all ownership rights of the course <b>{objectName}</b> to another user. After transferring the ownership, the new owner will have full control over this course and get irrevokable admin access to all contained activities and elements (according to the permission propagation), while you will retain admin access to the course. This action cannot be undone.',
      shareANSWER_COLLECTION: 'Share Answer Collection',
      shareCATALOG_COLLECTION: 'Share Catalog Collection',
      shareLIVE_QUIZ: 'Share Live Quiz',
      sharePRACTICE_QUIZ: 'Share Practice Quiz',
      shareMICRO_LEARNING: 'Share Microlearning',
      shareGROUP_ACTIVITY: 'Share Group Activity',
      shareCOURSE: 'Share Course',
      shareELEMENT: 'Share Element',
      infoSharingANSWER_COLLECTION:
        'This view allows you to share the answer collection "<b>{objectName}</b>" with other users or user groups and change granted access rights. Depending on the assigned rights, the corresponding users can edit the content of the collection, add more users or make other changes.',
      infoSharingCATALOG_COLLECTION:
        'This view allows you to share the catalog collection "<b>{objectName}</b>" with other users or user groups and change granted access rights. Depending on the assigned rights, the corresponding users can add objects to the collection, add more users or make other changes.',
      infoSharingLIVE_QUIZ:
        'This view allows you to share the live quiz "<b>{objectName}</b>" with other users or user groups and change granted access rights. Depending on the assigned rights, the corresponding users can edit the metadata of the quiz or make other changes.',
      infoSharingPRACTICE_QUIZ:
        'This view allows you to share the practice quiz "<b>{objectName}</b>" with other users or user groups and change granted access rights. Depending on the assigned rights, the corresponding users can edit the metadata of the quiz or make other changes.',
      infoSharingMICRO_LEARNING:
        'This view allows you to share the microlearning "<b>{objectName}</b>" with other users or user groups and change granted access rights. Depending on the assigned rights, the corresponding users can edit the metadata of the microlearning or make other changes.',
      infoSharingGROUP_ACTIVITY:
        'This view allows you to share the group activity "<b>{objectName}</b>" with other users or user groups and change granted access rights. Depending on the assigned rights, the corresponding users can edit the metadata of the group activity or make other changes.',
      infoSharingCOURSE:
        'This view allows you to share the course "<b>{objectName}</b>" with other users or user groups and change granted access rights. Depending on the assigned rights, the corresponding users can edit the metadata of the course or make other changes.',
      infoSharingELEMENT:
        'This view allows you to share the element "<b>{objectName}</b>" with other users or user groups and change granted access rights. Depending on the assigned rights, the corresponding users can edit the content of the element, add more users or make other changes.',
      propagatedPermissions: 'Propagated Permissions',
      propagatedPermissionsANSWER_COLLECTION: '',
      propagatedPermissionsCATALOG_COLLECTION: '',
      propagatedPermissionsELEMENT:
        'If your element depends on an answer collection, sharing the element will automatically also result in permissions on the dependent objects. Regarding the granted permission level for a specific permission level on the element, please refer to the table below.',
      propagatedPermissionsLIVE_QUIZ:
        'Depending on the granted permission level, permissions will propagate to the elements in this live quiz and the corresponding users will be able to re-use or share elements and linked resources with other users outside this activity. For more details regarding the allowed actions, please check out the permission tables for the corresponding objects or refer to the official documentation.',
      propagatedPermissionsPRACTICE_QUIZ:
        'Depending on the granted permission level, permissions will propagate to the elements in this practice quiz and the corresponding users will be able to re-use or share elements and linked resources with other users outside this activity. For more details regarding the allowed actions, please check out the permission tables for the corresponding objects or refer to the official documentation.',
      propagatedPermissionsMICRO_LEARNING:
        'Depending on the granted permission level, permissions will propagate to the elements in this microlearning and the corresponding users will be able to re-use or share elements and linked resources with other users outside this activity. For more details regarding the allowed actions, please check out the permission tables for the corresponding objects or refer to the official documentation.',
      propagatedPermissionsGROUP_ACTIVITY:
        'Depending on the granted permission level, permissions will propagate to the elements in this group activity and the corresponding users will be able to re-use or share elements and linked resources with other users outside this activity. For more details regarding the allowed actions, please check out the permission tables for the corresponding objects or refer to the official documentation.',
      propagatedPermissionsCOURSE:
        'Depending on the granted permission level and your choice whether to propagate higher permission levels, the technically required or propagated permissions will be granted to the activities, elements, etc. assigned to the course as listed in the table below. For more details regarding the allowed actions, please check out the permission tables for the corresponding objects or refer to the official documentation.',
      sharingSuccessful: 'The object was shared successfully.',
      sharingFailed:
        'An error occurred while sharing the object or the specified user could not be found.',
      accessRemovalSuccessful: 'Access has been successfully removed.',
      accessRemovalFailed:
        'Failed to remove access. Please try again or contact support.',
      removeCATALOG_COLLECTION: 'Remove Catalog Collection',
      removeANSWER_COLLECTION: 'Remove Answer Collection',
      removeLIVE_QUIZ_TEMPLATE: 'Remove Live Quiz Template',
      removeLIVE_QUIZ: 'Remove Live Quiz',
      removeCOURSE: 'Remove Course',
      removeELEMENT: 'Remove Element',
      confirmRemovalCATALOG_COLLECTION:
        'Are you sure you want to remove the catalog collection "{objectName}" from your profile?',
      confirmRemovalANSWER_COLLECTION:
        'Are you sure you want to remove the answer collection "{objectName}" from your profile?',
      confirmRemovalLIVE_QUIZ_TEMPLATE:
        'Are you sure you want to remove the live quiz template "{objectName}" from your profile?',
      confirmRemovalLIVE_QUIZ:
        'Are you sure you want to remove the live quiz "{objectName}" from your profile?',
      confirmRemovalCOURSE:
        'Are you sure you want to remove the course "{objectName}" from your profile?',
      confirmRemovalELEMENT:
        'Are you sure you want to remove the element "{objectName}" from your profile?',
      confirmRemoval: 'Confirm removal',
      removalSuccessful:
        'The object has been removed successfully from your account.',
      removalFailed:
        'An error occurred while removing the object. Please try again or contact the support.',
      revokeDirectPermission: 'Revoke Direct Access',
      revokeUserPermission:
        'Please confirm that you want to remove the direct access to this resource for user <b>{username}</b>.',
      revokeGroupPermission:
        'Please confirm that you want to remove the direct access to this resource for the user group <b>{groupName}</b>.',
      derivedPermissionWarning:
        "Caution: Removing the direct access rights to an object might not completely remove a user's access to it. In case a user has access to other objects that depend on this one, they will be granted a derived permission, which can be inspected at the bottom of the sharing dialog.",
    },
    groupActivity: {
      activityMissingOrNotCompleted:
        'The group activity you are looking for does not exist or has not yet been completed. Please note that group activities can only be evaluated after their official end date.',
      gradingTitle: 'Grading Group Activity: {name}',
      submissions: 'Submissions',
      noSubmissions: 'No submissions are available for this group activity.',
      submittedAt: 'Submitted at {datetime}',
      toGrade: 'To Grade',
      graded: 'Graded',
      notSubmitted: 'Not submitted',
      grading: 'Grading',
      noSubmissionSelected:
        'Please select a submission from the list on the left side for grading. Before the grading is finalized, you can adjust the grading at any time.',
      nPoints: '{number} Points',
      achievedScore: 'Achieved score',
      maxScoreTooltip:
        'The maximum score for a question is calculated as the product of the question multiplier and the group activity multiplier.',
      passedMissingError:
        'Please specify, if the group passed or failed the group challenge.',
      scoreMissingError:
        'Plase make sure that all questions are graded with a valid value.',
      didGroupPass: 'Is the group activity passed?',
      optionalFeedback:
        'Enter an optional general feedback for the group challenge here',
      saveGrading: 'Save Grading',
      optionalQuestionFeedback:
        'Enter optional feedback for the answered question here.',
      generalFeedback: 'General Feedback',
      switchSubmission: 'Switch Submission',
      confirmSubmissionSwitch:
        'Are you sure you want to switch to another submission of the group activity? You currently have unsaved changes that will be lost when switching.',
      totalAchievedPoints: 'Total: {achieved}/{total} Points',
      finalizeGrading: 'Finalize Grading',
      confirmFinalizeGrading:
        'Are you sure you want to finalize the grading of the group activity? After finalizing the grading, the results will be visible to the participants and no further changes are possible.',
      stackGradingSuccess: 'Grading was saved successfully.',
      stackGradingError:
        'An error occurred while saving the grading. Please check if all required decisions have been entered.',
      finalizeGradingSuccess: 'Grading was finalized successfully.',
      finalizeGradingError:
        'An error occurred while finalizing the grading. Please make sure that all submissions have been graded and try again.',
      alreadyGraded:
        'The grading for this group activity has already been finalized and can no longer be changed.',
      nOfTotalPoints: '{number}/{total} Points',
      gradingAlreadyFinalized:
        'Grading has already been finalized and cannot be changed anymore. Select a submission to view the entered grading.',
    },
    analytics: {
      selectAnalyticsDashboard: 'Please select an analytics dashboard',
      activity: 'Activity',
      performance: 'Performance & Progress',
      quizzes: 'Quizzes',
      olderCourses: 'Older courses...',
      activityDashboard: 'Activity Dashboard',
      performanceDashboard: 'Performance and Progress Dashboard',
      quizDashboard: 'Quiz Dashboard',
      quizAnalytics: 'Quiz Analytics',
      featureUnavailable:
        'Learning analytics are not available for your account yet.',
      analyticsLoadingWait: 'Loading analytics data. Please wait...',
      analyticsLoadingFailed:
        'An error occurred while loading the analytics data. Please try again later or contact the support.',
      weeklyStudentActivity: 'Weekly Student Activity',
      dailyStudentActivity: 'Daily Student Activity',
      totalParticipants: 'Course participants: {number}',
      dailyActivity: 'Daily Activity',
      activeStudents: 'Active Students',
      percentageOfStudents: 'Percentage of students',
      courseComparison: 'Course Comparison',
      courseComparisonDescription:
        'Select a second course to compare the corresponding data directly.',
      selectCourse: 'Select course...',
      weekN: 'Week {number}',
      studentN: 'Student {number}',
      overallStudentActivity: 'Overall Student Activity',
      numberOfStudents: 'Number of Students',
      activeWeeks: 'Active Weeks',
      activeDaysPerWeek: 'Active Days per Week',
      meanElementsPerDay: 'Mean Elements per Day',
      activityLevel: 'Activity Level',
      levelHigh: 'HIGH',
      levelMedium: 'MEDIUM',
      levelLow: 'LOW',
      asynchronousActivityProgress: 'Asynchronous Activity Progress',
      started: 'Started',
      completed: 'Completed',
      repeated: 'Repeated',
      activityElementPerformanceRates: 'Activity and Element Performance Rates',
      errorRate: 'Error Rate',
      partialRate: 'Partial Error Rate',
      correctRate: 'Success Rate',
      activities: 'Activities',
      elements: 'Elements',
      answers: 'Answers',
      allAttempts: 'All Attempts',
      firstAttempts: 'First Attempts',
      lastAttempts: 'Last Attempts',
      activityType: 'Activity Type',
      allActivityTypes: 'All Activity Types',
      elementType: 'Element Type',
      allElementTypes: 'All Element Types',
      noEntriesManageFilters:
        'No entries exist for the selected filters in this course. Please adjust the filters accordingly or reset all filters.',
      resetSelectors: 'Reset selectors',
      searchPlaceholder: 'Search...',
      activityNameLabel: 'Activity Name',
      elementNameLabel: 'Element Name',
      overallStudentPerformance: 'Overall Student Performance (Error Rates)',
      totalErrorRate: 'Total Error Rate',
      total: 'Total',
      firstAttempt: 'First Attempt',
      lastAttempt: 'Last Attempt',
      performanceLevel: 'Performance Level',
      feedbackOverviewActivityInstances:
        'Overview of Activity and Element Ratings',
      upvotes: 'Upvotes',
      downvotes: 'Downvotes',
      performanceRates: 'Performance Rates',
      totalScore: 'Total Score',
      activityProgress: 'Activity Progress',
      studentPerformance: 'Student Performance',
      feedbackOverview: 'Feedback Overview',
      dataSource: 'Data Source',
      selectActivityAnalytics:
        'Please select one of the activities from your course to view the corresponding analytics. Please note that analytics are only available for activities accessible for students.',
      noPracticeQuizzes: "This course doesn't contain any practice quizzes.",
      noMicroLearnings: "This course doesn't contain any microlearnings.",
      searchPracticeQuizzes: 'Search practice quizzes...',
      searchMicroLearnings: 'Search microlearnings...',
      backToActivitySelection: 'Back to activity selection',
      totalAnsweredElements:
        'Total answered elements in {activityName}: <b>{number}</b>',
      averageTimeSpentActivity:
        'Average total time spent per student: <b>{min}:{sec} min</b>',
      successRates: 'Success Rates',
      successRate: 'Success Rate',
      partialErrorRate: 'Partial Error Rate',
      microLearningOneSubmissionHint:
        'For microlearnings no separation of first and last submitted answers is possible, since every participant can solve each element of the activity only once.',
      totalAnswers: 'Total Answers: <b>{number}</b>',
      numberOfStudentsN: 'Number of Students: <b>{number}</b>',
      averageTimeSpentInstance: 'Average Time Spent: <b>{min}:{sec} min</b>',
      studentFeedback: 'Student Feedback (N = {numOfVotes})',
      noWeeklyActivityData:
        'Until now, no weekly activity data is available for this course.',
      noDailyActivityData:
        'Until now, no daily activity data is available for this course.',
      noActivityDistributionData:
        'No activity distribution data is available for this course yet.',
      noStudentActivity:
        'No student activity has been calculated for this course yet.',
      noAsynchronousActivityProgressData:
        'No asynchronous activity progress data is available for this course yet.',
      noStudentPerformanceData:
        'No student performance data is available for this course yet.',
      noStudentActivityPerformanceData:
        'No student performance data is available for activities in this course yet.',
      studentActivityPerformance: 'Student Activity Performance',
      studentUsername: 'Username',
      studentEmail: 'E-Mail Address',
      emailMissing: 'n/a',
      selectAllActivities: 'Select all activities',
      deselectAllActivities: 'Deselect all activities',
      noActivitySelected:
        'Please select at least one activity to display the collected points and the progress of the students.',
      participantActivityPerformanceDescription:
        'This table illustrates the progress and collected points of the participants in the selected activities. It displays all calculated points (including repetitions of practice quizzes). This number may differ from the number of collected points on the course leaderboard due to the scoring logic for repetitions. The percentage progress corresponds to the number of elements in the activity that have been answered at least once. An activity is counted towards the completed activities if the percentage progress equals 100%.',
      completedActivitiesExplanation:
        'Completed Activities (with 100% Progress)',
      completedActivities: 'Completed Activities',
    },
  },
  control: {
    login: {
      header: 'KlickerUZH Controller-App (Token)',
      installAndroid:
        'Install the KlickerUZH Controller app on your phone to control your live quiz directly from your smartphone during lectures.',
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
      liveQuizzesNoCourse: 'Live quizzes without course',
      listLiveQuizzesNoCourse: 'List of all live quizzes without course',
      loadingLiveQuizzesFailed:
        'An error occurred while loading your live quizzes. Please try again later.',
    },
    course: {
      courseOverview: 'Course overview',
      loadingFailed:
        'An error occurred while loading your courses. Please try again later.',
      completedLiveQuizzesHint:
        'Completed live quizzes can be viewed with results on the corresponding page in the KlickerUZH management app.',
      runningLiveQuizzes: 'Running Live Quizzes',
      noRunningLiveQuizzes: 'No running live quizzes',
      plannedLiveQuizzes: 'Planned Live Quizzes',
      noPlannedLiveQuizzes: 'No planned live quizzes',
      liveQuizStartFailed:
        'Unfortunately, your live quiz could not be started due to an error. Please try again later.',
      pptEmbedding: 'PPT-Embedding Evaluation',
      startLiveQuiz: 'Start quiz',
      confirmStartLiveQuiz:
        'Are you sure you want to start the following live quiz?',
      explanationStartLiveQuiz:
        'Please note that a started live quiz is generally publicly accessible. Running live quizzes can be canceled or stopped using the KlickerUZH management app.',
    },
    liveQuiz: {
      liveQuizControl: 'Live Quiz Control',
      errorLoadingLiveQuiz:
        'Unfortunately, an error occurred while loading the live quiz. Please make sure that the quiz is still running or try again later.',
      containsNoQuestions:
        'This live quiz does not contain any questions and therefore cannot be controlled via the controller app at the moment. Please use the management app with all functionalities.',
      liveQuizWithName: 'Live Quiz: {name}',
      activeBlock: 'Active Block:',
      closeBlock: 'Close Block',
      nextBlock: 'Next Block:',
      activateBlockN: 'Activate Block {number}',
      hintAllBlocksClosed:
        'All blocks of this live quiz have already been executed and closed. The feedback channel will be closed when the quiz is ended.',
      endQuiz: 'End Quiz',
      hintLastBlock:
        'The currently running block is the last of this live quiz. After closing it, the quiz can be ended.',
    },
    activity: {
      title: '{type} Activity',
      tooltip: 'View Comments',
      viewComments: 'View Comments',
      noActivity: 'No activity yet.',
      addMessage: 'Use the form below to add the first message.',
      messageInputPlaceholder: 'Type a message...',
      send: 'Send',
      sending: 'Sending...',
      missingId: 'Object ID is missing. comments cannot be displayed.',
    },
  },
}
