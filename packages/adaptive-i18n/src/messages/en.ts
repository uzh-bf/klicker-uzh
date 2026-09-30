const messages = {
  shared: {
    generic: {
      incorrect: 'Incorrect',
    },
    types: {
      COMPETENCE_TREE: 'Competence Tree',
    },
  },
  pwa: {
    practiceQuiz: {
      adaptive: {
        intro: {
          title: 'Adaptive practice quiz',
          purpose:
            'Questions adapt to your responses to estimate your current competence level.',
          expectedLength:
            '{maximum, plural, one {The quiz has at most # question.} other {The quiz has at most # questions.}}',
          noBacktracking:
            'After submitting an answer, you cannot return to earlier questions.',
          resumable: 'You can leave the quiz and resume it later.',
          privacy:
            'Your result helps you choose what to practise next. Course instructors see only anonymous group results.',
        },
        question: {
          testingSolution: 'Solution — testing only',
          testingSolutionDescription:
            'Answer display is enabled for this environment.',
          testingTrue: 'True',
          testingFalse: 'False',
          remainingTime: 'Time remaining: {time}',
          timeLimitReached: 'Time is up. Checking your result…',

          progress: 'Question {current}, at most {maximum}',
          timer: 'Elapsed {time}',
          status: {
            building: 'Building your competence profile',
            refining: 'Refining your competence profile',
          },
        },
        actions: {
          start: 'Start quiz',
          resume: 'Resume quiz',
          submit: 'Submit answer',
          startOver: 'Start over',
          startOverTitle: 'Start over?',
          startOverDescription:
            'Your current attempt and its responses will be discarded.',
          startOverConfirm: 'Start over',
          practiceAgain: 'Practice again',
        },
        errors: {
          load: 'The adaptive practice quiz could not be loaded.',
          start: 'The quiz could not be started. Please try again.',
          resume: 'The quiz could not be resumed. Please try again.',
          startOver: 'A new attempt could not be started. Please try again.',
          submit: 'Your response could not be submitted. Please try again.',
          result: 'Your result could not be loaded. Please try again.',
        },
        feedback: {
          correct: 'Correct',
          incorrect: 'Not correct yet',
          score: 'Score: {score}%',
        },
        unavailable: {
          title: 'Quiz unavailable',
          description: 'This adaptive practice quiz is currently unavailable.',
        },
        preview: {
          label: 'Preview',
          description:
            'You are viewing a preview of this adaptive practice quiz.',
        },
        validation: {
          numericRequired: 'Enter a number.',
          numericInvalid: 'Enter a valid number.',
          numericRange: 'Enter a value between {min} and {max}.',
          numericMin: 'Enter a value of at least {min}.',
          numericMax: 'Enter a value of at most {max}.',
          numericPercentRange: 'Enter a percentage between 0 and 100.',
          numericPercentAllowed: 'Percent input is accepted.',
          freeTextRequired: 'Enter an answer.',
          freeTextTooLong:
            '{maxLength, plural, one {Enter no more than # character.} other {Enter no more than # characters.}}',
        },
        result: {
          timeLimit: {
            zeroAnswered:
              'The time limit was reached before you submitted an answer. No level estimate is available.',
            answered:
              'The time limit was reached. Any result below is based only on the answers submitted before time ran out.',
          },
          placementPilot: {
            notice:
              'Experimental placement pilot: this result is an estimate for orientation and may change as the pilot is evaluated.',
            estimatedLevel: 'Estimated level: {level}',
            adjacentRange: 'Estimated adjacent range: {levels}',
            noEvidence: 'No estimated level is available yet',
            resultHelp:
              'This experimental pilot reports an estimated level or adjacent range for orientation.',
          },
          uncertainty: {
            title: 'Model-based estimated range',
            description:
              'A wider range means more uncertainty about your level. This is an estimate based on your answers, not a guarantee.',
          },

          retakeAvailableAt:
            'You can take this quiz again from {date}. Your current result remains available here.',
          retakeUnavailable:
            'Retakes are not enabled for this quiz. Your result remains available here.',
          title: 'Your result',
          headline: 'Your current level: {level}',
          incompleteHeadline: 'No complete result yet',
          betweenHeadline: 'Between {levels}',
          poolLimitedHeadline: 'More suitable questions are needed',
          researchHeadline: 'Practice completed',
          incomplete:
            'There is not enough evidence to determine your overall level.',
          probability: '({probability}% probability)',
          answeredQuestions:
            '{count, plural, one {# question answered} other {# questions answered}}',
          classification: {
            CLASSIFIED: {
              label: 'Level determined',
              description:
                'The available evidence supports this level. The range below shows the remaining uncertainty.',
            },
            BETWEEN_LEVELS: {
              label: 'Between levels',
              description:
                'Your responses support two neighbouring levels. The range below shows where the result overlaps them.',
            },
            INSUFFICIENT_EVIDENCE: {
              label: 'Not enough evidence',
              description:
                'There is not yet enough evidence to report a dependable level.',
            },
            POOL_LIMITED: {
              label: 'Question pool limited',
              description:
                'The available questions could not narrow the estimate enough for a dependable level.',
            },
            RESEARCH_ONLY: {
              label: 'No proficiency result',
              description:
                'This session collected responses for calibration and does not report a proficiency level.',
            },
          },
          nextStep: {
            title: 'What to do next',
            CLASSIFIED:
              'Continue with material at this level and revisit any competence areas shown below it.',
            BETWEEN_LEVELS:
              'Practise the higher of the two levels, then repeat the quiz when you have more evidence.',
            INSUFFICIENT_EVIDENCE:
              'Practise across the competence areas and repeat the quiz to gather more evidence.',
            POOL_LIMITED:
              'Use the competence profile as orientation and ask your instructor for additional practice material.',
            RESEARCH_ONLY: '',
          },
          interpretation: {
            MASTERY: {
              headline: 'Highest demonstrated level: {level}',
              description:
                'The placement rule reports the highest level threshold reached by your estimate. Use the confidence and competence profile when interpreting it.',
            },
            NEAREST: {
              headline: 'Estimated level: {level}',
              description:
                'The diagnostic rule reports the level anchor nearest your current estimate. Use the confidence and competence profile when interpreting it.',
            },
          },
        },
        confidence: {
          label: 'Confidence',
          HIGH: 'High',
          MODERATE: 'Moderate',
          LOW: 'Low',
          INSUFFICIENT_DATA: 'Insufficient data',
        },
        nearBoundary: {
          label: 'Near a level boundary',
          description:
            'Your result is close to the boundary between two levels.',
        },
        stopReasons: {
          TIME_LIMIT: 'The quiz ended because the time limit was reached.',
          ABANDONED: 'This attempt was ended before it was completed.',
          CLASSIFIED: 'Your level could be estimated reliably.',
          ALL_ROOTS_CLASSIFIED:
            'The main competence areas could be estimated. Individual subcompetences may still need more answers.',
          TOTAL_QUESTION_CAP:
            'The quiz ended after the maximum number of questions.',
          NODE_QUESTION_CAP:
            'The question limit for a competence area was reached.',
          POOL_EXHAUSTED: 'No more suitable questions were available.',
          INSUFFICIENT_DATA:
            'There was not enough evidence for a complete result.',
        },
        trajectory: {
          evidenceHelp:
            'The line shows how your estimate changed as you answered. Early estimates are provisional: a level may not yet be determined at that point, even when your final result is available. The shaded range shows the remaining uncertainty.',
          notYetDetermined: 'Not yet determined',
          title: 'Estimate over time',
          questionAxis: 'Answered questions',
          levelAxis: 'Estimated level',
          question: 'Question {number}',
          estimate: 'Estimate',
          confidenceRange: 'Confidence range',
          finalResult: 'Final result',
          noData: 'No trajectory data is available.',
          summary:
            '{count, plural, one {After # answered question, your final estimate is {level}.} other {After # answered questions, your final estimate is {level}.}}',
          incompleteSummary:
            '{count, plural, one {After # answered question, there is not enough evidence for an overall level.} other {After # answered questions, there is not enough evidence for an overall level.}}',
        },
        profile: {
          earlyIndication: 'Early indication: {level}',
          plausibleRange: 'Plausible range: {range}',
          fewResponses:
            '{count, plural, one {Based on just # answer. This is an early indication and is still very uncertain.} other {Based on just # answers. This is an early indication and is still very uncertain.}}',
          supportedEstimate:
            'Your answers support this estimate. The shaded range shows the remaining uncertainty.',
          uncertainEstimate:
            'Your level is still uncertain. More answers in this area would help narrow the range.',
          noResponses: 'No questions answered in this area.',
          evidenceHelp:
            'Each row uses answers from that area. After a few answers, the indication is tentative. The shaded range shows the uncertainty: a wider range means your level is less certain. Areas without answers have no estimate.',
          title: 'Competence profile',
          overall: 'Overall',
          responses: '{count, plural, one {# response} other {# responses}}',
          insufficientData: 'Insufficient data',
          betweenLevels: 'Between {levels}',
          poolLimited: 'Question pool limited',
          researchOnly: 'No proficiency result',
          expand: 'Show details for {name}',
          collapse: 'Hide details for {name}',
        },
      },
    },
  },
  manage: {
    adaptiveActivitySummary: {
      title: 'Adaptive practice quiz',
      tree: 'Competence tree',
      notAssigned: 'No competence tree assigned yet',
      poolCount:
        '{count, plural, one {# element in the quiz question pool} other {# elements in the quiz question pool}}',
      treeCount:
        '{count, plural, one {# element assigned to the tree} other {# elements assigned to the tree}}',
    },
    general: {
      sortAscending: 'Sort ascending',
      sortDescending: 'Sort descending',
      selectAllElements: 'Select all elements',
      deselectAllElements: 'Deselect all elements',
    },
    activities: {
      adaptiveInfo: 'Adaptive question pool · individually selected questions',
    },
    elements: {
      adaptiveMapping: {
        selectTrees: 'Competence trees',
        multipleTreesHint:
          'Select one or more trees. Set a subcompetence and difficulty level for each selected tree.',
        enableAdaptive: 'Enable adaptive learning',
        disableHint:
          'Remove the tree assignments below to disable adaptive learning for this element. Existing published quizzes keep their saved questions.',

        title: 'Adaptive mapping',
        description:
          'Assign this element to a leaf subcompetence and level in one or more competence trees. Adaptive estimates count only fully correct answers as correct; partial scores count as incorrect.',
        unsupportedType:
          'Adaptive mapping is available only for numerical, single-choice, multiple-choice, KPRIM, and controlled-answer free-text questions.',
        saveElementFirst:
          'Save the element before changing its adaptive mappings.',
        assignDuringCreation: 'Assign to a competence tree',
        createAndAssign: 'Create element and assign',
        noTrees: 'No competence trees are available.',
        noAdditionalTrees: 'No additional competence trees match the search.',
        tree: 'Competence tree',
        searchTrees: 'Search competence trees',
        selectTree: 'Select a competence tree...',
        noAssignableLeaves:
          'This competence tree has no enabled leaf-level coverage to assign.',
        leaf: 'Leaf subcompetence',
        selectLeaf: 'Select a leaf subcompetence...',
        additionalLeaves: 'Additional leaf subcompetences',
        addAdditionalLeaf: 'Add another subcompetence',
        removeAdditionalLeaf: 'Remove subcompetence',
        additionalLeavesDraftOnly:
          'Additional subcompetences must belong to the same competence as the main subcompetence. The element is still asked at most once per attempt; its answer counts once for each mapped subcompetence.',
        level: 'Level',
        expectedDifficulty: 'Expected item difficulty',
        expectedDifficultyTooltip:
          'Choose the level at which you expect this item to be most informative. This initial estimate is replaced by an approved calibration.',
        selectLevel: 'Select a level...',
        enabled: 'Use in adaptive quizzes',
        enablePercentInput: 'Allow percentage input',
        selectedB: 'Selected difficulty (b)',
        defaultA: 'Default discrimination (a)',
        effectiveA: 'Effective discrimination (a)',
        inferredC: 'Inferred guessing (c)',
        choiceCount: 'Answer choices',
        notAssigned: 'Not assigned',
        add: 'Add mapping',
        remove: 'Remove mapping',
        save: 'Save mapping',
        assignmentErrors: {
          locked:
            'This competence tree is already used by a practice quiz. Duplicate the tree before adding this element.',
          coverage:
            'The selected leaf and level are no longer enabled. Choose an available leaf-level combination.',
          invalid:
            'This adaptive mapping is not valid. Review the selected leaf, level, and answer configuration.',
          unavailable:
            'This competence tree is no longer available to edit. Refresh the catalog or choose another tree.',
        },
        states: {
          archived: 'Archived',
          locked: 'Structurally locked',
          owner: 'Owned',
          readOnly: 'Read-only',
        },
      },
    },
    activityWizard: {
      adaptive: {
        loadFailed: 'The adaptive practice quiz could not be loaded.',
        mode: {
          label: 'Quiz mode',
          standard: 'Standard',
          adaptive: 'Adaptive',
          standardDescription:
            'Uses the question stacks and order configured in this quiz.',
          adaptiveDescription:
            'Selects questions dynamically from a linked competence tree and reports level-based results.',
          confirmTitle: 'Switch quiz mode?',
          confirmDescription:
            'Switching to {mode} mode removes the current mode-specific questions and settings. This cannot be undone.',
          confirmAction: 'Switch mode',
          rolloutUnavailable:
            'Adaptive learning is currently available only in selected pilot courses.',
        },
        preset: {
          DIAGNOSTIC: 'Diagnostic / self-assessment',
          PLACEMENT: 'Placement / mastery',
          PLACEMENT_UNAVAILABLE: 'Placement (not yet available)',
          RESEARCH: 'Research / calibration',
        },
        placementPilot: {
          label: 'Overall placement (pilot)',
          notice:
            'Experimental placement pilot: it uses the selected scale and provisional or calibrated item parameters, uses your configured question limit, and requires at least 4 responses per main competence.',
        },
        research: {
          nonClassifying:
            'Research mode collects responses for item calibration. It does not classify learners or show them a competence level.',
        },
        attemptPolicy: {
          FIRST_COMPLETED: 'First completed attempt',
          LATEST_COMPLETED: 'Latest completed attempt',
        },
        levelMapping: {
          MASTERY: 'Mastery threshold',
          NEAREST: 'Nearest level',
        },
        stopping: {
          pilotPolicy:
            'Stops early when the overall estimate is sufficiently concentrated after minimum coverage. Otherwise it continues to the question or time limit and may show a range. This pilot has not been empirically validated.',
          title: 'When should the quiz finish?',
          description:
            'The quiz can finish early once every enabled competence has enough evidence and its uncertainty interval fits within one level.',
          maxQuestions: 'Maximum questions',
          maxQuestionsHint: 'The quiz never asks more than this limit.',
          interval: 'Confidence interval for early stopping',
          interval80: '80% · shorter quizzes (default)',
          interval90: '90% · more evidence',
          interval95: '95% · more cautious',
          customInterval: 'Existing custom setting (z = {value})',
          intervalHint:
            'A higher percentage gives a wider uncertainty interval and usually needs more questions. This is a model-based interval, not a guarantee that the reported level is correct.',
          scalePolicy:
            'Confidence and early stopping follow the approved policy of the selected calibrated scale. The question and time limits below still apply.',
          enableTimeLimit: 'Also set a time limit',
          timeLimitMinutes: 'Maximum duration (minutes)',
          limitHint:
            'The first question or time limit reached ends the quiz, even if uncertainty remains. The result will include the available estimate and uncertainty.',
          coverage: 'Coverage settings (optional)',
          coverageHint:
            'Require some answers in each subcompetence before finishing early. Leave the per-subcompetence maximum empty to use only the overall limit.',
          minPerLeaf: 'Minimum questions per subcompetence',
          maxPerLeaf: 'Maximum questions per subcompetence (optional)',
        },
        settings: {
          noPoints:
            'Adaptive practice quizzes do not award points or experience points.',
          preset: 'Preset',
          totalQuestionCap: 'Maximum questions',
          showTimer: 'Show timer',
          attemptPolicy: 'Attempt used for results',
          advanced: 'Advanced adaptive settings',
          perLeafQuestionCap: 'Maximum questions per leaf',
          minQuestionsPerLeaf: 'Minimum questions per leaf',
          classificationZ: 'Classification z-value',
          levelMappingRule: 'Level mapping',
          topInformationRatio: 'Top-information pool ratio',
          defaultDiscrimination: 'Default discrimination (a)',
        },
        assignments: {
          title: 'Question pool',
          searchPlaceholder: 'Search by element name or ID...',
          allLeaves: 'All leaves',
          allLevels: 'All levels',
          state: {
            ALL: 'All states',
            ENABLED: 'Enabled',
            DISABLED: 'Disabled',
          },
          use: 'Use',
          element: 'Element',
          leaf: 'Leaf',
          level: 'Level',
          effective: 'Effective pool',
          discrimination: 'Discrimination (a)',
          included: 'Included',
          excluded: 'Excluded',
        },
        coverage: {
          title: 'Coverage readiness',
          leaf: 'Leaf',
        },
        hierarchy: {
          title: 'Quiz hierarchy',
          directIntent:
            'Changes here apply only to this quiz; the shared competence tree remains unchanged.',
          effectiveState: 'Effective state',
          competence: 'Competence',
          subcompetence: 'Subcompetence',
          weight: 'Weight',
          cap: 'Question cap',
          effectiveEnabled: 'Included',
          effectiveDisabled: 'Excluded',
          disableConfirmTitle: 'Exclude hierarchy branch?',
          disableConfirmDescription:
            'Exclude "{name}"? This also excludes {descendants, plural, one {# descendant node} other {# descendant nodes}} and {assignments, plural, one {# mapped element} other {# mapped elements}} from this quiz.',
          disableAction: 'Exclude branch',
        },
        setup: {
          enableTimeLimit: 'Set a time limit',
          timeLimitMinutes: 'Maximum duration (minutes)',
          timeLimitHint:
            'Starts with the first question and continues while paused or closed. Leave disabled for unlimited time.',

          title: 'Adaptive setup',
          tooltip:
            'Select a competence tree, configure the effective pool, and verify readiness.',
          tree: 'Competence tree',
          searchTrees: 'Search competence trees',
          selectTree: 'Select a competence tree...',
          linkedTrees: 'Linked to this course',
          ownedUnlinkedTrees: 'Your unlinked trees',
          loadMoreLinked: 'Load more linked trees',
          loadMoreOwned: 'Load more owned trees',
          linkSuccess: 'The competence tree was linked to the course.',
          linkFailed: 'The competence tree could not be linked to the course.',
          linkTree: 'Link to course',
          courseRequired:
            'Select a course before configuring adaptive delivery.',
          linkRequired:
            'Link the selected competence tree to this course before continuing.',
        },
        scale: {
          title: 'Scale and calibration',
          version: 'Scale version {version}',
          noActive:
            'This competence tree has no active scale. Create, review, and activate a scale before publishing.',
          legacyMeasurement:
            'This quiz still uses the legacy measurement model. Use active scale version {version} to configure Bayesian IRT.',
          newerActiveAvailable:
            'A newer active scale version {version} is available. Existing published attempts keep their original scale.',
          useActive: 'Use scale version {version}',
          standardSetting: 'Standard setting approved',
          empiricalValidation: 'Empirical holdout approved',
        },
        preview: {
          emptyResponse: 'The adaptive preview returned no data.',
          refresh: 'Refresh preview',
        },
        readiness: {
          notChecked: 'Readiness has not been checked yet.',
          ready: 'Ready to publish',
          notReady: 'Not ready to publish',
          stale: 'Preview out of date',
          expectedLength: 'Expected questions',
          duration: 'Estimated duration',
          minutes: '{value} min',
          roots: 'Enabled competences',
          leaves: 'Enabled leaves',
          assignments: 'Enabled assignments',
          errors: 'Blocking issues',
          warnings: 'Warnings',
          reachability: 'Root competence reachability',
          root: 'Root competence',
          available: 'Available items',
          allocated: 'Allocated questions',
          levels: 'Classifiable levels',
          minimumSe: 'Minimum reachable SE',
          issues: {
            ADAPTIVE_COURSE_DISABLED:
              'Adaptive learning is not enabled for this course.',
            ADAPTIVE_COMPETENCE_TREE_UNAVAILABLE:
              'The competence tree was archived, deleted, or unlinked from this course.',
            ADAPTIVE_NO_ENABLED_COMPETENCE:
              'Enable at least one root competence.',
            ADAPTIVE_COMPETENCE_WITHOUT_ENABLED_LEAF:
              'The enabled competence "{nodeName}" has no enabled leaf.',
            ADAPTIVE_ITEM_UNAVAILABLE:
              'The element "{elementName}" was deleted and cannot be added to a new adaptive pool.',
            ADAPTIVE_ITEM_ACCESS_REVOKED:
              'The competence tree owner can no longer access the element "{elementName}". Restore access or duplicate the tree with an available element.',
            ADAPTIVE_ITEM_NOT_SCORABLE:
              'The element "{elementName}" has no controlled answer that can be graded adaptively.',
            ADAPTIVE_ITEM_PARAMETERS_INVALID:
              'The element "{elementName}" has invalid effective item parameters.',
            ADAPTIVE_COVERAGE_CELL_EMPTY:
              'Every enabled leaf and level combination needs at least one enabled element.',
            ADAPTIVE_COVERAGE_BELOW_PRODUCT_MINIMUM:
              'Production presets require {minimumValue} independent, enabled, scorable elements in this leaf and level combination; {enabledAssignmentCount} are available.',
            ADAPTIVE_COVERAGE_BELOW_TARGET:
              'The target is {targetItemCount} elements, but only {enabledAssignmentCount} {enabledAssignmentCount, plural, one {element is} other {elements are}} available.',
            ADAPTIVE_MINIMUM_EVIDENCE_UNREACHABLE:
              'The leaf "{nodeName}" requires {requiredQuestionCount} questions, but only {availableItemCount} enabled elements are available.',
            ADAPTIVE_MINIMUM_EVIDENCE_CAPPED:
              'The node "{nodeName}" requires {requiredQuestionCount} questions, but its effective cap is {effectiveQuestionCap}.',
            ADAPTIVE_MULTIPLE_SUBCOMPETENCES_DRAFT_ONLY:
              'Elements mapped to multiple subcompetences require the standard adaptive quiz or Placement with a competence scale. Other quiz modes do not support these mappings.',
            ADAPTIVE_ASSIGNMENT_ADDITIONAL_LEAVES_INVALID:
              'An element has invalid additional subcompetences. Choose distinct subcompetences without further subcompetences beneath them.',
            ADAPTIVE_ASSIGNMENT_ADDITIONAL_LEAF_OTHER_ROOT:
              'An element can only also count for subcompetences of the same competence as its main subcompetence. Remove subcompetences of other competences in the competence tree.',
            ADAPTIVE_PLACEMENT_PILOT_LIMITS_INVALID:
              'Placement samples subcompetences. Remove question limits on individual subcompetences to continue.',
            ADAPTIVE_ROOT_MINIMUM_EVIDENCE_CAPPED:
              'Allow at least {requiredQuestionCount} questions so every main competence can receive four answers. The current limit is {totalQuestionCap}.',
            ADAPTIVE_ROOT_MINIMUM_EVIDENCE_UNREACHABLE:
              'The competence "{nodeName}" needs at least four available questions and a question limit of four or more.',
            ADAPTIVE_GLOBAL_MINIMUM_EVIDENCE_CAPPED:
              'The enabled leaves require {requiredQuestionCount} questions, but the total cap is {totalQuestionCap}.',
            ADAPTIVE_CLASSIFICATION_BANDS_UNREACHABLE:
              'The planning estimate supports a precise result in {classifiableLevelCount} of {levelCount} levels for "{nodeName}". With this question limit, some results may remain uncertain.',
            ADAPTIVE_TIME_BUDGET_EXCEEDED:
              'The coverage is expected to take about {estimatedDurationMinutes} minutes using {secondsPerItem} seconds per item.',
            ADAPTIVE_CONFIG_INTEGER_RANGE:
              'The setting {field} must be a whole number between {minimumValue} and {maximumValue}.',
            ADAPTIVE_PER_LEAF_CAP_INVALID:
              'The per-leaf cap must be positive and no larger than the total cap of {totalQuestionCap}.',
            ADAPTIVE_MIN_QUESTIONS_EXCEEDS_TOTAL:
              'The minimum questions per leaf cannot exceed the total cap of {totalQuestionCap}.',
            ADAPTIVE_CLASSIFICATION_Z_INVALID:
              'The classification z-value must be greater than 0 and at most {maximumValue}.',
            ADAPTIVE_TOP_INFORMATION_RATIO_INVALID:
              'The top-information ratio must be greater than 0 and at most {maximumValue}.',
            ADAPTIVE_DEFAULT_DISCRIMINATION_INVALID:
              'Default discrimination must be greater than 0 and at most {maximumValue}.',
            ADAPTIVE_STACKS_FORBIDDEN:
              'Adaptive practice quizzes cannot contain standard question stacks.',
            ADAPTIVE_RESEARCH_SETTINGS_FORBIDDEN:
              'Advanced research settings are available only with the research preset.',
            ADAPTIVE_ASSIGNMENT_INVALID:
              'Assignment {assignmentId} does not have a supported element type and valid level.',
            ADAPTIVE_NODE_OVERRIDE_INVALID:
              'Node override {nodeId} is duplicated or does not belong to the selected tree.',
            ADAPTIVE_NON_ROOT_WEIGHT_FORBIDDEN:
              'Quiz weights can be set only for root competences.',
            ADAPTIVE_NODE_CAP_INVALID:
              'Node question caps must be whole numbers between 1 and {maximumValue}.',
            ADAPTIVE_ELEMENT_OVERRIDE_INVALID:
              'Element override {assignmentId} is duplicated or does not belong to the selected tree.',
            ADAPTIVE_DISCRIMINATION_OVERRIDE_FORBIDDEN:
              'Quiz-specific discrimination overrides require the research preset.',
            ADAPTIVE_DISCRIMINATION_OVERRIDE_INVALID:
              'Discrimination must be greater than 0 and at most {maximumValue}.',
            ADAPTIVE_ROOT_WEIGHT_INVALID:
              'The enabled competence "{nodeName}" needs a positive finite weight.',
            ADAPTIVE_CONFIG_MISSING:
              'The adaptive practice quiz configuration was not found.',
            ADAPTIVE_V2_SCALE_NOT_ACTIVE:
              'The selected competence scale is not active or is no longer supported.',
            ADAPTIVE_V2_PLACEMENT_UNAVAILABLE:
              'Placement is not yet available for calibrated adaptive quizzes. Select Diagnostic or Research.',
            ADAPTIVE_V2_CALIBRATION_MISSING:
              'The element "{elementName}" needs an approved calibration for the selected scale.',
            ADAPTIVE_V2_CALIBRATION_VERSION_MISMATCH:
              'The element "{elementName}" changed after calibration. Import a calibration for its current version.',
            ADAPTIVE_V2_CALIBRATION_FLAGGED:
              'The element "{elementName}" was excluded by calibration review.',
            ADAPTIVE_V2_INFORMATION_GAP:
              'The calibrated item bank has too little information near a level boundary.',
            ADAPTIVE_V2_CUT_SCORE_UNREACHABLE:
              'The calibrated item bank does not contain suitable questions near a level boundary.',
            ADAPTIVE_V2_RESEARCH_ANCHORS_REQUIRED:
              'Every enabled leaf and level band needs at least one calibrated anchor item for Research.',
            ADAPTIVE_V2_RESEARCH_DESIGN_DISCONNECTED:
              'Research needs calibration collection enabled for the course and at least one eligible field-test item.',
            ADAPTIVE_V2_EMPIRICAL_VALIDATION_REQUIRED:
              'Diagnostic publication requires independently approved holdout validation.',
            ADAPTIVE_V2_EMPIRICAL_VALIDATION_FAILED:
              'The empirical validation has not passed the release criteria for Diagnostic publication.',
            ADAPTIVE_V2_EMPIRICAL_VALIDATION_STALE:
              'The approved empirical validation does not match the current calibrated item bank.',
            unknown: 'The adaptive configuration contains an unknown issue.',
          },
        },
        validation: {
          number: 'Enter a valid number.',
          required: 'This field is required.',
          integer: 'Enter a whole number.',
          positive: 'Enter a value greater than 0.',
          questionCapMax: 'Enter no more than 1000 questions.',
          classificationZMax: 'Enter a value no greater than 5.',
          ratioMax: 'Enter a value no greater than 1.',
          discriminationMax: 'Enter a value no greater than 10.',
          treeRequired: 'Select a competence tree.',
          courseNotEnabled:
            'Select a course that is enabled for the adaptive-learning pilot.',
          nonNegative: 'Enter 0 or a positive value.',
        },
      },
    },
    adaptivePublication: {
      immediateOnly:
        '"{title}" can currently be published only immediately. Scheduling is unavailable for adaptive practice quizzes.',
      checkingReadiness: 'Checking publication readiness...',
      emptyResponse: 'Publishing the adaptive practice quiz returned no data.',
      publishFailed: 'The adaptive practice quiz could not be published.',
      researchNonClassifying:
        'Research mode collects response data for calibration. Students will not receive a competence classification or level result.',
      researchConfirmation:
        'I understand that this publication is for calibration data collection and does not classify students.',
    },
    evaluation: {
      adaptive: {
        title: 'Adaptive cohort results',
        attemptSummary: 'Attempt summary',
        attempts: {
          total: 'Total',
          completed: 'Completed results',
          inProgress: 'In progress',
          abandoned: 'Abandoned',
          classified: 'Level determined',
          betweenLevels: 'Between levels',
          insufficientEvidence: 'Insufficient evidence',
          poolLimited: 'Question pool limited',
          researchOnly: 'Research only',
          capped: 'Question cap reached',
          poolExhausted: 'Question pool exhausted',
          stoppedInsufficientData: 'Stopped with insufficient data',
          insufficientData: 'Insufficient data',
          nearBoundary: 'Near a level boundary',
        },
        distributionEstimates: {
          description:
            'All available level estimates for this area are shown, including quizzes that reached the question limit. Certainty is assessed separately for each area.',
          determined: 'Level determined',
          provisional: 'Provisional estimate',
          empty: 'No level estimates are available for this area yet.',
          barLabel:
            '{level}: {determined} determined, {provisional} provisional',
          counts: '{determined} determined · {provisional} provisional',
          included:
            '{count} results with an estimate for this area. Bar lengths show their share of these results.',
          excluded:
            '{count} results without a usable estimate for this area are not shown.',
        },
        distributionStatuses: {
          betweenLevels: 'Between levels',
          insufficientEvidence: 'Insufficient evidence',
          poolLimited: 'Question pool limited',
          researchOnly: 'Research only',
        },
        stopSummary: 'Stopping outcomes',
        qualitySummary: 'Quality flags',
        suppressedValue: '-',
        notEnoughData: 'Not enough data',
        suppression: {
          cohort:
            'A dash (-) means no result is available yet; it does not mean zero.',
          summary:
            'Outcome counts are available after a participant completes the quiz.',
          distribution:
            'This distribution is available after a participant completes the quiz.',
          pilot:
            '“Not enough data” means there is not enough evidence to calculate the metric.',
        },
        pilot: {
          itemOverview: 'Element overview',
          itemCount: '{count} elements',
          itemOverviewHelp:
            'Expand a competence and subcompetence to inspect its elements. Each list shows 10 elements per page by default.',
          unassignedItems: 'Other elements',
          questionDistribution: 'Questions answered',
          timeDistribution: 'Completion time',
          boxPlotHelp:
            'Box: middle 50% · Line: median · Whiskers: minimum and maximum',
          boxPlotCount: '{count} completed results',
          boxPlotDurationNote:
            'Only results with a recorded completion time are included.',
          boxPlotEmpty: 'No recorded values available.',
          boxPlotMin: 'Minimum',
          boxPlotQ1: '25th percentile',
          boxPlotMedian: 'Median',
          boxPlotQ3: '75th percentile',
          boxPlotMax: 'Maximum',
          boxPlotTimeFormat: 'HH:MM:SS',

          title: 'Pilot quality monitoring',
          description:
            'Aggregate indicators for form length, exposure, and descriptive item fit. They do not recalibrate items or replace teaching review.',
          medianQuestions: 'Median questions',
          p95Questions: '95th percentile questions',
          medianDuration: 'Median completion time',
          p95Duration: '95th percentile completion time',
          nearBoundaryRate: 'Near-boundary rate',
          responseIntegrity: 'Response-count integrity',
          durationCompleteness: 'Duration completeness',
          issueDetected: 'Issue detected',
          noIssue: 'No issue',
          responseCountMismatch:
            'Stored estimates and canonical response rows do not agree. Investigate this data-integrity warning before interpreting the pilot.',
          durationMissing:
            'At least one selected attempt has no complete client-reported duration.',
          columnHelp: {
            item: 'The question as it appeared in the published quiz.',
            competence:
              'The competence and subcompetence assessed by this question.',
            level:
              'The level assigned to the question in the published question bank.',
            responses:
              'Number of responses to this question in the released cohort.',
            exposure:
              'Share of released participants who received this question. Adaptive selection means not everyone sees every question.',
            observed: 'Percentage of responses graded correct.',
            expected:
              'Average probability of a correct answer predicted by the model, using each participant’s earlier answers and the question parameters. This is a model estimate, not a target pass rate.',
            residual:
              'Observed correct minus model-predicted correct, in percentage points. Positive means more correct answers than predicted. Requires at least 30 responses and sufficient group sizes. Descriptive only; not a significance test.',
            flags:
              'High exposure means this question was shown to more than 40% of participants in this report. This is a review hint, not an error; adaptive selection can use some questions more often.',
          },
          item: 'Item',
          competence: 'Competence path',
          level: 'Level',
          responses: 'Responses',
          exposure: 'Exposure',
          observed: 'Observed correct',
          expected: 'Model-predicted correct',
          residual: 'Difference (pp)',
          flags: 'Review flags',
          highExposure: 'High exposure',
          reviewFit: 'Review fit',
          notEnoughResponses: 'Not enough responses',
          noFlags: 'None',
        },
        overallDistribution: 'Overall level distribution',
        rootDistributions: 'Competence distributions',
        insufficientData: 'Insufficient data',
        noDistributionData: 'No distribution data is available yet.',
        expandNode: 'Expand {node}',
        collapseNode: 'Collapse {node}',
        distributionBarLabel:
          '{level}: {count} {count, plural, one {attempt} other {attempts}}',
      },
    },
    courseList: {
      deletionErrors: {
        retainedAdaptiveHistory:
          'This course contains retained adaptive-learning history and cannot be deleted. Archive the course instead.',
        generic:
          'The course could not be deleted. Please try again or contact support.',
      },
    },
    resources: {
      competenceTrees: 'Competence trees',
    },
    competenceTree: {
      overviewRoots: 'Main competences',
      overviewChildren: 'Subcompetences',
      overviewElements: 'Elements',
      overviewWeightHint: 'Contribution to the overall result',
      guidance: {
        missingSubcompetence:
          '“{name}” needs a subcompetence. Add at least one skill beneath it, or remove this competence if you do not need it.',
        missingEnabledSubcompetence:
          '“{name}” has no active subcompetence. Enable at least one skill beneath it.',
        missingCoverage:
          'Choose at least one level to assess for “{name}” in Tree settings.',
        missingNodeName: 'Give this competence or subcompetence a name.',
        nodeTooDeep:
          '“{name}” is nested too deeply. Move it higher in the hierarchy or increase the permitted depth in Tree settings.',
        invalidWeight:
          'Set a weight greater than zero for “{name}” in the selected competence.',
        missingTreeName: 'Enter an internal name for this tree in Structure.',
        missingDisplayName: 'Enter the name learners should see in Structure.',
        invalidDepth:
          'Choose a maximum hierarchy depth between 1 and 5 in Tree settings.',
        missingRoot: 'Add at least one competence in Structure.',
        missingLevels: 'Add at least two level labels under Questions.',
        fewLevels:
          'Consider using at least three levels to distinguish learner abilities more clearly.',
        missingLevelName:
          'Give every level a name under Questions → Level labels.',
        duplicateLevelName:
          '“{name}” is used for more than one level. Give each level a different name.',
        invalidAssignment:
          'Assign “{name}” to a subcompetence with no further subcompetences beneath it.',
        additionalLeafOtherRoot:
          '“{name}” can only also count for subcompetences of the same competence as its main subcompetence. Remove the others under “Also counts for”.',
        missingAssignmentLevel: 'Choose an expected level for “{name}”.',
        assignmentCoverage:
          'Enable the level used by “{name}” for its subcompetence in Tree settings.',
        invalidCoverageTarget:
          'Set the target number of questions to at least 1 for this level.',
        other:
          'Review this setting before saving. The details below explain what needs attention.',
        unnamed: 'Unnamed competence',
        technicalDetails: 'Show validation details',
        editCompetence: 'Edit competence',
        editLevels: 'Edit levels',
        editSettings: 'Open tree settings',
        editQuestions: 'Edit questions',
        editStructure: 'Edit structure',
      },
      stepStructure: 'Structure',
      stepQuestions: 'Questions',
      stepReview: 'Review',
      setupSteps: 'Competence tree setup',
      wizardDraftHint: 'Save your progress as a draft on this device.',
      backToSetup: 'Back to tree',
      advancedSettings: 'Advanced coverage and calibration',
      quizDefaults: 'Quiz defaults',
      quizDefaultsHint:
        'Used when creating a new adaptive quiz with this tree. Each quiz can override these limits. Existing quizzes keep their saved settings.',
      defaultMaxQuestions: 'Maximum questions',
      enableTimeLimit: 'Set a time limit',
      defaultMaxMinutes: 'Maximum duration (minutes)',
      timeLimitHint:
        'The time limit starts with the first question and continues while the quiz is paused or closed.',
      treeSettings: 'Tree settings',
      levelLabels: 'Level labels',
      continueQuestions: 'Continue to questions',
      continueReview: 'Continue to review',
      reviewTitle: 'Review your competence tree',
      reviewHint:
        'Check the structure and question assignments before saving. Saving a tree does not publish a quiz.',
      reviewMissingNames:
        'Add an internal name and display name in Structure before saving.',
      reviewUnmapped:
        'Choose a subcompetence and expected level for every question before saving.',
      reviewStructureCount:
        '{roots, plural, one {# competence} other {# competences}} · {leaves, plural, one {# leaf subcompetence} other {# leaf subcompetences}}',
      reviewQuestionCount:
        '{count, plural, =0 {No questions added yet. You can save the structure and add questions later.} one {# question added} other {# questions added}}',
      editStructure: 'Edit structure',
      editQuestions: 'Edit questions',
      settingsHint:
        'Set defaults for new quizzes, level labels, and advanced model settings. Save the tree to apply your changes.',
      scaleAfterSave:
        'Scale and calibration tools become available after saving the tree.',
      optionalDescription: 'Description (optional)',
      nodeOptions: 'Competence details',

      restoreDraftPrompt:
        'Replace your current edits with the saved browser draft?',
      tagFilter: 'Tag',
      allTags: 'All tags',
      sortElements: 'Sort elements',
      sortName: 'Name (A–Z)',
      sortModified: 'Recently modified',
      draftDescription:
        'Save an unfinished draft in this browser, even before all required fields are complete. Use “Save” to store a validated tree on the server. Questions and calibration can be completed later; neither action publishes a quiz.',
      draftSaved:
        'Draft saved in this browser for your account. It is not yet saved to the server.',
      draftAvailable:
        'An unfinished draft is available in this browser. Restoring it replaces the current editor contents.',
      restoreDraft: 'Restore draft',
      localDraftError:
        'The browser could not save this draft. Keep this page open or save a valid tree to the server.',
      draft: 'Draft',
      saveDraft: 'Save draft',
      advancedTitle: 'Advanced: level scale and question calibration',
      advancedDescription:
        'Levels describe what learners can do. Calibration places questions on the same difficulty scale so the adaptive quiz can choose suitable questions and estimate a level. The item-bank map helps specialists check gaps and question coverage; it is not needed to assign existing library elements.',
      previewElement: 'Preview {name}',
      previewError: 'The element preview could not be loaded.',
      retryPreview: 'Try again',
      chooseSubcompetence: 'Choose subcompetence…',
      chooseLevel: 'Choose level…',
      competenceGroup: 'group',
      assignElementLeaf: 'Subcompetence for {name}',
      assignElementLevel: 'Expected level for {name}',
      alsoCountsFor: 'Also counts for',
      alsoCountsForSummary:
        '{count, plural, =0 {no other subcompetence} one {# other subcompetence} other {# other subcompetences}}',
      alsoCountsForLabel: 'Other subcompetences {name} also counts for',
      alsoCountsForHelp:
        'The element is still asked at most once per attempt. Its answer counts once for its subcompetence and for each selected subcompetence of the same competence.',
      alsoCountsForOtherCompetence:
        'Other competence: remove this subcompetence before saving.',
      unmappedElements:
        'Choose a subcompetence and an expected level for every element before saving the tree. You can save an unfinished draft on this device. Elements belong to the lowest subcompetence; add a subcompetence beneath a new competence to assign elements to it.',
      batchLimit:
        'A tree supports up to 10,000 assignments. Narrow the filters or select a smaller batch.',
      bulkDescription:
        'Filter ready questions with sample solutions, select a page or all matches, and assign the batch to a subcompetence and level. Existing assignments are kept. Changing a filter clears the selection. Save the tree to apply your changes.',
      selectPage: 'Select this page',
      selectMatching: 'Select all matching elements',
      clearSelection: 'Clear selection',
      selectedCount: '{count} selected',
      addSelected: 'Add selected elements',
      batchAdded:
        '{count} elements added. Save the tree to keep these assignments.',
      browseElements: 'Add existing elements',
      searchElements: 'Search elements by name or content',
      allTypes: 'All question types',
      selectLeaf: 'Assign to subcompetence',
      selectLevel: 'Expected level',
      addElement: 'Add to tree',
      assigned: 'Added to tree',
      pickerDescription:
        'Preview ready library questions and add them to this tree. Then choose a subcompetence and expected level in each added row.',
      loadElementsError: 'The element library could not be loaded.',
      noElements: 'No matching elements. Adjust your search or filters.',
      assignmentSearch: 'Search tree elements',
      allLevels: 'All levels',
      allCompetences: 'All subcompetences',
      libraryDescription:
        'Create and manage reusable competence trees for adaptive practice quizzes.',
      create: 'Create competence tree',
      searchLabel: 'Search competence trees',
      searchPlaceholder: 'Search competence trees...',
      loadMore: 'Load more',
      moreCourseLinks: '+{count} more',
      ownershipFilter: 'Filter by ownership',
      filterOwned: 'Owned',
      filterLinked: 'Linked',
      filterAll: 'All',
      allCourses: 'All courses',
      showArchived: 'Show archived',
      tree: 'Competence tree',
      linkedCourses: 'Linked courses',
      structure: 'Structure',
      usage: 'Usage',
      actions: 'Actions',
      owned: 'Owned',
      linkedReadOnly: 'Linked, read-only',
      archived: 'Archived',
      noLinkedCourses: 'No linked courses',
      levelCount: '{count} {count, plural, one {level} other {levels}}',
      nodeCount: '{count} {count, plural, one {node} other {nodes}}',
      assignmentCount:
        '{count} {count, plural, one {assignment} other {assignments}}',
      draftUsage: 'Draft quizzes: {count}',
      publishedUsage: 'Published quizzes: {count}',
      structurallyLocked: 'Structure locked',
      open: 'Open',
      duplicate: 'Duplicate',
      saveBeforeDuplicate: 'Save or discard your changes before duplicating.',
      leaveUnsavedTitle: 'Discard unsaved changes?',
      leaveUnsavedDescription:
        'Your changes to this competence tree have not been saved.',
      leaveUnsavedAction: 'Discard changes',
      manageLinks: 'Manage course links',
      archive: 'Archive',
      restore: 'Restore',
      emptyLibrary: 'No competence trees match the current filters.',
      archiveTitle: 'Archive competence tree?',
      archiveWarning:
        'Archive "{tree}"? It remains available in existing quizzes but cannot be selected for new mappings or quizzes.',
      actionError: 'The competence tree action could not be completed.',
      newTitle: 'Create competence tree',
      editTitle: 'Edit competence tree',
      backToLibrary: 'Back to competence trees',
      save: 'Save competence tree',
      saveError: 'The competence tree could not be saved.',
      treeNotFound: 'The competence tree could not be found.',
      readOnlyNotice:
        'This tree belongs to another owner. You can inspect and duplicate it, but only the owner can edit it.',
      lockedNotice:
        'This tree is used by an adaptive quiz. Its metadata can still be edited; duplicate the tree to change levels, hierarchy, coverage, or assignments.',
      defaultLevelLow: 'Low',
      defaultLevelMedium: 'Medium',
      defaultLevelHigh: 'High',
      defaultRoot: 'Competence 1',
      defaultLeaf: 'Subcompetence 1',
      metadataTitle: 'Name your tree',
      metadataDescription:
        'Use an internal name for your library and a display name for learners.',
      internalName: 'Internal name',
      displayName: 'Display name',
      description: 'Description',
      modelSettings: 'Model settings',
      structureSettings: 'Structure settings',
      maxDepth: 'Maximum hierarchy depth',
      thetaMin: 'Minimum theta',
      thetaMax: 'Maximum theta',
      defaultDiscrimination: 'Default discrimination (a)',
      mappingRule: 'Level mapping',
      mappingNearest: 'Nearest level anchor',
      mappingMastery: 'Highest mastered level',
      levelsTitle: 'Levels',
      levelsDescription:
        'Define ordered level labels. Cut scores and expected item positions are versioned in the competence scale below.',
      addLevel: 'Add level',
      newLevel: 'New level',
      levelLabel: 'Label',
      theta: 'Anchor (b)',
      band: 'Level band',
      moveUp: 'Move up',
      moveDown: 'Move down',
      deleteLevel: 'Delete level',
      assignmentsAffectedTitle: 'Assignments will change',
      levelReorderWarning:
        'Reordering levels changes their difficulty anchors and can affect existing assignments. Continue?',
      levelDeleteWarning:
        'Deleting this level also removes its coverage cells and assignments. Continue?',
      hierarchyTitle: 'Competence hierarchy',
      hierarchyDescription:
        'Create root competences and nested subcompetences. Only leaf subcompetences can receive element assignments.',
      selectedNode: 'Selected node',
      addRootCompetence: 'Add root competence',
      addSubcompetence: 'Add subcompetence',
      addSubcompetenceTo: 'Add a subcompetence to {name}',
      addChild: 'Add child',
      maxDepthReached: 'Maximum hierarchy depth reached',
      duplicateBranch: 'Duplicate branch',
      deleteBranch: 'Delete branch',
      nodeName: 'Node name',
      parent: 'Parent node',
      rootNode: 'Root competence',
      nodeDescription: 'Node description',
      nodeType: 'Node type',
      competence: 'Competence',
      subcompetence: 'Subcompetence',
      depth: 'Depth',
      rootWeight: 'Root weight',
      normalizedWeight: 'Normalized: {percentage}%',
      noNodeSelected: 'Select a node to edit its details.',
      expandNode: 'Expand node',
      collapseNode: 'Collapse node',
      newCompetence: 'New competence',
      newSubcompetence: 'New subcompetence',
      deleteBranchTitle: 'Delete hierarchy branch?',
      deleteBranchWarning:
        'Deleting this branch removes its mappings for {assignments, plural, one {# element} other {# elements}}. Mappings outside this branch are kept. Continue?',
      coverageTitle: 'Coverage targets',
      contentBlueprintTitle: 'Content blueprint',
      coverageDescription:
        'Plan the required content for every leaf and level. This blueprint does not indicate calibration readiness; select a cell to filter assignments below.',
      searchLeaves: 'Search leaves...',
      allRoots: 'All root competences',
      leaf: 'Leaf subcompetence',
      coverageDisabled: 'Disabled',
      coverageReady: 'Ready',
      coverageMissing: 'Incomplete',
      coverageTargetLabel: 'Target items for {leaf} at {level}',
      coverageEnabledLabel: 'Enable {leaf} at {level}',
      coverageFilterLabel: 'Show assignments for {leaf} at {level}',
      coverageAssignmentCount: '{count} of {target} enabled',
      noMatchingLeaves: 'No leaves match the current filters.',
      itemParameters: {
        title: 'Item parameters',
        difficulty: 'Estimated difficulty (b)',
        difficultySource: 'Derived from level: {level}',
        missingLevel: 'Assign a level to calculate difficulty.',
        guessing: 'Assumed guessing probability (c)',
        guessingSource: 'Derived from the question type and answer options.',
        note: 'Read-only authoring assumptions, not calibrated estimates. Published quizzes keep their saved parameters.',
      },
      structureOverview: 'Overview',
      assignedElements: 'Assigned elements',
      assignmentInactive: 'Inactive',
      assignFromLibrary:
        'Review the current assignments here. Add batches above, or manage individual mappings in the element library.',
      openElementLibrary: 'Open element library',
      overallWeight: 'Overall weight',
      weightExplanation:
        'Main competence weights determine their contribution to the overall result. Subcompetences provide evidence within their main competence.',
      assignmentsTitle: 'Element assignments',
      assignmentsDescription:
        'Choose existing library elements below and assign them to a subcompetence and level. Changes are stored when you save the tree.',
      createElement: 'Create element',
      clearCoverageFilter: 'Clear cell filter',
      assignmentFilter: 'Showing assignments for {leaf} at {level}.',
      element: 'Element',
      elementType: 'Type',
      level: 'Level',
      expectedDifficulty: 'Expected item difficulty',
      discriminationParameter: 'Discrimination (a)',
      difficultyParameter: 'Difficulty (b)',
      guessingParameter: 'Guessing (c)',
      enabled: 'Enabled',
      assignmentEnabledLabel: 'Use {element} in this competence tree',
      percentInput: 'Percent input',
      yes: 'Yes',
      no: 'No',
      removeAssignment: 'Remove assignment',
      noAssignments: 'This competence tree has no element assignments.',
      noFilteredAssignments:
        'No assignments match the selected leaf and level.',
      scale: {
        title: 'Competence scale',
        description:
          'Manage immutable level boundaries, standard-setting evidence, and the active scale used by calibrated adaptive quizzes.',
        createDraft: 'Create scale draft',
        draftTitle: 'New scale draft',
        draftDescription:
          'Set explicit level boundaries and expected item positions. After creation, submit an evidence artifact for independent review.',
        priorMean: 'Population prior mean',
        priorStandardDeviation: 'Population prior standard deviation',
        rangeStart: 'Scale range start',
        rangeEnd: 'Scale range end',
        gridStep: 'Estimation step',
        lowerBound: 'Lower boundary',
        openLowerBound: 'Open',
        version: 'Version',
        versionLabel: 'Version {version} - {status}',
        versionNumber: 'Version {version}',
        active: 'Active scale',
        noActive: 'No active scale',
        emptyState:
          'No scale exists yet. Create a draft from the current level labels.',
        readOnly:
          'This linked tree is read-only. Its active scale and readiness facts are shown below.',
        readinessSummary: 'Calibration readiness',
        activeScaleVersion: 'Active scale version',
        enabledAssignments: 'Enabled assignments',
        calibratedAssignments: 'Calibrated assignments',
        blockingAssignments: 'Assignments needing calibration',
        readinessStatus: {
          NO_ACTIVE_SCALE: 'The tree has no active scale.',
          CALIBRATION_INCOMPLETE:
            'The active scale still has assignments that need an approved exact-version calibration.',
          CALIBRATED_BANK:
            'Every enabled assignment has an approved exact-version calibration on the active scale.',
        },
        empty: 'The scale operation returned no data.',
        created: 'The scale draft was created.',
        activated: 'The approved scale is now active.',
        loadFailed: 'The scale and calibration data could not be loaded.',
        standardSetting: 'Standard-setting evidence',
        standardSettingDescription:
          'Upload the strict JSON evidence artifact and submit this draft for independent review.',
        submitForReview: 'Submit evidence for review',
        reviewSubmitted: 'The scale was submitted for independent review.',
        activate: 'Activate approved scale',
        standardSettingStatus: 'Standard setting approved',
        empiricalValidationStatus: 'Empirical holdout approved',
        scaleLinkStatus: 'Scale link approved',
        status: {
          DRAFT: 'Draft',
          IN_REVIEW: 'In review',
          APPROVED: 'Approved',
          ACTIVE: 'Active',
          REJECTED: 'Rejected',
          SUPERSEDED: 'Superseded',
        },
      },
      calibration: {
        title: 'Calibration',
        status: {
          PROVISIONAL: 'Provisional',
          PILOT: 'Pilot',
          CALIBRATED: 'Calibrated',
          FLAGGED: 'Flagged',
          RETIRED: 'Retired',
          MISSING: 'Missing',
        },
        importTitle: 'Import calibrations',
        importDescription:
          'Upload a strict calibration artifact. Invalid, stale, or incompatible records are rejected by the server.',
        import: 'Import artifact',
        imported:
          '{count, plural, one {# calibration was imported.} other {# calibrations were imported.}}',
        invalidJson: 'Select a valid JSON artifact.',
        exportTitle: 'Export calibration data',
        exportDescription:
          'Request a short-lived, privacy-controlled dataset for offline calibration.',
        datasetVersion: 'Dataset version',
        export: 'Request export',
        exportQueued: 'The calibration export was queued.',
        exportStatus: 'Export status: {status}',
        download: 'Download export',
      },
      itemBank: {
        title: 'Calibrated item-bank map',
        description:
          'Inspect item coverage across the active scale. The shaded area represents available test information; item symbols distinguish element types.',
        axis: 'Item difficulty scale',
        missingCut:
          'No calibrated item is close to the boundary for "{level}".',
        tableCaption:
          'Accessible item-bank list with expected difficulty and calibration status.',
        search: 'Search item bank',
        empty: 'No elements are assigned to this competence tree.',
        positionSource: {
          CALIBRATED: '(calibrated)',
          EXPECTED: '(expected)',
        },
      },
      validationTitle: 'Validation',
      validationDescription:
        'Check whether the tree is ready to save. Any changes needed are listed below.',
      validate: 'Validate tree',
      validationNotRun: 'Validation has not been run yet.',
      validationValid: 'The competence tree is valid.',
      validationErrors:
        '{count, plural, one {# thing to fix before saving} other {# things to fix before saving}}',
      validationWarnings:
        '{count} {count, plural, one {warning} other {warnings}}',
      validationRequestError: 'The competence tree could not be validated.',
      jumpToSection: 'Go to section',
      courseLinksTitle: 'Course links for {tree}',
      courseLinksDescription:
        'Linked courses can use this tree in adaptive practice quizzes. Linking does not transfer ownership.',
      courseLinkError: 'The course link could not be updated.',
      inactiveCourse: 'Inactive course',
      courseWriteRequired:
        'Editing permission is required to change this link.',
      courseLinkSwitchLabel: 'Link {course} to this competence tree',
      linked: 'Linked',
      notLinked: 'Not linked',
      updating: 'Updating...',
      noActiveCourses: 'No courses are available to link.',
      close: 'Close',
      confirm: 'Confirm',
      cancel: 'Cancel',
    },
  },
}

export default messages
