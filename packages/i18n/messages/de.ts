export default {
  chat: {
    common: {
      opensInNewTab: '(öffnet in neuem Tab)',
    },
    a11y: {
      skipToContent: 'Zum Inhalt springen',
    },
    modes: {
      switcherLabel: 'Chat-Modus',
      tutor: 'Tutor',
      tutorDescription:
        'Erhalte geduldige, schrittweise Hilfe bei Deinen Fragen.',
      explainer: 'Erklärer',
      explainerDescription:
        'Erhalte klare Erklärungen zu schwierigen Konzepten.',
    },
    settingsPanel: {
      title: 'Einstellungen',
      aiModelLabel: 'KI-Modell',
      selectAiModel: 'KI-Modell auswählen',
      autoModelDescription:
        'Wählt automatisch für jede Nachricht ein passendes Modell aus.',
      reasoningModelDescription:
        'Für schwierige Aufgaben mit mehreren Schritten. Die Antwort kann länger dauern und mehr Credits verbrauchen.',
      standardModelDescription:
        'Ein vielseitiges Modell für alltägliche Fragen.',
      fallbackModelDescription:
        'Verbraucht weniger Credits und bleibt verfügbar, wenn Deine Credits aufgebraucht sind.',
      autoSelectionInfo:
        'KlickerUZH wählt für jede Nachricht ein passendes Modell aus.',
      usingPrimaryModel:
        'Das Standardmodell wird verwendet, solange Credits verfügbar sind.',
      usingFallbackModel:
        'Es sind keine Credits mehr übrig. Einige Modelle sind möglicherweise nicht mehr verfügbar.',
      reasoningEffortLabel: 'Denkaufwand',
      selectReasoningEffort: 'Denkaufwand auswählen',
      reasoningEffortHint:
        'Ein höherer Aufwand kann schwierige Antworten verbessern, erhöht aber die Wartezeit.',
      reasoningEfforts: {
        none: 'Aus',
        minimal: 'Minimal',
        low: 'Niedrig',
        medium: 'Mittel',
        high: 'Hoch',
        xhigh: 'Sehr hoch',
      },
    },
    credits: {
      title: 'Verfügbare Credits',
      costHint:
        'Jede Nachricht verbraucht Credits — wie viele, hängt vom Modell und der Länge des Austauschs ab.',
      resetAt: 'Werden am {date} wieder aufgefüllt.',
      resetNone: 'Diese Credits werden nicht automatisch aufgefüllt.',
      exhausted:
        'Deine Credits sind aufgebraucht. Einige Modelle sind möglicherweise nicht mehr verfügbar.',
      fallbackNotice:
        'Deine Credits sind aufgebraucht. Einige Modelle sind möglicherweise nicht mehr verfügbar.',
    },
    sidebar: {
      newChat: 'Neuer Chat',
      closeSidebar: 'Seitenleiste schliessen',
      openSidebar: 'Seitenleiste öffnen',
      toggleSidebar: 'Seitenleiste umschalten',
      conversationsLabel: 'Konversationen',
      logoAlt: 'Klicker-Logo',
      copyright:
        '©{year} DF Teaching Center, Department of Finance, University of Zurich. Alle Rechte vorbehalten.',
    },
    assistant: {
      participationRequiredTitle: 'Kurszugang erforderlich',
      participationRequiredDefaultMessage:
        'Du musst dem entsprechenden KlickerUZH-Kurs beitreten, bevor Du diesen Chatbot verwenden kannst. Bitte tritt dem Kurs bei oder wende Dich für den Zugang an Deine Dozierenden.',
      openKlickerUzh: 'KlickerUZH öffnen',
      loading: 'Chatbot wird geladen...',
      disclaimerDeclinedTitle: 'Chatbot nicht verfügbar',
      disclaimerDeclinedMessage:
        'Du hast den Haftungsausschluss des Chatbots abgelehnt. Akzeptiere die Bedingungen, um den Chatbot weiterhin zu verwenden.',
      showDisclaimerAgain: 'Haftungsausschluss erneut anzeigen',
      newConversation: 'Neue Konversation starten',
      confirmNewConversation: 'Neue Konversation wirklich starten',
      confirmNewConversationShort: 'Neu starten?',
      newConversationWait:
        'Warte, bis die aktuelle Antwort vollständig generiert wurde',
      newConversationArmed:
        'Bestätigung erforderlich: Aktiviere die Schaltfläche erneut, um eine neue Konversation zu starten.',
    },
    manageAssistant: {
      welcome: 'Hallo! Wie kann ich helfen?',
      manageContext: 'Verwalten',
      capabilitySearch: 'Kurse und Fragensammlung durchsuchen',
      capabilityDraft:
        'Single-Choice-, Multiple-Choice- und Freitextfragen entwerfen — sie werden erst nach Deiner Bestätigung in der Fragensammlung gespeichert',
      capabilityFeedback: 'Verbesserungen für Fragefeedback vorschlagen',
      capabilityDocumentation:
        'Funktionen von KlickerUZH anhand der Dokumentation und Anleitungen erklären',
      limitsNote:
        'Alles andere ist schreibgeschützt — der Assistent veröffentlicht nichts und bearbeitet keine bestehenden Inhalte.',
      proposalReview: {
        reviewLabel: 'Fragenentwurf prüfen',
        draftQuestion: 'Fragenentwurf',
        question: 'Frage',
        correctAnswer: 'Richtige Antwort',
        correctAnswers: 'Richtige Antworten',
        correct: 'Richtig',
        incorrect: 'Falsch',
        answerFeedback: 'Antwortfeedback',
        notProvided: 'Nicht angegeben',
        sampleSolution: 'Beispiellösung',
        maximumResponseLength: 'Maximale Antwortlänge: {maxLength} Zeichen',
        generalExplanation: 'Allgemeine Erklärung',
        singleChoice: 'Single Choice',
        multipleChoice: 'Multiple Choice',
        freeText: 'Freitext',
      },
    },
    ownerPreview: {
      badge: 'Eigentümer-Vorschau',
      description:
        'Teste die aktuelle Chatbot-Konfiguration. Dieses Gespräch wird nicht zu Deinen gespeicherten Gesprächen hinzugefügt.',
      backToManage: 'Zurück zu den Chatbot-Einstellungen',
      loginTitle: 'Anmeldung für Dozierende erforderlich',
      loginMessage:
        'Melde Dich in KlickerUZH Manage mit dem Konto an, dem dieser Chatbot gehört, um die Vorschau zu öffnen.',
      loginButton: 'KlickerUZH Manage öffnen',
      opensInNewTab:
        '(öffnet in einem neuen Tab; kehre nach der Anmeldung hierher zurück)',
    },
    recovery: {
      notFoundTitle: 'Chatbot nicht gefunden',
      notFoundMessage:
        'Dieser Chat-Link ist nicht mehr verfügbar. Kehre zu KlickerUZH zurück, um einen anderen Kurs oder Chatbot auszuwählen.',
      errorTitle: 'Chatbot nicht verfügbar',
      errorMessage:
        'Der Chatbot konnte nicht geladen werden. Versuche es erneut oder kehre zu KlickerUZH zurück.',
      retry: 'Erneut versuchen',
      openKlickerUzh: 'KlickerUZH öffnen',
    },
    branchPicker: {
      previous: 'Vorherige Variante',
      next: 'Nächste Variante',
    },
    historyRail: {
      label: 'Gesprächsverlauf',
      mobileLabel: 'Verlauf {current}/{total}',
      item: 'Eintrag {current} von {total}',
      itemRange: 'Einträge {start}-{end} von {total}',
      openHistory: 'Gesamten Verlauf öffnen',
      closeHistory: 'Gesamten Verlauf schliessen',
      turn: 'Gesprächsrunde',
      you: 'Du',
      assistant: 'Assistent',
      noText: 'Kein Text',
      noResponse: 'Noch keine Antwort',
      inProgress: 'In Bearbeitung',
      partial: 'Unvollständige Antwort',
      error: 'Fehler',
    },
    disclaimer: {
      mediaTitle: 'Haftungsausschluss-Medien',
      introAlt: 'Chatbot-Einführung',
      studentResponsibilityTitle: 'Verantwortung der Studierenden',
      studentResponsibilityText:
        'Antworten des Chatbots können mehr oder weniger Informationen enthalten, als zum Bestehen des Kurses erforderlich sind, und sind daher für sich genommen nicht prüfungsrelevant (nur das zugrunde liegende Kursmaterial ist es). Wir sind zwar bestrebt, über den Chatbot korrekte Informationen bereitzustellen, übernehmen jedoch keine Gewähr für die Richtigkeit, Vollständigkeit oder Aktualität der Antworten. Bitte überprüfe wichtige Informationen anhand der offiziellen Kursmaterialien und Quellen.',
      dataProtectionTitle: 'Datenschutz',
      dataProtectionText:
        'Teile keine persönlichen Informationen mit dem Chatbot. Deine Eingaben werden ausschliesslich über Azure-OpenAI-Instanzen verarbeitet, die in der EU oder in der Schweiz gehostet werden. Unterhaltungen können in anonymisierter Form vom KlickerUZH-Team oder Deinen Dozierenden überprüft werden, um die Qualität des Chatbots und die Kursinhalte zu verbessern.',
      consentText:
        'Durch die Nutzung des Chatbots erkennst Du diese Bedingungen an und akzeptierst sie. Bei Feedback oder Bedenken wende Dich bitte an Deine Dozierenden.',
      decline: 'Ablehnen',
      saving: 'Wird gespeichert...',
      acceptAndContinue: 'Akzeptieren und fortfahren',
      consequenceTitle: 'Was nach Deiner Wahl geschieht:',
      consequenceAccept:
        'Akzeptieren: Du kannst den Chatbot nutzen und auf alle Funktionen zugreifen.',
      consequenceDecline:
        'Ablehnen: Der Chatbot bleibt gesperrt und Du kannst keine Nachrichten senden.',
      actionError:
        'Es ist leider ein Fehler aufgetreten. Bitte versuche es erneut.',
    },
    markdown: {
      copyCode: 'Kopieren',
    },
    attachments: {
      hydrationError:
        'Die Bildanhänge für diese Nachricht konnten nicht geladen werden. Bitte versuche es erneut.',
      attachedImageAlt: 'Angehängtes Bild {index}',
    },
    imageViewer: {
      previewUnavailable: 'Vorschau nicht verfügbar',
      title: 'Bildanhang',
      loading: 'Vollständiges Bild wird geladen...',
      retry: 'Erneut versuchen',
    },
    threadList: {
      groupToday: 'Heute',
      groupYesterday: 'Gestern',
      groupThisWeek: 'Diese Woche',
      groupEarlier: 'Früher',
      newChatTitle: 'Neuer Chat',
      save: 'Speichern',
      cancel: 'Abbrechen',
      editName: 'Namen bearbeiten',
      deleteChat: 'Chat löschen',
      deleteConfirm: 'Löschen?',
      deleteConfirmAria: 'Löschen dieses Chats bestätigen',
      deleteArmedStatus:
        'Bestätigung erforderlich: Betätige Löschen erneut, um diesen Chat zu löschen.',
      emptyState: 'Starte Deine erste Konversation mit einer Nachricht.',
      loadError: 'Deine Chats konnten nicht geladen werden.',
      retry: 'Erneut versuchen',
      loading: 'Deine Chats werden geladen...',
    },
    thread: {
      viewportLabel: 'Gesprächsverlauf',
      scrollToBottom: 'Nach unten scrollen',
      loading: 'Die Konversation wird geladen...',
      thinking: 'Antwort wird vorbereitet …',
      runStarted: 'Antwort wird generiert …',
      runCompleted: 'Antwort abgeschlossen.',
      runStopped: 'Antwort gestoppt.',
      runFailed: 'Antwort fehlgeschlagen.',
      welcomeTitle: 'Willkommen!',
      welcomeTo: 'Du chattest mit {chatbot}.',
      welcomeSubtitle: 'Wähle einen Einstieg oder schreibe Deine eigene Frage.',
      welcomeMode: 'Ausgewählter Modus: {mode}',
    },
    suggestions: {
      sectionLabel: 'Gesprächseinstiege',
      editHint: 'Wähle einen Einstieg und passe ihn vor dem Senden an.',
      practiceTopic: 'Ein Thema üben',
      practiceTopicPrompt:
        'Ich möchte ein bestimmtes Thema aus den Kursunterlagen üben. Stelle mir eine Frage nach der anderen und gib mir Hinweise, statt die Antwort sofort zu verraten.',
      workThroughProblem: 'Eine Aufgabe bearbeiten',
      workThroughProblemPrompt:
        'Hilf mir, eine Aufgabe aus den Kursunterlagen Schritt für Schritt zu bearbeiten. Stell mir Fragen und gib mir Hinweise, bevor du die Lösung zeigst.',
      explainConcept: 'Ein Konzept erklären',
      explainConceptPrompt:
        'Erkläre ein schwieriges Konzept aus den Kursunterlagen in einfachen Worten, mit einem durchgerechneten Beispiel und Quellenangaben.',
      compareConcepts: 'Zwei Konzepte vergleichen',
      compareConceptsPrompt:
        'Vergleiche zwei Konzepte anhand der Kursunterlagen. Erkläre den wichtigsten Unterschied, wann welches Konzept gilt, und nenne die relevanten Quellen.',
    },
    message: {
      creditsUsed:
        '{count, plural, one {{credits} Credit} other {{credits} Credits}}',
      reasoningToggle: 'Denkprozess',
      editUnavailable: 'Bearbeiten nicht verfügbar',
      edit: 'Bearbeiten',
      editDisabledTooltip:
        'Bearbeiten nicht möglich: Das ausgewählte Modell unterstützt keine Bilder',
      copy: 'Kopieren',
      refresh: 'Aktualisieren',
      retry: 'Erneut versuchen',
      rateUp: 'Hilfreiche Antwort',
      rateDown: 'Keine hilfreiche Antwort',
      ratingError: 'Bewertung konnte nicht gespeichert werden.',
      stoppedNotice: 'Du hast diese Antwort gestoppt.',
      toolCallsGroupLabel:
        '{count, plural, one {1 Tool-Aufruf} other {{count} Tool-Aufrufe}}',
    },
    composer: {
      placeholder: 'Nachricht schreiben...',
      send: 'Nachricht senden',
      stop: 'Antwort stoppen',
      disclaimerHint:
        'Antworten des Chatbots können falsch sein — bitte anhand Deiner Kursmaterialien prüfen.',
      attachmentLimitError: 'Du kannst höchstens {max} Bilder anhängen.',
      attachmentReadError:
        'Das Bild konnte nicht gelesen werden. Bitte versuche es mit einer anderen Datei.',
      dismissError: 'Fehler schliessen',
      dropImages: 'Bilder zum Anhängen hier ablegen',
      attachmentPreviewAlt: 'Anhang-Vorschau',
      removeAttachment: 'Anhang entfernen',
      attachImage: 'Bild anhängen',
      attachmentFallbackLabel: 'Anhang',
      editCancel: 'Abbrechen',
      editSend: 'Senden',
    },
    toolFallback: {
      running: '{tool} wird verwendet...',
      done: '{tool} verwendet',
      failed: '{tool} fehlgeschlagen',
      showLess: 'Weniger anzeigen',
      showMore:
        '{count, plural, one {Mehr anzeigen (# weitere Zeile)} other {Mehr anzeigen (# weitere Zeilen)}}',
      docQueryQueryLabel: 'Suchanfrage',
      docQuerySourcesHint:
        'Die Treffer erscheinen als Quellen unter der Antwort.',
    },
    tools: {
      searchingCourseMaterial: 'Kursmaterialien werden durchsucht...',
      searchedCourseMaterial: 'Kursmaterialien durchsucht',
      searchedCourseMaterialEmpty: 'Kursmaterialien durchsucht · keine Treffer',
      searchCourseMaterialFailed: 'Suche in Kursmaterialien fehlgeschlagen',
      imageAnalyzed: 'Bild analysiert',
    },
    sources: {
      title: 'Quellen',
      page: 'S. {page}',
      video: 'Video',
      image: 'Bild',
    },
    citations: {
      label: 'Quelle {index}: {title}',
      goToSource: 'Zur Quelle springen',
    },
    noLogin: {
      title: 'Anmeldung erforderlich',
      message:
        'Du musst ein KlickerUZH-Konto erstellen oder Dich anmelden, bevor Du auf diesen Chatbot zugreifen kannst.',
      redirectNotice: 'Nach der Anmeldung kehrst Du zu diesem Chatbot zurück.',
      loginButton: 'Zur KlickerUZH-Anmeldung',
    },
    response: {
      errorLabel: 'Fehler',
      networkError:
        'Der Server konnte leider nicht erreicht werden. Bitte überprüfe Deine Verbindung und versuche es erneut.',
      genericError:
        'Es ist leider ein Fehler beim Verarbeiten Deiner Anfrage aufgetreten. Bitte versuche es erneut.',
      connectionInterrupted:
        'Verbindung unterbrochen — die Antwort ist möglicherweise unvollständig.',
      truncated:
        'Antwort gekürzt — schreibe «weiter» oder bitte um eine kürzere Antwort.',
    },
  },
  shared: {
    table: {
      download: 'Als CSV herunterladen',
      noResults: 'Keine Ergebnisse.',
      previous: 'Zurück',
      next: 'Weiter',
    },
    questions: {
      roundedTo: 'Rundet auf {accuracy} Nachkommastellen.',
      numInvalidValue:
        'Der eingegebene Wert ist keine Zahl oder liegt nicht im vorgegebenen Bereich.',
      ftPlaceholder: 'Ihre Antwort...',
      seSelectOption: 'Antwort eingeben & auswählen...',
      seSelectNCorrectOptions:
        'Bitte wählen Sie <b>{number} korrekte Antwort-Optionen</b> aus der vorgegebenen Liste.',
      seCorrectAnswerN: 'Antwort {number}',
      noMatchingOptionFound: 'Keine passende Option gefunden.',
    },
    DRAFT: {
      statusLabel: 'Entwurf',
    },
    SCHEDULED: {
      statusLabel: 'Geplant',
    },
    PUBLISHED: {
      statusLabel: 'Öffentlich / Laufend',
      statusLabel1: 'Öffentlich',
      statusLabel2: 'Laufend',
    },
    ENDED: {
      statusLabel: 'Abgeschlossen / Bereit zur Bewertung',
      statusLabel1: 'Abgeschlossen',
      statusLabel2: 'Bereit zur Bewertung',
    },
    GRADED: {
      statusLabel: 'Bewertet',
    },
    TEMPLATE: {
      statusLabel: 'Vorlage',
    },
    REVIEW: {
      statusLabel: 'Review',
    },
    READY: {
      statusLabel: 'Bereit',
    },
    SC: {
      short: 'SC',
      typeLabel: 'Single Choice (SC)',
      text: 'Bitte eine einzige Option auswählen.',
      richtext: 'Bitte <b>eine einzige</b> Option auswählen.',
    },
    MC: {
      short: 'MC',
      typeLabel: 'Multiple Choice (MC)',
      text: 'Bitte eine oder mehrere Optionen auswählen.',
      richtext: 'Bitte <b>eine oder mehrere</b> Optionen auswählen.',
    },
    KPRIM: {
      short: 'KP',
      typeLabel: 'Kprim (KP)',
      text: 'Beurteile die Aussagen auf ihre Richtigkeit.',
      richtext: 'Beurteile die Aussagen auf ihre <b>Richtigkeit</b>.',
    },
    FREE_TEXT: {
      short: 'FT',
      typeLabel: 'Freitext (FT)',
      text: 'Bitte eine Antwort eingeben.',
      richtext: 'Bitte eine <b>Antwort</b> eingeben.',
    },
    NUMERICAL: {
      short: 'NR',
      typeLabel: 'Numerisch (NR)',
      text: 'Bitte eine Zahl eingeben.',
      richtext: 'Bitte eine <b>Zahl</b> eingeben.',
    },
    CONTENT: {
      short: 'CT',
      typeLabel: 'Inhalt (CT)',
    },
    FLASHCARD: {
      short: 'FC',
      typeLabel: 'Lernkarte (FC)',
    },
    SELECTION: {
      short: 'SE',
      typeLabel: 'Auswahl (SE)',
      text: 'Bitte wählen Sie die richtigen Antworten aus der Liste.',
      richtext:
        'Bitte wählen Sie die <b>richtigen Antworten</b> aus der Liste.',
    },
    CASE_STUDY: {
      short: 'CS',
      typeLabel: 'Fallstudie (CS)',
      text: 'Bitte bewerten Sie alle Möglichkeiten auf die vorgegebenen Kriterien.',
      richtext:
        'Bitte bewerten Sie alle Möglichkeiten auf die vorgegebenen Kriterien.',
    },
    login: {
      installButton: 'Jetzt installieren',
    },
    comments: {
      title: 'Kommentare',
      viewComments: 'Kommentare anzeigen',
      noActivity: 'Noch keine Aktivität',
      noUnresolvedActivity: 'Keine unerledigten Nachrichten',
      addMessage:
        'Fügen Sie eine Nachricht hinzu, um eine Unterhaltung zu beginnen',
      messageInputPlaceholder: 'Nachricht schreiben...',
      sending: 'Senden...',
      send: 'Senden',
      tooltip: 'Kommentare anzeigen',
      markResolved: 'Als erledigt markieren',
      markUnresolved: 'Als unerledigt markieren',
      resolved: 'Erledigt',
      hideResolved: 'Erledigte Nachrichten ausblenden',
      resolvedAt: 'Erledigt {time}',
      messageMESSAGE: '',
      messageCREATION: '{username} hat dieses Objekt erstellt.',
      messageMODIFICATION:
        '{username} hat {field} geändert ({oldValue} -> {newValue}).',
      messageSHARING: '', // TODO: implement once available
      fieldtitle: 'Titel',
      fieldstatus: 'Status',
      fieldcontent: 'Inhalt',
    },
    generic: {
      date: 'Datum',
      percentage: 'Prozent',
      status: 'Status',
      groupMessages: 'Gruppennachrichten',
      preferred: 'bevorzugt',
      groupSize: 'Gruppengrösse',
      courseDuration: 'Kursdauer',
      enabled: 'Aktiviert',
      disabled: 'Deaktiviert',
      download: 'Herunterladen',
      profile: 'Profil',
      shortname: 'Kurzname',
      yes: 'Ja',
      no: 'Nein',
      draft: 'Entwurf',
      scheduled: 'Geplant',
      published: 'Öffentlich',
      completed: 'Abgeschlossen',
      running: 'Laufend',
      grading: 'Bewertung',
      points: 'Punkte',
      pointsSmall: 'Punkte',
      title: 'KlickerUZH',
      send: 'Absenden',
      next: 'Weiter',
      submit: 'Absenden',
      save: 'Speichern',
      start: 'Starten',
      startNoun: 'Start',
      end: 'Ende',
      continue: 'Weiter',
      cancel: 'Abbrechen',
      confirm: 'Bestätigen',
      close: 'Schliessen',
      approve: 'Genehmigen',
      apply: 'Anwenden',
      sendAnswer: 'Antwort senden',
      begin: 'Beginnen',
      finish: 'Abschliessen',
      logout: 'Ausloggen',
      openApplication: 'Anwendung öffnen',
      login: 'Login',
      username: 'Benutzername',
      usernameOrEmail: 'Benutzername / E-Mail',
      email: 'E-Mail Adresse',
      password: 'Passwort',
      token: 'Token',
      passwordRepetition: 'Passwort (Wiederholung)',
      signin: 'Anmelden',
      usernameError: 'Bitte geben Sie Ihren Nutzernamen oder E-Mail ein.',
      passwordError: 'Bitte geben Sie Ihr Passwort ein.',
      studentLoginError:
        'Nutzername/E-Mail oder Passwort sind falsch. Falls Sie Ihr Passwort vergessen haben, nutzen Sie bitte die "E-Mail Login" Funktion.',
      usernameAvailability: 'Dieser Benutzername ist nicht verfügbar.',
      systemError: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
      error: 'Fehler',
      back: 'Zurück',
      home: 'Home',
      questions: 'Fragen',
      question: 'Frage',
      activities: 'Aktivitäten',
      element: 'Element',
      block: 'Block',
      stack: 'Stack',
      feedbacks: 'Feedbacks',
      feedback: 'Feedback',
      explanation: 'Erklärung',
      leaderboard: 'Leaderboard',
      repetition: 'Repetition',
      evaluation: 'Auswertung',
      liveQuiz: 'Live Quiz',
      liveQuizzes: 'Live Quizzes',
      practiceQuiz: 'Übungs-Quiz',
      practiceQuizzes: 'Übungs-Quizzes',
      microlearnings: 'Microlearnings',
      microlearning: 'Microlearning',
      activeLiveQuizzes: 'Aktive Live Quizzes',
      assessmentLiveQuizzes: 'Assessment Live Quizzes',
      activePracticeQuizzes: 'Aktive Übungs-Quizzes',
      activeMicroLearnings: 'Aktive Microlearnings',
      groupActivity: 'Gruppenaktivität',
      groupActivities: 'Gruppenaktivitäten',
      loading: 'Lädt...',
      characters: 'Zeichen',
      precision: 'Präzision',
      unit: 'Einheit',
      min: 'Min',
      minLong: 'Minimum',
      max: 'Max',
      maxLong: 'Maximum',
      lowerEnd: 'Untergrenze',
      midValue: 'Zentralwert',
      upperEnd: 'Obergrenze',
      steps: 'Schritte',
      textInput: 'Texteingabe',
      free: 'Frei',
      congrats: 'Gratulation!',
      thanks: 'Vielen Dank!',
      bookmark: 'Bookmark',
      bookmarks: 'Bookmarks',
      group: 'Gruppe',
      create: 'Erstellen',
      join: 'Beitreten',
      leave: 'Austreten',
      documentation: 'Dokumentation',
      community: 'Community',
      roadmap: 'Roadmap',
      features: 'Features',
      experiencePoints: 'Erfahrungspunkte',
      level: 'Level',
      levelX: 'Level: {number}',
      solution: 'Lösung',
      sampleSolution: 'Musterlösung',
      gamification: 'Gamifizierung',
      interaction: 'Interaktion',
      basePoints: 'Basispunkte',
      awardedPoints: 'Vergebene Punkte',
      additionalPoints: 'Zusätzliche Punkte',
      correctnessPoints: 'Korrektheitspunkte',
      bonusPoints: 'Bonuspunkte',
      scoring: 'Punktevergabe',
      liveQA: 'Live-Q&A',
      moderation: 'Moderation',
      feedbackChannel: 'Feedback-Channel',
      multiplier: 'Multiplikator',
      options: 'Optionen',
      correct: 'Richtig',
      delete: 'Löschen',
      edit: 'Bearbeiten',
      duplicate: 'Duplizieren',
      preview: 'Vorschau',
      createdAt: 'Erstellt am {date}',
      updatedAt: 'Editiert am {date}',
      startAt: 'Start am {time}',
      endAt: 'Endet am {time}',
      finishedAt: 'Beendet am {time}',
      introduction: 'Einführung',
      information: 'Information',
      description: 'Beschreibung',
      settings: 'Einstellungen',
      activitySettings: 'Aktivitätseinstellungen',
      course: 'Kurs',
      courses: 'Kurse',
      availableFrom: 'Verfügbar ab',
      startDate: 'Startdatum',
      endDate: 'Enddatum',
      repetitionInterval: 'Wiederholungszeitraum',
      order: 'Reihenfolge',
      link: 'Link',
      respond: 'Antworten',
      responses: 'Antworten',
      update: 'Update',
      recompute: 'Neu berechnen',
      ok: 'OK',
      language: 'Sprache',
      en: 'Englisch',
      enShort: 'en',
      de: 'Deutsch',
      deShort: 'de',
      practicePool: 'Üben',
      practiceTitle: 'Übungspool',
      practice: 'Übungs-Quiz',
      clues: 'Hinweise',
      server: 'Server',
      value: 'Wert',
      passed: 'Bestanden',
      failed: 'Nicht bestanden',
      survey: 'Umfrage',
      avatar: 'Avatar',
      gamified: 'Gamifiziert',
      nonGamified: 'Nicht gamifiziert',
      blockN: 'Block {number}',
      elementN: 'Element {number}',
      Nelements: '{number} Element(e)',
      stackN: 'Stack {number}',
      questionN: 'Frage {number}',
      clueN: 'Hinweis {number}',
      availability: 'Verfügbarkeit',
      taskDescription: 'Aufgabenstellung',
      color: 'Farbe',
      groups: 'Gruppen',
      pleaseReview:
        'Bitte beachten Sie die folgenden Hinweise. Diese Aktion kann nicht rückgängig gemacht werden.',
      comingSoon: 'Coming soon...',
      pinCode: 'PIN Code',
      forgotPassword: 'Passwort vergessen?',
      archive: 'Archiv',
      archived: 'Archiviert',
      ended: 'Beendet',
      assessment: 'Assessment',
      pin: 'PIN',
      pinProtected: 'PIN geschützt',
      learningAnalytics: 'Learning Analytics',
      monday: 'Montag',
      tuesday: 'Dienstag',
      wednesday: 'Mittwoch',
      thursday: 'Donnerstag',
      friday: 'Freitag',
      saturday: 'Samstag',
      sunday: 'Sonntag',
      mean: 'Mittelwert',
      median: 'Median',
      q1: 'Q1',
      q3: 'Q3',
      weeks: 'Wochen',
      student: 'Studierende(r)',
      activity: 'Aktivität',
      featurePreview: 'Feature-Vorschau',
      new: 'Neu',
      search: 'Suche',
      accept: 'Akzeptieren',
      decline: 'Ablehnen',
      user: 'Nutzer',
      correctness: 'Korrektheit',
      answerCollection: 'Antwort-Sammlung',
      users: 'Nutzer',
      unknown: 'Unbekannt',
      name: 'Name',
      minimum: 'Minimum',
      maximum: 'Maximum',
      stepSize: 'Schrittweite',
      criterion: 'Kriterium',
      criteria: 'Kriterien',
      minimumShort: 'Min',
      maximumShort: 'Max',
      step: 'Schritt',
      case: 'Fall',
      cases: 'Fälle',
      entries: 'Einträge',
      content: 'Inhalt',
      instructions: 'Anweisungen',
      caseStudyItems: 'Fallstudien-Elemente',
      results: 'Resultate',
      never: 'Nie',
      actions: 'Aktionen',
      object: 'Objekt',
      read: 'Lesen',
      execute: 'Ausführen',
      write: 'Schreiben',
      admin: 'Admin',
      owner: 'Besitzer',
      userGroup: 'Benutzergruppe',
      permissionLevel: 'Zugriffsrechte',
      template: 'Vorlage',
      noPoints: 'keine Punkte',
      criterionN: 'Kriterium {number}',
      propagation: 'Propagation',
      sharing: 'Sharing',
      shared: 'Geteilt',
      imported: 'Importiert',
      dependency: 'Abhängigkeit',
      tryAgain: 'Erneut versuchen',
      legend: 'Legende',
      collections: 'Sammlungen',
      objects: 'Objekte',
      pseudonym: 'Pseudonym',
      selected: 'Ausgewählt',
      seconds: 'Sekunden',
      moreInformation: 'Mehr Informationen',
      today: 'Heute',
      month: 'Monat',
      week: 'Woche',
      day: 'Tag',
      total: 'Total',
      reviewStatus: 'Review-Status',
      reviewStatusINCOMPLETE: 'Review ausstehend',
      reviewStatusREVIEWED: 'Gereviewt',
      reviewStatusMODIFIED_AFTER_REVIEW: 'Nach Review verändert',
      modifiedAfterReviewInformation:
        'Der Inhalt dieses Objekts wurde nach dem letzten Review verändert. Bitte markieren Sie dieses erneut als gereviewt, wenn Sie mit dem aktualisierten Inhalt einverstanden sind.',
      availableActions: 'Verfügbare Aktionen',
      configuration: 'Konfiguration',
      unknownUser: 'Unbekannter Nutzer',
      deletedUser: 'Gelöschter Nutzer',
      correction: 'Korrektur',
      filter: 'Filter',
      listExamples: 'z.B.',
    },
    types: {
      ACTIVITIES: 'Aktivitäten',
      LIVE_QUIZ: 'Live Quiz',
      LIVE_QUIZ_TEMPLATE: 'Live Quiz Vorlage',
      PRACTICE_QUIZ: 'Übungs-Quiz',
      PRACTICE_QUIZ_TEMPLATE: 'Übungs-Quiz Vorlage',
      MICRO_LEARNING: 'Microlearning',
      MICRO_LEARNING_TEMPLATE: 'Microlearning Vorlage',
      GROUP_ACTIVITY: 'Gruppenaktivität',
      GROUP_ACTIVITY_TEMPLATE: 'Gruppenaktivität Vorlage',
      ANSWER_COLLECTION: 'Antwort-Sammlung',
      CATALOG_COLLECTION: 'Katalog-Sammlung',
      ELEMENT: 'Element',
      COURSE: 'Kurs',
      SC: 'Single Choice Frage',
      MC: 'Multiple Choice Frage',
      KPRIM: 'Kprim Frage',
      NUMERICAL: 'Numerische Frage',
      FREE_TEXT: 'Freitext Frage',
      SELECTION: 'Auswahl Frage',
      CASE_STUDY: 'Fallstudie',
      FLASHCARD: 'Lernkarte',
      CONTENT: 'Inhaltselement',
    },
    short: {
      LIVE_QUIZ: 'LQ',
      PRACTICE_QUIZ: 'ÜQ',
      MICRO_LEARNING: 'ML',
      GROUP_ACTIVITY: 'GA',
    },
    contentInput: {
      boldStyle:
        'Wählen Sie diese Einstellung für fetten Text. Das gleiche kann auch mit der Standard Tastenkombination cmd/ctrl+b erreicht werden.',
      italicStyle:
        'Wählen Sie diese Einstellung für kursiven Text. Das gleiche kann auch mit der Standard Tastenkombination cmd/ctrl+i erreicht werden.',
      codeStyle: 'Wählen Sie diese Einstellung für Code-Styling.',
      citationStyle:
        'Wählen Sie diese Option, um ein Zitat einzufügen. Beachten Sie hier, dass aktuell neue Paragraphen (durch einen Zeilenumbruch / Enter) als separate Zitate dargestellt werden.',
      numberedList:
        'Diese Option erzeugt eine nummerierte Liste. Um neue Punkte zu erstellen, fügen Sie einfach nach einem bestehenden Element eine neue Zeile ein. Um zu Standard-Text zurückzukehren, drücken Sie diesen Knopf erneut.',
      unnumberedList:
        'Diese Option erzeugt eine nicht-nummerierte Liste. Um neue Punkte zu erstellen, fügen Sie einfach nach einem bestehenden Element eine neue Zeile ein. Um zu Standard-Text zurückzukehren, drücken Sie diesen Knopf erneut.',
      image:
        'Wählen Sie diese Einstellung, um ein Bild einzubinden. Benutzen Sie dieselbe Schreibweise, um Formeln in Antortmöglichkeiten einzubinden.',
      video: 'Binden Sie ein YouTube- oder Kaltura-Video ein.',
      videoUrl: 'YouTube- oder Kaltura-URL',
      videoUrlPlaceholder: 'YouTube- oder Kaltura-Video-URL einfügen',
      videoUrlInvalid:
        'Geben Sie eine gültige YouTube- oder Kaltura-Video-URL ein.',
      insertVideo: 'Video einfügen',
      latex:
        'Wählen Sie diese Einstellung, um eine LaTeX-Formel inline einzubinden. Benutzen Sie dieselbe Schreibweise, um Formeln in Antortmöglichkeiten einzubinden.',
      latexCentered:
        'Wählen Sie diese Einstellung, um eine LaTeX-Formel zentriert auf einer separaten Zeile einzubinden.',
    },
    leaderboard: {
      lqLeaderboard: 'Quiz Leaderboard',
      ranks: 'Ränge',
      points: 'Punkte',
      computed: 'Berechnet',
      collected: 'Gesammelt',
      pointsCollected: 'Punkte (gesammelt)',
      participantCount: 'Anzahl Teilnehmende: {number}',
      groupCount: 'Anzahl Gruppen: {number}',
      averagePoints: 'Durchschnittliche Punkte: {number}',
      noPointsCollected:
        'Bisher wurden im Rahmen dieses Live Quizzes noch keine Punkte gesammelt. Sobald sich dies ändert, werden hier Podium und Rangliste angezeigt.',
      liveQuizGamifiedNoGamifiedCourse:
        'Dieses Live Quiz ist gamifiziert, aber nicht Teil eines gamifizierten Kurses. Da Sie angemeldet sind, werden Ihre im Quiz gesammelten Punkte automatisch auf dem Leaderboard angezeigt. Sollten Sie dies nicht wünschen, <logout>melden Sie sich bitte ab</logout> und treten Sie dem Quiz erneut über den Link bei.',
      liveQuizGamifiedCourseNoParticipation:
        'Dieses Live Quiz ist Teil eines gamifizierten Kurses. Da Sie diesem Kurs nicht beigetreten sind, werden Sie nur im Rahmen dieses Quizzes Punkte sammeln. Ihre Punkte erscheinen auf dem Quiz-Leaderboard. Sollten Sie dies nicht wünschen, <logout>melden Sie sich bitte ab</logout> und treten Sie dem Quiz erneut über den Link bei.',
      liveQuizCourseParticipationInactive:
        'Dieses Live Quiz ist Teil eines gamifizierten Kurses, aber Sie nehmen derzeit nicht an der Gamifizierung teil. Um dem Leaderboard beizutreten und Punkte in diesem Quiz zu sammeln, treten Sie dem <link>Leaderboard auf der Kursübersicht</link> bei und kehren Sie zum Quiz zurück.',
      liveQuizGamifiedAssessment:
        'Diese Live Quiz ist gamifiziert und gleichzeitig Teil eines Assessment-Kurses. Um nicht mit Ihrem Pseudonym auf dem Leaderboard zu erscheinen, gehen Sie bitte in die Profileinstellungen und stellen Sie die Anzeigeoption Ihres Profils entsprechend um.',
      rank: 'Rang',
      username: 'Nutzername',
      email: 'E-Mail',
    },
    error: {
      '404': '404 Seite nicht gefunden',
      pwaWithoutUser:
        'Die von Ihnen aufgerufene Seite existiert leider nicht. Sie können sich <login>anmelden</login>, um eine Übersicht aller Klicker-Elemente Ihrer Kurse zu sehen.',
      pwaWithUser:
        'Die von Ihnen aufgerufene Seite existiert leider nicht. Sehen Sie sich eine <home>Übersicht</home> aller Klicker-Elemente Ihrer Kurse an.',
      offlineHint:
        'Sie scheinen im Moment offline zu sein. Verbinden Sie Ihr Gerät mit dem Internet, um die KlickerUZH App nutzen zu können.',
    },
  },
  auth: {
    authentication: 'Authentifizierung',
    delegatedAccess: 'Delegierter Zugriff',
    signedInAs: 'Sie sind bereits eingelogged als {username}',
    tosAgreement:
      'Ich akzeptiere die KlickerUZH <tos></tos> (aktualisiert am 26.08.2023) und <privacy></privacy> (aktualisiert am 26.08.2023).',
    tosAgreementRequired:
      'Bitte akzeptieren Sie die Nutzungsbedingungen und Datenschutzerklärung, bevor Sie sich einloggen.',
    termsOfService: 'Nutzungsbedingungen',
    privacyPolicy: 'Datenschutzerklärung',
    tosUrl: 'https://www.klicker.uzh.ch/nutzungsbedingungen',
    privacyUrl: 'https://www.klicker.uzh.ch/datenschutz',
    loginInfo:
      'Sie müssen sich nur hier einloggen, wenn Sie eigene Aktivitäten und Kurse erstellen möchten, nicht um an solchen teilzunehmen.',
  },
  pwa: {
    general: {
      magicLinkLogin: 'Login mit E-Mail',
      passwordLogin: 'Login mit Passwort',
      magicLinkSent:
        'Falls ein Account existiert, wurde ein einmaliger Login-Link an die hinterlegte E-Mail Adresse gesendet.',
      activationMailSent:
        'Ein Aktivierungslink wurde an die E-Mail Adresse gesendet. Bitte überprüfen Sie Ihren Posteingang.',
      processingLogin:
        'Ihr E-Mail Login wird verarbeitet. Bitte warten Sie einen Moment.',
      processingActivation:
        'Ihr Account-Aktivierung wird verarbeitet. Bitte warten Sie einen Moment.',
      magicLinkLoginFailed:
        'Der E-Mail Login ist fehlgeschlagen. Sie werden auf die Login-Seite weitergeleitet.',
      accountActivationFailed:
        'Die Account-Aktivierung ist fehlgeschlagen. Sie werden auf die Login-Seite weitergeleitet.',
      waitingForActivation:
        'Ihr Account wurde erstellt. Bitte überprüfen Sie Ihren Posteingang auf einen Aktivierungslink.',
      myCourses: 'Meine Kurse',
      myAssessmentCourses: 'Meine Assessment-Kurse',
      noAssessmentCourseAssignments:
        'Sie wurden bisher zu keinen Assessment-Kursen hinzugefügt. Bitte wenden Sie sich an Ihre Dozierenden.',
      insights: 'Einblicke',
      timeline: 'Zeitachse',
      myBookmarks: 'Meine Bookmarks',
      joinCourse: 'Kurs beitreten',
      setupProfile: 'Profil einrichten',
      openInBrowser: 'In Browser öffnen',
      selectCourse: 'Kurs auswählen',
      setup: 'Log-in und KlickerUZH-App',
      appSetup: 'Installation der KlickerUZH-App',
      firstLogin: 'Erstmaliges Login und Profileinrichtung',
      polls: 'Umfragen',
      liveQA: 'Live-Q&A',
      userNotLoggedIn:
        'Sie sind aktuell nicht eingeloggt. <login>Loggen Sie sich bitte ein</login>, falls Sie Punkte und XP sammeln und eine Übersicht über Ihren Lernfortschritt sehen möchten.',
      userNotLoggedInFrame:
        'Sie sind aktuell nicht eingeloggt. Bitte loggen Sie sich über die Plattform ein, in der diese Seite eingebettet ist, falls Sie Punkte und XP sammeln und eine Übersicht über Ihren Lernfortschritt sehen möchten.',
      noLiveQuizzesActive: 'Keine Live Quizzes aktiv.',
      activeLiveQuizzesBy: 'Aktive Live Quizzes von {name}',
      activeLiveQuizzesInCourse: 'Aktive Live Quizzes in {name}',
      noPracticeQuizzesActive: 'Keine Übungs-Quizzes aktiv.',
      activePracticeQuizzesInCourse: 'Aktive Übungs-Quizzes in {name}',
      noMicroLearningsActive: 'Keine Microlearnings aktiv.',
      activeMicroLearningsInCourse: 'Aktive Microlearnings in {name}',
      joinLeaderboardNotice: `
🎊 Herzlich willkommen, {username}, zum Kurs "{courseName}" 🎊

Du nimmst derzeit **nicht** an der Kursrangliste teil. Das bedeutet, dass Du an allen Aktivitäten teilnehmen kannst, aber keine Punkte sammeln, nicht in der Rangliste aufgeführt werden und nicht für Erfolge und Auszeichnungen in Frage kommst. Wenn Du an den spielerischen Aktivitäten in diesem Kurs teilnehmen möchtest, **klicke auf die Schaltfläche** unten, um teilzunehmen. Du kannst die Kursrangliste jederzeit verlassen, wobei alle gesammelten Punkte **gelöscht** werden.

Andere Teilnehmende sehen nur Dein öffentliches **Teilnehmendenprofil**, einschließlich Deines Pseudonyms und der Gesamtpunktzahl/Erfolge in den Ranglisten. Du kannst Dein Profil vor anderen Teilnehmern verbergen, aber trotzdem an der Rangliste teilnehmen, wenn Du dies wünschst (siehe [hier](/editProfile)).
`,
      activityPreview:
        'Sie sehen eine Vorschau der Aktivität {activity} "{name}" (Anzeigename "{displayName}"). Bitte beachten Sie, dass diese Vorschau als Test-Ansicht für Dozierende konzipiert wurde. Während die meisten Interaktionsfunktionalitäten unterstützt werden, werden keine eingereichten Antworten gespeichert oder in der Auswertungsansicht angezeigt.',
    },
    chatbot: {
      loginRequiredMessage:
        'Für diesen Chatbot benötigen Sie ein KlickerUZH-Konto. Bitte melden Sie sich an oder erstellen Sie zuerst ein Konto.',
      goToLogin: 'Zum Login',
      openCourseChat: 'KI-Tutor',
      participationRequiredMessage:
        'Ihre Kursteilnahme für diesen Chatbot konnte nicht eingerichtet werden. Öffnen Sie den Kurs in OLAT/KlickerUZH und treten Sie ihm bei, bevor Sie es erneut versuchen.',
      goToCourse: 'Kurs öffnen',
      courseChat: 'Kurs-Chatbot',
      selectChatbot: 'Chatbot auswählen',
      openInNewTab: 'Chat in neuem Tab öffnen',
      activeContext: 'Nutzt den aktuellen Seitenkontext',
      questionContext: 'Frage {currentStep}/{totalSteps}',
      noCourseChatbot: 'Für diesen Kurs ist noch kein Kurs-Chatbot verfügbar.',
      retrieval: {
        searching: 'Vorlesungsinhalte werden nach „{query}“ durchsucht…',
        errorTitle: 'Suche nicht verfügbar',
        errorDescription:
          'Die Vorlesungsinhalte konnten nicht durchsucht werden. Bitte versuchen Sie es erneut.',
        contentTitle: 'Vorlesungsinhalte',
        questionLabel: 'Frage',
        noContent: 'Keine Inhalte verfügbar',
      },
    },
    insights: {
      noCourseDataAvailable:
        'Es sind noch keine Kurse mit Zeitachsen-Daten verfügbar. Bitte treten Sie hierfür zuerst einem Kurs bei und nehmen Sie an Aktivitäten teil.',
      totalPoints: 'Gesamtpunkte',
      totalXp: 'Gesamte XP',
      completed: 'Abgeschlossen',
      upcoming: 'Bevorstehend',
      ongoing: 'Laufend',
    },
    createAccount: {
      dataProcessingTitle: 'Datenverarbeitung und Datenschutz',
      dataCollectionTitle: 'Welche Daten werden über mich gesammelt?',
      dataCollectionNotice:
        'Wir erfassen und speichern die Profilinformationen Deines erstellten Teilnehmendenkontos (z. B. E-Mail, Pseudonym, Passwort) sowie die Daten, die bei Deinen Interaktionen mit Kursen (z. B. erstellte Gruppen) und abgeschlossenen Aktivitäten (z. B. Antworten auf gestellte Fragen) anfallen. Wenn Du Dich entscheidest, an der optionalen Rangliste als Teil eines Kurses teilzunehmen, erfassen und speichern wir zusätzlich die gesammelten Punktzahlen als Teil aller Aktivitäten.',
      dataSharingTitle: 'Wie werden meine Daten geteilt?',
      dataSharingNotice: `
Wenn Du ein Konto erstellst und an Kursen und Aktivitäten mit KlickerUZH teilnimmst, können die Besitzer der KlickerUZH-Konten, die mit Deinen Kursen verbunden sind, Deine **E-Mail-Adresse** zusammen mit einigen Informationen über die KlickerUZH-Aktivitäten, an denen Du teilgenommen hast, sehen und diese Informationen möglicherweise für den Unterricht ihres Kurses mit KlickerUZH oder, in **anonymisierter** Form, für Forschungszwecke außerhalb von KlickerUZH verwenden. Sie sind verpflichtet, Dich über eine solche Verwendung Deiner Daten neben der Verwendung innerhalb von KlickerUZH zu informieren.

Der **detaillierte Inhalt** Deiner Fragen (z.B. in Live Q&A) oder Antworten (z.B. in Quiz) wird nur in **aggregierter oder anonymisierter Form** an die Besitzer der KlickerUZH-Konten weitergegeben. Nur **nicht-sensitive** Informationen wie die Anzahl der Interaktionen mit und die gesammelten Punkte bei Aktivitäten, wenn Du Dich für die Teilnahme an der Bestenliste entscheidest, werden in identifizierbarer Form weitergegeben.

Deine Daten werden niemals an weitere Parteien weitergegeben und nicht für kommerzielle Zwecke (z. B. Marketing) verwendet.`,
      dataUsageTitle: 'Wie werden meine Daten genutzt?',
      dataUsageNotice:
        'Deine Daten werden verwendet, um die von KlickerUZH zur Verfügung gestellten Funktionalitäten bereitzustellen. Eine weitere Auswertung der gesammelten Daten außerhalb der KlickerUZH-Plattform darf nur in anonymisierter Form und nur zu Zwecken der Lehre und Forschung erfolgen. Die Lehrenden sind verpflichtet, Dich in angemessener Weise über die Forschung zu informieren, die mit Deinen gesammelten Daten durchgeführt wird.',
      dataStorageTitle: 'Wie lange werden meine Daten gespeichert?',
      dataStorageNotice:
        'Deine Kontodaten, wie z.B. Profilinformationen, Erfolge und Erfahrungspunkte sowie Antworten, die du auf Fragen im KlickerUZH gibst, werden für die Lebenszeit Deines Kontos gespeichert. Deine Punkte und Platzierungen bei Kursaktivitäten und Bestenlisten werden so lange gespeichert, wie Du an der jeweiligen Kursrangliste teilnimmst. Du kannst jederzeit die Löschung Deiner Daten und Deines Kontos beantragen.',
      confirmationMessage:
        'Ich stimme den KlickerUZH [Datenschutzbestimmungen](https://www.klicker.uzh.ch/privacy_policy) und [Nutzungsbedingungen](https://www.klicker.uzh.ch/terms_of_service) zu und erkläre mich mit der darin beschriebenen Verarbeitung meiner Daten einverstanden. Mir ist bewusst, dass ich anonym und ohne Konto an den Lernaktivitäten teilnehmen kann, wenn ich diesen Bedingungen nicht zustimme.',
    },
    studentDocs: {
      assessmentInstanceWarning:
        'Bitte beachten Sie, dass Sie sich aktuell in der <b>Assessment-Instanz</b> von KlickerUZH befinden. Die nachfolgende Dokumentation bezieht sich auf die reguläre Studierenden-Applikation, welche sich von der Assessment-Instanz unterscheiden kann.',
      pageList: `
In dieser Dokumentation finden Sie die wichtigsten Informationen zu KlickerUZH in Ihrem Kurs:

- [Features im Überblick](docs/features)
- [Erster Login & Accounteinrichtung](docs/login)
- [App Installation](docs/appSetup)
      `,
      featuresTitle: 'Features im Überblick',
      features: `
KlickerUZH bietet Ihnen als Kursteilnehmende eine umfassende Reihe von Funktionalitäten. Diese Übersicht fasst die wichtigsten davon zusammen. Welche Funktionen konkret zur Verfügung stehen, hängt von den durch Ihre Dozierenden bereitgestellten Inhalten ab (z. B. ob Gruppenaktivitäten oder eine Challenge aktiviert sind) und wird Ihnen direkt von diesen mitgeteilt.

#### Umfragen und Live-Quiz

![Live-Quiz _auf der linken Seite_](/img/06_live_quiz.png)

Während der Vorlesung können Sie die von den Dozierenden in Live Quizzes gestellten Fragen in der KlickerUZH-App, über Ihr LMS (z. B. OLAT unter dem Modul "Live Quiz") oder direkt unter
\`https://pwa.klicker.uzh.ch/join/&lt;shortname&gt;\` beantworten. Die Resultate werden live in der Auswertung angezeigt und können nach Ablauf der Antwortzeit präsentiert und kommentiert werden.

Zur Teilnahme an einem Live Quiz benötigen Sie keinen Login. Mit einem KlickerUZH‑Account können Sie jedoch an der Kurs‑Challenge teilnehmen und Punkte sammeln. Falls verfügbar, können Sie auch dem KlickerUZH‑Kurs mit Ihrem Klicker‑Account beitreten, sodass Ihnen direkt eine Liste aller laufenden Live‑Quizzes angezeigt wird.
Möchten Sie nur in einem spezifischen gamifizierten Quiz Punkte sammeln, bietet Ihnen KlickerUZH auch die Möglichkeit, ein temporäres Pseudonym und Avatar zu definieren.

#### Live Q&A und Echtzeit-Feedback

![Live Q&A und Feedback _auf der rechten Seite_](/img/06_live_quiz.png)

Haben Sie eine Frage oder möchten Sie direktes Feedback zur Vorlesung geben? Mit dem Live‑Q&A können Sie den Dozierenden oder Assistierenden während der Vorlesung Fragen stellen – auch bei Teilnahme aus der Ferne. Zusätzlich können Sie direktes Feedback zum Tempo und zur Schwierigkeit der Vorlesung geben.

Die Teilnahme ist unter \`https://pwa.klicker.uzh.ch/join/&lt;shortname&gt;\` (auch anonym) oder über die KlickerUZH‑App möglich. Die Verfügbarkeit des Live Q&A und Live Feedbacks hängt davon ab, ob die Dozierenden diese Funktionen im Live‑Quiz aktivieren.

#### Übungsquizzes, Microlearnings und Flashcards

![Übungsquiz in OLAT](/img/07_practice_quiz.png)

Übungsquizzes, Microlearnings und Flashcards helfen Ihnen, Kursinhalte ausserhalb der Vorlesungszeit zu wiederholen und direktes Feedback zu erhalten. Übungsquizzes (optional mit Flashcards) sind jederzeit verfügbar und beliebig oft wiederholbar; Microlearnings sind nur einmal und in einem begrenzten Zeitfenster verfügbar. Alle Elemente sind über die KlickerUZH‑App oder über von den Dozierenden bereitgestellte Links zugänglich (einschliesslich anonymer Teilnahme).

Während der Beantwortung können eingeloggte Teilnehmende persönliche Lesezeichen setzen und so einen privaten Übungspool aufbauen. Bei inhaltlichen Problemen mit eingebundenen Fragen können Sie über die "Fehler melden"-Funktion eine direkt Rückmeldung an die Dozierenden geben.

#### Gruppen und Gruppenaktivitäten

Einige Kurse setzen Gruppenaktivitäten ein, die nur kollaborativ gelöst werden können. Dozierende können eine zufällige Gruppenzuteilung aktivieren und eine bevorzugte Gruppengrösse vorgeben. Sobald die Gruppen gebildet und eine Gruppenaktivität publiziert ist, werden Hinweise auf die Gruppenmitglieder verteilt. Die Gruppe kann die Aktivität innerhalb eines begrenzten Zeitfensters gemeinsam lösen (eine Abgabe pro Gruppe). Gruppenbildung und Gruppenaktivitäten stehen nur Teilnehmenden mit KlickerUZH‑Account zur Verfügung.

Innerhalb einer Gruppe können Sie Ihre Punkte mit Ihren Mitstudierenden vergleichen; als Gruppe können Sie sich zudem mit anderen Gruppen messen. Die Gesamtpunktzahl Ihrer Gruppe setzt sich zusammen aus Punkten aus Gruppenaktivitäten und den aggregierten Punkten aller Gruppenmitglieder.

#### Kurse, Leaderboards und Errungenschaften

Dozierende können Kurs‑Leaderboards aktivieren, Challenges definieren und Errungenschaften vergeben. Durch den Beitritt zum Leaderboard sammeln Sie Punkte auf Kurs-Ebene und sehen Rang, Level, XP und Errungenschaften (wenn kompatibel mit Ihren Datenschutz‑Einstellungen). Durch die Aktivierung der anonymen Teilnahme in den Profileinstellungen können Sie Ihr Profil für andere Teilnehmende ausblenden und dennoch am Leaderboard teilnehmen.

#### Challenge und Punktevergabe

![Leaderboard (bei gamifizierten Kursen) und Kursinformationen](/img/08_gamification.png)

Alle Aktivitäten in KlickerUZH können Teil einer gamifizierten Challenge sein. Dabei sammeln Sie – sofern Sie im eingeloggten Zustand teilnehmen – Punkte für die Kursrangliste, Erfahrungspunkte und Errungenschaften.

Folgende Aktivitäten sind Teil der Challenge:

- Umfragen und Live Quizzes: 10 Punkte pro Teilnahme an einer Frage und bis zu 50 Bonuspunkte für schnelle und korrekte Antworten. Die schnellste korrekte Antwort erhält die meisten Punkte. Dozierende können das Punkteschema anpassen oder Multiplikatoren auf einzelne Aktivitäten/Fragen anwenden; für weitere Informationen wenden Sie sich bitte an Ihre Dozierenden.
- Übungs-Quizzes: 10 Punkte werden vergeben, wenn die erste Antwort auf eine Frage korrekt ist. Bei Wiederholung wird die gleiche Punktzahl nach Ablauf der festgelegten Sperrzeit vergeben.
- Microlearnings: 10 Punkte werden für eine korrekte Antwort auf eine Frage vergeben. Microlearnings können nicht wiederholt werden.
- Gruppenaktivitäten: Standardmäßig können pro Frage in der Gruppenaktivität bis zu 25 Punkte vergeben werden. Gruppenaktivitäten werden von den Dozierenden manuell bewertet.
- Errungenschaften: Bestimmte Errungenschaften (z. B. ein erster Platz in einem Live Quizzes) bringen Bonuspunkte ein. Errungenschaften werden automatisch oder manuell von den Dozierenden vergeben.
- Multiplikatoren: Fragen- und Aktivitäts-Multiplikatoren (z. B. 2x/3x/4x) erhöhen die vergebenen Punkte. In asynchronen Aktivitäten (Übungs-Quizzes und Microlearnings) werden Aktivitäts-Multiplikatoren zu Beginn der Aktivität angezeigt.
`,
      firstLoginTitle: 'Erster Login & Accounteinrichtung',
      firstLogin: `
Wenn Sie zum ersten Mal an KlickerUZH‑Aktivitäten teilnehmen, können Sie ein KlickerUZH‑Teilnehmendenkonto erstellen. Damit verwalten und nutzen Sie die Lerninhalte Ihrer Kurse, bauen eine private Wiederholungsbibliothek auf und nehmen an gamifizierten Elementen teil. In Übungsquizzes ermöglichen Accounts die Nutzung der Spaced Repetition Funktionalität (anderenfalls aus Datenschutzgründen nicht nutzbar). Abhängig vom technischen Setup Ihres Kurses gehen Sie wie folgt vor:

#### Kurse mit LMS‑Integration (z. B. OLAT)

Öffnen Sie das KlickerUZH‑Modul im OLAT‑Kurs Ihrer Lehrveranstaltung. Um Ihr KlickerUZH‑Konto zu verwalten oder ein neues zu erstellen, klicken Sie auf "Konto verwalten" innerhalb des KlickerUZH‑Moduls. Bitte beachten Sie, dass dieser Block auch anders benannt sein kann; fragen Sie im Zweifelsfall Ihre Dozierenden.

![](/img/01_create_account.png)

Wenn Sie bereits ein KlickerUZH‑Konto besitzen und dem Kurs beigetreten sind (mit dem PIN oder über die Account Management-Seite), besuchen Sie eine der KlickerUZH‑Aktivitäten im LMS‑Kurs – Sie sollten automatisch eingeloggt sein. Falls nicht, nutzen Sie den Button oben rechts.

Wenn noch kein KlickerUZH‑Konto für Sie existiert, werden Sie von einer Willkommensseite begrüsst, auf der Sie ein neues Konto erstellen können (anonymer Benutzername, Passwort, persönlicher Avatar).

#### Kurse ohne LMS‑Integration

Wenn Sie bereits ein KlickerUZH‑Konto haben (z. B. aus anderen Kursen), öffnen Sie die KlickerUZH‑App und klicken Sie auf der Hauptansicht unterhalb der Kursliste auf "Kurs beitreten". Geben Sie die 9‑stellige PIN ein, die Sie von Ihren Dozierenden erhalten haben. Sie sind nun Teil des Kurses und können an allen Aktivitäten teilnehmen.

![](/img/05_join_course.png)

Wenn Sie zum ersten Mal an einem Kurs mit KlickerUZH teilnehmen, öffnen Sie den Zugangslink, den Sie von den Dozierenden erhalten (z. B.
\`https://pwa.klicker.uzh.ch/course/XYZ/join?pin=111111111\`). Darüber können Sie ein neues KlickerUZH‑Konto erstellen (anonymer Benutzername und Passwort), sich einloggen, Ihren Avatar festlegen und an Aktivitäten teilnehmen.

#### Anonyme Teilnahme

Grundsätzlich ist eine anonyme Teilnahme an allen Aktiväten in KlickerUZH ausser Gruppenaktivitäten möglich. Für Live‑Quizzes finden Sie die laufenden Quizzes eines Accounts unter
\`https://pwa.klicker.uzh.ch/join/&lt;shortname&gt;\`. Practice Quizzes und Microlearnings sind über direkte Links zugänglich, die von den Dozierenden bereitgestellt werden. Beim Zugriff über die OLAT‑Integration können Sie ein Konto erstellen und werden danach automatisch eingeloggt. Ohne KlickerUZH‑Konto bleibt Ihre Teilnahme an eingebetteten Aktivitäten anonym.
`,
      appSetupTitle: 'App Installation',
      appSetup: `
Um von überall auf KlickerUZH zugreifen zu können, gibt es eine KlickerUZH-App. Mit der App können Sie die Lerninhalte Ihrer Kurse (mit KlickerUZH) einfach verwalten und darauf zugreifen, sowie wichtige Elemente zu Ihrer privaten Wiederholungsbibliothek hinzufügen und an den gamifizierten Elementen (Challenge) teilnehmen. Außerdem können Sie die Push-Benachrichtigungen für Microlearnings in Ihren Kursen aktivieren.

Sie können die KlickerUZH-App wie folgt einrichten:

#### Android

Sie können die KlickerUZH-App im Google Play Store unter folgendem Link herunterladen:

[https://play.google.com/store/apps/details?id=ch.uzh.bf.klicker.pwa](https://play.google.com/store/apps/details?id=ch.uzh.bf.klicker.pwa)

Nach der Installation sollten Sie die App auf Ihrem Startbildschirm sehen und können sich wie gewohnt einloggen. Sie können Push-Benachrichtigungen für Ihre Kurse aktivieren, indem Sie auf das Glockensymbol des jeweiligen Kurses klicken, woraufhin Sie z.B. über neue Microlearning-Einheiten informiert werden.

#### iOS

Da die KlickerUZH-App noch nicht im iOS-App-Store verfügbar ist, folgen Sie dieser Anleitung, um die App auf Ihrem Startbildschirm hinzuzufügen. Die installierte App verhält sich daraufhin wie eine gewöhnliche App.

1. Öffnen Sie den folgenden Link auf Ihrem Smartphone: [{pwa_url}/login]({pwa_url}/login)
2. Nutzen Sie den Teilen-Dialog und klicken Sie auf "Add to Home Screen" / "Zum Startbildschirm zufügen".
3. Akzeptieren Sie, dass die App installiert wird. Sobald die App installiert ist, sollten Sie zum Log-in weitergeleitet werden. Sie werden auch ein neues KlickerUZH-Symbol auf Ihrem Startbildschirm finden.
`,
    },
    login: {
      installAndroid:
        'Installieren Sie die KlickerUZH App auf Ihrem Handy, um Push-Benachrichtigungen zu erhalten, wenn neue Lerninhalte verfügbar sind.',
      installIOS:
        "Öffnen Sie den Share-Dialog und klicken Sie auf 'Zum Startbildschirm hinzufügen', um die KlickerUZH App auf Ihrem Handy zu installieren.",
      createAccountJoin: 'Account erstellen & Kurs beitreten',
      existingParticipantAccount:
        'Sollten Sie bereits einen KlickerUZH Studierenden-Account haben, nutzen Sie bitte das Login um sich anzumelden. Einem neuen Kurs können Sie nach der Anmeldung in der Übersicht beitreten. Anderenfalls können Sie hier im Rahmen Ihres Kurses einen KlickerUZH Account erstellen.',
      joinCourseTooltip:
        'Geben Sie hier die PIN Ihres Kurses ein, um einen neuen Account zu erstellen und dem Kurs beizutreten. Sie erhalten diese von Ihrem Dozierenden.',
      signup: 'Registrieren',
      coursePinInvalid: 'Die von Ihnen eingebene Kurs-PIN ist ungültig.',
    },
    courses: {
      courseInformation: 'Kursinformationen',
      createJoinGroup: 'Gruppe erstellen/beitreten',
      createGroup: 'Gruppe erstellen',
      joinGroup: 'Gruppe beitreten',
      groupName: 'Gruppenname',
      randomGroup: 'Zufällige Gruppe',
      assessmentResults: 'Assessment Resultate',
      createJoinRandomGroup:
        'Hier klicken, um einer zufälligen Gruppe mit anderen Studierenden automatisch beitreten.',
      joinGroupError:
        'Beim Beitreten zur Gruppe ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
      joinGroupFull:
        'Diese Gruppe hat bereits die maximale Anzahl Teilnehmer erreicht. Bitte wählen Sie eine andere Gruppe.',
      inRandomGroupPool:
        'Sie haben sich entschieden, automatisch einer Gruppe von Studierenden in Ihrem Kurs zugewiesen zu werden. Wir warten derzeit darauf, dass mehr Personen dem Pool beitreten, und werden Sie so schnell wie möglich einer Gruppe zuweisen. Wenn Sie stattdessen lieber manuell einer anderen Gruppe beitreten oder Ihre eigene Gruppe erstellen möchten, können Sie den Pool mit dem Button unten verlassen.',
      leaveRandomGroupPool: 'Pool verlassen',
      code: 'Code',
      individualLeaderboard: 'Individuelles Leaderboard',
      biWeekly: 'Zweiwöchentlich',
      groupLeaderboard: 'Gruppenleaderboard',
      individualLeaderboardUpdate:
        'Das individuelle Leaderboard wird stündlich aktualisiert.',
      courseOverviewOnlyWithLogin:
        'Die Kursübersicht dieses Kurses ist nur für angemeldete Teilnehmer zugänglich. Bitte melden Sie sich zuerst in KlickerUZH an und treten Sie dem Kurs bei, bevor Sie auf die Kursübersicht zugreifen. Sollten Sie aus einem LMS (z.B. OLAT) auf KlickerUZH zugreifen, besuchen Sie bitte den "Manage Account"-Baustein, um Ihre Kontoinformationen zu verwalten.',
      gamificationOnlyForLoggedInUsers:
        'Gamifizierungs-Elemente auf Kursebene sind nur für eingeloggte Nutzer und Mitglieder des Kurses zugänglich.',
      noGroups: "Bisher wurden noch keine Gruppen gebildet. Los geht's!",
      noGroupPoints:
        "Bisher hat noch keine Gruppe Punkte erhalten. Los geht's!",
      groupLeaderboardUpdate:
        'Das Gruppenleaderboard wird täglich aktualisiert.<b>x</b>Gruppen mit einem Mitglied erhalten keine Punkte.',
      joinLeaderboardCourse: 'Treten Sie dem Leaderboard für <b>{name}</b> bei',
      membersScore: 'Punkte durch Mitglieder',
      groupActivityScore: 'Punkte durch Gruppenaktivitäten',
      totalScore: 'Total Punkte',
      bookmarkedQuestionsTitle: 'Bookmarks in {courseName}',
      bookmarkedQuestionsDesc:
        'Diese Seite erlaubt, alle Fragen mit Bookmarks aus dem Kurs {courseName} zu wiederholen. Sie werden dabei alle hintereinander wie in einem gewöhnlichen Übungs-Quiz dargestellt.',
      noBookmarksSet:
        'Sie haben bisher keine Fragen gebookmarked. Klicken Sie hierfür einfach auf das Lesezeichen-Symbol auf einer Frage.',
      awards: 'Auszeichnungen',
      open: 'offen',
      leaveLeaderboardTitle: 'Leaderboard verlassen',
      leaveLeaderboardConfirmation:
        'Möchten Sie das Leaderboard wirklich verlassen?',
      leaveLeaderboardInformation:
        'Wenn Sie das Kurs-Leaderboard verlassen, werden Interaktionen mit Kursaktivitäten und Ihre gesammelten Punkte gelöscht. Sie können dem Leaderboard jederzeit wieder beitreten, beginnen dann aber von Neuem.',
      noGamificationOrDescription:
        'Willkommen im Kurs {courseName}! Für diesen KlickerUZH-Kurs wurde die Gamifizierung deaktiviert und es wird kein Leaderboard angezeigt. KlickerUZH listet dennoch alle kursbezogenen Aktivitäten in den entsprechenden Abschnitten der App für einen direkten Zugriff.',
      groupActivityEndedToast:
        'Gruppenaktivität "{activityName}" beendet, keine weiteren Abgaben sind möglich.',
      groupActivityStartedToast:
        'Die Gruppenaktivität "{activityName}" hat begonnen. Startet sie jetzt!',
      microLearningEndedToast:
        'Microlearning "{activityName}" beendet, keine weiteren Abgaben sind möglich.',
      coursePracticeArea:
        'Dies ist der Übungspool für den Kurs {courseName}. Hier stehen euch die Inhalte aus allen Übungs-Quizzes kombiniert zur Verfügung. Für gezielte Wiederholungen werden immer 25 Fragen gemäss unserer Spaced Repeitition Logik und basierend auf euren bisherigen Antworten ausgewählt.',
    },
    joinCourse: {
      title: 'Kurs "{name}" beitreten',
      introLoggedIn:
        'Sie sind bereits eingeloggt und können dem Kurs {name} durch die Eingabe des korrekten PINs direkt beitreten.',
      introLoggedInNoCourse:
        'Sie sind bereits eingeloggt und können einem Kurs durch die Eingabe des entsprechenden PINs direkt beitreten.',
      introNewUser:
        'Erstellen Sie hier Ihr KlickerUZH Konto für den Kurs {name}. Sollten Sie bereits über ein Konto verfügen, loggen Sie sich bitte ein und kehren Sie dann hierher zurück.',
      coursePinFormat: 'Kurs-PIN (Format: ### ### ###)',
      coursePinNumerical: 'Bitte geben Sie einen numerischen PIN ein.',
      coursePinRequired: 'Bitte geben Sie den Kurs-PIN ein.',
      invalidPin: 'PIN ungültig',
      genericError:
        'Beim Versuch, dem Kurs beizutreten, ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder wenden Sie sich an Ihren Dozenten.',
    },
    practiceQuiz: {
      flashcardClick: 'Klicken Sie, um die Antwort zu sehen',
      studentFlashcardResponse: 'Haben Sie die Antwort gewusst?',
      flashcardNoResponse: 'Nein',
      flashcardPartialResponse: 'Teilweise',
      flashcardYesResponse: 'Ja',
      resetAnswers: 'Antworten zurücksetzen',
      markAllAsRead: 'Alle als gelesen markieren',
      read: 'Gelesen',
      feedbackTransmitted: 'Ihr Feedback wurde erfolgreich übermittelt.',
      feedbackRequired: 'Bitte fügen Sie einen Inhalt zu Ihrem Feedback hinzu',
      flagElement: 'Fehler melden',
      flagElementText:
        'Dieses Feedback-Formular soll ermöglichen, zu den einzelnen Elementen eines Practice Quiz / eines Microlearnings eine direkte Anmerkung abgeben zu können, sollte sich ein Fehler eingeschlichen haben. Der Dozierende wird eine Nachricht mit Ihrem Feedback erhalten. Bitte versuchen Sie daher, den Fehler so genau wie möglich zu beschreiben.',
      addFeedback: 'Feedback hinzufügen',
      submitFeedback: 'Feedback abschicken',
      updateFeedback: 'Feedback aktualisieren',
      errorRatingElement:
        'Ihre Bewertung des Elements war leider nicht erfolgreich. Versuchen Sie es später nochmals.',
      notFound:
        'Unter diesem Link existiert kein Übungs-Quiz oder dieses ist noch nicht publiziert.',
      repetitionTitle: 'Repetition Übungs-Quizzes',
      noRepetition:
        'Aktuell sind keine Übungs-Quizzes zur Repetition verfügbar.',
      numOfQuestions: 'Anzahl Fragen: {number}',
      orderLAST_RESPONSE: 'Reihenfolge: zuletzt beantwortete Fragen am Ende',
      orderSHUFFLED: 'Reihenfolge: zufällige Reihenfolge',
      orderSEQUENTIAL: 'Reihenfolge: geordnet in Sequenz',
      orderSPACED_REPETITION: 'Reihenfolge: Spaced Repetition',
      repetitionDaily: 'Wiederholung: täglich',
      repetitionXDays: 'Wiederholung: alle {days} Tage',
      answeredMinOnce: 'Min. 1x beantwortet: {answered}/{total}',
      multiplicatorPoints: 'Multiplikator: {mult}x Punkte',
      multiplicatorEval: '<b>Multiplikator</b> {mult}x',
      solvedPracticeQuiz:
        'Du hast das Übungs-Quiz <it>{name}</it> erfolgreich absolviert.',
      pointsCollectedPossible: 'Punkte (gesammelt/berechnet/möglich)',
      pointsComputedAvailable: 'Punkte (berechnet/möglich)',
      notAttempted: 'Nicht gelöst',
      totalPoints: 'Total Punkte (gesammelt): {points}',
      totalXp: '{xp} XP gesammelt',
      questionTypeNotSupported:
        'Dieser Fragetyp ist aktuell für Übungs-Quizzes nicht verfügbar.',
      newPointsFrom: 'Erneute Punkte/XP ab:',
      othersAnswered: 'So haben andere geantwortet',
      infoStack: 'Informationselement',
      scheduledAvailableFrom: 'Das Übungs-Quiz {name} ist ab {date} verfügbar.',
      inactiveParticipation:
        'Du hast das Übungs-Quiz <it>{name}</it> erfolgreich absolviert. Da du allerdings nicht Teil der Leaderboards in diesem Kurs bist, werden deine Punkte nicht gespeichert. Um in Zukunft Punkte zu sammeln, tritt dem Leaderboard auf der Kursübersicht bei.',
      missingParticipation:
        'Du hast das Übungs-Quiz <it>{name}</it> erfolgreich absolviert. Da du allerdings nicht Mitglied dieses Kurses bist, werden deine Punkte und Erfahrungspunkte nicht gespeichert. Um in Zukunft sowohl Punkte als auch XP zu sammeln, tritt jetzt dem Kurs bei.',
      correctAnswerOptions: 'Richtige Antwortoptionen',
      topNAnswers: 'Top {number} Antworten',
    },
    microLearning: {
      numOfQuestionSets: 'Anzahl Fragesets: {number}',
      notFound:
        'Unter diesem Link existiert kein Microlearning oder diese ist noch nicht aktiv.',
      solvedMicrolearning:
        'Du hast das Microlearning <it>{name}</it> erfolgreich absolviert.',
      inactiveParticipation:
        'Du hast das Microlearning <it>{name}</it> erfolgreich absolviert. Da du allerdings nicht Teil der Leaderboards in diesem Kurs bist, werden deine Punkte nicht gespeichert. Um in Zukunft Punkte zu sammeln, tritt dem Leaderboard auf der Kursübersicht bei.',
      missingParticipation:
        'Du hast das Microlearning <it>{name}</it> erfolgreich absolviert. Da du allerdings nicht Mitglied dieses Kurses bist, werden deine Punkte und Erfahrungspunkte nicht gespeichert. Um in Zukunft sowohl Punkte als auch XP zu sammeln, tritt jetzt dem Kurs bei.',
      availableFrom: 'Verfügbar ab {date}',
      availableUntil: 'Verfügbar bis {date}',
      questionSetN: 'Frageset {number}',
      activityExpired:
        'Dieses Microlearning ist abgelaufen und es können keine Antworten mehr eingereicht werden.',
    },
    liveQuiz: {
      noActiveQuestion:
        'Aktuell ist keine Frage aktiv... Sobald eine neue Frage aktiviert wird, wird sie automatisch angezeigt. Alternativ können Sie auch die Seite <reload>aktualisieren</reload>, um ein Update zu erzwingen.',
      allQuestionsAnswered:
        'Sie haben bereits alle aktiven Fragen beantwortet oder der Block wurde geschlossen.',
      previousCase: 'Vorheriger Fall',
      nextCase: 'Nächster Fall',
      thisLiveQuizGamified: 'Diese Live-Quiz ist gamifiziert!',
      loginSelectionHint:
        'Sie sind dabei, an einem gamifizierten Live-Quiz teilzunehmen. Bitte wählen Sie zwischen den folgenden Optionen: <ul><li>Login mit <b>KlickerUZH-Konto</b>: Punkte und XP sammeln</li><li>Erstellen Sie ein <b>temporäres Pseudonym</b>: Sammeln Sie Punkte nur in diesem Live-Quiz (Punkte nicht im Kurs verfügbar)</li><li><b>Anonyme</b> Teilnahme: Nicht an den Gamifizierungselementen teilnehmen</li></ul>',
      loginWithAccount: 'Login mit KlickerUZH-Konto',
      createTemporaryPseudonym: 'Temporäres Pseudonym erstellen',
      participateAnonymously: 'Anonym teilnehmen',
      changeLoginMode: 'Login-Modus ändern',
      pseudonymExplanation:
        'Durch die Eingabe eines <b>Pseudonyms</b> können Sie Punkte in diesem gamifizierten Live-Quiz sammeln, ohne ein KlickerUZH-Konto erstellen zu müssen. Gesammelte Punkte werden nur im Zusammenhang mit diesem Live-Quiz gespeichert und nicht in der Kursrangliste angezeigt.',
      pseudonymRequired: 'Bitte geben Sie ein Pseudonym ein.',
      pseudonymMinLength:
        'Das Pseudonym muss mindestens {length} Zeichen lang sein.',
      pseudonymMaxLength:
        'Das Pseudonym darf nicht länger als {length} Zeichen sein.',
      joinedSuccessfullyWithPseudonym:
        'Sie sind dem Live Quiz erfolgreich mit dem Pseudonym <b>{pseudonym}</b> beigetreten.',
      pseudonymAlreadyExists:
        'Das gewählte Pseudonym ist leider bereits vergeben. Bitte wählen Sie ein anderes.',
      pseudonymCreationFailed:
        'Die Erstellung des Pseudonyms ist fehlgeschlagen. Bitte versuchen Sie es erneut.',
      temporaryParticipantsLeaderboard:
        'Temporäre Teilnehmende (sammeln nur in diesem gamifizierten Live-Quiz Punkte)',
      pseudonymSelection: 'Pseudonym-Auswahl',
      avatarExplanation:
        'Falls sie möchten, können Sie hier Ihren <b>Avatar</b> für das Live-Quiz auswählen.',
      noQuizTitle: 'Kein Live-Quiz verfügbar',
      noQuizDescription:
        'Unter diesem Link ist derzeit kein laufendes Live-Quiz verfügbar. Bitte überprüfen Sie Ihren Link oder wenden Sie sich an Ihren Dozierenden.',
      refreshPage: 'Seite aktualisieren',
      pinRequired: 'Für den Zugriff auf dieses Quiz ist eine PIN erforderlich.',
      enterPinTitle: 'PIN-Code eingeben',
      invalidPin: 'Die eingegebene PIN ist ungültig.',
      enterPinLabel: 'PIN-Code',
      enterPinPlaceholder: 'PIN eingeben',
      submitPin: 'PIN absenden',
    },
    feedbacks: {
      title: 'Feedback-Kanal',
      speed: 'Geschwindigkeit',
      difficulty: 'Schwierigkeit',
      openQuestions: 'Offene Fragen',
      resolvedQuestions: 'Erledigte Fragen',
      feedbackPlaceholder: 'Feedback / Frage eingeben',
      postedAt: 'Gepostet am {date}',
      solvedAt: 'Gelöst am {date}',
      feedbackSubmitted:
        'Ihr Feedback / ihre Frage wurde erfolgreich übermittelt.',
    },
    profile: {
      publicProfile: 'Profilsichtbarkeit',
      isProfilePublic:
        'Soll Dein Profil und Pseudonym anderen Teilnehmenden angezeigt werden? Wenn Du diese Option deaktivierst, sehen dich andere Teilnehmende nur noch als Anonymous, Du alle anderen Teilnehmenden allerdings auch.',
      editProfile: 'Profil editieren',
      editProfileFailed:
        'Leider ist beim Speichern der Änderungen ein Fehler aufgetreten. Möglicherweise ist der von Ihnen gewählte Nutzername bereits vergeben. Bitte überprüfen Sie Ihre Eingaben und versuchen es nochmal.',
      createProfileFailed:
        'Leider konnte Ihr Konto nicht erstellt oder verknüpft werden. Bitte überprüfen Sie Ihre Eingaben und versuchen Sie es erneut.',
      editProfileSuccess: 'Ihr Profil wurde erfolgreich aktualisiert.',
      achievements: 'Errungenschaften',
      myProfile: 'Mein Profil',
      createProfile: 'Profil erstellen',
      usernameMinLength:
        'Der Benutzername muss mindestens {length} Zeichen lang sein.',
      usernameMaxLength:
        'Der Benutzername darf nicht länger als {length} Zeichen sein.',
      passwordMinLength:
        'Das Passwort muss mindestens {length} Zeichen lang sein.',
      identicalPasswords: 'Passwörter müssen übereinstimmen.',
      emailRequired: 'Bitte geben Sie eine E-Mail Adresse ein.',
      emailInvalid: 'Bitte geben Sie eine gültige E-Mail Adresse ein.',
      usernameRequired: 'Bitte geben Sie einen Benutzernamen ein.',
      passwordRequired: 'Bitte geben Sie ein Passwort ein.',
      welcomeMessage:
        'Willkommen bei KlickerUZH! Falls dies dein erstes Mal hier ist, setze bitte ein Passwort und definiere deinen eigenen Benutzernamen und Avatar.',
      deleteProfile: 'Konto löschen',
      deleteProfileDescription:
        'Das Löschen Deines KlickerUZH-Kontos wird alle verbundenen Informationen irreversibel löschen.',
      deleteProfileConfirmation:
        'Bist Du sicher, dass Du Dein Konto löschen möchtest? Alle Daten, die mit Deinem Konto assoziiert sind, werden gelöscht. Diese Aktion kann nicht rückgängig gemacht werden.',
      emailMissing:
        'Die E-Mail-Adresse in Ihrem Konto ist ungültig oder fehlt. Bitte ergänzen Sie diese und speichern Sie Ihre Änderungen, um alle Funktionalitäten von KlickerUZH nutzen zu können.',
      forgotPasswordInfo:
        'Wenn Sie Ihr Passwort vergessen haben, verwenden Sie die E-Mail Login Funktion, um einen einmaligen Login-Link zu erhalten und Ihr Passwort anschliessend zu ändern.',
      errorLogoutTemporaryParticipant:
        'Beim Ausloggen aus ihrem temporären Pseudonym ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
      loggedInAs: 'Angemeldet als',
      temporaryPseudonym: 'temporäres Pseudonym',
    },
    serverError: {
      warning: 'Ein unerwarteter Fehler ist aufgetreten',
      serverSideError:
        'Ein unerwarteter Fehler ist bei Ihrer Anfrage aufgetreten. Bitte setzen Sie Ihre Cookies zurück und versuchen Sie es erneut. Wenn das Problem weiterhin besteht, wenden Sie sich an Ihren Kursleiter.',
      tryAgain: 'Erneut versuchen',
    },
    avatar: {
      hair: 'Frisur',
      hairColor: 'Haarfarbe',
      eyes: 'Augen',
      accessory: 'Brille',
      mouth: 'Mund',
      facialHair: 'Bart',
      clothing: 'Kleidungsstil',
      clothingColor: 'Kleidungsfarbe',
      skinTone: 'Hautton',
      breasts: 'Weiblich',
      chest: 'Männlich',
      normal: 'Normal',
      happy: 'Glücklich',
      content: 'Zufrieden',
      squint: 'Fokussiert',
      heart: 'Herzen',
      light: 'Hell',
      dark: 'Dunkel',
      long: 'Lang',
      bun: 'Dutt',
      short: 'Kurz',
      buzz: 'Sehr Kurz',
      afro: 'Afro',
      blonde: 'Blond',
      black: 'Schwarz',
      brown: 'Braun',
      white: 'Weiss',
      blue: 'Blau',
      green: 'Grün',
      red: 'Rot',
      grin: 'Grinsen',
      openSmile: 'Lachen',
      open: 'Offen',
      serious: 'Ernst',
      tongue: 'Zunge',
      none: 'Keine',
      roundGlasses: 'Sehbrille',
      tinyGlasses: 'Lesebrille',
      shades: 'Sonnenbrille',
      stubble: 'Stoppeln',
      mediumBeard: 'Bart',
      wink: 'Zwinkern',
      shirt: 'Shirt',
      dressShirt: 'Anzug',
      dress: 'Kleid',
    },
    achievements: {
      noAchievements: 'Bisher keine Errungenschaften.',
      notAchievedYet: 'Noch nicht erreicht',
    },
    groups: {
      messageRequired: 'Bitte geben Sie vor dem Abschicken eine Nachricht ein.',
      nameRequired: 'Bitte geben Sie einen Gruppennamen ein.',
      pinRequired: 'Bitte geben Sie eine PIN ein.',
      pinNumeric: 'Die 6-stellige PIN muss numerisch sein.',
    },
    groupActivity: {
      startAt: 'Start: {time}',
      endAt: 'Ende: {time}',
      available: 'Verfügbar',
      started: 'Gestartet',
      submitted: 'Abgegeben',
      past: 'Abgeschlossen',
      passed: 'Bestanden',
      failed: 'Nicht bestanden',
      groupActivityPassed:
        'Gratulation! Deine Gruppe hat die Gruppenaktivität bestanden.',
      groupActivityFailed:
        'Oh nein! Deine Gruppe hat die Gruppenaktivität leider nicht bestanden.',
      groupActivityFeedback: 'Feedback: {feedback}',
      answerCORRECT: 'Eure Antwort ist korrekt.',
      answerPARTIAL: 'Eure Antwort ist teilweise korrekt.',
      answerINCORRECT: 'Eure Antwort ist falsch.',
      openGroupActivity: 'Zur Gruppenaktivität',
      openGroupActivitySubmission: 'Zur Abgabe',
      openActivityFeedback: 'Zum Feedback',
      activityNotYetActive:
        'Die Gruppenaktivität ist nicht aktiv oder noch nicht freigeschalten.',
      initialSituation: 'Ausgangslage',
      yourHints: 'Eure Hinweise',
      coordinateHints:
        'Jedes Gruppenmitglied erhält ein/mehrere der obigen Hinweise.<br></br> Sprecht euch ab, um alle nötigen Hinweise für die Aufgaben zu sammeln.',
      yourGroup: 'Deine Gruppe',
      groupCompleteQuestion:
        'Ist deine Gruppe vollständig? Wenn ja, klicke auf Start, um die Hinweise unter deinen Gruppenmitgliedern zu verteilen. Mitglieder, die nach der Zuweisung zu der Gruppe stossen, erhalten keine zusätzlichen Hinweise.',
      startCaps: 'START',
      minTwoPersons:
        'Gruppen mit einem Mitglied können leider nicht an der Gruppenquest teilnehmen.<br></br> Suche dir mindestens eine:n Partner:in, um mitzumachen, oder schaue dir die Aufgabe im Excel an, die wir nach der Abgabefrist publizieren.',
      yourTasks: 'Eure Aufgaben',
      sendAnswers: 'Antworten absenden',
      oneSolutionPerGroup:
        'Jede Gruppe kann nur einmal Lösungen einreichen. Sendet eure Lösungen erst ab, wenn ihr euch sicher seid.',
      alreadySubmittedAt:
        'Deine Gruppe hat ihre Lösungen bereits eingereicht (am {date}).<br></br> Die Bewertung wird später veröffentlicht und separat kommuniziert.',
      joinLeaderboard:
        'Damit im Rahmen der Gruppenaktivität Punkte gesammelt werden können, müssen Sie dem Kurs-Leaderboard beitreten. Wechseln Sie hierfür auf das andere Tab und bestätigen Sie die Teilnahme.',
      singleParticipantAutomaticAssignment:
        'Sie sind der einzige Teilnehmer in Ihrer Gruppe. Sobald die Frist für die Gruppenbildung abgelaufen ist am {groupFormationDeadline} oder der Dozent die Gruppenbildung manuell gestoppt hat, werden Sie automatisch einer zufälligen Gruppe zugewiesen.',
      maxNumberOfGroupMembers:
        'Deine Gruppe hat die maximale Anzahl von Teilnehmenden erreicht, wie von deinem Dozierenden festgelegt. Es können keine weiteren Studierenden dieser Gruppe beitreten.',
      nOfMaxParticipants: '{numParticipants}/{maxParticipants} Teilnehmer',
      groupActivityEnded:
        'Diese Gruppenaktivität ist bereits beendet. Sie können sie nicht mehr starten oder Antworten einreichen.',
    },
    assessment: {
      homepageHint:
        'Willkommen in der Assessment-Instanz von KlickerUZH! Sollten Sie Aktivitäten ausserhalb eines Assessment-Kurses nutzen wollen, loggen Sie sich bitte stattdessen unter <link>{pwa_url}</link> ein.',
      title: 'Assessment Login',
      warning:
        'Dies ist eine Assessment-Anwendung. Alle Ihre Daten und Aktivitäten sind für Ihre Dozierenden sichtbar.',
      loginWithEduId: 'Login mit Edu-ID',
      eduIdRequired:
        'Edu-ID-Authentifizierung ist für Assessments erforderlich',
      submissionInputsInvalid:
        'Beim Abschicken Ihrer Antwort ist ein Fehler aufgetreten. Bitte überprüfen Sie Ihre Eingaben auf Fehlermeldungen.',
      submissionSuccessful:
        'Ihre Antwort wurde erfolgreich abgeschickt und gespeichert.',
      submissionGeneralError:
        'Beim Abschicken Ihrer Antwort ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
      submissionAlreadyRecorded:
        'Sie haben diese Frage bereits beantwortet. Ihre vorherige Antwort wurde gespeichert.',
      submissionUnauthorizedError:
        'Ihr Login konnte nicht korrekt verifiziert werden. Bitte loggen Sie sich erneut ein und beantworten Sie die Frage nochmals.',
      submissionServerError:
        'Beim Abschicken Ihrer Antwort ist ein Serverfehler aufgetreten. Bitte versuchen Sie es erneut.',
      missingAssessmentCourseParticipation:
        'Sie sind nicht Teil des Assessment-Kurses, zu welchem dieses Quiz gehört. Bitte kontaktieren Sie Ihre Dozierenden.',
      accountDeletionMessage:
        'Da Sie Ihr KlickerUZH-Konto derzeit zur Teilnahme an einem Assessment-Kurs verwenden, können Sie Ihr Konto nicht selbst löschen. Für weitere Informationen zur Löschung Ihres Kontos und zum Verlassen des Kurses wenden Sie sich bitte an Ihre Dozierenden.',
      respondedAt: 'Beantwortet am {date}',
      failedToLoadActivityResults:
        'Beim Laden der Resultate für die Aktivitäten in diesem Assessment Kurs ist leider ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder kontaktieren Sie Ihre Dozierenden, falls das Problem weiterhin besteht.',
      activityResultsDescription:
        'Die folgende Übersicht zeigt alle Aktivitäten, welche Ihnen im Assessment-Kurs zur Verfügung gestellt wurden. Aktivitäten, welche live im Hörsaal durchgeführt werden oder nur während einer bestimmten Zeit zur Verfügung stehen (z.B. Microlearnings), erscheinen auf dieser Übersicht, sobald sie durch den Dozierenden beendet wurden. Für weitere Informationen bezüglich der Korrektheit ihrer spezifischen Antworten innerhalb einer Aktivität, kontaktieren Sie bitte Ihre Dozierenden.',
      noCompletedLiveQuizzesYet:
        'Bisher wurden noch keine Live-Quizzes in diesem Assessment-Kurs abgeschlossen.',
      completedOn: 'Abgeschlossen am {date}',
      notCompletedYet: 'Noch nicht abgeschlossen',
      multiplier: 'Multiplikator',
      basePoints: 'Basispunkte',
      correctnessPoints: 'Korrektheitspunkte',
      bonusPoints: 'Bonuspunkte',
      ofAvailable: 'von {value} verfügbar',
      totalPoints: 'Totalpunkte',
      aggregatedTitle: 'Aggregierte Werte',
      excludingBonus: '(ohne Bonus: {value})',
      corrections: 'Korrekturen',
      noPointsCorrection: '+ 0 Punkte (keine Änderung): {reason}',
      nonZeroPointCorrection:
        '{points} Punkte ({basePoints} Basispunkte, {correctnessPoints} Korrektheitspunkte, {bonusPoints} Bonuspunkte): {reason}',
      reportTitle: 'Assessment-Leistungsbericht',
      issuedAt: 'Ausgestellt am',
      reportTimeZone: 'Europe/Zurich',
      courseReferenceLabel: 'Interne Kursreferenz',
      identitySourceLabel: 'Verifizierte Identitätsquelle',
      identitySourceCourseInvitation:
        'E-Mail-Adresse aus der angenommenen Assessment-Kurseinladung',
      identitySourceEduId: 'SWITCH edu-ID',
      achievedPointsLabel: 'Erreicht',
      availablePointsLabel: 'Verfügbar',
      performanceInsightsTitle: 'Peer-Vergleich',
      percentileText: 'Perzentilrang: {percentile}.',
      percentileExplanation:
        'Das Perzentil gibt an, wie viel Prozent der Teilnehmenden eine tiefere oder gleiche Punktzahl als du erreicht haben. Ein Perzentil von 75% bedeutet beispielsweise, dass deine Leistung gleich gut oder besser als 75% der Peer-Gruppe war.',
      histogramTitle: 'Punkteverteilung im Kurs',
      histogramDescription:
        'Das Diagramm zeigt die aggregierte Verteilung der Gesamtpunktzahlen aktiver Teilnehmender. Dein Punktebereich ist hervorgehoben.',
      histogramUserRange: 'Dein Punktebereich: {range}.',
      notEnoughDataForComparison:
        'Es ist kein Peer-Vergleich verfügbar. Er wird nur bei mindestens 10 aktiven Teilnehmenden und einem verfügbaren Punktebereich grösser als null ausgegeben.',
      exportReportButton: 'Performance-Bericht exportieren',
      exportReportExplanation:
        'Stelle einen Bericht aus dem aktuellen Assessment-Datensatz aus. Sobald er bereit ist, kannst du ihn im Browser ansehen oder über den Druckdialog des Browsers als einseitige A4-PDF speichern. Der Bericht enthält einen Link zur Prüfung seines aktuellen Status und seiner Angaben.',
      exportReportReady:
        'Dein Assessment-Bericht ist bereit. Öffne ihn in einem neuen Tab oder öffne über «Als PDF speichern» den Druckdialog des Browsers.',
      viewReportButton: 'Bericht öffnen',
      downloadReportButton: 'Als PDF speichern',
      refreshReportButton: 'Bericht aktualisieren',
      exportReportNotEligibleError:
        'Für diesen Kurs kann kein Assessment-Bericht ausgestellt werden. Prüfe, ob du eingeschrieben bist und die bewerteten Aktivitäten beendet wurden, oder kontaktiere deine Dozierenden.',
      exportReportIdentityUnverifiedError:
        'Es konnte keine E-Mail aus einer angenommenen Assessment-Kurseinladung bestätigt werden. Bitte kontaktiere die Kursadministration oder den Support.',
      exportReportRevokedError:
        'Dieser unveränderte Assessment-Bericht wurde widerrufen und kann nicht erneut ausgestellt werden. Kontaktiere deine Dozierenden, falls die verlässlichen Berichtsdaten korrigiert werden müssen.',
      exportReportInvalidDataError:
        'Die Assessment-Daten konnten für den Bericht nicht validiert werden. Bitte versuche es später erneut oder kontaktiere deine Dozierenden.',
      exportReportIssuanceError:
        'Der Assessment-Bericht konnte nicht ausgestellt werden. Prüfe deine Verbindung und versuche es erneut.',
      exportReportGenerationError:
        'Der Bericht wurde ausgestellt, aber das Browser-Dokument konnte nicht erstellt werden. Bitte versuche es erneut.',
      exportReportViewError:
        'Der Bericht konnte nicht in einem neuen Tab geöffnet werden. Erlaube Pop-ups für diese Seite und versuche es erneut.',
      exportReportPrintError:
        'Der Bericht konnte nicht zum Drucken geöffnet werden. Erlaube Pop-ups für diese Seite und versuche es erneut.',
      privacyAndTransparencyNotice:
        'Ein Peer-Vergleich wird erst ab 10 aktiven Teilnehmenden ausgegeben. Zehn initiale Punktebereiche werden zusammengeführt, bis jeder angezeigte Bereich mindestens 3 Teilnehmende repräsentiert. Der Bericht enthält keine einzelnen Peer-Punktzahlen oder Identifikatoren.',
      courseNameLabel: 'Kurs',
      studentNameLabel: 'Name der studierenden Person',
      studentEmailAddressLabel: 'E-Mail-Adresse',
      matriculationNumberLabel: 'Matrikelnummer',
      studentEmailLabel: 'Studierende/r',
      pointsSummaryLabel: 'Punkteübersicht',
      yourScoreLabel: 'Du',
      countLabel: 'Anzahl',
      binLabel: 'Punktebereich',
      privacyNoticeTitle: 'Datenschutz & Transparenz',
      verificationTitle: 'Assessment-Datensatz prüfen',
      verificationText:
        'KlickerUZH speichert den Assessment-Snapshot, der in diesem Bericht dargestellt wird. Öffne die Verifizierungsseite, um den Status des Datensatzes zu prüfen und seine aktuellen Angaben mit dieser Datei zu vergleichen.',
      verificationLink: 'Verifizierungsseite öffnen',
      verificationQrAlt: 'QR-Code zur KlickerUZH-Verifizierungsseite',
      verificationPageTitle: 'Assessment-Bericht prüfen | KlickerUZH',
      verificationHeading: 'Assessment-Bericht verifizieren',
      verificationIntro:
        'Prüfe den aktuellen Status und die serverseitig gespeicherten Angaben eines KlickerUZH-Assessment-Berichts.',
      verificationLoading: 'Assessment-Datensatz wird geladen',
      verificationInvalidLinkTitle: 'Ungültiger Verifizierungslink',
      verificationMissingToken:
        'Dieser Link enthält keinen Verifizierungsschlüssel.',
      verificationInvalidToken:
        'Der Verifizierungsschlüssel in diesem Link hat ein ungültiges Format.',
      verificationLoadError:
        'Der Assessment-Datensatz konnte nicht geladen werden. Bitte versuche es später erneut.',
      verificationNotFoundTitle: 'Assessment-Datensatz nicht gefunden',
      verificationNotFoundText:
        'Für diesen Verifizierungslink existiert kein Assessment-Bericht.',
      verificationActiveTitle: 'Aktiver Assessment-Datensatz',
      verificationActiveText:
        'Die folgenden Angaben entsprechen dem aktiven Snapshot in KlickerUZH. Vergleiche sie mit dem gedruckten oder angezeigten Bericht.',
      verificationRevokedTitle: 'Widerrufener Assessment-Datensatz',
      verificationRevokedText:
        'Dieser am {date} ausgestellte Bericht wurde widerrufen und darf nicht mehr als aktiv behandelt werden. Seine Angaben werden nicht offengelegt.',
      verificationSupersededTitle: 'Ersetzter Assessment-Datensatz',
      verificationSupersededText:
        'Später wurde ein geänderter Assessment-Snapshot ausgestellt. Dieser ältere Bericht ist nicht mehr aktiv; seine Angaben werden nicht offengelegt.',
      verificationDataUnavailableTitle: 'Assessment-Daten nicht verfügbar',
      verificationDataUnavailableText:
        'Der Datensatz existiert, aber seine gespeicherten Angaben können nicht sicher validiert werden. Es werden keine Angaben offengelegt.',
      verificationIdentityTitle: 'Berichtsidentität',
      cohortSizeLabel: 'Vergleichsgruppe: {count} aktive Teilnehmende',
    },
  },
  kb: {
    title: 'Wissensdatenbanken',
    create: 'Wissensdatenbank erstellen',
    nameLabel: 'Name',
    descriptionLabel: 'Beschreibung (optional)',
    createSuccess: 'Wissensdatenbank wurde erstellt.',
    createError: 'Die Wissensdatenbank konnte nicht erstellt werden.',
    deleteTitle: 'Wissensdatenbank löschen',
    deleteDescription:
      '„{name}“ wird sofort ausgeblendet. Gespeicherte Dateien und der externe Index werden im Hintergrund entfernt. Diese Aktion kann nicht rückgängig gemacht werden.',
    deleteSuccess:
      'Wissensdatenbank wurde entfernt. Die Bereinigung läuft im Hintergrund.',
    deleteError: 'Die Wissensdatenbank konnte nicht gelöscht werden.',
    emptyTitle: 'Noch keine Wissensdatenbanken',
    emptyDescription:
      'Erstellen Sie eine Wissensdatenbank, um erste Ressourcen hinzuzufügen.',
    noDescription: 'Keine Beschreibung',
    loadError: 'Die Wissensdatenbanken konnten nicht geladen werden.',
    searchKnowledgeBases: 'Wissensdatenbanken suchen',
    searchKnowledgeBasesPlaceholder: 'Nach Name oder Beschreibung suchen',
    noSearchResults: 'Keine passenden Wissensdatenbanken',
    noSearchResultsDescription:
      'Versuchen Sie es mit einem anderen Namen oder einer anderen Beschreibung.',
    searchResultCount:
      '{count, plural, =0 {Keine Wissensdatenbanken} one {# Wissensdatenbank} other {# Wissensdatenbanken}}',
    catalogMetrics:
      '{resources, plural, one {# Ressource} other {# Ressourcen}} · {chatbots, plural, one {# verknüpfter Chatbot} other {# verknüpfte Chatbots}}',
    loadMore: 'Weitere Wissensdatenbanken laden',
    notFound: 'Die Wissensdatenbank konnte nicht gefunden werden.',
    detailFallbackTitle: 'Wissensdatenbank',
    backToList: 'Zurück zu den Wissensdatenbanken',
    metricsTitle: 'Nutzung und Verknüpfungen',
    metricVisibleResources: 'Sichtbare Ressourcen',
    metricReservedResources:
      '{count, plural, =0 {Keine Upload-Reservierungen} one {# Upload-Reservierung} other {# Upload-Reservierungen}}',
    metricStorage: 'Speicherlimit',
    metricStorageBreakdown:
      '{visible} sichtbar · {reserved} für Uploads reserviert',
    unknownSizesReserved:
      '{count, plural, one {# ältere Ressource reserviert bis zu 25 MiB} other {# ältere Ressourcen reservieren je bis zu 25 MiB}}',
    metricPendingCleanup: 'Ausstehende Bereinigung',
    metricPendingCleanupSize: '{size} warten auf die Bereinigung',
    metricLinkedConsumers: 'Verknüpfte Chatbots',
    metricQuotaResources: '{count} Ressourcen werden dem Limit angerechnet',
    quotaReleaseMessage:
      'Gelöschte Ressourcen werden dem Limit weiterhin angerechnet, bis die Bereinigung im Hintergrund abgeschlossen ist.',
    fileUploadTitle: 'Datei hochladen',
    fileUploadDescription: 'Fügen Sie Kursmaterial von Ihrem Computer hinzu.',
    fileDropPrompt: 'Datei hier ablegen oder zum Auswählen klicken',
    fileUploadFormats: 'PDF, TXT oder MD · maximal 25 MB',
    uploading: 'Wird hochgeladen…',
    fileUploadSuccess: 'Datei wurde zur Wissensdatenbank hinzugefügt.',
    fileUploadError: 'Die Datei konnte nicht hochgeladen werden.',
    fileRejected: 'Wählen Sie eine unterstützte Datei mit maximal 25 MB.',
    linkTitle: 'Link hinzufügen',
    linkDescription:
      'Registrieren Sie eine Website oder Medienressource für die Verarbeitung.',
    resourceTitleLabel: 'Titel',
    urlLabel: 'URL',
    invalidUrl:
      'Geben Sie eine gültige URL ein, die mit http:// oder https:// beginnt.',
    linkSuccess: 'Link wurde zur Wissensdatenbank hinzugefügt.',
    linkError: 'Der Link konnte nicht hinzugefügt werden.',
    resourcesTitle: 'Ressourcen',
    resourceColumn: 'Ressource',
    resourceActions: 'Aktionen',
    resourcesLoadError: 'Die Ressourcen konnten nicht geladen werden.',
    searchResources: 'Ressourcen suchen',
    searchResourcesPlaceholder: 'Titel, Dateiname oder URL suchen',
    filterType: 'Typ',
    filterStatus: 'Letzte Verarbeitung',
    filterAll: 'Alle',
    typeFile: 'Datei',
    typeUrl: 'Link',
    addResource: 'Ressource hinzufügen',
    addResourceTitle: 'Ressource hinzufügen',
    addResourceDescription:
      'Wählen Sie, wie Sie diese Ressource hinzufügen möchten.',
    addWebsite: 'Website',
    addWebsiteDescription: 'Eine Website-URL zur Verarbeitung registrieren.',
    addDocument: 'Dokument',
    addDocumentDescription: 'Eine PDF-, TXT- oder Markdown-Datei hochladen.',
    addVideo: 'Video',
    comingSoon: 'Demnächst verfügbar',
    configure: 'Konfigurieren',
    backToResourceTypes: 'Zurück',
    noResourceResults: 'Keine Ressourcen entsprechen diesen Filtern.',
    resourceResultCount:
      '{count, plural, =0 {Keine Ressourcen} one {# Ressource} other {# Ressourcen}}',
    selectAllPage: 'Bis zu 50 verfügbare Ressourcen auswählen',
    selectResource: '„{title}“ auswählen',
    loadMoreResources: 'Weitere Ressourcen laden',
    noResources: 'Es wurden noch keine Ressourcen hinzugefügt.',
    emptyResourceHint:
      'Verwenden Sie oben «Ressource hinzufügen», um eine Website oder ein Dokument hinzuzufügen.',
    updatedAtLabel: 'Aktualisiert',
    updatedAt: 'Aktualisiert {date}',
    statusAdded: 'Hinzugefügt',
    statusQueued: 'In Warteschlange',
    statusProcessing: 'In Verarbeitung',
    statusReady: 'Bereit',
    statusFailed: 'Fehlgeschlagen',
    deleteResourceTitle: 'Ressource löschen',
    deleteResourceDescription:
      '„{title}“ wird sofort ausgeblendet. Die gespeicherte Datei und der externe Index werden im Hintergrund entfernt. Diese Aktion kann nicht rückgängig gemacht werden.',
    deleteResourceSuccess:
      'Ressource wurde entfernt. Die Bereinigung läuft im Hintergrund.',
    deleteResourceError: 'Die Ressource konnte nicht gelöscht werden.',
    bulkDelete: 'Ausgewählte löschen ({count})',
    bulkDeleteTitle:
      '{count, plural, one {# Ressource löschen} other {# Ressourcen löschen}}',
    bulkDeleteConfirm:
      '{count, plural, one {Ressource löschen} other {# Ressourcen löschen}}',
    bulkDeleteDescription:
      '{count, plural, one {Die ausgewählte Ressource wird sofort ausgeblendet. Gespeicherte Dateien und externe Indizes werden im Hintergrund entfernt. Diese Aktion kann nicht rückgängig gemacht werden.} other {Die # ausgewählten Ressourcen werden sofort ausgeblendet. Gespeicherte Dateien und externe Indizes werden im Hintergrund entfernt. Diese Aktion kann nicht rückgängig gemacht werden.}}',
    bulkDeleteSuccess:
      '{count, plural, one {Ressource wurde entfernt. Die Bereinigung läuft im Hintergrund.} other {# Ressourcen wurden entfernt. Die Bereinigung läuft im Hintergrund.}}',
    bulkDeleteError:
      'Das Löschen konnte nicht bestätigt werden. Aktualisieren Sie die Liste, bevor Sie es erneut versuchen.',
    ingestResource: 'Verarbeiten',
    retryIngestion: 'Erneut versuchen',
    reingestResource: 'Neu verarbeiten',
    ingestResourceSuccess: 'Ressource wurde zur Verarbeitung eingeplant.',
    ingestResourceError:
      'Die Ressource konnte nicht zur Verarbeitung eingeplant werden.',
    operationStatus: 'Letzte Verarbeitung',
    operationInProgress:
      'Dieser Vorgang läuft im Hintergrund. Sie können diese Seite verlassen.',
    backgroundOperationsMessage:
      'Ein oder mehrere Vorgänge laufen noch. Die Status werden automatisch aktualisiert und Sie können diese Seite sicher verlassen.',
    servingStatus: 'Für KI verfügbar',
    notServing: 'Noch nicht verfügbar',
    servingCurrentVersion: 'Aktuelle Version {version}',
    servingPreviousVersion: 'Version {version} bleibt verfügbar',
    servingSince: 'Verfügbar seit {date}',
    version: 'Version {version}',
    recentAttempts: 'Letzte Versuche',
    noRecentAttempts: 'Noch keine Verarbeitungsversuche.',
    historyLoadError: 'Die letzten Versuche konnten nicht geladen werden.',
    runStatusQueued: 'In Warteschlange',
    runStatusProcessing: 'In Verarbeitung',
    runStatusSucceeded: 'Erfolgreich',
    runStatusFailed: 'Fehlgeschlagen',
    runStatusSuperseded: 'Ersetzt',
    ingestionStartError:
      'Der Verarbeitungsvorgang konnte nicht gestartet werden.',
    storageLimitError:
      'Diese Ressource überschreitet das Speicherlimit von 500 MiB für die Wissensdatenbank.',
    resourceLimitError:
      'Diese Wissensdatenbank hat ihr Limit von 100 Ressourcen erreicht.',
    uploadMismatchError:
      'Die hochgeladene Datei stimmt nicht mehr mit ihrer Upload-Reservierung überein. Laden Sie sie erneut hoch.',
    ingestionFailed: 'Der Verarbeitungsvorgang ist fehlgeschlagen.',
    ingestionSuperseded: 'Der Verarbeitungsvorgang wurde ersetzt.',
    inspectResource: 'Details',
    inspectorTitle: 'Ressourcendetails',
    sourceType: 'Quelltyp',
    sourceLocation: 'Quell-URL',
    fileName: 'Ursprünglicher Dateiname',
    mimeType: 'Medientyp',
    fileSize: 'Dateigrösse',
    createdAt: 'Erstellt',
    chatbotsTitle: 'Verknüpfte Chatbots',
    chatbotsDescription:
      'Wählen Sie, welcher Chatbot diese Wissensdatenbank verwenden kann. Ein Chatbot kann jeweils eine Wissensdatenbank verwenden.',
    chatbotsLoadError: 'Die Chatbots konnten nicht geladen werden.',
    noChatbots:
      'Erstellen Sie einen Chatbot, bevor Sie eine Wissensdatenbank verknüpfen.',
    chatbotSelectLabel: 'Chatbot',
    chatbotSelectPlaceholder: 'Chatbot auswählen',
    attachChatbot: 'Chatbot verknüpfen',
    replaceChatbot: 'Wissensdatenbank ersetzen',
    detachChatbot: 'Verknüpfung aufheben',
    linkedChatbots: 'Verwendet diese Wissensdatenbank',
    noLinkedChatbots: 'Kein Chatbot verwendet diese Wissensdatenbank.',
    chatbotReplacementWarning:
      'Dieser Chatbot verwendet derzeit „{kbName}“. Durch die Verknüpfung wird diese Wissensdatenbank ersetzt.',
    chatbotAttachSuccess: 'Chatbot wurde mit der Wissensdatenbank verknüpft.',
    chatbotAttachError: 'Der Chatbot konnte nicht verknüpft werden.',
    chatbotDetachSuccess: 'Die Verknüpfung des Chatbots wurde aufgehoben.',
    chatbotDetachError:
      'Die Verknüpfung des Chatbots konnte nicht aufgehoben werden.',
    previewAccessError:
      'Der Wissensdatenbank-Arbeitsbereich ist für Ihr Konto noch nicht verfügbar.',
    graphTitle: 'Wissensgraph',
    graphDescription:
      'Erstellen Sie aus den Ressourcen der Wissensdatenbank einen Graphen und prüfen Sie das veröffentlichte Ergebnis.',
    graphQualityTierLabel: 'Qualität des Aufbaus',
    graphQualityStandard: 'Standard (geringere Kosten)',
    graphQualityHigh: 'Hoch (höhere Kosten)',
    graphBuild: 'Graph erstellen',
    graphRebuild: 'Graph neu erstellen',
    graphBuildCost: 'Geschätzte Kosten für diesen Aufbau: {amount}.',
    graphEnableLabel: 'Wissensgraph für diese Wissensdatenbank aktivieren',
    graphEnabledDescription:
      'Ein veröffentlichter Graph kann von aktivierten Chatbot-Verknüpfungen dieser Wissensdatenbank verwendet werden.',
    graphDisabledDescription:
      'Aktivieren Sie die Wissensdatenbank, bevor Sie einen Graphen erstellen oder für Studierende bereitstellen.',
    graphCostUnavailable:
      'Die Kostenkontrollen für Graphen sind noch nicht konfiguriert. Der Aufbau bleibt deaktiviert.',
    graphEnableError:
      'Die Einstellung des Wissensgraphen konnte nicht aktualisiert werden.',
    graphBillingLabel: 'Abrechnungsmodus',
    graphBillingSemesterQuota: 'Semesterkontingent',
    graphBillingProvider: 'Durch Anbieter abgerechnet',
    graphRemainingQuota: 'Verbleibendes Semesterkontingent',
    graphWorstCaseBalance: 'Kontostand nach dem maximalen Aufbau',
    graphMaxCost: 'Maximal reservierte Kosten',
    graphCostStatus: 'Kostenreservierung',
    graphCostStatusReserved: 'Reserviert',
    graphCostStatusSettled: 'Abgerechnet',
    graphCostStatusReleased: 'Freigegeben',
    graphCostStatusNeedsHumanReview: 'Zur manuellen Prüfung zurückgehalten',
    graphActualCost: 'Tatsächliche Kosten',
    graphActualUsage:
      'Tatsächliche Nutzung: {requests} Anfragen, {inputTokens} Eingabetoken, {outputTokens} Ausgabetoken, {embeddingTokens} Embedding-Token.',
    graphStatusLabel: 'Status',
    graphStatusEmpty: 'Kein Aufbau',
    graphStatusQueued: 'In Warteschlange',
    graphStatusProcessing: 'In Verarbeitung',
    graphStatusSucceeded: 'Erfolgreich',
    graphStatusFailed: 'Fehlgeschlagen',
    graphStale: 'Veraltet',
    graphBuildId: 'Aufbau {buildId}',
    graphLoading: 'Graphstatus wird geladen…',
    graphLoadError: 'Der Graphstatus konnte nicht geladen werden.',
    graphRetry: 'Erneut versuchen',
    graphBuildError: 'Der Graphaufbau konnte nicht gestartet werden.',
    graphPreviewTitle: 'Veröffentlichter Graph',
    graphGenerateElements: 'Klicker-Elemente generieren',
    graphElementGenerationUnavailable:
      'Dieser veröffentlichte Graph enthält noch kein Paket zur Elementgenerierung. Erstellen Sie ihn neu, um Klicker-Elemente zu generieren.',
    graphPreviewUnavailable:
      'Erstellen und veröffentlichen Sie einen Graphen, bevor Sie die Dozierendenansicht öffnen.',
    ingestionDisabledError:
      'Das Hinzufügen neuer Inhalte zu Wissensdatenbanken ist vorübergehend deaktiviert.',
  },
  manage: {
    assistant: {
      open: 'Assistent',
      title: 'KlickerUZH Assistant',
      subtitle: 'KI-Assistent für Ihre Kurse und Ihren Fragepool',
      openInNewTab: 'Assistent in einem neuen Tab öffnen',
      loading: 'Assistent wird geladen…',
      resize: 'Grösse des Assistenten ändern',
      resizeHint:
        'Ziehen Sie, um die Grösse zu ändern. Die Pfeiltasten ändern die Grösse ebenfalls.',
      elementCreatedToast: 'Entwurf "{name}" zum Fragepool hinzugefügt',
    },
    ai: {
      unavailableTitle: 'KI-Funktionen nicht verfügbar',
      unavailableDescription:
        'Die KI-Funktionen befinden sich in der Beta-Phase und sind für Ihr Konto noch nicht verfügbar. Bitte wenden Sie sich für den Zugang an Ihre Administratorin oder Ihren Administrator.',
    },
    general: {
      qrCode: 'QR Code',
      presentQrCode: 'QR-Code präsentieren',
      questionPool: 'Fragepool',
      library: 'Bibliothek',
      quizzes: 'Quizzes',
      analytics: 'Analytics',
      liveQuizzes: 'Live Quizzes',
      courses: 'Kurse',
      resources: 'Ressourcen',
      ai: 'KI',
      betaFeatures: 'Beta-Funktionen',
      catalog: 'Katalog',
      mediaLibrary: 'Mediathek',
      userGroups: 'Benutzergruppen',
      adminPanel: 'Admin-Panel',
      '404Message':
        'Die von Ihnen aufgerufene Seite existiert leider nicht. Kehren sie zur <link>Bibliothek</link> zurück oder nutzen sie das Menu zur weiteren Navigation.',
      date: 'Datum',
      dateCreated: 'Erstellungsdatum',
      dateModified: 'Änderungsdatum',
      title: 'Titel',
      elementType: 'Elementtyp',
      activityType: 'Aktivitätstyp',
      status: 'Status',
      searchPlaceholder: 'Suchen...',
      sortBy: 'Sortieren nach..',
      catalystRequired:
        'Catalyst-Zugriff erforderlich. Mehr Informationen unter <link></link>.',
      elementPreview: 'Elementvorschau: {element}',
      elementPreviewRedirect: 'Vorschau in einem neuen Tab öffnen',
      elementTypeDescription: 'Typ',
      elementPreviewDescription: 'Vorschau',
      basePointsDescription: 'Basispunkte',
      correctnessPointsDescription: 'Korrektheitspunkte',
      bonusPointsDescription: 'Bonuspunkte',
      totalPointsSynchronousDescription: 'Maximal erreichbare Punkte',
      totalPointsAsynchronousDescription: 'Erreichbare Punkte',
      pointTypeDescription: 'Punkttyp',
      pointAmountDescription: 'Menge',
      pointsMultiplierDescription: 'Multiplikator',
      sampleSolutionDescription: 'Musterlösung',
      gradingDescription: 'Dokumentation',
      showingResults:
        '{start} bis {end} von {total} Ergebnissen werden angezeigt',
      NEntriesPerPage: '{N} Ergebnisse pro Seite',
      previousPage: 'Vorherige',
      nextPage: 'Nächste',
    },
    admin: {
      pageName: 'Admin-Panel',
      privatePreviewAvailability: 'Verfügbarkeit: Private Features',
      privatePreviewDescription:
        'Alle Benutzer in der folgenden Liste haben Zugriff auf Funktionen, die derzeit als "Private Preview" gekennzeichnet sind. Neue Benutzer können durch Eingabe ihrer E-Mail-Adresse (primäre Edu-ID-E-Mail) hinzugefügt werden.',
      grantAccessEmailLabel: 'Benutzer E-Mail-Adresse',
      grantAccessTooltip:
        'Bitte geben Sie die primäre Edu-ID-E-Mail-Adresse des Benutzers ein, dem Zugriff auf die privaten Funktionen gewährt werden soll. Alle Benutzer müssen sich zuvor bei KlickerUZH angemeldet haben. Die gespeicherte E-Mail-Adresse kann im Benutzerprofil eingesehen werden.',
      grantAccess: 'Zugriff gewähren',
      grantAccessEmailError: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
      grantAccessEmailRequired:
        'Um Zugriff zu gewähren, geben Sie bitte eine E-Mail-Adresse ein.',
      accessGranted:
        'Der Zugriff auf private Vorschaufunktionen wurde dem angegebenen Benutzer erfolgreich gewährt.',
      alreadyAccess:
        'Der angegebene Benutzer hat bereits Zugriff auf private Vorschaufunktionen.',
      userNotExist:
        'Der angegebene Benutzer existiert nicht. Bitte überprüfen Sie die E-Mail-Adresse und stellen Sie sicher, dass sich der Benutzer mindestens einmal bei KlickerUZH angemeldet hat.',
      grantAccessError:
        'Beim Gewähren des Zugriffs auf private Vorschaufunktionen ist ein Fehler aufgetreten. Dies könnte auf unzureichende Berechtigungen oder einen Systemfehler zurückzuführen sein.',
      aiFeaturesAvailability: 'Verfügbarkeit: KI-Funktionen',
      aiFeaturesDescription:
        'Alle Benutzer in der folgenden Liste dürfen die KI-Funktionen nutzen, welche Modellbudget verbrauchen. Aktivieren Sie ein Konto erst, wenn eine Kostenstelle vorliegt, der die Nutzung verrechnet werden kann. Die Aktivierung und Deaktivierung erfolgt über die Eingabe der E-Mail-Adresse (primäre Edu-ID-E-Mail).',
      aiFeaturesEnable: 'Aktivieren',
      aiFeaturesDisable: 'Deaktivieren',
      aiFeaturesEnabled:
        'Der angegebene Benutzer wurde für die KI-Funktionen aktiviert.',
      aiFeaturesDisabled:
        'Der angegebene Benutzer wurde für die KI-Funktionen deaktiviert.',
      aiFeaturesUnchanged:
        'Der angegebene Benutzer hatte die gewünschte Einstellung für die KI-Funktionen bereits.',
      aiFeaturesError:
        'Beim Ändern der Einstellung für die KI-Funktionen ist ein Fehler aufgetreten. Dies könnte auf unzureichende Berechtigungen oder einen Systemfehler zurückzuführen sein.',
    },
    activities: {
      activityType: 'Aktivitätstyp',
      modeFilters: 'Modus',
      noActivitiesAvailable:
        'Bisher sind keine Aktivitäten verfügbar. Sie können neue Aktivitäten einfach durch die Kombination von Elementen in der <link>Bibliothek</link> erstellen.',
      noActivitiesWarning:
        'Leider konnten keine Aktivitäten gefunden werden, welche den gewünschten Kriterien entsprechen.',
      liveQuizInfo: '{numOfBlocks} Blöcke, {numOfElements} Element(e)',
      activityInfo: '{numOfStacks} Stack(s), {numOfElements} Element(e)',
      activityDetails: 'Aktivitätsdetails',
      lastModifiedAt: 'Zuletzt bearbeitet am {date}',
      instancesOutdated: 'Aktivität enthält veraltete Elemente',
      instanceUpdateDraftScheduled:
        'Für einige der in dieser Aktivität enthaltenen Elemente sind neuere Versionen in der Bibliothek verfügbar. Dies passiert, wenn Sie ein Element editieren, während die Aktivität bereits veröffentlicht ist oder ohne die Aktualisierungen in Aktivitäten zu aktivieren.<ul><li>Um veraltete Versionen von Elementen zu aktualisieren, <b>bearbeiten Sie die Aktivität</b> und wählen Sie die Instanzen aus, die Sie im letzten Schritt des Assistenten aktualisieren möchten.</li><li>Alternativ können Sie beim Ändern der entsprechenden Elemente auch wählen, die in Entwurfs- und geplanten Aktivitäten enthaltenen Instanzen zu aktualisieren.</li><li>Um eine Liste aller veralteten Instanzen zu erhalten, öffnen Sie bitte die Aktivitätsinformationen, indem Sie auf den Titel der Aktivität in der Übersicht klicken.</li></ul>',
      instanceUpdateTemplate:
        'Für einige der in dieser Vorlage enthaltenen Elemente sind neuere Versionen in der Bibliothek verfügbar. Dies passiert, wenn Sie ein Element editieren, ohne die Aktualisierungen in Vorlagen zu aktivieren.<ul><li>Um veraltete Versionen von Elementen zu aktualisieren, erstellen Sie die Vorlage erneut.</li><li>Alternativ können Sie beim Ändern der entsprechenden Elemente auch wählen, die in Vorlagen enthaltenen Instanzen zu aktualisieren.</li><li>Um eine Liste aller veralteten Instanzen zu erhalten, öffnen Sie bitte die Übersicht, indem Sie auf den Titel der Vorlage in der Liste klicken.</li></ul>',
      automaticPublicationAt: 'Automatische Veröffentlichung am {date}',
      availability: 'Verfügbarkeit: {startDate} - {endDate}',
      removeActivity: 'Aktivität entfernen',
      confirmActivityRemoval:
        'Bitte bestätigen Sie die folgenden Konsequenzen der Entfernung der Aktivität <b>{name}</b> aus Ihrem Benutzerkonto.',
      activityRemovalFinal:
        'Die Entfernung der Aktivität wird sie aus Ihrem Benutzerkonto entfernen, aber nicht deren Inhalt löschen. Zudem bleiben veröffentlichte Aktivitäten für alle Studierenden weiterhin verfügbar. Die Aktion kann nicht rückgängig gemacht werden.',
      activityRemovalDerivedAccessHint:
        'Wenn diese Aktivität einem Kurs zugewiesen ist, auf den Sie Zugriff haben, kann sie aus technischen Gründen nicht vollständig entfernt werden. In diesem Fall erhalten Sie automatisch eine abgeleitete Berechtigung für die Aktivität, nachdem Sie deren Entfernung ausgelöst haben. Sobald der zugehörige Kurs gelöscht oder entfernt wird, wird das Element ebenfalls automatisch entfernt.',
      activityRemovalDependencyAccess:
        'Abgeleitete Zugriffsrechte auf enthaltene Elemente und Ressourcen werden automatisch widerrufen (es sei denn, diese sind technisch erforderlich).',
      activeFiltersWarning:
        'Aktuell sind Filter aktiv, welche die angezeigten Aktivitäten beeinflussen können. Um alle Aktivitäten anzuzeigen, können Sie die Filter <reset>zurücksetzen</reset> oder verändern Sie diese auf der rechten Seite.',
      changeActivityName: 'Aktivitätsnamen ändern',
      activityNameChangeSuccess:
        'Der Name der Aktivität wurde erfolgreich geändert.',
      activityNameChangeError:
        'Der Name der Aktivität konnte nicht geändert werden.',
      noCourseAssigned: 'Kein Kurs zugewiesen',
      actionsLegend: 'Aktionen für Aktivitäten',
      activityDetailsNoInstanceSelected:
        'Bitte wählen Sie ein Element aus einem Block, um eine Vorschau und die entsprechende Bepunktung einzusehen.',
      previewElement: 'Elementvorschau',
      editElement: 'Element bearbeiten',
      noElementEditPermissions:
        'Sie haben nicht aussreichende Berechtigungen, um dieses Element zu bearbeiten.',
      deletedElement:
        'Dieses Element wurde gelöscht und kann daher nicht mehr bearbeitet werden.',
      activityInformation: 'Aktivitätsinformationen',
      activityMultiplier: 'Aktivitäts-Multiplikator',
      reviewCompleted: 'Review abgeschlossen',
      resetReview: 'Review zurücksetzen',
      reviewStatusUpdated: 'Review-Status erfolgreich aktualisiert',
      reviewStatusUpdateFailed:
        'Aktualisierung des Review-Status fehlgeschlagen',
      openElementsInLibrary: 'Elemente in Bibliothek öffnen',
      batchOperations:
        'Batch-Operationen ({numActivities, plural, =1 {1 Aktivität} other {# Aktivitäten}})',
      batchOperationsOnlyDraftScheduled:
        'Batch-Operationen können nur mit Entwurfs- oder geplanten Aktivitäten ausgeführt werden.',
      batchOperationsActivities: 'Aktivitäten - Batch-Operationen',
      batchNotApplicableExplanation:
        'Die ausgewählten Batch-Operationen können aus den folgenden Gründen nicht auf diese Aktivität angewendet werden:',
      modifyMultiplier: 'Multiplikator ändern',
      changeCourse: 'Kurszuweisung ändern',
      modifyLiveQuizPoints: 'Bepunktung anpassen (nur Live Quiz)',
      deleteSelectedActivities: 'Aktivitäten löschen',
      batchDeleteDescription:
        'Berechtigte Aktivitäten unwiderruflich löschen. Das Löschen kann nicht mit anderen Batch-Aktionen kombiniert werden.',
      enableLiveQuizPointsModification:
        'Basis, Korrektheits- und Bonuspunkte anpassen',
      bonusTime: 'Bonuszeit',
      bonusTimeNonNegative:
        'Die Zeitspanne während welcher Bonuspunkte vergeben werden muss mindestens 1 Sekunde betragen. Um keine Bonuspunkte zu vergeben, setzen Sie die Bonuspunkte auf 0.',
      noActivitiesWillBeUpdated: 'Keine Aktivitäten werden verändert',
      nActivitiesWillBeUpdated: '{number} Aktivitäten werden angepasst',
      noActivitiesWillBeDeleted: 'Keine Aktivitäten werden gelöscht',
      nActivitiesWillBeDeleted:
        '{number, plural, =1 {# Aktivität wird gelöscht} other {# Aktivitäten werden gelöscht}}',
      nOfMActivitiesWillBeDeleted:
        '{affected}/{total} Aktivitäten werden gelöscht',
      activityContainsNoElements: 'Diese {activity} enthält keine Elemente.',
      multiplierRequiresGamifiedAssessmentCourse:
        'Ein Multiplikator kann nur für gamifizierte Aktivitäten oder Aktivitäten in Assessment-Kursen definiert werden, da nur in diesen Kursen Punkte gesammelt werden können. Sie haben die Zuweisung zu einem Kurs gewählt, welcher diese Bedingungen nicht erfüllt.',
      liveQuizPointsRequireGamifiedAssessmentCourse:
        'Die Bepunktung kann nur für gamifizierte Live Quizzes oder Live Quizzes in Assessment-Kursen angepasst werden, da nur in diesen Kursen Punkte gesammelt werden können. Sie haben die Zuweisung zu einem Kurs gewählt, welcher diese Bedingungen nicht erfüllt.',
      batchNoCoursesAvailable:
        'Es sind keine laufenden oder geplanten Kurse verfügbar zu welchen Sie Ihre Aktivitäten zuweisen könnten. Bitte erstellen Sie zunächst einen entsprechenden Kurs unter "Kurse"',
      batchOperationsInformation: `Abhängig von den ausgewählten Aktionen und den Berechtigungen für die selektierten Aktivitäten gelten die folgenden Regeln:
<ul>
<li>Veränderungen des Multiplikators sind nur für gamifizierte Aktivitäten oder Aktivitäten als Teil eines Assessment-Kurses möglich. Wird eine neue Kurszuweisung im gleichen Schritt als Batch-Operation gewählt, werden die Gamifizierungs- und Assessment-Einstellungen dieses Kurses genutzt.</li>
<li>Aktivitäten können grundsätzlich allen laufenden und zukünftigen Kursen zugewiesen werden. Bei Microlearnings und Gruppenaktivitäten werden zusätzlich nur Zuweisungen erlaubt, bei welchen das Verfügbarkeits-Intervall der Aktivität vollständig in der Kurslaufzeit liegt.</li>
<li>Basis-, Korrektheits- und Bonuspunkte können nur für Live Quizzes definiert und angepasst werden. Bei Aktivierung dieser Option werden andere Aktivitätstypen nicht geupdated.</li>
<li>Alle Anpassungen erfordern mindestens Schreibrechte auf der jeweiligen Aktivität. Für das unwiderrufliche Löschen ist Administratorzugriff erforderlich.</li>
</ul>
      `,
      selectedActivitiesDescription:
        'Sie haben die folgenden Aktivitäten ausgewählt. Alle Aktivitäten, welche von den gewählten Aktionen betroffen sind, sind markiert. Hovern Sie über dem Symbol für nicht betroffene Aktivitäten für mehr Informationen. Bitte beachten Sie: Einige Aktionen können nur einzeln durchgeführt werden oder erfordern bestimmte Zugriffsrechte (siehe Tooltip). Überprüfen Sie die ausgewählten Aktionen sorgfältig, bevor Sie diese anwenden.',
      batchInvalidStatus:
        'Nur Entwurfs- und geplante Aktivitäten können über Batch-Operations angepasst werden.',
      batchNeedEditorPermissions:
        'Um eine Aktivität über die Batch-Operationen anzupassen, benötigen Sie mindestens Schreibzugriff.',
      batchNeedManagerPermissions:
        'Um eine Aktivität unwiderruflich zu löschen, benötigen Sie Administratorzugriff.',
      batchMultiplierRequiresGamificationOrAssessment:
        'Eine Veränderung des Multiplikators ist nur für gamifizierte Aktivitäten oder Aktivitäten mit Assessment-Kurs Zuweisung möglich.',
      batchGroupActivityRequiresGroupsEnabled:
        'Gruppenaktivitäten können nur Kursen zugewiesen werden, in welchen die Gruppenbildung aktiviert ist.',
      batchAssessmentRemovalAdminOnly:
        'Aktivitäten, welche sich im Assessment-Modus (mit Zuweisung zu einem Assessment-Kurs) befinden, können nur von Administratoren des entsprechenden Kurses aus diesem entfernt werden.',
      batchAssessmentDeletionAdminOnly:
        'Assessment-Live-Quizzes können nur von Administratoren des entsprechenden Assessment-Kurses gelöscht werden.',
      batchActivityDatesOutsideCourse:
        'Das Verfügbarkeitsintervall von Gruppenaktivtäten und Microlearnings muss vollständig innerhalb der Kurslaufzeit liegen.',
      batchGroupActivityRequiresFinalizedGroups:
        'Gruppenaktivitäten können nur Kursen zugewiesen werden, bei welchen die Gruppenbildung zum Startdatum der Aktivität abgeschlossen ist.',
      batchPointsOnlyLiveQuiz:
        'Basis-, Korrektheits- und Bonuspunkte können nur für Live Quizzes definiert und angepasst werden.',
      batchPracticeQuizScheduledWithinCourse:
        'Bei geplanten Übungsquizzes (mit definiertem Zeitpunkt zur automatischen Publikation) muss der Publikationszeitpunkt innerhalb der Kursdauer liegen.',
      batchOperationSuccess:
        'Ihre Batch-Operation wurde erfolgreich durchgeführt.',
      batchOperationPartialSuccess:
        'Nur ein Teil Ihrer Batch-Operation konnte erfolgreich angewendet werden. Bitte überprüfen Sie die betroffenen Aktivitäten und Ihre Berechtigungen.',
      batchOperationFailed:
        'Beim Anwenden der Batch-Operation ist ein Fehler aufgetreten. Bitte überprüfen Sie Ihre Berechtigungen und versuchen Sie es erneut.',
      confirmBatchDeletionTitle: 'Ausgewählte Aktivitäten löschen',
      confirmBatchDeletionMessage:
        'Sie sind im Begriff, {number, plural, =1 {1 Aktivität} other {# Aktivitäten}} einschliesslich der zugehörigen Teilnehmerdaten und Resultate unwiderruflich zu löschen. Diese Aktion kann nicht rückgängig gemacht werden.',
      confirmBatchDeletionIrreversible:
        'Ich verstehe, dass {number, plural, =1 {die Aktivität und die zugehörigen Daten} other {alle # Aktivitäten und die zugehörigen Daten}} unwiderruflich gelöscht und nicht wiederhergestellt werden können.',
      confirmBatchDeletionAcknowledge: 'Bestätigen',
      confirmBatchDeletionSubmit: 'Aktivitäten löschen',
      batchDeletionProgress:
        'Löschung läuft: {completed} von {total, plural, =1 {1 Aktivität} other {# Aktivitäten}} abgeschlossen. Bitte lassen Sie dieses Fenster geöffnet.',
      batchDeletionRefreshFailed:
        'Die Löschung ist abgeschlossen, aber die Aktivitätenliste konnte nicht aktualisiert werden. Laden Sie die Liste neu, bevor Sie fortfahren.',
      batchDeletionNoEligibleActivities:
        'Keine der ausgewählten Aktivitäten war zum Löschen berechtigt. Die Auswahl wurde zurückgesetzt; überprüfen Sie die Aktivitätenliste, bevor Sie es erneut versuchen.',
      batchDeletionSuccess:
        'Die berechtigten ausgewählten Aktivitäten wurden erfolgreich gelöscht.',
      batchDeletionPartialSuccess:
        'Nur ein Teil der ausgewählten Aktivitäten konnte gelöscht werden. Bitte überprüfen Sie die verbleibenden Aktivitäten und Ihre Berechtigungen.',
      batchDeletionUncertain:
        'Das Ergebnis einiger Löschvorgänge konnte nicht bestätigt werden. Bitte überprüfen Sie die Aktivitätenliste und laden Sie diese bei Bedarf neu, bevor Sie es erneut versuchen.',
      batchDeletionFailed:
        'Die ausgewählten Aktivitäten konnten nicht gelöscht werden. Bitte überprüfen Sie Ihre Berechtigungen und versuchen Sie es erneut.',
    },
    assessment: {
      assessmentResults: 'Assessment Resultate',
      participantInvitations: 'Teilnehmendeneinladungen',
      participantInvitationsDescription:
        'Laden Sie Teilnehmende zu diesem Assessment-Kurs ein und verfolgen Sie, ob die Einladung angenommen wurde.',
      invitationBackToCourse: 'Zurück zum Kurs',
      invitationImportTitle: 'Einladungen importieren',
      invitationImportDescription:
        'Wählen Sie eine CSV-Datei mit den E-Mail-Adressen und Matrikelnummern der Teilnehmenden. Die Datei wird in Ihrem Browser verarbeitet, bevor die Einladungen übermittelt werden.',
      invitationAffiliationWarning:
        'Verwenden Sie genau die E-Mail-Adresse, die in der Swiss Edu-ID als verifizierte Hochschulzugehörigkeit hinterlegt ist (z. B. eine @uzh.ch-Adresse). Private E-Mail-Adressen können bei der Anmeldung möglicherweise nicht zugeordnet werden.',
      invitationDownloadTemplate: 'CSV-Vorlage herunterladen',
      invitationCsvPrompt: 'CSV-Datei mit Teilnehmenden auswählen',
      invitationCsvHeaders:
        'Erforderliche Spalten: email und matriculationNumber (Komma oder Semikolon als Trennzeichen).',
      invitationCsvReady:
        '{count, plural, one {# Zeile ist für den Import bereit} other {# Zeilen sind für den Import bereit}}',
      invitationSelectCsv: 'CSV-Datei auswählen',
      invitationImportButton:
        '{count, plural, one {# Einladung importieren} other {# Einladungen importieren}}',
      invitationCsvMissingHeaders:
        'Die CSV-Datei muss die Spalten email und matriculationNumber enthalten.',
      invitationCsvInvalidHeaders:
        'Die CSV-Datei muss genau eine email-Spalte und eine matriculationNumber-Spalte enthalten.',
      invitationCsvInvalidRows:
        'Jede CSV-Zeile muss gleich viele Spalten wie die Kopfzeile enthalten.',
      invitationCsvEmpty: 'Die CSV-Datei enthält keine Teilnehmendenzeilen.',
      invitationCsvParseError:
        'Die CSV-Datei konnte nicht gelesen werden. Prüfen Sie das Format und versuchen Sie es erneut.',
      invitationCsvTooLarge:
        'Die CSV-Datei ist zu gross. Wählen Sie eine Datei mit höchstens 1 MB.',
      invitationCsvTooManyRows:
        'Die CSV-Datei enthält mehr als {count} Teilnehmendenzeilen. Teilen Sie sie in kleinere Dateien auf.',
      invitationImportCompleted: 'Der Einladungsimport wurde abgeschlossen.',
      invitationImportFailed:
        'Die Einladungen konnten nicht importiert werden. Bitte versuchen Sie es erneut.',
      invitationImportInvalidEmail: 'Ungültiges E-Mail-Format',
      invitationImportSummary:
        'Verarbeitet: {total, plural, one {# Zeile} other {# Zeilen}}; {created} ausstehend, {accepted} angenommen, {duplicates} bereits vorhanden, {errors} Fehler.',
      invitationListTitle: 'Einladungen',
      invitationListDescription:
        'Angenommene Einladungen bleiben als Nachweis sichtbar. Ausstehende Einladungen können gelöscht werden.',
      invitationCount:
        '{count, plural, one {# Einladung} other {# Einladungen}}',
      invitationEmail: 'E-Mail',
      invitationMatriculationNumber: 'Matrikelnummer',
      invitationStatus: 'Status',
      invitationInvitedAt: 'Eingeladen',
      invitationActions: 'Aktionen',
      invitationStatusPending: 'Ausstehend',
      invitationStatusAccepted: 'Angenommen',
      invitationDeleteLabel: 'Ausstehende Einladung für {email} löschen',
      invitationDeleteTitle: 'Ausstehende Einladung löschen',
      invitationDeleteDescription:
        'Möchten Sie die ausstehende Einladung für {email} löschen? Die teilnehmende Person kann sie danach nicht mehr annehmen.',
      invitationDeleteSuccess: 'Die ausstehende Einladung wurde gelöscht.',
      invitationDeleteFailed:
        'Die ausstehende Einladung konnte nicht gelöscht werden. Aktualisieren Sie die Seite und versuchen Sie es erneut.',
      invitationEmpty: 'Es wurden noch keine Einladungen erstellt.',
      invitationLoadingError:
        'Die Teilnehmendeneinladungen konnten nicht geladen werden. Prüfen Sie Ihre Berechtigungen und versuchen Sie es erneut.',
      liveQuizStudentResultsTitle: 'Studierendenresultate',
      liveQuizStudentEmailColumn: 'Studierende (E-Mail)',
      liveQuizStudentGivenNameColumn: 'Vorname der studierenden Person',
      liveQuizStudentSurnameColumn: 'Nachname der studierenden Person',
      liveQuizStudentMatriculationNumberColumn:
        'Matrikelnummer der studierenden Person',
      liveQuizStudentResultsEmpty:
        'Es sind noch keine Studierendenresultate vorhanden.',
      errorLoadingLiveQuizResults:
        'Beim Laden der Resultate ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
      errorLoadingCourseResults:
        'Beim Laden der Kursresultate ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
      liveQuizSelectStudentInfo:
        'Um die von einem bestimmten Studierenden abgegebenen Antworten einsehen zu können, wählen Sie diesen bitte aus der Liste auf der linken Seite aus. Sie erhalten dann eine Übersicht über alle im Quiz enthaltenen Fragen, die jeweils abgegebene Antwort und die Bepunktung.',
      courseSelectStudentInfo:
        'Um die erreichten Punkte eines bestimmten Studierenden auf der Quizebene einsehen zu können, wählen Sie diesen bitte aus der Liste auf der linken Seite aus. Sie erhalten dann eine Übersicht über alle im Kurs enthaltenen Quizzes, die jeweils erreichten Punkte und die maximal erreichbaren Punkte.',
      liveQuizElement: 'Element',
      liveQuizStudentHasNoResponses:
        'Dieser Studierende hat noch keine Antworten eingereicht.',
      liveQuizResponse: 'Antwort',
      liveQuizOpenResponse: 'Antwort ansehen',
      liveQuizOpenCorrection: 'Punktkorrektur öffnen',
      liveQuizNoResponseSubmitted: 'Keine Antwort abgegeben',
      liveQuizQuestionAnswered: 'Beantwortet',
      liveQuizQuestionNotAnswered: 'Nicht beantwortet',
      liveQuizResponseFromBlock: 'Antwort aus {block}',
      liveQuizCorrect: 'Korrekt',
      liveQuizPartiallyCorrect: 'Teilweise korrekt',
      liveQuizIncorrect: 'Falsch',
      liveQuizNotAnswered: 'Nicht beantwortet',
      errorLoadingStudentLiveQuizResponses:
        'Beim Laden der Studierendenantworten ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
      responseBy: 'Antwort von {email}',
      noSampleSolution: 'Keine Musterlösung',
      detailedResultsLiveQuiz: 'Detailierte Resultate für dieses Live Quiz',
      reportRecordsButton: 'Assessment-Berichte ({count})',
      reportRecordsTitle: 'Ausgestellte Assessment-Berichte',
      reportRecordsLoadError:
        'Die Assessment-Berichte konnten nicht geladen werden. Bitte prüfen Sie Ihre Berechtigungen und versuchen Sie es erneut.',
      reportRecordsEmpty:
        'Es wurden keine passenden Assessment-Berichte gefunden.',
      reportSearchPlaceholder: 'Empfänger-E-Mail suchen',
      reportStatusAll: 'Alle Status',
      reportStatusActive: 'Aktiv',
      reportStatusRevoked: 'Widerrufen',
      reportStatusSuperseded: 'Ersetzt',
      reportRecipient: 'Empfänger:in',
      reportToken: 'Verifizierungsschlüssel',
      reportIssuedAt: 'Ausgestellt',
      reportStatus: 'Status',
      reportStatusChangedAt: 'Status geändert',
      reportActions: 'Aktionen',
      reportCopyLinkTooltip: 'Verifizierungslink kopieren',
      reportLinkCopied: 'Der Verifizierungslink wurde kopiert.',
      reportLinkCopyError:
        'Der Verifizierungslink konnte nicht kopiert werden.',
      reportRevoke: 'Widerrufen',
      reportRevokeTitle: 'Assessment-Bericht widerrufen',
      reportRevokeConfirm: 'Bericht widerrufen',
      reportRevokeMessage:
        'Den aktiven Assessment-Bericht für {email} widerrufen? Der bestehende Verifizierungslink zeigt den Datensatz sofort als widerrufen an.',
      reportRevokePolicy:
        'Derselbe unveränderte Assessment-Snapshot kann nicht erneut ausgestellt werden. Wenn sich verlässliche Angaben zu Identität, Kurs oder Punkten später ändern, kann die studierende Person einen neuen aktiven Bericht ausstellen.',
      reportRevocationSuccess: 'Der Assessment-Bericht wurde widerrufen.',
      reportAlreadyInactive:
        'Der Assessment-Bericht wurde inaktiv, bevor er widerrufen werden konnte. Sein aktueller Status wird in der Liste angezeigt.',
      reportRevocationError:
        'Der Assessment-Bericht konnte nicht widerrufen werden. Der lokale Status wurde nicht geändert.',
      reportRecordsRefreshError:
        'Der Berichtsstatus hat sich geändert, aber die sichtbare Liste konnte nicht aktualisiert werden. Schliessen und öffnen Sie den Dialog erneut, um den aktuellen Status zu laden.',
      reportTimeZone: 'Europe/Zurich',
    },
    support: {
      modalTitle: 'Support KlickerUZH',
      yourFeedback: 'Ihr Feedback',
      feedbackText:
        'Was funktioniert für Sie gut und was sollten wir verbessern? Teilen Sie Ideen, positive Erfahrungen und Probleme auf unserer öffentlichen Feedback-Plattform. Bitte geben Sie keine persönlichen Angaben oder Kursdaten ein.',
      feedbackDesc: 'Teilen Sie Ideen, positive Erfahrungen und Probleme.',
      furtherResources: 'Weitere Ressourcen',
      documentationDesc: 'Tutorials, Funktionsdokumentation und Release Notes',
      faq: 'FAQ',
      faqDesc: 'Häufig gestellte Fragen',
      connect: 'Kontakt',
      community: 'Community',
      communityDesc: 'Ein Ort für Diskussionen und Fragen rund um KlickerUZH',
      email: 'E-Mail',
      emailDesc: 'Kontaktieren Sie uns unter klicker@df.uzh.ch',
      aboutProject: 'Über das Projekt',
      projectUpdates: 'Projekt Updates',
      projectUpdatesDesc: 'Regelmässige Updates zu unserem Projekt',
      roadmap: 'Roadmap',
      roadmapDesc: 'Unsere aktuellen Prioritäten und Pläne für die Zukunft',
      releaseNotes: 'Release Notes',
      releaseNotesDesc:
        'Übersicht über Änderungen in unseren neuesten Releases',
      openSource: 'Open-Source',
      githubRepository: 'GitHub Repository',
      githubRepositoryDesc: 'Quellcode des Open-Source Projekts',
      survey:
        'Wir möchten gerne wissen, was Sie über KlickerUZH und unsere zukünftigen Pläne denken! Bitte geben Sie uns Ihr Feedback in einer <link>kurzen Umfrage (5 - 10min)</link>.',
      catalystRequest: {
        title: 'Catalyst-Zugang anfragen',
        subtitle:
          'Beschreiben Sie Ihren Anwendungsfall und wir melden uns bei Ihnen.',
        explanation:
          'Ihre Anfrage geht an klicker@df.uzh.ch. Wir antworten auf die E-Mail-Adresse Ihres Kontos und verwenden Ihre Daten ausschliesslich zur Bearbeitung dieser Anfrage.',
        institution: 'Institution',
        institutionRequired: 'Bitte geben Sie Ihre Institution ein.',
        institutionMin: 'Bitte geben Sie mindestens 2 Zeichen ein.',
        institutionMax: 'Bitte geben Sie höchstens 160 Zeichen ein.',
        useCase: 'Geplante Verwendung',
        useCaseRequired: 'Bitte beschreiben Sie die geplante Verwendung.',
        useCaseMin: 'Bitte geben Sie mindestens 20 Zeichen ein.',
        useCaseMax: 'Bitte geben Sie höchstens 2000 Zeichen ein.',
        submit: 'Anfrage senden',
      },
    },
    login: {
      lecturerLogin: 'Login Dozierende',
      installAndroid:
        'Installieren Sie die KlickerUZH Manage-App auf Ihrem Handy, um gewisse Funktionen für Dozierenden jederzeit nutzen zu können.',
      installIOS:
        "Öffnen Sie den Share-Dialog und klicken Sie auf 'Zum Startbildschirm hinzufügen', um die KlickerUZH Manage-App auf Ihrem Handy zu installieren.",
    },
    firstLogin: {
      welcome: 'Willkommen bei KlickerUZH!',
      makeFirstSettings:
        'Da Sie KlickerUZH v3.0 zum ersten Mal nutzen, möchten wir Ihnen gerne helfen, einige wichtige Einstellungen gleich zu Beginn vorzunehmen, damit Sie so effizient wie möglich starten können. Dazu gehören Ihre bevorzugte Sprache sowie der Kurzname, der mit diesem Konto verknüpft ist. Beides kann jederzeit in den Benutzereinstellungen erneut geändert werden.',
      relevantLinks:
        'Stellen Sie sicher, dass Sie die folgenden relevanten Links gesehen/gespeichert haben:',
      watchVideo:
        'Bitte nehmen Sie sich die Zeit, sich das folgende Einführungsvideo anzusehen, welches alle Kernkonzepte von KlickerUZH v3.0 und seine wichtigsten Funktionen abdeckt. Möchten Sie diesen Schritt überspringen, speichern Sie Ihre Einstellungen einfach mit dem Button unterhalb des Videos.',
      seedDemoElements: 'Demo-Elemente generieren',
      seedDemoElementsExplanation:
        'Bitte wählen Sie, ob Demo-Elemente zur Demonstration der verfügbaren Element-Typen in Ihrer Bibliothek generiert werden sollen. Diese können jederzeit gelöscht werden.',
      seedDemoElementsDecisionRequired:
        'Bitte wählen Sie, ob Demo-Elemente generiert werden sollen oder nicht.',
    },
    settings: {
      advancedModelUsage: 'Nutzung des fortgeschrittenen Modells',
      baseModelUsage: 'Nutzung des Basismodells',
      chatAccountUsageDescription:
        'Prüfen Sie die geschätzte Nutzung des aktuellen Monats für jede Nutzungsklasse.',
      chatAccountUsageBoundaryDescription:
        'Budgets werden für die Betriebsplanung durch den Betrieb festgelegt. Sie sind Richtwerte und keine harte Sperre; laufende Anfragen können sie überschreiten.',
      chatAccountUsageTitle: 'Chatbot-Nutzung',
      chatAccountUsageUnauthorized:
        'Die Chatbot-Nutzung ist für dieses Konto nicht freigeschaltet.',
      usageBudget: 'Budget',
      usageBudgetEmpty: 'Für diese Nutzungsklasse ist kein Budget festgelegt.',
      usageBudgetExhausted: 'Das monatliche Budget ist ausgeschöpft.',
      usageCredits: 'Credits',
      usageRemaining: 'Verbleibend',
      usageResetDate: 'Zurücksetzung',
      usageUsed: 'Verwendet',
      userSettings: 'Benutzereinstellungen',
      languageSettings: 'Spracheinstellungen',
      storedEmail: 'E-Mail (Edu-ID)',
      languageTooltip:
        'Ändern Sie hier die Programmsprache der KlickerUZH Manage App. Beachten Sie, dass dies keinerlei Einfluss auf Ihre Kursinhalte oder die Spracheinstellungen bei anderen Nutzern oder Studierenden in Ihren Kursen hat.',
      confirmDelegatedAccess: 'Delegierten Login bestätigen',
      confirmDelegatedAccessTooltip:
        'Bitte überprüfen Sie die Zugangsdaten für den delegierten Login. Kopieren Sie das Passwort, bevor Sie dieses Pop-Up schliessen, da es nicht erneut angezeigt werden kann.',
      FULL_ACCESS: 'Voller Zugriff',
      SESSION_EXEC: 'Durchführung von Live Quizzes',
      READ_ONLY: 'Nur Lesen',
      ACCOUNT_OWNER: 'Konto-Besitzer',
      OTP: 'Einmalpasswort',
      EDUID: 'Edu-ID',
      ACTIVATION: 'Aktivierung',
      lastUsed: 'zuletzt genutzt: {date}',
      lastUsedNever: 'zuletzt genutzt: Nie',
      createDelegatedLogin: 'Delegierten Login erstellen',
      delegatedLoginDescription:
        'Um sich einzuloggen, nutzen Sie den Shortname Ihres Haupt-Accounts und das generierte Passwort des delegierten Logins.',
      copiedPassword:
        'Das Passwort wurde erfolgreich in die Zwischenablage kopiert.',
      loginName: 'Login-Beschreibung',
      scope: 'Berechtigungen',
      selectScope: 'Jetzt wählen',
      createLogin: 'Login erstellen',
      nameRequired: 'Geben Sie einen Namen für Ihr Login ein',
      scopeRequired: 'Wählen Sie die Berechtigungen für Ihr Login',
      shortnameTooltip:
        'Der Shortname ist an den Hauptaccount gebunden und kann oben über eine separate Einstellung geändert werden.',
      passwordTooltip:
        'Das Passwort wird automatisch generiert. Notieren Sie es sich vor dem Erstellen des Logins, es ist später nicht mehr sichtbar. Sollten Sie ein anderes Passwort wünschen, können Sie dieses über den Knopf rechts rechts neu generieren lassen.',
      shortnameRequirements:
        'Der Kurzname hat im KlickerUZH eine wichtige Bedeutung, da er an vielen Stellen einen einfachen Zugriff auf Kurse und Übungs-Quizzes ermöglicht. Bitte beachten Sie daher folgende Regeln bei der Wahl des Kurznamens: <ul><li>Der Kurzname muss mindestens 5 und maximal 10 Zeichen lang sein.</li><li>Der Kurzname darf nur aus Buchstaben und Zahlen bestehen.</li></ul>',
      shortnameRequired: 'Geben Sie einen Kurznamen ein.',
      shortnameMin: 'Der Kurzname muss mindestens 5 Zeichen lang sein.',
      shortnameMax: 'Der Kurzname darf maximal 10 Zeichen lang sein.',
      shortnameAlphanumeric:
        'Der Kurzname darf nur aus Buchstaben und Zahlen bestehen.',
      shortnameTaken: 'Dieser Kurzname ist bereits vergeben.',
      emailUpdates: 'Projekt-Updates per E-Mail',
      emailUpdatesTooltip:
        'Diese Einstellung beeinflusst die E-Mails, die Sie in Verbindung mit KlickerUZH erhalten. E-Mails zu wichtigen Releases werden immer an Ihre Edu-ID E-Mail-Adresse gesendet (ca. 2x pro Jahr), häufigere Projekt-Updates (z.B. zu Beta-Tests oder Umfragen) können hier aktiviert oder deaktiviert werden.',
      betaFeatures: 'Beta-Funktionen',
      betaFeaturesTooltip:
        'Erhalten Sie frühzeitigen Zugriff auf KlickerUZH-Funktionen, die sich noch im Test befinden. Beta-Funktionen können sich kurzfristig ändern oder zurückgezogen werden und eignen sich nicht für benotete Prüfungen. Sie können diese Einstellung jederzeit wieder deaktivieren.',
      betaFeaturesError:
        'Die Beta-Einstellung konnte nicht gespeichert werden. Bitte versuchen Sie es in einem Moment erneut.',
      changePassword: 'Passwort ändern',
      changeDelegatedLoginPassword: 'Passwort des delegierten Logins ändern',
      changeDelegatedLoginPasswordMessage:
        'Hier können Sie das Passwort des gewählten delegierten Logins ändern. Bitte beachten Sie, dass das Passwort nur einmalig angezeigt wird, bitte notieren Sie es sich daher vor dem Bestätigen.',
      newPassword: 'Neues Passwort',
    },
    token: {
      pageName: 'Token Generation',
      tokenGenerationTitle: 'Generation eines Login-Token',
      tokenGenerationExplanation:
        'Auf dieser Seite können Sie einen Token zum Login bei der Controller-App <link>{displayLink}</link> generieren. Dieser Token hat eine Gültigkeit von 10 Minuten, kann allerdings jederzeit wieder neu generiert werden.',
      generateToken: 'Token generieren!',
      tokenTitle: 'Ihr Token lautet:',
      remainingValidity: 'Verbleibende Gültigkeit:',
      tokenExpired:
        'Ihr Token ist leider abgelaufen, bitte generieren Sie einen neuen.',
    },
    elementGeneration: {
      eyebrow: 'KI-unterstützte Erstellung',
      title: 'Elemente generieren',
      description:
        'Erstellen Sie Klicker-Elemente aus einem veröffentlichten Wissensgraphen. Single Choice, Multiple Choice, KPRIM und Karteikarten verwenden denselben Ablauf.',
      actions: {
        generate: 'Elemente generieren',
        newGeneration: 'Neue Generierung',
        retry: 'Erneut versuchen',
        publishIncomplete: 'Generierte Elemente verwenden',
      },
      configure: {
        sourceTitle: 'Wissensquelle',
        sourceHelp:
          'Wählen Sie eine Wissensbasis mit einem veröffentlichten Graphen. Die Generierung bleibt für die Nachvollziehbarkeit mit diesem Graph-Build verknüpft.',
        sourceCount: '{count, plural, one {# Quelle} other {# Quellen}}',
        indexedAt: 'Veröffentlicht {date}',
        staleGraph: 'Aktualisierung verfügbar',
        staleGraphHelp:
          'Dieser veröffentlichte Graph kann weiterhin verwendet werden, aber die Wissensbasis enthält neuere Änderungen. Erstellen Sie ihn zuerst neu, wenn diese Änderungen einbezogen werden sollen.',
        sourceDetails: 'Enthaltene Quellen',
        pageFrom: 'Von Seite',
        pageTo: 'Bis Seite',
        elementTypeTitle: 'Klicker-Elementtyp',
        elementTypeHelp:
          'Alle Typen werden als Klicker-Elemente generiert. Wählen Sie das Format passend zum Lernziel.',
        bloomTitle: 'Blooms Taxonomie',
        bloomHelp: 'Wählen Sie die abzudeckenden kognitiven Stufen.',
        settingsTitle: 'Einstellungen der Generierung',
        elementCount: 'Anzahl Elemente',
        language: 'Sprache',
        difficulty: 'Schwierigkeitsverteilung',
        objectives: 'Lernziele',
        objectivesHelp: 'Optionale Vorgaben für die generierten Elemente.',
        addObjective: 'Lernziel hinzufügen',
        remove: 'Entfernen',
        start: 'Elemente generieren',
        starting: 'Wird gestartet…',
        noSources: 'Kein veröffentlichter Wissensgraph verfügbar',
        noSourcesHelp:
          'Erstellen Sie eine Wissensbasis und veröffentlichen Sie ihren Wissensgraphen, bevor Sie Elemente generieren.',
      },
      elementTypes: {
        SC: {
          label: 'Single Choice',
          description:
            'Eine richtige Option aus mehreren Auswahlmöglichkeiten.',
        },
        MC: {
          label: 'Multiple Choice',
          description: 'Eine oder mehrere richtige Optionen.',
        },
        KPRIM: {
          label: 'KPRIM',
          description: 'Vier Aussagen als richtig oder falsch beurteilen.',
        },
        FLASHCARD: {
          label: 'Karteikarte',
          description:
            'Ein Element mit Vorder- und Rückseite zum aktiven Abrufen.',
        },
      },
      language: {
        de: 'Deutsch',
        en: 'Englisch',
      },
      bloom: {
        remember: 'Erinnern',
        understand: 'Verstehen',
        apply: 'Anwenden',
        analyze: 'Analysieren',
        evaluate: 'Bewerten',
      },
      difficulty: {
        EASY: 'Leicht',
        MIXED: 'Gemischt',
        HARD: 'Schwer',
      },
      summary: {
        title: 'Zusammenfassung',
        source: 'Wissensbasis',
        type: 'Elementtyp',
        count: 'Elemente',
      },
      validation: {
        sourceRequired: 'Wählen Sie eine Wissensquelle.',
        sourceScopeRequired: 'Wählen Sie mindestens eine Quelle.',
        countRange: 'Wählen Sie zwischen 1 und 20 Elementen.',
        pagePair:
          'Geben Sie für einen Seitenbereich die erste und letzte Seite an.',
        pageRange: 'Verwenden Sie einen gültigen Seitenbereich ab Seite 1.',
        bloomRequired: 'Wählen Sie mindestens eine Bloom-Stufe.',
      },
      statuses: {
        QUEUED: 'Eingereiht',
        RUNNING: 'In Bearbeitung',
        PREPARING_INPUT: 'Eingabe wird vorbereitet',
        DESIGNING: 'Design wird erstellt',
        WAITING_FOR_DESIGN_REVIEW: 'Designprüfung',
        WAITING_FOR_PLAN_REVIEW: 'Planprüfung',
        GENERATING_ITEMS: 'Elemente werden generiert',
        FINALIZING: 'Wird abgeschlossen',
        AWAITING_INCOMPLETE_PUBLICATION: 'Entscheidung erforderlich',
        PUBLISHING_INCOMPLETE: 'Verfügbare Elemente werden vorbereitet',
        COMPLETED: 'Zur Prüfung bereit',
        INCOMPLETE: 'Teilweise bereit',
        FAILED: 'Fehlgeschlagen',
        REJECTED: 'Abgelehnt',
      },
      build: {
        title: 'Generierung: {type}',
        stage: 'Aktuelle Phase: {stage}',
        generatedCount: '{generated} von {requested} generiert',
        generated: 'Generiert',
        unresolved: 'Ungelöst',
        warnings: 'Warnungen',
        retries: 'Wiederholungen',
        processing: 'Die Elemente werden vorbereitet',
        processingHelp:
          'Diese Seite wird automatisch aktualisiert. Sie können sie verlassen und über dieselbe URL zurückkehren.',
        failed: 'Generierung fehlgeschlagen',
        failedHelp: 'Der Worker konnte die Generierung nicht abschliessen.',
        incompleteTitle: 'Einige Elemente konnten nicht generiert werden',
        incompleteHelp:
          '{generated} von {requested} Elementen sind verfügbar. Versuchen Sie es erneut oder fahren Sie mit den verfügbaren Elementen fort.',
        incompleteAcknowledge:
          'Ich verstehe, dass das Ergebnis weniger Elemente als angefordert enthält.',
        rejected: 'Diese Generierung wurde bei der Prüfung abgelehnt.',
        noDrafts: 'Die Generierung wurde ohne prüfbare Elemente abgeschlossen.',
      },
      gate: {
        eyebrow: 'Prüfschritt',
        designTitle: 'Generierungsdesign prüfen',
        designDescription:
          'Prüfen Sie die Verteilung der angeforderten Elemente auf Module und Lernziele, bevor die Generierung fortgesetzt wird.',
        planTitle: 'Elementplan prüfen',
        planDescription:
          'Prüfen Sie geplante Aufgaben, kognitive Stufen, Schwierigkeit und Quellenabdeckung, bevor die Generierung fortgesetzt wird.',
        elementCount: '{count, plural, one {# Element} other {# Elemente}}',
        elementNumber: 'Element {number}',
        objectives: 'Lernziele',
        noObjectives: 'Keine expliziten Lernziele.',
        difficulty: 'Schwierigkeit {difficulty}',
        warnings: '{count, plural, one {# Warnung} other {# Warnungen}}',
        acknowledgeWarnings: 'Ich habe diese Warnungen geprüft und bestätigt.',
        reject: 'Generierung ablehnen',
        approve: 'Genehmigen und fortfahren',
        submitting: 'Wird übermittelt…',
      },
      review: {
        title: 'Generierte Elemente prüfen',
        summary:
          '{total} insgesamt · {accepted} angenommen · {open} noch offen',
        elementNumber: 'Element {number}',
        copy: 'Kopie {number}',
        name: 'Interner Name',
        prompt: 'Aufgabenstellung',
        front: 'Vorderseite',
        back: 'Rückseite',
        context: 'Kontext',
        choices: 'Antwortoptionen',
        correctChoice: 'Antwort {label} als richtig markieren',
        explanation: 'Erklärung',
        cardType: 'Karteikartentyp',
        tags: 'Tags',
        tagsPlaceholder: 'Tags mit Kommas trennen',
        qualityFlags:
          '{count, plural, one {Qualitätshinweis} other {Qualitätshinweise}}',
        citations:
          '{count, plural, one {# Quellenbeleg} other {# Quellenbelege}}',
        accept: 'Annehmen',
        reject: 'Ablehnen',
        duplicate: 'Duplizieren',
        saveDraft: 'Änderungen speichern',
        savingDraft: 'Wird gespeichert…',
        saveElements: '{count} in Bibliothek speichern',
        savingElements: 'Elemente werden gespeichert…',
        savedElements:
          '{count, plural, one {# Element ist in Ihrer Bibliothek.} other {# Elemente sind in Ihrer Bibliothek.}}',
        actionError:
          'Das Element konnte nicht aktualisiert werden. Versuchen Sie es erneut.',
        saveElementsError:
          'Die angenommenen Elemente konnten nicht gespeichert werden. Versuchen Sie es erneut.',
      },
      decisions: {
        OPEN: 'Offen',
        ACCEPTED: 'Angenommen',
        REJECTED: 'Abgelehnt',
      },
      cardTypes: {
        definition: 'Definition',
        formula: 'Formel',
        calculation: 'Berechnung',
      },
      errors: {
        load: 'Die Einstellungen zur Elementgenerierung konnten nicht geladen werden.',
        notConfigured:
          'Die Elementgenerierung ist für diese Umgebung nicht konfiguriert.',
        start:
          'Die Generierung konnte nicht gestartet werden. Versuchen Sie es erneut.',
        buildLoad: 'Diese Generierung konnte nicht geladen werden.',
        action:
          'Die Generierung konnte nicht aktualisiert werden. Versuchen Sie es erneut.',
        withCode:
          'Der Vorgang ist fehlgeschlagen ({code}). Versuchen Sie es erneut.',
      },
    },
    questionPool: {
      createLiveQuiz: 'Live Quiz erstellen',
      createMicrolearning: 'Microlearning erstellen',
      createPracticeQuiz: 'Übungs-Quiz erstellen',
      createGroupTask: 'Gruppenaktivität erstellen',
      createElement: 'Element Erstellen',
      resetFilters: 'Filter zurücksetzen',
      showArchived: 'Archiv anzeigen',
      hideArchived: 'Archiv verstecken',
      elementTypes: 'Elementtypen',
      elementStatus: 'Status',
      tags: 'Tags',
      selectOrType: 'Auswählen oder Eingeben...',
      untagged: 'Ohne Tags',
      noTagsAvailable: 'Keine Tags verfügbar',
      activityUsage: 'Aktivitätsnutzung',
      selectActivity: 'Aktivität auswählen...',
      answerFeedbacks: 'Antwortfeedbacks',
      noElementsWarning:
        'Wir konnten leider keine Elemente finden, welche den gewünschten Kriterien entsprechen.',
      activeFiltersWarning:
        'Aktuell sind Filter aktiv, welche die angezeigten Elemente beeinflussen können. Um alle Elemente (ausser archivierte) anzuzeigen, können Sie die Filter <reset>zurücksetzen</reset> oder verändern Sie diese auf der rechten Seite.',
      deleteElement: 'Element löschen',
      confirmDeletion:
        'Bitte bestätigen Sie die folgenden Folgen der Löschung des Elementes <b>{name}</b>.',
      elementDeletionFinal:
        'Die Löschung eines Elements is unwiderruflich und gelöschte Elemente können nicht wiederhergestellt werden. Das Element wird durch die Löschung nicht aus bestehenden Aktivitäten entfernt.',
      elementDeletionOtherUsers:
        'Andere Nutzer setzen dieses Element in Aktivitäten ein. Der Zugriff für diese Nutzer bleibt bestehen.',
      elementDeletionDerivedAccessHint:
        'Sie nutzen das Element in einer Aktivität, für welche Sie mindestens Admin-Zugriff haben. Aus technischen Gründen kann das Element nicht vollständig gelöscht werden. Sie erhalten nach der Löschung automatisch eine abgeleitete Berechtigung auf dem Element. Sobald die zugehörige Aktivität gelöscht wird, wird das Element automatisch ebenfalls gelöscht.',
      elementDeletionDependencyAccess:
        'Von diesem Element abgeleitete Zugriffsrechte auf beinhaltete Ressourcen werden automatisch widerrufen.',
      elementDeletionOtherUsersNotApplicable:
        'Das Element wird nicht von anderen Nutzern in Aktivitäten verwendet.',
      elementDeletionDerivedAccessNotApplicable:
        'Sie nutzen das Element nicht in keiner Aktivität. Das Element kann vollständig gelöscht werden.',
      elementDeletionDependencyAccessNotApplicable:
        'Keine abgeleiteten Ressourcen sind durch die Löschung des Elements betroffen.',
      removeElement: 'Element entfernen',
      confirmElementRemoval:
        'Bitte bestätigen Sie die folgenden Effekte der Entfernung des Elementes <b>{name}</b> aus Ihrem Nutzerkonto.',
      elementRemovalFinal:
        'Die Entfernung dieses Elements aus Ihrem Konto ist unwiderruflich und kann nicht rückgängig gemacht werden.',
      elementRemovalDerivedAccessHint:
        'Sie nutzen das Element in einer Aktivität, für welche Sie mindestens Admin-Zugriff haben. Aus technischen Gründen kann das Element nicht vollständig entfernt werden. Sie erhalten nach der Löschung automatisch eine abgeleitete Berechtigung auf dem Element. Sobald die zugehörige Aktivität gelöscht wird, wird das Element automatisch ebenfalls entfernt.',
      elementRemovalDerivedAccessHintNotApplicable:
        'Sie nutzen das Element nicht in keiner Aktivität. Das Element kann vollständig entfernt werden.',
      numSelected: '{count}/{total}',
      moveToArchive: 'Ins Archiv verschieben',
      restoreFromArchive: 'Element wiederherstellen',
      elementArchivedSuccessfully: 'Das Element wurde ins Archiv verschoben.',
      elementRestoredSuccessfully:
        'Das Element wurde aus dem Archiv wiederhergestellt.',
      elementArchiveActionUnchanged:
        'Das Element befand sich bereits im gewünschten Archivstatus.',
      elementArchiveActionFailed:
        'Der Archivstatus des Elements konnte nicht geändert werden.',
      elementArchiveActionUncertain:
        'Der Archivstatus konnte nicht bestätigt werden. Prüfen Sie die Elementliste, bevor Sie es erneut versuchen.',
      elementArchiveRefreshFailed:
        'Der Archivstatus konnte nicht bestätigt werden, weil die Elementliste nicht aktualisiert werden konnte. Laden Sie die Seite neu, um den aktuellen Status anzuzeigen.',
      showFeedbacksExplanation: 'Antwort-Feedbacks & Erklärung anzeigen',
      showExplanation: 'Erklärung anzeigen',
      showFeedbacksExplanationTooltip:
        'Eine Vorschau, wie die Erklärung und die Antwort-Feedbacks in <b>asynchronen Aktivitäten</b> angezeigt werden, nachdem ein Schüler auf das Element reagiert hat.',
      showExplanationTooltip:
        'Eine Vorschau, wie die Erklärung in <b>asynchronen Aktivitäten</b> angezeigt wird, nachdem ein Schüler auf das Element reagiert hat.',
      sampleSolutionUnavailableTypes:
        'Musterlösungen können nur für Fragen erfasst werden. Inhaltselemente und Lernkarten unterstützen keine Musterlösungen.',
      answerFeedbacksUnavailableTypes:
        'Antwort-Feedbacks können nur für Single-Choice, Multiple-Choice, und KPRIM Fragen erfasst werden.',
      batchOperations: 'Batch-Operationen ({numElements} Elemente)',
      batchOperationsElements: 'Elemente - Batch-Operationen',
      batchOperationsApplying: 'Batch-Operationen werden angewendet…',
      selectedElementsDescription:
        'Sie haben die folgenden Elemente ausgewählt. Alle Elemente, welche von den gewählten Aktionen betroffen sind, sind markiert. Fokussieren Sie das Symbol für nicht betroffene Elemente mit der Tastatur oder Maus, um weitere Informationen zu erhalten. Bitte beachten Sie: Einige Aktionen können nur einzeln durchgeführt werden oder erfordern bestimmte Zugriffsrechte (siehe Tooltip). Überprüfen Sie die ausgewählten Aktionen sorgfältig, bevor Sie diese anwenden.',
      batchElementName: 'Element',
      batchElementPermission: 'Ihre Berechtigung',
      batchUpdateStatus: 'Eignung für Elementänderungen',
      batchUpdateStatusInactive: 'Keine Elementänderung konfiguriert',
      batchSharingStatus: 'Eignung für Elementfreigaben',
      actionApplies: 'Aktion wird angewendet',
      batchSharingApplies: 'Freigabe wird angewendet',
      modifyStatus: 'Status ändern',
      modifyMultiplier: 'Multiplikator ändern',
      modifyBasePoints: 'Basispunkte ändern',
      awardBasePoints: 'Basispunkte vergeben',
      noElementsWillBeUpdated: 'Keine Elemente werden verändert',
      nElementsWillBeUpdated: '{number} Elemente werden angepasst',
      batchSharing: 'Elemente teilen',
      batchSharingDescription:
        'Erteilen Sie dieselbe direkte Berechtigung für alle ausgewählten Elemente. Die Freigabe wird nicht auf Aktivitäten übertragen, aber verknüpfte Antwortsammlungen erhalten den erforderlichen abgeleiteten Lesezugriff.',
      batchSharingLimit:
        'Das Teilen ist auf {max} Elemente pro Vorgang beschränkt. Reduzieren Sie die Auswahl oder deaktivieren Sie das Teilen.',
      batchSharingUserOrEmail: 'Benutzer:in',
      batchSharingGroup: 'Benutzergruppe',
      batchSharingPermission: 'Berechtigung',
      noElementsWillBeShared: 'Keine Elemente können geteilt werden',
      nElementsWillBeShared: '{number} Elemente können geteilt werden',
      batchSharingNotApplicableExplanation:
        'Die ausgewählte Freigabe kann aus den folgenden Gründen nicht auf dieses Element angewendet werden:',
      batchSharingInsufficientPermission:
        'Das Teilen von Elementen erfordert mindestens Adminrechte.',
      batchOperationsResult: 'Ergebnis der Batch-Operation',
      batchOperationsResultDescription:
        'Überprüfen Sie unten die ausgeführten und übersprungenen Operationen. Dieses Ergebnis kann nicht bearbeitet werden.',
      batchUpdateResultSuccess:
        'Die ausgewählten Elementänderungen wurden erfolgreich angewendet.',
      batchUpdateResultPartial:
        '{updated}/{total} ausgewählte Elementänderungen wurden angewendet.',
      batchUpdateResultFailed:
        'Die ausgewählten Elementänderungen konnten nicht angewendet werden.',
      batchUpdateResultSkipped:
        'Elementänderungen wurden übersprungen, da keines der ausgewählten Elemente dafür geeignet war.',
      batchSharingResult: 'Freigabeergebnis',
      batchSharingResultShared: 'Geteilt',
      batchSharingResultSkippedInsufficientPermission:
        'Übersprungen: Adminrechte erforderlich',
      batchSharingResultElementUnavailable:
        'Übersprungen: Element nicht verfügbar',
      batchSharingResultFailed: 'Freigabe fehlgeschlagen',
      batchSharingResultNotProcessed: 'Nicht verarbeitet',
      batchSharingRequestFailed:
        'Die Freigabeanfrage ist fehlgeschlagen, bevor alle Ergebnisse zurückgegeben werden konnten.',
      batchSharingTargetInvalidOrSelf:
        'Der Zielbenutzer existiert nicht oder ist Ihr eigenes Konto.',
      batchSharingTargetGroupUnavailable:
        'Die ausgewählte Benutzergruppe ist nicht mehr verfügbar.',
      batchOperationsRefreshFailed:
        'Die Operationen wurden beendet, aber die Elementliste konnte nicht aktualisiert werden.',
      batchUpdatesInformation: `Abhängig von den ausgewählten Aktionen und den Berechtigungen für die selektierten Elemente gelten die folgenden Regeln:
<ul>
<li>Das Archivieren von Elementen / das Wiederherstellen von Elementen aus dem Archiv ist nur für nicht archivierte respektive archivierte Elemente möglich. Diese Aktion kann nur von Benutzern mit Administratorrechten für die betreffenden Elemente ausgeführt werden.</li>
<li>Multiplikatoren können nur für Fragen mit einer definierten Musterlösung geändert werden. Diese Aktion erfordert mindestens Schreibrechte.</li>
<li>Basispunkte können nur für Fragen (nicht für Lernkarten oder Inhaltselemente) aktiviert / deaktiviert werden. Diese Aktion erfordert mindestens Schreibrechte.</li>
<li>Änderungen des Elementstatus sind durch alle Nutzer möglich.</li>
<li>Das Teilen erfordert für jedes Element mindestens Adminrechte. Die Freigabe wird nicht auf Aktivitäten übertragen, aber verknüpfte Antwortsammlungen erhalten den erforderlichen abgeleiteten Lesezugriff.</li>
</ul>
      `,
      updateActivitiesBatchInfo:
        'Wählen Sie hier, ob die Änderungen, die an den ausgewählten Elementen vorgenommen werden, auch auf alle Aktivitäten im Entwurf- und Planungsstatus angewendet werden sollen. Optional können Sie auch Aktivitätsvorlagen mit diesem Element in das Update einbeziehen.',
      activityUpdates: 'Aktivitäts-Updates',
      draftScheduledActivities: 'Entwurfs- und geplante Aktivitäten',
      templateUpdates: 'Aktivitätsvorlagen-Updates',
      batchOperationSuccess:
        'Ihre Batch-Operation wurde erfolgreich durchgeführt.',
      batchOperationPartialSuccess:
        'Nur ein Teil Ihrer Batch-Operation konnte erfolgreich angewendet werden. Bitte überprüfen Sie die betroffenen Elemente und Ihre Berechtigungen.',
      batchOperationFailed:
        'Beim Anwenden der Batch-Operation ist ein Fehler aufgetreten. Bitte überprüfen Sie Ihre Berechtigungen und versuchen Sie es erneut.',
      batchNotApplicableExplanation:
        'Die ausgewählten Batch-Operationen können aus den folgenden Gründen nicht auf dieses Element angewendet werden:',
      batchUnarchiveOnlyArchivedElements:
        'Die Wiederherstellung von Elementen aus dem Archiv ist nur für archivierte Elemente möglich',
      batchUnarchiveOnlyManagerElements:
        'Die Wiederherstellung von Elementen aus dem Archiv erfordert mindestens Adminrechte',
      batchArchiveOnlyUnarchivedElements:
        'Das Archivieren von Elementen ist nur für nicht archivierte Elemente möglich',
      batchArchiveOnlyManagerElements:
        'Das Archivieren von Elementen erfordert mindestens Adminrechte',
      batchMultiplierOnlyEditorElements:
        'Das Verändern von Multiplikatoren erfordert mindestens Schreibrechte.',
      batchMultiplierOnlySampleSolution:
        'Das Verändern von Multiplikatoren ist nur für Fragen mit einer definierten Musterlösung möglich.',
      batchBasePointsOnlyEditorElements:
        'Das Verändern von Basispunkten erfordert mindestens Schreibrechte.',
      batchBasePointsOnlyQuestions:
        'Basispunkte können nur für Fragen (nicht für Lernkarten oder Inhaltselemente) aktiviert / deaktiviert werden.',
    },
    tags: {
      deleteTag: 'Tag löschen',
      confirmTagDeletion:
        'Bitte bestätigen Sie, dass Sie den Tag <b>{name}</b> löschen möchten. Fragen mit diesem Tag bleiben erhalten, der Tag wird jedoch entfernt. Diese Aktion kann nicht rückgängig gemacht werden.',
      validName: 'Geben Sie einen gültigen Namen für Ihren Tag ein.',
      uniqueTagName:
        'Bitte beachten Sie, dass Sie nicht mehrere Tags mit dem gleichen Namen erfassen können.',
      tagNameUpdatedSuccessfully: 'Der Tagname wurde erfolgreich angepasst.',
    },
    elements: {
      CREATETitle: 'Element erstellen',
      EDITTitle: 'Element bearbeiten',
      DUPLICATETitle: 'Element duplizieren',
      deleteElement: 'Element löschen',
      shareElement: 'Element teilen',
      viewElement: 'Element anzeigen',
      modifyElement: 'Element bearbeiten',
      useElementInActivities: 'Element in Aktivitäten verwenden',
      elementType: 'Elementtyp',
      selectQuestionType: 'Elementtyp auswählen',
      selectQuestionStatus: 'Status auswählen',
      questionStatus: 'Status',
      elementTitle: 'Elementtitel',
      recoverData: 'Daten-Wiederherstellung',
      temporaryStorageCreation:
        'Der Erstellungsprozess wurde ohne Speichern abgebrochen. Möchten Sie das letzte automatische Daten-Backup wiederherstellen oder diese Informationen verwerfen?',
      temporaryStorageEditing:
        'Der Bearbeitungsprozess wurde ohne Speichern abgebrochen. Möchten Sie das letzte automatische Daten-Backup wiederherstellen oder diese Informationen verwerfen?',
      discard: 'Verwerfen',
      loadData: 'Daten laden',
      titleTooltip:
        'Geben Sie einen kurzen, zusammenfassenden Titel für das Element ein. Dieser dient lediglich zur besseren Übersicht.',
      tagsTooltip:
        'Fügen Sie Tags zu Ihrer Frage hinzu, um die Organisation und Wiederverwendbarkeit zu verbessern (änhlich zu bisherigen Ordnern).',
      tagFormatting:
        'Zwischenzeitlich erforderliche Formattierung: Geben Sie Tags durch Kommas getrennt ein, z.B.: Tag1,Tag2,Tag3',
      basePointInformation:
        'Basispunkte werden bei allen Teilnehmern für die Beantwortung der Frage in einem Live Quiz gutgeschrieben. Diese Punkte werden nicht durch Punktmultiplikatoren beeinflusst.',
      multiplierInformation:
        'Wählen Sie einen Multiplikator, mit welchem Korrektheits- und Bonuspunkte für diese Frage multipliziert werden sollen. Der Multiplikator kann nur zwischen 1 und 4 liegen.',
      multiplierNoEffect:
        'Multiplikatoren beeinflussen die Bepunktung einer Frage nur, wenn eine Musterlösung definiert ist und Korrektheits- und Bonuspunkte (Live Quiz) vergeben werden.',
      liveQuizBasePoints: 'Live-Quiz Basispunkte',
      zeroPoints: '0 Punkte',
      questionTooltip:
        'Geben Sie die Frage ein, die Sie den Teilnehmenden stellen möchten. Der Rich Text Editor erlaubt Ihnen folgende (Block-) Formatierungen zu nutzen: fetter Text, kursiver Text, Code, Zitate, nummerierte Listen, unnummerierte Listen und LaTeX Formeln. Fahren Sie mit der Maus über die einzelnen Knöpfe für mehr Informationen.',
      contentTooltip:
        'Geben Sie den Inhalt ein, den Sie den Teilnehmenden präsentieren möchten. Der Rich Text Editor erlaubt Ihnen folgende (Block-) Formatierungen zu nutzen: fetter Text, kursiver Text, Code, Zitate, nummerierte Listen, unnummerierte Listen und LaTeX Formeln. Fahren Sie mit der Maus über die einzelnen Knöpfe für mehr Informationen.',
      instructionsTooltip:
        'Geben Sie hier die Instruktionen für die Studierenden ein, welche als Wegleitung für die Beantwortung der Fallstudie dienen.',
      enableSampleSolution: 'Musterlösung aktivieren',
      sampleSolutionAndScoring: 'Musterlösung & Bewertung',
      scoringDocumentation: 'Dokumentation zur Bewertung',
      questionPlaceholder: 'Fragetext hier eingeben…',
      contentPlaceholder: 'Inhalt hier eingeben…',
      instructionsPlaceholder: 'Instruktionen hier eingeben…',
      explanationTooltip:
        'Geben Sie hier eine generische Erklärung zu Ihrer Frage ein, welche den Studierenden unabhängig von Ihrer Antwort in Übungs-Quizzen und Microlearnings als Erklärung der Lösung angezeigt wird.',
      explanationPlaceholder: 'Erklärung hier eingeben…',
      answerOptions: 'Antwortmöglichkeiten',
      answerOption: 'Antwortmöglichkeit',
      answerOptionsTooltip:
        'Erfassen Sie hier die möglichen Antworten, welche von den Studierenden für die Frage ausgewählt werden können.',
      answerOptionPlaceholder: 'Antwortmöglichkeit hier eingeben…',
      FTOptionsTooltip:
        'Nehmen Sie hier optionale Einstellungen für die Freitext-Frage vor. Bitte beachten Sie, dass die Antwort auf Freitext-Fragen nicht auf Gross- und Kleinschreibung geprüft wird.',
      NUMERICALOptionsTooltip:
        'Nehmen Sie hier optionale Einstellungen für die numerische Frage vor. Bitte beachten Sie, dass der Antwortbereich von numerischen Fragen auf das Intervall [-1e30,1e30] begrenzt ist. Sollten Sie grössere Zahlen benötigen, verwenden Sie bitte eine Freitext-Frage.',
      SELECTIONOptionsTooltip:
        'Wählen Sie hier die Antwort-Sammlung aus welcher die Studierenden die korrekten Antworten auswählen sollen.',
      CSAnswerCollectionRequired:
        'Zur Erstellung von Fallstudien-Fragen benötigen Sie Zugriff auf eine Antwort-Sammlung oder können <link>die Fallstudien-Elemente manuell eingeben</link>. Um eine Antwort-Sammlung zu verwenden, erstellen Sie entweder eine eigene unter <link2>Ressourcen → Antwort-Sammlungen</link2> oder importieren Sie bestehende Sammlungen anderer Nutzer über den <link3>Katalog</link3>.',
      SEAnswerCollectionRequired:
        'Zur Erstellung von Auswahl-Fragen benötigen Sie Zugriff auf eine Antwort-Sammlung oder können <link>die Auswahl-Möglichkeiten manuell eingeben</link>. Um eine Antwort-Sammlung zu verwenden, erstellen Sie entweder eine eigene unter <link2>Ressourcen → Antwort-Sammlungen</link2> oder importieren Sie bestehende Sammlungen anderer Nutzer über den <link3>Katalog</link3>.',
      selectCollection: 'Sammlung auswählen...',
      answerCollection: 'Antwort-Sammlung',
      notSufficientPermissionsEditCollection:
        'Ihre Berechtigungen für diese Antwort-Sammlung sind nicht ausreichend, um diese zu bearbeiten.',
      noAnswerCollectionSelected:
        'Bitte wählen Sie zuerst eine Antwort-Sammlung mit ausreichenden Berechtigungen aus, bevor Sie diese ergänzen können.',
      caseStudyAnswerCollectionTooltip:
        'Bitte wählen Sie eine Antwort-Sammlung, aus welcher Sie die in der Fallstudie zu bewertenden Elemente auswählen möchten.',
      numberOfInputs: 'Anzahl Eingabefelder',
      correctAnswerOptions: 'Korrekte Antwortoptionen',
      correctAnswerOptionsTooltip:
        'Bitte wählen Sie die korrekten Antwortoptionen aus der Liste der Antwortmöglichkeiten aus. Die Anzahl der korrekten Antwortoptionen muss mindestens der Anzahl Eingabefelder entsprechen',
      selectCorrectAnswerOptions: 'Korrekte Antwortmöglichkeiten auswählen...',
      noMatchingOptionFound: 'Keine passende Option gefunden',
      changeOfAnswerCollection: 'Wechsel der Antwort-Sammlung',
      confirmCollectionChange:
        'Sind Sie sicher, dass Sie die Antwort-Sammlung wechseln möchten? Die bisher ausgewählten Elemente der Fallstudie und alle definierten Musterlösungen gehen durch diesen Wechsel verloren.',
      selectedItems: 'Ausgewählte Elemente',
      selectionItems: 'Elemente zur Auswahl',
      newSelectionItemsTooltip:
        'Bitte geben Sie hier die Elemente ein, aus welchen die Studierenden die korrekten Optionen auswählen sollen. Diese werden beim Speichern der Frage automatisch in eine neue Antwort-Sammlung kombiniert.',
      definedItems: 'Neue Fallstudien-Elemente',
      caseStudyItemsTooltip:
        'Bitte wählen Sie hier die Elemente aus der Antwort-Sammlung, welche durch die Teilnehmer in der Fallstudie in bezug auf die unten erfassten Kriterien bewertet werden sollen.',
      newCaseStudyItemsTooltip:
        'Bitte geben Sie hier die Fallstudien-Elemente an, die in Bezug auf die angegebenen Kriterien bewertet werden sollen. Diese werden beim Speichern der Frage automatisch in eine neue Antwort-Sammlung kombiniert.',
      enterItemsManually:
        'Möchten Sie die Fallstudien-Elemente manuell erfassen?',
      enterItemsManuallyExplanation:
        'Diese Oberfläche erlaubt es Ihnen, die Elemente für Ihre Fallstudie direkt im Kontext der Frage zu erfassen. Beim Speichern der Frage werden die entsprechenden Elemente automatisch in eine <b>neue Antwort-Sammlung kombiniert</b>, die Sie später wiederverwenden oder erweitern können. <button>Sie können auch zur Auswahl der Fallstudien-Elemente aus einer bestehenden Sammlung zurückkehren.</button>',
      returnItemsCollectionSelection:
        'Möchten Sie zur Auswahl der Optionen aus einer bestehenden Sammlung zurückkehren?',
      enterSelectionItemsManually:
        'Möchten Sie die zur Auswahl stehenden Elemente manuell erfassen?',
      enterSelectionItemsManuallyExplanation:
        'Diese Oberfläche erlaubt es Ihnen, die Elemente für Ihre Auswahl-Frage direkt im Kontext der Frage zu erfassen. Beim Speichern der Frage werden die entsprechenden Elemente automatisch in eine <b>neue Antwort-Sammlung kombiniert</b>, die Sie später wiederverwenden oder erweitern können.',
      returnSelectionItemsCollection:
        'Möchten Sie zur Auswahl einer bestehenden Sammlung zurückkehren?',
      selectCaseStudyItems: 'Elemente auswählen...',
      insertNewItems: 'Elemente erfassen...',
      caseStudyRangeCriterion: 'Numerisches Intervallkriterium',
      caseStudyStepCriterion: 'Schritt-/Likert-Kriterium',
      caseStudyCriteriaDescription:
        'Bitte definieren Sie hier die Kriterien, nach denen die oben ausgewählten Elemente der Fallstudie bewertet werden sollen. Sie können zwischen rein numerischen Kriterien (ideal z.B. für Wahrscheinlichkeits- / Kostenabschätzungen) und Schritt- / Likert-Kriterien (ideal für Fallstudien ohne exakte / bekannte Lösungen) wählen. Für weitere Informationen zu den einzelnen Feldern beachten Sie bitte auch die entsprechenden Tooltips.',
      caseStudyCriteriaNameTooltip:
        'Der Name des Kriteriums wird den Studierenden angezeigt (z.B. "Wahrscheinlichkeit").',
      caseStudyCriteriaMinTooltip:
        'Der Minimalwert entscheidet über die untere Grenze des Schiebereglers.',
      caseStudyCriteriaMaxTooltip:
        'Der Maximalwert entscheidet über die obere Grenze des Schiebereglers.',
      caseStudyCriteriaStepTooltip:
        'Die Schrittweite entscheidet über die Schritte bei der Einstellung des Schiebereglers.',
      caseStudyCriteriaUnitTooltip:
        'Die optionale Einheit wird den Studierenden neben den entsprechenden Werten angezeigt (z.B. "%").',
      caseStudyCriteriaMinLabelTooltip:
        'Dieser Text beschreibt das untere Ende ihres Schritt- oder Likert-Kriteriums an (z.B. "sehr unwahrscheinlich").',
      caseStudyCriteriaMidLabelTooltip:
        'Dieser Text beschreibt den mittleren Bereich ihres Schritt- oder Likert-Kriteriums (z.B. "möglich").',
      caseStudyCriteriaMaxLabelTooltip:
        'Dieser Text beschreibt das obere Ende ihres Schritt- oder Likert-Kriteriums an (z.B. "sehr wahrscheinlich").',
      caseStudyCriteriaStepsTooltip:
        'Geben Sie hier die Anzahl der Schritte an, die der Schieberegler haben soll (mind. 3).',
      addCriterion: 'Kriterium hinzufügen',
      addRangeCriterion: 'Numerisches Intervallkriterium hinzufügen',
      addStepsCriterion: 'Schritt-/Likert-Kriterium hinzufügen',
      addCase: 'Neuen Fall hinzufügen',
      removeCase: 'Fall entfernen',
      caseTitle: 'Fallname',
      caseStudyCaseTitleTooltip:
        "Bitte geben Sie einen Namen für den Fall an, welcher den Studierenden angezeigt wird (z.B. 'Szenario 1: Lorem ipsum').",
      confirmCaseDelete:
        'Sind Sie sicher, dass Sie diesen Fall löschen möchten?',
      confirmCaseDeleteSolutions:
        'Sind Sie sicher, dass Sie diesen Fall inklusive aller definierten Musterlösungen löschen möchten?',
      confirmCaseDeletion: 'Fall löschen',
      caseDescription: 'Fallbeschreibung',
      caseStudyCaseDescriptionTooltip:
        'Die Fallbeschreibung dient der detaillierten Beschreibung des Szenarios. Sie muss alle Informationen enthalten, welche die Studierenden benötigen, um die gegebenen Elemente auf die Kriterien zu bewerten.',
      caseDescriptionPlaceholder:
        'Detaillierte Fallbeschreibung hier eingeben…',
      caseStudySolutions: 'Musterlösungen für Fall {number}',
      caseStudySolutionsTooltip:
        'Bitte geben Sie hier für jedes zu Bewertende Element und Kriterium einen Bereich an, welcher als korrekt bewertet werden soll.',
      caseStudySolutionIntervalStep:
        'im Interval [{lower}, {upper}], Schrittweite {step}',
      lowerLimit: 'Untere Grenze',
      upperLimit: 'Obere Grenze',
      LISTDisplay: 'Anzeige als Liste',
      GRIDDisplay: 'Anzeige als Raster',
      feedbackPlaceholder: 'Feedback eingeben…',
      addAnswer: 'Neue Antwort hinzufügen',
      restrictions: 'Einschränkungen',
      solutionRanges: 'Lösungsbereiche',
      solutionRangesTooltip:
        'Geben Sie hier die Intervalle an, die als korrekt gewertet werden sollen.',
      exactSolutions: 'Exakte Lösungen',
      exactSolutionsTooltip:
        'Geben Sie hier die exakten Lösungen an, die als korrekt gewertet werden sollen.',
      solutionTypeNumerical: 'Art der Lösung',
      solutionTypeNumericalTooltip:
        'Wählen Sie zwischen der Option von Lösungsbereichen und exakten Lösungen für diese Frage',
      addSolutionRange: 'Neuen Lösungsbereich hinzufügen',
      addExactSolution: 'Neue exakte Lösung hinzufügen',
      maximumLength: 'Maximale Länge',
      answerLength: 'Antwort Länge',
      possibleSolutionN: 'Mögliche Lösung {number}',
      possibleSolutions: 'Mögliche Lösungen',
      addSolution: 'Neue Lösung hinzufügen',
      noFeedbackDefined: 'Kein Feedback definiert',
      createElement: '{element} erstellen',
      editElement: '{element} bearbeiten',
      cancelCreation: 'Erstellen abbrechen',
      cancelEditing: 'Bearbeiten abbrechen',
      mediaLibrary: 'Medienbibliothek',
      uploadImageHeader: 'Medien hinzufügen',
      uploadImageDescription:
        'Ziehen Sie ein Bild auf diese Fläche oder klicken Sie darauf, um den Explorer zu öffnen.',
      updateInstances:
        'Element-Instanzen in KlickerUZH-Aktivitäten aktualisieren',
      includeTemplateInstanceUpdates:
        'Instanzen in Vorlagen-Aktivitäten ebenfalls aktualisieren',
      updateInstancesExplanation:
        'Nutzen sie diese Einstellung, um das Element in allen angezeigten geplanten Live-Quizzes, Übungs-Quizzes, Microlearnings und Gruppenaktivitäten anzupassen. Der Inhalt von Elementen in laufenden und abgeschlossenen Aktivitäten wird nicht aktualisiert. Veränderte Multiplikatoren werden auf die erstellten Instanzen angewendet. Bitte beachten Sie, dass bei einer Deaktivierung der Musterlösung nur Inhaltselemente, Flashcards und Freitext-Fragen in Übungs-Quizzes und Microlearnings geupdated werden.',
      questionSavedSuccessfully: 'Die Frage wurde erfolgreich gespeichert.',
      questionSavedFailed:
        'Beim Speichern der Frage ist ein Fehler aufgetreten. Bitte beachten Sie die Fehlermeldungen im Formular und überprüfen Sie die Eingaben.',
    },
    activityWizard: {
      activityName: 'Bitte geben Sie einen Namen für Ihre Aktivität ein.',
      activityDisplayName:
        'Bitte geben Sie einen Anzeigenamen für Ihre Aktivität ein.',
      considerFormErrors: 'Bitte beachten Sie die Fehlermeldungen im Formular',
      startDate: 'Bitte geben Sie ein Startdatum für Ihre Activität ein.',
      endDate: 'Bitte geben Sie ein Enddatum für Ihre Activität ein.',
      endAfterStart: 'Das Enddatum muss nach dem Startdatum liegen.',
      endInFuture: 'Das Enddatum muss in der Zukunft liegen.',
      validMultiplicator: 'Bitte geben Sie einen gültigen Multiplikator ein.',
      checkValues:
        'Bitte überprüfen Sie zuerst Ihre Eingaben im vorherigen Schritt bevor Sie fortfahren.',
      closeWizard: 'Wizard schliessen',
      name: 'Name',
      displayName: 'Anzeigename',
      multiplierDefault: 'Default: 1x',
      multiplier1: 'Einfach (1x)',
      multiplier2: 'Doppelt (2x)',
      multiplier3: 'Dreifach (3x)',
      multiplier4: 'Vierfach (4x)',
      changesSaved: 'Änderungen gespeichert',
      elementCreated: 'Element erfolgreich erstellt',
      openPreview: 'Vorschau öffnen',
      openOverview: 'Übersicht öffnen',
      createAnotherActivity: 'Weitere Aktivität erstellen',
      enterContentHere: 'Inhalt hier eingeben…',
      questionsDragDrop: 'Fügen Sie mittels Drag&Drop Fragen hinzu.',
      newQuestion: 'Neue Frage',
      blockCountdownTitle: 'Countdown Block {blockIx}',
      timeLimit: 'Zeit-Limit',
      noTimeLimit: 'Kein Zeit-Limit',
      optionalTimeLimit: 'Optionales Zeit-Limit',
      timeLimitTooltip: 'Zeit-Limit für Block {blockIx} in Sekunden',
      newBlock: 'Neuer Block',
      newStack: 'Neuer Stack',
      newBlockSelected: '1 Block mit {count} Elementen hinzufügen',
      newStackSelected: '1 Stack mit {count} Elementen hinzufügen',
      pasteSelection: '{count} Fragen hinzufügen',
      pasteSelectionElements: '{count} Elemente hinzufügen',
      pasteSingleElementsBlock: '{count} Blöcke mit 1 Element anfügen',
      pasteSingleElementsStack: '{count} Stacks mit 1 Element hinzufügen',
      pinProtected: 'PIN-Schutz',
      pinProtectedTooltip:
        'Bei aktiviertem Schutz durch einen PIN-Code generiert das System automatisch eine PIN, welche durch die Studierenden beim Beitritt zum Quiz eingegeben werden muss.',
      displayNameTooltip:
        'Der Anzeigename wird den Teilnehmenden bei der Durchführung angezeigt.',
      stackDescriptionTitle: 'Stack {stackIx}: Beschreibung (optional)',
      stackDisplayName: 'Stack-Titel',
      stackDisplayNameTooltip:
        'Der Titel des Stacks wird oberhalb der Beschreibung am oberen Ende des Stacks angezeigt.',
      stackDescription: 'Beschreibung',
      stackDescriptionTooltip:
        'Die Beschreibung des Stacks wird oberhalb der Fragen im Stack angezeigt.',
      stackDescriptionPlaceholder: 'Beschreibung hier eingeben…',
      stackFTQuestionsNoSL:
        'Sie haben eine Freitext-Frage in diesem Stack ohne Musterlösung genutzt. Während dies Freitext-Fragen möglich ist, beachten Sie bitte, dass die Teilnehmenden eine Standardpunktzahl für die Beantwortung erhalten und keine Bewertungslogik angewendet wird.',
      outdatedElementsWarning:
        'Ihre Aktivität enthält veraltete Versionen von Elementen.',
      updateAllElements: 'Alle Elemente aktualisieren',
      elementInstancesFrozen:
        'Beim Erstellen der Aktivität wurde der Inhalt der Elemente eingefroren. Wenn aktiviert, werden Änderungen an Elementen auf Aktivitäten mit Entwurf-Status angewendet.',
      noInstanceUpdatePublishedActivities:
        'Keine Änderungen an Elementen werden auf veröffentlichte Aktivitäten angewendet (für Teilnehmende zugänglich).',
      choiceOnDuplication:
        'Beim Duplizieren einer Aktivität können Sie wählen, ob der Inhalt der Aktivität unverändert bleiben oder die Elemente auf die neueste Version aktualisiert werden sollen.',
      microlearningTypes:
        'Microlearnings können alle verfügbaren Elemente enthalten.',
      microlearningCreated: 'Microlearning <b>{name}</b> erfolgreich erstellt.',
      microlearningEdited:
        'Microlearning <b>{name}</b> erfolgreich modifiziert.',
      microLearningIntroductionName:
        'Bitte geben Sie einen Namen für Ihr Microlearning ein. Für weitere Informationen zu den spezifischen Feldern während der Erstellung können Sie die entsprechenden Tooltips konsultieren.',
      microLearningInformation:
        'Geben Sie in diesem Schritt den Namen für das Microlearning ein und finden Sie hilfreiche Informationen zur Erstellung des Elements.',
      microLearningNoCourse:
        'Microlearnings müssen immer einem laufenden Kurs zugeordnet werden. Bitte erstellen Sie zuerst einen Kurs über das entsprechende Menü oder verlängern Sie einen bestehenden Kurs, bevor sie mit der Erstellung fortfahren.',
      microLearningLecturerDocs:
        'Für weitere Informationen zur Erstellung und Durchführung von Microlearnings, besuchen Sie die <link>Dozierenden-Dokumentation</link>.',
      microLearningStudentDocs:
        'Für weitere Informationen zur Studierenden-Ansicht, besuchen Sie die <link>Studierenden-Dokumentation</link>.',
      microlearningDescription:
        'Geben Sie in diesem Schritt den Namen und die Beschreibung des Microlearnings ein.',
      microlearningSettings:
        'Wählen Sie in diesem Schritt das Start- und Enddatum und nehmen Sie weitere Einstellungen vor.',
      microLearningMissingCourse:
        'Microlearnings müssen einem Kurs zugewiesen werden.',
      microLearningCourseNotGamified:
        'Mit der aktuellen Kursauswahl wird das Microlearning nicht gamifiziert sein.',
      microlearningQuestions:
        'Wählen Sie in diesem Schritt die Fragen für das Microlearning aus.',
      microlearningEditingFailed:
        'Anpassen des Microlearnings fehlgeschlagen...',
      microlearningCreationFailed:
        'Erstellen des Microlearnings fehlgeschlagen...',
      microlearningName:
        'Der Name soll Ihnen ermöglichen, dieses Microlearning von anderen zu unterscheiden. Er wird den Teilnehmenden nicht angezeigt, verwenden Sie hierfür bitte den Anzeigenamen im nächsten Feld.',
      microlearningDescField:
        'Fügen Sie eine Beschreibung zu Ihrem Microlearning hinzu, welche den Teilnehmern zu Beginn angezeigt wird.',
      microlearningCourse:
        'Für die Erstellung eines Microlearnings ist die Auswahl des zugehörigen Kurses erforderlich. Das Microlearning wird automatisch die Gamification-Einstellungen des Kursed übernehmen.',
      microlearningStartDate:
        'Wählen Sie das Startdatum des Microlearnings aus. Es wird den Teilnehmenden nach Publikation ab diesem Zeitpunkt angezeigt.',
      microlearningEndDate:
        'Wählen Sie das Enddatum des Microlearnings aus. Es wird den Teilnehmenden nach diesem Zeitpunkt nicht mehr angezeigt.',
      microlearningStartAfterCourseStart:
        'Das Startdatum des Microlearnings muss nach dem Startdatum des Kurses liegen.',
      microlearningEndBeforeCourseEnd:
        'Das Enddatum des Microlearnings muss vor dem Enddatum des Kurses liegen.',
      microlearningMultiplier:
        'Der Multiplikator ist ein Faktor, mit welchem die Punkte der Teilnehmenden bei einem gamifizierten Microlearning multipliziert werden.',
      microlearningUseCase:
        '<link>Microlearnings</link> können durch Studierende in einem zeitlich limitierten Rahmen bearbeitet werden. Sie eignen sich besonders für die Wiederholung von Lerninhalten und die Vorbereitung auf Prüfungen.',
      minOneElementPerStack:
        'Jeder Stack muss mindestens ein Element enthalten.',
      minOneElementPerBlock:
        'Jeder Block muss mindestens ein Element enthalten.',
      minOneQuestionGroupActivity:
        'Eine Gruppenaktivität muss mindestens eine Frage enthalten.',
      liveQuizGamified:
        'Bitte spezifizieren Sie, ob das Quiz gamifiziert sein soll. Dies ist nur möglich, wenn das Quiz Teil eines Kurses ist.',
      liveQuizTypes:
        'Live Quizzes unterstützen alle Fragetypen, sowie Inhaltelemente. Lernkarten können nicht in Live Quizzes genutzt werden.',
      liveQuizTimeRestriction:
        'Bitte geben Sie eine gültige Zeitbegrenzung ein.',
      liveQuizMinQuestions:
        'Der Frageblock muss mindestens eine Frage enthalten.',
      liveQuizCreated: 'Live Quiz <b>{name}</b> erfolgreich erstellt.',
      liveQuizUpdated: 'Live Quiz <b>{name}</b> erfolgreich modifiziert.',
      liveQuizInformation:
        'Geben Sie in diesem Schritt den Namen für das Live Quiz ein und finden Sie hilfreiche Informationen zur Erstellung des Elements.',
      liveQuizDescription:
        'Geben Sie in diesem Schritt den Namen und die Beschreibung des Live Quizzes ein.',
      liveQuizSettings:
        'In diesem Schritt können Sie Einstellungen für das Live Quiz erfassen.',
      liveQuizBlocks: 'Fragen & Blöcke',
      liveQuizDragDrop:
        'Fügen Sie mittels Drag&Drop auf das Plus-Icon Fragen zu Ihren Blöcken hinzu. Neue Blöcke können entweder ebenfalls durch Drag&Drop auf das entsprechende Feld oder durch Klicken auf den Button erstellt werden.',
      liveQuizCreationFailed: 'Anpassen des Live Quizzes fehlgeschlagen...',
      liveQuizEditingFailed: 'Erstellen des Live Quizzes fehlgeschlagen...',
      liveQuizName:
        'Der Name soll Ihnen ermöglichen, dieses Live Quiz von anderen zu unterscheiden. Er wird den Teilnehmenden nicht angezeigt, verwenden Sie hierfür bitte den Anzeigenamen im nächsten Feld.',
      liveQuizDescField:
        'Hier können Sie eine optionale Beschreibung des Live Quizzes eingeben. Diese wird in den Studierenden zu Beginn des Live Quizzes angezeigt.',
      liveQuizDescCourse:
        'Sie können Ihr Live Quiz einem Kurs zuordnen. Wenn Ihr Kurs gamifiziert ist oder der Assessment-Modus aktiviert ist, werden diese Einstellungen automatisch auf die Aktivität übertragen. Für nicht-gamifizierte Kurse oder Live Quizzes ohne Kurszuordnung kann die Gamifizierung separat aktiviert werden. Weitere Informationen finden Sie in der Dokumentation zu <link>gamifizierten Live Quizzes</link>.',
      liveQuizSelectCourse: 'Kurs auswählen',
      liveQuizNoCourse: 'Kein Kurs',
      assessmentCourseRemovalRestricted:
        'Aktivitäten im Assessment-Modus können nur durch einen Administrator des entsprechenden Kurses wieder aus diesem entfernt werden.',
      liveQuizEnableGamification:
        'Wählen Sie einen gamifizierten Kurs aus, um Gamifizierung zu aktivieren.',
      liveQuizMultiplier:
        'Beim Multiplikator handelt es sich um einen Faktor, mit welchem die Punkte bei einer beantworteten Frage multipliziert werden. Der Faktor findet nur Verwendung, wenn Gamification aktiviert ist.',
      liveQuizGamification:
        'Das Quiz übernimmt automatisch die Gamifizierungseinstellung des Kurses. Wird das Quiz keinem Kurs zugeordnet, kann die Gamifizierung nicht aktiviert werden.',
      liveQuizLiveQA:
        'Diese Einstellung spezifiziert, ob der Live-Q&A Kanal zu Beginn des Live Quizzes aktiviert sein soll. Sie kann während des laufenden Live Quizzes jederzeit geändert werden.',
      liveQuizModeration:
        'Diese Einstellung spezifiziert, ob die Moderation im Live-Q&A Kanal zu Beginn des Live Quizzes aktiviert sein soll. Sie kann während der laufenden Live Quizzes jederzeit geändert werden.',
      liveQuizFeedbackChannel:
        'Diese Einstellung spezifiziert, ob der Feedback-Kanal zu Beginn des Live Quizzes aktiviert sein soll. Sie kann während der laufenden Live Quizzes jederzeit geändert werden.',
      liveQuizIntroductionName:
        'Bitte geben Sie einen Namen für Ihr Live-Quiz ein. Für weitere Informationen zu den spezifischen Feldern während der Erstellung können Sie die entsprechenden Tooltips konsultieren.',
      liveQuizUseCase:
        '<link>Live Quizzes</link> können zur Förderung der Interaktivität in Vorlesungen, Seminaren und Workshops eingesetzt werden. Während die Teilnehmenden die Fragen beantworten, werden die Resultate auf einer Evaluationsansicht dargestellt.',
      liveQuizLecturerDocs:
        'Für weitere Informationen zur Erstellung und Durchführung von Live-Quizzes, besuchen Sie die <link>Dozierenden-Dokumentation</link>.',
      liveQuizStudentDocs:
        'Für weitere Informationen zur Studierenden-Ansicht, besuchen Sie die <link>Studierenden-Dokumentation</link>.',
      liveQuizStartNow: 'Jetzt starten',
      liveQuizAdvancedSettings: 'Erweiterte Einstellungen',
      liveQuizCustomizedGrading: 'Benutzerdefinierte Bewertung',
      liveQuizPointsExplanation:
        'Diese erweiterten Einstellungen ermöglichen es, die Punktevergabe bei einem Live-Quiz zu verändern. Bitte beachten Sie, dass alle Punkteinstellungen und die Illustrationen der Punktevergabe sich auf Elemente mit einem Multiplikator von 1x beziehen. Höhere Multiplikatoren werden auf alle Komponenten ausser den Standardpunkten angewendet. Der auf der Aktivität gesetzte Multiplikator wird in der Illustration bereits mit einbezogen. Die Antwortzeit beginnt abzulaufen sobald der erste Teilnehmer eine vollständig korrekte Antwort abgegeben hat. Für mehr Informationen konsultieren Sie bitte unsere <link>Dokumentation</link>.',
      liveQuizNoCustomizedScoring:
        'Die Fragen in diesem Live Quiz werden aktuell nicht bepunktet. Um die Bepunktung zu aktivieren, weisen Sie es einem gamifizierten und/oder Assessment-Kurs zu oder aktivieren Sie die Gamifizierung manuell.',
      liveQuizDefaultPoints: 'Standardpunkte',
      liveQuizDefaultPointsTooltip:
        'Teilnehmende in einem Live-Quiz erhalten diese Anzahl Punkte für das Teilnehmen an einer Frage. Wenn keine Musterlösung definiert ist, werden nur Standardpunkte vergeben. Der Standardwert beträgt {defaultValue}.',
      liveQuizDefaultCorrectPoints: 'Punkte für korrekte Antwort',
      liveQuizDefaultCorrectPointsTooltip:
        'Teilnehmende in einem Live-Quiz erhalten diese Anzahl Punkte für eine korrekte Antwort auf eine Frage mit Musterlösung. Der Standardwert beträgt {defaultValue}.',
      liveQuizMaxBonusPoints: 'Maximale Bonuspunkte',
      liveQuizMaxBonusPointsTooltip:
        'Dies ist die maximale Anzahl von Bonuspunkten, die ein Teilnehmer während eines gamifizierten Live-Quiz für eine korrekte Antwort auf eine Frage mit Musterlösung erhalten wird. Der Standardwert beträgt {defaultValue}.',
      liveQuizTimeToZeroBonus: 'Zeit bis zum Ende von Bonuspunkten',
      liveQuizTimeToZeroBonusTooltip:
        'Dies ist die Zeit in Sekunden nach der ersten korrekten Antwort, nach der ein Teilnehmer keine Bonuspunkte mehr für eine korrekte Antwort erhält. Der Standardwert beträgt {defaultValue}.',
      liveQuizAnswerTime: 'Zeitpunkt: {answerTime} s',
      liveQuizCorrectAnswersPoints: 'Punkte für korrekte Antwort',
      liveQuizIncorrectAnswersPoints:
        'Punkte für inkorrekte Antwort / keine Musterlösung',
      liveQuizTotalAwardedPointsCorrect:
        'Gesamtpunkte (korrekt): {totalPoints}',
      liveQuizTotalAwardedPointsIncorrect:
        'Gesamtpunkte (inkorrekt): {totalPoints}',
      liveQuizDefaultPointsReq:
        'Bitte geben Sie eine gültige Anzahl Standardpunkte ein, welche für jede Antwort vergeben werden.',
      liveQuizDefaultPointsMin:
        'Die Standardpunkte müssen mindestens 0 betragen.',
      liveQuizDefaultCorrectPointsReq:
        'Bitte geben Sie eine gültige Anzahl Punkte ein, welche für jede korrekte Antwort vergeben werden.',
      liveQuizDefaultCorrectPointsMin:
        'Die Punkte für korrekte Antworten müssen mindestens 0 betragen.',
      liveQuizMaxBonusPointsReq:
        'Bitte geben Sie eine gültige Anzahl von maximalen Bonuspunkten ein.',
      liveQuizMaxBonusPointsMin:
        'Die maximalen Bonuspunkte müssen mindestens 0 betragen.',
      liveQuizTimeToZeroBonusReq:
        'Bitte geben Sie eine gültige Zeit bis zum Ende der Vergabe von Bonuspunkten ein.',
      liveQuizTimeToZeroBonusMin:
        'Die Zeit bis zum Ende der Vergabe von Bonuspunkten muss mindestens 1 Sekunde betragen.',
      liveQuizTSinceFirstCorrect: 'Zeit seit erster korrekter Antwort [s]',
      practiceQuizNoCourse:
        'Übungs-Quizzes müssen einem laufenden Kurs zugeordnet werden. Bitte erstellen Sie zuerst einen Kurs über das entsprechende Menü oder verlängern Sie einen bestehenden Kurs, bevor sie mit der Erstellung fortfahren.',
      practiceQuizIntroductionName:
        'Bitte geben Sie einen Namen für Ihr Übungs-Quiz ein. Für weitere Informationen zu den spezifischen Feldern während der Erstellung können Sie die entsprechenden Tooltips konsultieren.',
      practiceQuizInformation:
        'Geben Sie in diesem Schritt den Namen für das Übungs-Quiz ein und finden Sie hilfreiche Informationen zur Erstellung des Elements.',
      practiceQuizLecturerDocs:
        'Für weitere Informationen zur Erstellung und Durchführung von Übungs-Quizzes, besuchen Sie die <link>Dozierenden-Dokumentation</link>.',
      practiceQuizStudentDocs:
        'Für weitere Informationen zur Studierenden-Ansicht, besuchen Sie die <link>Studierenden-Dokumentation</link>.',
      practiceQuizResetDays:
        'Bitte geben Sie eine Anzahl Tage ein nach welcher das Übungs-Quiz wiederholt werden kann.',
      practiceQuizStartAfterCourseStart:
        'Das Startdatum des Übungs-Quiz muss nach dem Startdatum des Kurses liegen.',
      practiceQuizStartRequired:
        'Bitte geben Sie ein Startdatum für Ihr Übungs-Quiz ein.',
      practiceQuizValidResetDays:
        'Bitte geben Sie eine gültige Anzahl Tage ein nach welcher das Übungs-Quiz wiederholt werden kann.',
      practiceQuizElementTypes:
        'Übungs-Quizzes können nur Single-Choice, Multiple-Choice, Kprim und Numerische Fragen sowie Inhaltselemente und Flashcards enthalten.',
      elementSolutionReq:
        'Für alle Fragetypen ausser Freitext fragen ist eine Musterlösung erforderlich.',
      practiceQuizCreated: 'Übungs-Quiz <b>{name}</b> erfolgreich erstellt.',
      practiceQuizUpdated: 'Übungs-Quiz <b>{name}</b> erfolgreich modifiziert.',
      practiceQuizDescription:
        'Geben Sie in diesem Schritt den Namen und die Beschreibung des Übungs-Quizzes ein.',
      practiceQuizSettings:
        'Nehmen Sie in diesem Schritt Einstellungen für Ihr Übungs-Quiz vor.',
      practiceQuizMissingCourse:
        'Übungs-Quizzes müssen einem Kurs zugewiesen werden.',
      practiceQuizCourseNotGamified:
        'Mit der aktuellen Kursauswahl wird das Übugns-Quiz nicht gamifiziert sein.',
      practiceQuizContent:
        'Fügen Sie in diesem Schritt Fragen und Text-Elemente zu Ihrem Übungs-Quiz hinzu.',
      practiceQuizCreationFailed:
        'Anpassen des Übungs-Quizzes fehlgeschlagen...',
      practiceQuizEditingFailed:
        'Erstellen des Übungs-Quizzes fehlgeschlagen...',
      selectCourse: 'Kurs auswählen...',
      practiceQuizName:
        'Der Name soll Ihnen ermöglichen, dieses Übungs-Quiz von anderen zu unterscheiden. Er wird den Teilnehmenden nicht angezeigt, verwenden Sie hierfür bitte den Anzeigenamen im nächsten Feld.',
      practiceQuizDescField:
        'Fügen Sie eine Beschreibung zu Ihrem Übungs-Quiz hinzu, welche den Teilnehmern zu Beginn angezeigt wird.',
      practiceQuizSelectCourse:
        'Für die Erstellung eines Übungs-Quizzes ist die Auswahl des zugehörigen Kurses erforderlich.',
      practiceQuizMultiplier:
        'Wählen Sie einen Multiplikator aus. Alle Punkte, welche Studierenden in diesem Übungs-Quiz sammeln, werden mit dem Multiplikator multipliziert.',
      practiceQuizRepetition:
        'Wählen Sie einen Zeitraum nach welchem die Studierenden das Übungs-Quiz wiederholen können.',
      practiceQuizOrder:
        'Wählen Sie eine Reihenfolge in welcher die Fragen für die Studierenden zu lösen sind.',
      practiceQuizSelectOrder: 'Reihenfolge wählen',
      practiceQuizSEQUENTIAL: 'Sequenziell',
      practiceQuizSPACED_REPETITION: 'Spaced Repetition',
      practiceQuizTypes:
        'Übungs-Quizzes können alle verfügbaren Element-Typen enthalten.',
      practiceQuizUseCase:
        '<link>Übungs-Quizzes</link> können zur Vorbereitung auf Prüfungen und zur Wiederholung von Lerninhalten eingesetzt werden. Im Rahmen einer kompakten Evaluation erhalten die Studierenden Feedback zu ihren Antworten.',
      selectGamifiedCourse:
        'Bitte wählen Sie einen gamifizierten Kurs für die Erstellung dieses Elements.',
      groupActivityInformation:
        'Geben Sie in diesem Schritt den Namen für die Gruppenaktivität ein und finden Sie hilfreiche Informationen zur Erstellung des Elements.',
      groupActivityMissingCourse:
        'Gruppenaktivitäten müssen einem Kurs zugewiesen werden.',
      groupActivityTypes:
        'Gruppenaktivitäten können nur Inhaltselemente, Single-Choice, Multiple-Choice, Kprim, Numerische, Freitext, und Auswahl-Fragen enthalten.',
      groupActivityCreated:
        'Ihre Gruppenaktivität <b>{name}</b> wurde erfolgreich erstellt.',
      groupActivityEdited:
        'Ihre Gruppenaktivität <b>{name}</b> wurde erfolgreich bearbeitet.',
      groupActivityNoCourse:
        'Gruppenaktivitäten müssen immer einem laufenden Kurs zugeordnet werden, in dem Gamifizierung und Gruppenbildung aktiviert sind. Bitte stellen Sie sicher, dass mindestens ein Kurs existiert, in welchem beide Optionen aktiviert ist, bevor sie mit der Erstellung fortfahren.',
      groupActivityIntroductionName:
        'Bitte geben Sie einen Namen für Ihre Gruppenaktivität ein. Für weitere Informationen zu den spezifischen Feldern während der Erstellung können Sie die entsprechenden Tooltips konsultieren.',
      groupActivityLecturerDocs:
        'Für weitere Informationen zur Erstellung und Durchführung von Gruppenaktivitäten, besuchen Sie die <link>Dozierenden-Dokumentation</link>.',
      groupActivityStudentDocs:
        'Für weitere Informationen zur Studierenden-Ansicht, besuchen Sie die <link>Studierenden-Dokumentation</link>.',
      groupActivityDescription:
        'In diesem Schritt geben Sie den Namen und die Beschreibung der Gruppenaktivität ein.',
      groupActivitySettings:
        'In diesem Schritt können Sie Einstellungen für Ihre Gruppenaktivität vornehmen und Hinweise definieren, die an Teilnehmende verteilt werden.',
      groupActivityQuestions:
        'In diesem Schritt wählen Sie die Fragen für die Gruppenaktivität aus.',
      groupActivityEditingFailed:
        'Bearbeiten der Gruppenaktivität fehlgeschlagen...',
      groupActivityCreationFailed:
        'Erstellen der Gruppenaktivität fehlgeschlagen...',
      groupActivityName:
        'This name should allow you to distinguish this group activity from others. It will not be shown to the participants, please use the display name (next field) for this.',
      groupActivityDescField:
        'Fügen Sie eine Beschreibung zu Ihrer Gruppenaktivität hinzu, welche alle Informationen enthält, die für das Lösen aller Fragen mit den bereitgestellten Hinweisen erforderlich sind.',
      groupActivityCourse:
        'Um eine Gruppenaktivität zu erstellen, ist die Auswahl des zugehörigen Kurses erforderlich.',
      groupActivityStartDate:
        'Bitte wählen Sie das Startdatum der Gruppenaktivität. Die Gruppenaktivität wird ab diesem Zeitpunkt für die Teilnehmenden verfügbar sein.',
      groupActivityEndDate:
        'Bitte wählen Sie das Enddatum der Gruppenaktivität. Die Gruppenaktivität wird nach diesem Zeitpunkt nicht mehr für die Teilnehmenden zur Verfügung stehen.',
      groupActivityStartAfterCourseStart:
        'Das Startdatum der Gruppenaktivität muss nach dem Startdatum des Kurses liegen.',
      groupActivityStartAfterGroupDeadline:
        'Das Startdatum der Gruppenaktivität muss nach dem Enddatum der Gruppenbildung liegen.',
      groupActivityEndBeforeCourseEnd:
        'Das Enddatum der Gruppenaktivität muss vor dem Enddatum des Kurses liegen.',
      groupActivityMultiplier:
        'Der Multiplikator ist ein Faktor, mit dem die Punkte der Teilnehmenden in einer gamifizierten Gruppenaktivität multipliziert werden.',
      groupActivityUseCase:
        '<link>Gruppenaktivitäten</link> können nur einmal pro Gruppe gelöst werden und erfordern Zusammenarbeit, um Informationen aus einer Reihe von Hinweisen zu sammeln und auf eine Reihe von Fragen zu antworten.',
      groupActivityCluesDescription:
        'Hinweise werden unter den Gruppenteilnehmenden verteilt und sollten benötigt werden, um die Fragen, die im nächsten Schritt zur Gruppenaktivität hinzugefügt werden, zu lösen.',
      groupActivityAddClue: 'Neuen Hinweis hinzufügen',
      groupActivityCluesUniqueNames:
        'Alle Hinweise müssen eindeutige Namen haben.',
      groupActivityClueType: 'Hinweis-Typ',
      textClue: 'Text-Hinweis',
      numericalClue: 'Numerischer Hinweis',
      groupActivityNameError:
        'Bitte geben Sie einen Namen für Ihre Gruppenaktivität ein.',
      groupActivityDisplayNameError:
        'Bitte geben Sie einen Anzeigenamen für Ihre Gruppenaktivität ein.',
      groupActivityDescriptionError:
        'Bitte geben Sie eine Aufgabenstellung für Ihre Gruppenaktivität ein.',
      groupActivityMin2Clues: 'Bitte fügen Sie mindestens zwei Hinweise hinzu.',
      clueNameMissing: 'Bitte geben Sie einen Namen für Ihren Hinweis ein.',
      clueDisplayNameMissing:
        'Bitte geben Sie einen Anzeigenamen für Ihren Hinweis ein.',
      clueContentMissing: 'Bitte geben Sie den Inhalt Ihres Hinweises ein.',
      clueValueMissing: 'Bitte geben Sie den Wert Ihres Hinweises ein.',
    },
    template: {
      convertToTemplate: '{activityType} in Vorlage umwandeln',
      conversionType: 'Konvertierungstyp wählen',
      convertOption: 'In Vorlage umwandeln',
      copyOption: 'Kopie als Vorlage erstellen',
      convertCopyTemplateInfo:
        'Vorlagen unterstützen Sie dabei, strukturell ähnliche Aktivitäten in KlickerUZH zu erfassen oder die Struktur der Aktivität mit anderen Nutzern zu teilen. Bitte wählen Sie, ob die bestehende Aktivität oder eine Kopie davon in eine Vorlage umgewandelt werden soll. Vorlagen stehen nicht mehr zur Bearbeitung zur Verfügung und können nicht ausgeführt werden.',
      noInstances:
        'Die ausgewählte Aktivität enthält keine Elemente und kann daher nicht in ein Template umgewandelt werden.',
      resourcesRequiredMissing:
        'Einige Elemente in dieser Aktivität sind von Ressourcen (z.B. Antwort-Sammlungen) abhängig, welche gelöscht, verändert (benötigte Antwort-Optionen entfernt) oder aus dem Konto entfernt wurden (bei geteiltem Zugriff). Bitte ersetzen Sie diese Elemente, bevor Sie die Aktivität in eine Vorlage umwandeln.',
      noResourceAccessRequired:
        'Diese Aktivität enthält keine Elemente, die von Ressourcen abhängen.',
      confirmationsTitle: 'Erforderliche Bestätigungen',
      confirmContentVisibility:
        'Ich verstehe, dass der Inhalt dieser gesamten Aktivität (einschließlich Fragen) für jeden Nutzer mit Zugriff auf diese Vorlage sichtbar sein wird.',
      confirmQuestionAccess:
        'Ich verstehe, dass der Zugriff auf meine Fragen nicht geteilt wird. Wenn ein anderer Nutzer diese Vorlage ohne Änderungen verwendet, werden neue Fragen mit demselben Inhalt in dessen Konto erstellt.',
      confirmResourceAccess:
        'Ich verstehe, dass Elemente in dieser Aktivität von Ressourcen abhängen (z.B. Antwort-Sammlungen), und dass der Zugriff auf diese automatisch geteilt wird (Lese-Berechtigungen), wenn ein Benutzer diese Informationen nicht ersetzt und keinen Zugriff auf die entsprechende Ressource hat.',
      templateInformation: 'Vorlagen-Informationen',
      templateInformationDescription:
        'Bitte geben Sie die folgenden Informationen für Ihre Vorlage an. Diese werden Benutzern angezeigt, wenn diese Ihre Vorlage aus einer Katalog-Sammlung importieren beziehungsweise zur Erstellung einer Aktivität verwenden.',
      nameTooltip:
        'Der Name wird Benutzern angezeigt, wenn sie verfügbare Vorlage über den Katalog suchen.',
      nameRequired: 'Ein Name für das Aktivitäts-Template ist erforderlich',
      descriptionTooltip:
        'Die Beschreibung wird Benutzern angezeigt, wenn sie verfügbare Vorlagen im Katalog durchsuchen.',
      descriptionPlaceholder:
        'Geben Sie eine Beschreibung ein, was diese Vorlage enthält und wofür sie verwendet werden kann...',
      instructionsTooltip:
        'Die Anweisungen werden oben in der Vorlage angezeigt, wenn ein Benutzer eine neue Aktivität daraus erstellt.',
      instructionsPlaceholder:
        'Geben Sie Anweisungen ein, wie diese Vorlage effektiv genutzt werden kann...',
      createTemplate: 'Vorlage erstellen',
      createTemplateCopy: 'Vorlage-Kopie erstellen',
      descriptionRequired: 'Eine Beschreibung ist erforderlich',
      instructionsRequired: 'Anweisungen sind erforderlich',
      templateCreationSuccess: 'Vorlage wurde erfolgreich erstellt',
      templateCreationError: 'Vorlage konnte nicht erstellt werden',
      deleteTemplate: 'Vorlage löschen',
      editTemplate: 'Vorlage bearbeiten',
      templateEditSuccess: 'Vorlage erfolgreich aktualisiert',
      templateEditError: 'Fehler beim Aktualisieren der Vorlage',
      templateDeletionSuccess: 'Vorlage erfolgreich gelöscht',
      templateDeletionError: 'Fehler beim Löschen der Vorlage',
      deleteTemplateExplanation:
        'Bitte bestätigen Sie, dass Sie die ausgewählte Vorlage löschen möchten. Sie wird dadurch auch automatisch aus allen Katalog-Sammlungen entfernt und kann nicht mehr durch andere Nutzer eingesetzt werden.',
      editTemplateDescription:
        'Editieren Sie alle Metainformationen der Aktivitätsvorlage, die Sie ändern möchten. Änderungen werden nach dem Speichern sofort wirksam und allen Benutzern der Vorlage angezeigt.',
      saveChanges: 'Änderungen speichern',
      activityFromTemplate: 'Aktivität aus Vorlage erstellen',
      errorLoadingTemplate:
        'Beim Laden der Vorlage ist ein Fehler aufgetreten...',
      templateInfoLIVE_QUIZ:
        'Diese Ansicht ermöglicht es Ihnen aus der Live-Quiz Vorlage "{templateName}" ihre eigene Live-Quiz Aktivität zu erstellen. Sie werden schrittweise durch die Erstellung geführt und in jedem Schritt die bestehenden Inhalte anpassen oder ersetzen. Bitte beachten Sie besonders auch die folgenden Instruktionen, welche von den Erstellern des Templates hinterlassen wurden.',
      templateInfoPRACTICE_QUIZ:
        'Diese Ansicht ermöglicht es Ihnen aus der Übungs-Quiz Vorlage "{templateName}" ihre eigene Übungs-Quiz Aktivität zu erstellen. Sie werden schrittweise durch die Erstellung geführt und in jedem Schritt die bestehenden Inhalte anpassen oder ersetzen. Bitte beachten Sie besonders auch die folgenden Instruktionen, welche von den Erstellern des Templates hinterlassen wurden.',
      templateInfoGROUP_ACTIVITY:
        'Diese Ansicht ermöglicht es Ihnen aus der Gruppenaktivität Vorlage "{templateName}" ihre eigene Gruppenaktivität zu erstellen. Sie werden schrittweise durch die Erstellung geführt und in jedem Schritt die bestehenden Inhalte anpassen oder ersetzen. Bitte beachten Sie besonders auch die folgenden Instruktionen, welche von den Erstellern des Templates hinterlassen wurden.',
      templateInfoMICRO_LEARNING:
        'Diese Ansicht ermöglicht es Ihnen aus der Microlearning Vorlage "{templateName}" ihr eigenes Microlearning zu erstellen. Sie werden schrittweise durch die Erstellung geführt und in jedem Schritt die bestehenden Inhalte anpassen oder ersetzen. Bitte beachten Sie besonders auch die folgenden Instruktionen, welche von den Erstellern des Templates hinterlassen wurden.',
      recoverTemplateActivityInputs:
        'Eingaben für Vorlagen-Aktivität wiederherstellen',
      notFoundNotAccessible:
        'Die angeforderte Aktivitäts-Vorlage wurde nicht gefunden oder ist nicht zugänglich. Bitte Stellen Sie sicher, dass sie über ausreichend Berechtigungen verfügen, um auf diese Vorlage zuzugreifen.',
      incompleteActivity:
        'Eine unvollständige Version dieser Aktivitätsvorlage wurde automatisch gespeichert. Bitte wählen Sie, ob Sie die Bearbeitung der Aktivität fortsetzen und den automatisch gespeicherten Zustand wiederherstellen oder mit der ursprünglichen Version der Vorlage neu beginnen möchten.',
      startOver: 'Neu starten',
      continueEditing: 'Weiter bearbeiten',
      settingsInstructions:
        'Hier können Sie die Grundeinstellungen der Akvitität verändern. Bitte beachten Sie für weitere Informationen die entsprechenden Tooltips oder konsultieren Sie die Dokumentation. Einige Einstellungen wie beispielsweise Punkte-Multiplikatoren können bei Vorlagen nicht direkt verändert werden.',
      reusingElement: 'Element übernommen',
      replacingElement: 'Element ersetzt',
      creatingElement: 'Element erstellt',
      forGamifiedCourses: 'für gamifizierte Kurse',
      gamificationDisabled: 'Gamifizierung & Assessment deaktiviert',
      gamificationDisabledInfo:
        'Bitte wählen Sie einen gamifizierten oder Assessment-Kurs, oder aktivieren Sie die Gamifizierung für Ihr Live Quiz, um hier die Bepunktungslogik einzusehen.',
      confirmSettings: 'Einstellungen bestätigen',
      settingsNotSaved:
        'Bitte speichern Sie Ihre Änderungen an den Einstellungen, bevor Sie mit der Bearbeitung der Vorlage fortfahren.',
      confirmTimeLimit: 'Zeitlimit bestätigen',
      elementActionsTemplate:
        'Elemente in dieser Vorlage können entweder wie im Template vorhanden übernommen, durch ein bestehendes Element des gleichen Typs und teilweise übereinstimmenden Einstellungen (z.B. Musterlösung) ausgetauscht, oder durch neue Inhalte ersetzt werden. Elemente, welche im Rahmen von Templates erstellt oder übernommen werden, stehen Ihnen im Anschluss in der Bibliothek zur Verfügung. Bitte wählen Sie die gewünschte Aktion für dieses Element aus.',
      selectActionOptionElement:
        'Bitte wählen Sie eine Aktion für dieses Element aus',
      previewTemplateElement: 'Vorschau für Vorlagen-Inhalt',
      acceptTemplateElement: 'Element aus Template ohne Änderungen übernehmen',
      replaceWithExistingElement:
        'Mit bestehendem Element aus Bibliothek ersetzen',
      insertContentNewElement: 'Inhalt für neues Element erfassen',
      editContentNewElement: 'Inhalt für neues Element weiter bearbeiten',
      selectExistingElement: 'Bestehendes Element auswählen',
      selectElementInstructions:
        'Wählen Sie eines Ihrer bestehenden Elemente aus, um es in die Vorlage zu übernehmnen. Bitte beachten Sie, dass es sich hierbei um den folgenden Typ Element handeln muss: {element}. Die untenstehende Auswahl wurde bereits nach diesen Kriterien gefiltert.',
      noMatchingQuestionsFound:
        'Es konnten keine Elemente in Ihrem Konto gefunden werden, welche mit den Anforderungen der Vorlage übereinstimmen. Bitte erfassen Sie ihr Element direkt in der Vorlage oder übernehmen Sie den bestehenden Inhalt.',
      withSampleSolution: 'mit Musterlösung',
      withoutSampleSolution: 'ohne Musterlösung',
      withAnswerFeedbacks: 'mit Antwortfeedbacks',
      withoutAnswerFeedbacks: 'ohne Antwortfeedbacks',
      nextElement: 'Nächstes Element',
      availableActions: 'Verfügbare Aktionen',
      sameNamedElementExists:
        'Ihre Bibliothek enthält bereits ein Element mit dem Namen "{elementName}". Bitte beachten Sie die Möglichkeit, ein bestehendes Element auszuwählen oder fügen Sie neue Inhalte ein. Wenn Sie das Vorlagenelement ohne Änderungen übernehmen, wird eine Kopie davon in Ihrem Konto erstellt.',
      discardEnteredElementContent: 'Eingaben für Elementerstellung verwerfen',
      confirmDiscardEnteredElementContent:
        'Mit dieser Aktion werden alle erfassten Eingaben zur Erstellung eines neuen Elementes an dieser Stelle in der Vorlage verworfen. Diese Aktion kann nicht rückgängig gemacht werden.',
      createLIVE_QUIZ: 'Live Quiz erstellen',
      templateInputsIncomplete:
        'Die Vorlage enthält unvollständige Eingaben. Bitte überprüfen Sie die Einstellungen und Elemente, noch nicht bearbeitete Komponenten sind über einen orangen Status gekennzeichnet.',
      errorCreatingLiveQuizFromTemplate:
        'Beim Erstellen des Live-Quizzes ist ein Fehler aufgetreten. Bitte überprüfen Sie, dass alle Ihre eingaben gültig sind und versuchen Sie es erneut.',
      activityRemainsAvailable:
        'Beim Erstellen des Templates als Kopie bleibt die ursprüngliche Aktivität weiterhin unverändert verfügbar.',
      confirmActivityConversion:
        'Ihre Akvitität wird in eine Vorlage umgewandelt und kann anschliessend nicht mehr ausgeführt werden.',
      expandAll: 'Alle ausklappen',
      collapseAll: 'Alle einklappen',
      basedOnObject: 'basierend auf {object}',
      recoveredTemplateData:
        'Für diese Vorlage wurden Ihre Eingaben automatisch zwischengespeichert und geladen. Möchten Sie das Template zurücksetzen, nutzen Sie bitte den hierfür vorgesehenen Knopf.',
      resetTemplateData: 'Eingaben zurücksetzen',
      resetConfirmation: 'Bestätigung Zurücksetzung des Templates',
      resetWarning:
        'Bitte bestätigen Sie, dass Sie alle Eingaben für dieses Template zurücksetzen möchten. Alle eingegebenen Daten, inkl. potentiell im Template erstellte Elemente werden gelöscht und können nicht wiederhergestellt werden.',
      confirmReset: 'Zurücksetzen bestätigen',
    },
    formErrors: {
      resolveErrors:
        'Bitte stellen Sie sicher, dass die folgenden Fehler im Formular behoben sind, bevor die Frage gespeichert werden kann:',
      questionName: 'Geben Sie einen Namen für die Frage ein.',
      questionContent: 'Bitte fügen Sie einen Inhalt zu Ihrer Frage hinzu.',
      answerContent:
        'Bitte fügen Sie einen Inhalt zu Ihrer Antwortoption hinzu.',
      feedbackContent:
        'Bitte fügen Sie einen Inhalt zu allen Antwortfeedbacks hinzu.',
      SCAnswersCorrect: 'Bei SC-Fragen muss genau eine Antwort korrekt sein.',
      MCAnswersCorrect:
        'Bei MC-Fragen muss mindestens eine Antwort korrekt sein.',
      enterSolution: 'Bitte geben Sie eine Lösung ein.',
      FTMaxLength: 'Die maximale Länge der Lösung muss mindestens 1 betragen.',
      solutionRequired:
        'Bitte geben Sie mindestens eine Lösung an oder deaktivieren Sie die Musterlösung.',
      NRMinLessThanMaxSol:
        'Das Minimum eines Lösungsintervalls muss kleiner als das Maximum sein.',
      NRMinLessThanMax: 'Das Minimum muss kleiner als das Maximum sein.',
      NROneValueRequired:
        'Bei einem Lösungsbereich muss mindestens ein Wert angegeben werden.',
      NRPrecision: 'Die Anzahl Nachkommastellen muss mindestens 0 sein.',
      chooseSolutionType:
        'Bitte wählen Sie einen Lösungstyp für Ihre numerische Frage aus oder deaktivieren Sie die Musterlösung.',
      solutionRangeRequired:
        'Bitte geben Sie mindestens einen Lösungsbereich an.',
      exactSolutionRequired:
        'Bitte geben Sie mindestens eine exakte Lösung an.',
      NumberQuestionsRequired:
        'Es muss mindestens eine Antwortmöglichkeit gegeben werden',
      NumberQuestionsRequiredKPRIM:
        'Bei Kprim-Fragen müssen genau vier Antwortmöglichkeiten gegeben werden',
      explanationRequired:
        'Bitte geben Sie eine Erklärung ein. Auf Flashcards wird diese Erklärung den Studierenden als Antwort auf die Frage angezeigt.',
      NumericalUnderflow:
        'Numerische Angaben dürfen aus technischen Gründen nicht kleiner als -1e30 sein.',
      NumericalOverflow:
        'Numerische Angaben dürfen aus technischen Gründen nicht größer als 1e30 sein.',
      NRSolutionRangesWithinRestrictions:
        'Die Lösungsbereiche müssen innerhalb der angegebenen Einschränkungen liegen.',
      NRExactSolutionsWithinRestrictions:
        'Die exakten Lösungen müssen innerhalb der angegebenen Einschränkungen liegen.',
      SEnumberOfInputsRequired:
        'Bitte geben Sie die Anzahl der Eingabefelder an.',
      SEnumberOfInputsMin:
        'Die Anzahl der Eingabefelder muss mindestens 1 sein.',
      SEnumberOfInputsMax:
        'Die Anzahl der Eingabefelder darf maximal der Anzahl Optionen in der Antwort-Sammlung - 1 entsprechen.',
      SEanswerCollectionRequired: 'Bitte wählen Sie eine Antwort-Sammlung aus.',
      SEcorrectAnswersRequired:
        'Bitte wählen Sie die korrekten Antwortmöglichkeiten aus Ihrer Sammlung aus.',
      SEcorrectAnswersMatchInputs:
        'Die Anzahl der korrekten Antworten muss mindestens der Anzahl der Eingabefelder entsprechen.',
      CSAnswerCollectionRequired:
        'Bitte wählen Sie eine Antwort-Sammlung aus welcher die zu bewertenden Element der Fallstudie selektiert werden.',
      CSItemsRequired:
        'Bitte wählen Sie mindestens ein Element aus der Antwort-Sammlung aus, welches von den Teilnehmenden auf die erstellten Kriterien bewertet werden soll.',
      CSNewItemsRequired:
        'Bitten definieren Sie mindestens ein Element, welches von den Teilnehmenden auf die erstellten Kriterien bewertet werden soll.',
      CSCriteriaNameRequired:
        'Bitte geben Sie einen Namen für das Kriterium ein.',
      CSCriteriaMinRequired:
        'Bitte geben Sie einen Minimalwert für das Kriterium ein.',
      CSCriteriaMinLessThanMax:
        'Der Minimalwert muss kleiner als der Maximalwert sein.',
      CSCriteriaMaxRequired:
        'Bitte geben Sie einen Maximalwert für das Kriterium ein.',
      CSCriteriaStepRequired:
        'Bitte geben Sie eine Schrittweite für das Kriterium ein.',
      CSStepSizeTooLarge:
        'Die Schrittweite darf maximal der halben Intervallbreite entsprechen.',
      CSLabelsRequired:
        'Bei Schritt- / Likert-Kriterien müssen mindestens je ein Label für die Unter- und Obergrenze definiert werden.',
      CSStepsDefinitionRequired:
        'Bitte definieren Sie eine Anzahl Schritte für das Schritt- / Likert-Kriterium (mindestens 3).',
      CSCriteriaRequired:
        'Zur Erstellung einer Fallstudie wird mindestens ein Kriterium benötigt.',
      CSCasesRequired:
        'Zur Erstellung einer Fallstudie wird mindestens ein Fall benötigt.',
      CSCaseTitleRequired: 'Bitte geben Sie einen Titel für den Fall ein.',
      CSCaseDescriptionRequired:
        'Bitte geben Sie eine Beschreibung für den Fall ein.',
      CSSolutionsRequired:
        'Bei Fallstudien mit Musterlösung muss für jedes Element und die entsprechenden Kriterien ein korrekter Bereich definiert werden.',
      CSSolutionsMissingCertainItems:
        'Bitte geben Sie für alle Elemente und Kriterien eine Lösung an.',
      CSSolutionsMissingCriteriaItem:
        'Bitte stellen Sie sicher, dass für alle Kriterien bei Element {itemNumber} eine korrekte Lösung definiert wurde.',
      CSSolutionsMinMaxRequired:
        'Bitte geben Sie bei Element {itemNumber} und Kriterium "{criterionName}" beide Randwerte für den Lösungsbereich an.',
      CSSolutionsMinMaxOrder:
        'Der Minimalwert muss kleiner als der Maximalwert sein (Element {itemNumber}, Kriterium "{criterionName}").',
      CSSolutionsMinMaxBounds:
        'Die Unter- und Obergrenze der Lösungsintervalls müssen innerhalb des Wertebereichs des Kriteriums liegen (Element {itemNumber}, Kriterium "{criterionName}").',
      CSSolutionsMinMaxStep:
        'Unter- und Obergrenze des Lösungsintervalls müssen bei numerischen Kriterien mindestens eine Schrittweite auseinanderliegen (Element {itemNumber}, Kriterium "{criterionName}").',
      CSSolutionsMinMaxIntegers:
        'Die Unter- und Obgrenze des Lösungsintervalls müssen bei Schritt- / Likert-Kriterien ganzzahlig sein (Element {itemNumber}, Kriterium "{criterionName}").',
    },
    liveQuizzes: {
      runningLiveQuizzes: 'Laufende Live Quizzes',
      plannedLiveQuizzes: 'Geplante Live Quizzes',
      preparedLiveQuizzes: 'Vorbereitete Live Quizzes',
      completedLiveQuizzes: 'Abgeschlossene Live Quizzes',
      liveQuizTemplates: 'Live Quiz Vorlagen',
      embeddingEvaluation: 'Einbettung Evaluation',
      lecturerCockpit: 'Dozierenden Cockpit',
      liveQuizEvaluation: 'Live Quiz Evaluation',
      startLiveQuiz: 'Start Quiz',
      scheduleLiveQuiz: 'Live Quiz planen',
      unpublishLiveQuiz: 'Geplante Veröffentlichung aufheben',
      editLiveQuiz: 'Quiz bearbeiten',
      duplicateLiveQuiz: 'Live Quiz duplizieren',
      viewLiveQuiz: 'Live Quiz einsehen',
      executeLiveQuiz: 'Live Quiz ausführen',
      manageFeedbacksExecution: 'Feedbacks während der Ausführung verwalten',
      viewLiveQuizEvaluation: 'Live Quiz Evaluation einsehen',
      modifyActivitySettings: 'Aktivitäts-Einstellungen ändern',
      modifyContainedElements: 'Elemente im Live Quiz verwalten',
      modifyCourseAssignment: 'Kurszuweisung ändern',
      nBlocksQuestions: '{blocks} Blöcke, {questions} Fragen',
      blockXQuestions: 'Block {block} ({questions} Frage(n))',
      shareLiveQuiz: 'Live Quiz teilen',
      removeLiveQuiz: 'Live Quiz entfernen',
      resetLiveQuiz: 'Live Quiz zurücksetzen',
      deleteLiveQuiz: 'Live Quiz löschen',
      resetLiveQuizMessage:
        'Bitte bestätigen Sie das Zurücksetzen dieses Assessment-Live Quizzes. Alle Antworten der Studierenden und gesammelten Punkte werden gelöscht. Diese Aktion wird im Audit-Log dokumentiert und kann nicht rückgängig gemacht werden.',
      deleteLiveQuizMessage:
        'Bitte bestätigen Sie die Löschung aller mit diesem Live Quiz verbundenen Resultate und Feedbacks. Durch die Teilnehmenden gesammelte Punkte werden durch die Löschung nicht beeinflusst.',
      noResponsesToDelete:
        'Für dieses Live-Quiz wurden noch keine Antworten abgegeben.',
      deleteResponses:
        '{number} Antwort(en) von Studierenden in diesem Live-Quiz werden gelöscht.',
      noFeedbacksToDelete:
        'Für dieses Live-Quiz wurden noch keine Fragen im Q&A-Kanal abgegeben.',
      deleteFeedbacks:
        '{number} Fragen(s) im Live-Q&A-Kanal und Antworten auf diese werden unwiderruflich gelöscht.',
      noConfusionFeedbacksToDelete:
        'Für dieses Live-Quiz wurden noch keine Confusion-Feedbacks abgegeben.',
      deleteConfusionFeedbacks:
        '{number} Confusion-Feedback(s) werden unwiderruflich gelöscht.',
      noLeaderboardEntriesToDelete:
        'Für dieses Live-Quiz wurden noch keine Quiz-Leaderboard-Einträge erstellt.',
      deleteLeaderboardEntries:
        'Alle Quiz-Leaderboard-Einträge werden gelöscht und alle Teilnehmenden verlieren ihre gesammelten Punkte.',
      evaluationLinksEmbedding: 'Links für die Einbettung der Evaluation',
      noLiveQuizzes: 'Keine Live Quizzes gefunden',
      creationExplanation:
        'Um Ihr erstes Live Quiz zu erstellen, gehen Sie zurück in den <link>Fragepool</link>. Dort können alle verschiedenen Arten von KlickerUZH-Elementen erstellt und Fragen aus dem Fragepool hinzufügen werden.',
      embeddingLinkCopied:
        'Der Einbettungslink wurde erfolgreich in die Zwischenablage kopiert.',
      liveQuizSchedulingDateRequired:
        'Bitte geben Sie ein Datum für den automatischen Start des Live-Quiz an.',
      liveQuizSchedulingFutureAfterCourseStart:
        'Das Datum zum automatischen Start des Live Quizzes muss in der Zukunft und falls zugehörig zu einem Kurs, nach dessen Startzeitpunkt liegen.',
      scheduleLiveQuizHint:
        'Bei der geplanten Veröffentlichung des Live Quizzes "{title}" wird dieses automatisch zum von Ihnen festgelegten Zeitpunkt gestartet. Bevor das geplante Veröffentlichungsdatum erreicht ist, kann das Quiz noch unveröffentlicht und bearbeitet werden.',
    },
    practiceQuizzes: {
      viewPracticeQuiz: 'Übungs-Quiz einsehen',
      publishUnpublishPracticeQuiz:
        'Übungs-Quiz veröffentlichen / Veröffentlichung aufheben',
      viewPracticeQuizEvaluation: 'Übungs-Quiz Evaluation einsehen',
      modifyActivitySettings: 'Aktivitäts-Einstellungen ändern',
      modifyContainedElements: 'Elemente im Übungs-Quiz verwalten',
      modifyCourseAssignment: 'Kurszuweisung ändern',
      duplicatePracticeQuiz: 'Übungs-Quiz duplizieren',
    },
    microLearnings: {
      viewMicroLearning: 'Microlearning einsehen',
      publishUnpublishMicroLearning:
        'Microlearning veröffentlichen / Veröffentlichung aufheben',
      viewMicroLearningEvaluation: 'Microlearning Evaluation einsehen',
      modifyActivitySettings: 'Aktivitäts-Einstellungen ändern',
      modifyContainedElements: 'Elemente im Microlearning verwalten',
      modifyCourseAssignment: 'Kurszuweisung ändern',
      duplicateMicroLearning: 'Microlearning duplizieren',
    },
    groupActivities: {
      viewGroupActivity: 'Gruppenaktivität einsehen',
      publishUnpublishGroupActivity:
        'Gruppenaktivität veröffentlichen / Veröffentlichung aufheben',
      gradeGroupActivitySubmissions: 'Abgaben zur Gruppenaktivität bewerten',
      modifyActivitySettings: 'Aktivitäts-Einstellungen ändern',
      modifyContainedElements: 'Elemente in der Gruppenaktivität verwalten',
      modifyCourseAssignment: 'Kurszuweisung ändern',
      duplicateGroupActivity: 'Gruppenaktivität duplizieren',
    },
    cockpit: {
      liveQuizQRCodes: 'Live Quiz QR-Codes',
      qrCodeAccountLinkTitle: 'Konto-Link',
      qrCodeAccountLinkPinWarning: 'PIN nicht enthalten',
      qrCodeDirectLinkIncluded: 'PIN enthalten',
      qrCodeAccountLinkDescription:
        'Ihr Konto-Link listet alle aktiven Live-Quizzes. Wenn nur ein Quiz aktiv ist, werden Teilnehmende direkt weitergeleitet, andererseits können sie auswählen, an welchem Quiz sie teilnehmen möchten. Dieser Link wird empfohlen, um ihn zu Folien hinzuzufügen, da er konsistent bleibt, solange Sie Ihren Kurznamen nicht ändern. Für Quizzes mit Kurszuweisung wird automatisch die Kurssprache im Link eingebettet.',
      qrCodeDirectLinkTitle: 'Direktlink',
      qrCodeDirectLinkDescription:
        'Der Direktlink führt Teilnehmende direkt und ausschliesslich zu diesem Quiz. Wenn das Quiz beendet ist, ist der Link nicht mehr gültig. Dieser Link wird empfohlen, wenn Sie viele Quizzes parallel durchführen und die Teilnehmenden nur an einem bestimmten Quiz teilnehmen sollen. Für Quizzes mit Kurszuweisung wird automatisch die Kurssprache im Link eingebettet. Wenn ein PIN-Code aktiviert ist, wird dieser direkt im Link eingebettet.',
      firstBlock: 'Ersten Block starten',
      blockActive: 'Block schliessen',
      nextBlock: 'Nächsten Block starten',
      endQuiz: 'Quiz beenden',
      audienceView: 'Publikumsansicht',
      evaluationResults: 'Auswertung (Resultate)',
      abortLiveQuiz: 'Quiz abbrechen',
      confirmAbortLiveQuiz: 'Live Quiz {title} abbrechen?',
      noAbortionAssessmentQuiz:
        'Assessment-Quizzes können nicht abgebrochen werden, sobald ein Block gestartet wurde. Sollten Sie das Quiz zu Testzwecken gestartet haben, führen Sie bitte alle Blöcke durch und beenden Sie das Quiz. Nutzer mit Administratorenrechten im Assessment-Kurse können das Live Quiz dann zurücksetzen.',
      cancelLiveQuizMessage:
        'Bitte bestätigen Sie die Löschung aller Elemente, die mit dieser Live-Quiz verbunden sind, und bestätigen Sie den Abbruch dieses Live-Quiz.',
      noResponsesToDelete:
        'Für dieses Live-Quiz wurden noch keine Antworten gespeichert.',
      deleteResponses:
        '{number} Antwort(en) von Studierenden in diesem Live-Quiz werden gelöscht.',
      noFeedbacksToDelete:
        'Für dieses Live-Quiz wurden noch keine Feedbacks abgegeben.',
      deleteFeedbacks:
        '{number} Feedback(s) im Live-Q&A-Kanal werden unwiderruflich gelöscht.',
      noConfusionFeedbacksToDelete:
        'Für dieses Live-Quiz wurden noch keine Confusion-Feedbacks abgegeben.',
      deleteConfusionFeedbacks:
        '{number} Confusion-Feedback(s) werden unwiderruflich gelöscht.',
      noLeaderboardEntriesToDelete:
        'Für dieses Live-Quiz wurden noch keine Quiz-Leaderboard-Einträge erstellt.',
      deleteLeaderboardEntries:
        'Alle Quiz-Leaderboard-Einträge werden gelöscht und alle Teilnehmenden verlieren ihre gesammelten Punkte.',
      printTitle: 'Live Quiz "{name}" - Feedback-Kanal',
      lecturerView: 'Dozierendenansicht',
      liveQA: 'Live Q&A',
      activateQA: 'Live Q&A aktivieren',
      activateModeration: 'Moderation aktivieren',
      QaNotActive: 'Live Q&A nicht aktiv.',
      activateFeedback: 'Feedback aktivieren',
      feedbackNotActive: 'Feedback nicht aktiv.',
      noFeedbacksYet: 'Bisher keine Feedbacks erhalten...',
      noFeedbackFilterMatch:
        'Keine Feedbacks stimmen mit den aktuellen Filtereinstellungen überein...',
      filterSolved: 'Gelöst',
      filterOpen: 'Offen',
      filterPinned: 'Gepinnt',
      filterUnpinned: 'Ungepinnt',
      filterPublished: 'Veröffentlicht',
      filterUnpublished: 'Unveröffentlicht',
      pinning: 'Pinning',
      visibility: 'Sichtbarkeit',
      sortByVotes: 'Nach Stimmen sortieren',
      sortByTime: 'Nach Zeitpunkt sortieren',
      answersGiven: '{number} Antwort(en) gegeben',
      reopenToAnswer: 'Öffnen Sie das Feedback wieder, um zu antworten...',
      enterResponseHere: 'Geben Sie Ihre Antwort hier ein...',
      pinFeedback: 'Pin',
      unpinFeedback: 'Unpin',
      reopen: 'Wieder öffnen',
      resolve: 'Lösen',
      noDataYet: 'Noch keine Daten verfügbar.',
      confusionSlow: 'langsam',
      confusionOptimal: 'optimal',
      confusionFast: 'schnell',
      confusionEasy: 'einfach',
      confusionDifficult: 'schwer',
      speed: 'Geschwindigkeit',
      difficulty: 'Schwierigkeit',
      confusionSpeedTooltip:
        'Die untenstehende Anzeige illustriert die aggregierten Feedbacks der Studierenden bezüglich der aktuell empfundenen Geschwindigkeit des Unterrichts.',
      confusionDifficultyTooltip:
        'Die untenstehende Anzeige illustriert die aggregierten Feedbacks der Studierenden bezüglich der aktuell empfundenen Schwierigkeit des vermittelten Inhalts.',
      skipCooldown: 'Cooldown überspringen',
      deleteFeedback: 'Feedback löschen',
      deleteFeedbackMessage:
        'Sind Sie sicher, dass Sie dieses Feedback löschen möchten: "{feedback}"?',
      moderationTip: 'Alternative zum Löschen',
      moderationTipMessage:
        'Sie können die Moderation aktivieren, um ausgewählte Feedbacks vor der Studierendenansicht zu verstecken, ohne sie dauerhaft zu löschen.',
      confirmDeleteFeedback:
        'Ich verstehe, dass diese Aktion das Feedback dauerhaft löscht.',
      disableModerationTitle: 'Moderation deaktivieren',
      disableModerationMessage:
        'Sie sind dabei, die Moderation zu deaktivieren. Dies wird automatisch {count} unveröffentlichte(s) Feedback(s) veröffentlichen.',
      autoPublishWarning: 'Auto-Veröffentlichung Warnung',
      autoPublishWarningMessage:
        'Diese werden sofort für alle Studierende sichtbar.',
      confirmDisableModeration:
        'Ich verstehe, dass die Moderation deaktiviert wird.',
      confirmPublishUnpublished:
        'Ich bestätige, dass alle {count} unveröffentlichten Feedback(s) veröffentlicht werden sollen.',
      confirmCloseBlockTitle: 'Aktiven Block schliessen',
      confirmCloseBlock:
        'Bitte bestätigen Sie, dass der Block geschlossen werden soll. Ab diesem Zeitpunkt akzeptiert das System keine weiteren Antworten der Studierenden und die vollständige Auswertung (inkl. Musterlösung) kann eingesehen werden.',
    },
    evaluation: {
      evaluationNotYetAvailable:
        'Die Evaluation zu dieser Frage kann leider (noch) nicht angezeigt werden. Sollten Sie diese Seite irgendwo einbinden wollen, beispielsweise über das PowerPoint-Plugin, wird die Evaluation automatisch nach Starten der Frage angezeigt.',
      noSignedInStudents:
        'Bisher waren keine Teilnehmenden während dieses Live Quizzes angemeldet und haben Punkte gesammelt.',
      noFeedbacksYet: 'Dieses Live Quiz enthält bisher keine Feedbacks.',
      noConfusionFeedbacksYet:
        'Dieses Live Quiz enthält bisher keine Confusion Feedbacks.',
      totalParticipants: 'Total Teilnehmende: {number}',
      totalParticipantsInclAnon:
        'Total Teilnehmende: {number} ({anonymous} anonym)',
      showSolution: 'Lösung anzeigen',
      showExplanation: 'Erklärung anzeigen',
      showSolutionInfo:
        'Diese Option ermöglicht es Ihnen, vorab auszuwählen, ob die Musterlösung auf der eingebetteten Auswertungsansicht angezeigt werden soll, sobald Sie die entsprechende Seite oder Folie öffnen. Diese Einstellung kann geändert werden, sobald die entsprechende Ansicht geöffnet wurde.',
      showExplanationInfo:
        'Diese Option ermöglicht es Ihnen, vorab auszuwählen, ob die Erklärung (falls erfasst) auf der eingebetteten Auswertungsansicht angezeigt werden soll, sobald Sie die entsprechende Seite oder Folie öffnen. Diese Einstellung kann geändert werden, sobald die entsprechende Ansicht geöffnet wurde.',
      solutionHiddenWhileActive:
        'Die Musterlösung und Erklärung werden erst nach Schliessen des Blocks auf der Evaluationsansicht angezeigt.',
      fontSize: 'Schriftgrösse',
      validSolutionRange: 'Erlaubter Antwortbereich',
      correctSolutionRanges: 'Korrekte Lösungsbereiche',
      correctExactSolutions: 'Korrekte Lösungen',
      statistics: 'Statistik',
      keywordsSolution: 'Schlüsselwörter Lösung',
      noChartsAvailable: 'There exists no chart for this question type yet',
      count: 'Anzahl',
      value: 'Wert',
      selection: 'Auswahl',
      histogramRange: 'Bereich',
      histogramBins: 'Unterteilungen',
      histogramBinsError:
        'Bitte geben Sie eine Anzahl Unterteilungen zwischen 2 und 100 ein.',
      histogramLowerLimit: 'Untere Grenze',
      histogramUpperLimit: 'Obere Grenze',
      histogramLowerLimitError:
        'Die untere Grenze muss grösser als {minValue} sein.',
      histogramUpperLimitError:
        'Die obere Grenze muss kleiner als {maxValue} sein.',
      histogramRangeError:
        'Bitte stellen Sie sicher, dass die untere Grenze kleiner als die obere Grenze ist.',
      correctLabel: 'Korrekt',
      correctLabelValue: 'Korrekt: {value}',
      resetSorting: 'Sortierung zurücksetzen',
      noFeedbacksMatchFilter:
        'Keine Feedbacks stimmen mit den aktuellen Filtereinstellungen überein...',
      resolvedDuringLiveQuiz: 'Während des Live Quizzes gelöst',
      confusion: 'Verständnis',
      minStep60s: 'Die Schrittweite muss mindestens 60 Sekunden betragen.',
      validMinSteps: 'Bitte geben Sie eine gültige Mindestschrittweite ein.',
      minWindowLength: 'Die Fensterlänge muss mindestens 1 betragen.',
      validWindowLength: 'Bitte geben Sie eine gültige Fensterlänge ein.',
      confusionDiagramsTooltip:
        'Die Diagramme unten zeigen alle Confusion-Feedbacks der Teilnehmenden von Beginn bis Ende des Live Quizzes. Die Werte werden normalisiert auf dem Intervall [-1,1] dargestellt und auf 0 gesetzt, sollten in einem Zeitabschnitt keine Werte vorhanden sein. Die exakte Anzahl Feedbacks kann durch Hovering der Maus über einem Datenpunkt ausgelesen werden.',
      avgDifficulty: 'Durchschnittl. Schwierigkeit',
      avgSpeed: 'Durchschnittl. Geschwindigkeit',
      graphSettings: 'Graph Einstellungen',
      timestepX: 'Timesteps X-Axis',
      timestepXTooltip:
        'In diesem Feld kann die Schrittgrösse auf der x-Achse in Sekunden für die Diagramme eingegeben werden. Der Minimalwert ist 60 Sekunden, der Default-Wert 120 Sekunden.',
      minTimestep: 'min. 60s',
      windowLength: 'Fensterlänge',
      windowLengthTooltip:
        'In diesem Feld kann ein eigener Faktor (multipliziert mit der Schrittweite auf der x-Achse) für die Grösse des Running Window zur Durchschnittsberechnung festgelegt werden. Der kleinstmögliche Faktor ist 1, der Default-Wert 3.',
      minWindow: 'min. 1',
      displayedInterval: 'Displayed interval: {interval} seconds',
      displayedWindow: 'Displayed running window: {window} times interval',
      table: 'Tabelle',
      wordCloud: 'Word Cloud',
      wordCloudFilterMode: 'Filtermodus',
      wordCloudLanguageFilter: 'Sprachfilter',
      wordCloudLanguageFilterTooltip:
        'Wenn eine Sprache ausgewählt ist, werden Stoppwörter dieser Sprache (z. B. "und", "der") herausgefiltert. Deaktivieren, um alle Wörter anzuzeigen.',
      wordCloudLanguageNone: 'Deaktiviert',
      wordCloudDisplayLimit: 'Anzeigelimit',
      wordCloudDisplayLimitAll: 'Alle',
      wordCloudModeWords: 'Einzelne Wörter',
      wordCloudOmittedWords:
        '{count} {count, plural, one {Wort} other {Wörter}} konnten aufgrund des Anzeigelimits oder aufgrund von Platzmangel nicht angezeigt werden.',
      wordCloudOmittedSentences:
        '{count} {count, plural, one {Antwort} other {Antworten}} konnten aufgrund des Anzeigelimits oder aufgrund von Platzmangel nicht angezeigt werden.',
      wordCloudModeSentences: 'Vollständige Antworten',
      wordCloudNoResponses:
        'Für diese Frage wurden noch keine Antworten von Teilnehmenden gespeichert 😔.',
      wordCloudNoResponsesFiltered:
        'Keine Antworten entsprechen den aktuellen Filtereinstellungen 🧐.',
      wordCloudNoResponsesDisplayed:
        'Keine Antworten werden aufgrund der aktuellen Filtereinstellungen oder der angegebenen Schriftgrößen angezeigt 😰.',
      numberOfVotes: 'Häufigkeit: {number}',
      histogram: 'Histogramm',
      barChart: 'Balkendiagramm',
      scatterPlot: 'Streudiagramm',
      unset: 'Nicht gesetzt',
      noStatistics:
        'Bisher sind aufgrund fehlender Antworten noch keine Statistiken verfügbar.',
      practiceQuizEvaluation: 'Übungs-Quiz Evaluation',
      microLearningEvaluation: 'Microlearning Evaluation',
      chartTypeNotSupported:
        'Derzeit wird der ausgewählte Diagrammtyp für diesen Elementtyp nicht unterstützt.',
      histogramNotSupported:
        'Histogramme werden für diesen Fragetyp nicht unterstützt.',
      criterionXAxis: 'Kriterium X-Achse',
      criterionYAxis: 'Kriterium Y-Achse',
      aggregation: 'Aggregation',
      caseStudySelectCasesCriteria:
        'Bitte wählen Sie mindestens einen Fall und entsprechende Kriterien aus, um die Auswertung anzuzeigen.',
      caseStudyHistogramSelection:
        'Sie können entweder mehrere Fälle oder mehrere Fallstudien-Elemente auswählen, um die entsprechenden Resultate zu vergleichen. Eine Kombination von mehreren Fällen und mehreren Fallstudien-Elementen kann nicht dargestellt werden.',
      caseStudySelectCasesItemsCriteria:
        'Bitte wählen Sie mindestens einen Fall, ein Fallstudien-Element und Kriterien aus, um eine Auswertung anzuzeigen.',
      answerNotRemembered: 'Antwort nicht bekannt',
      answerPartiallyRemembered: 'Antwort teilweise bekannt',
      answerRemembered: 'Antwort bekannt',
      frontSide: 'Vorderseite',
      backSide: 'Rückseite',
      blockActive: 'Block ist aktiv',
      blockActiveInfo:
        'Der aktuell ausgewählte Block wurde noch nicht geschlossen. Die Teilnehmenden Ihres Quizzes können nach wie vor Antworten abgeben. Bitte bestätigen Sie, dass Sie die Resultate anzeigen wollen.',
      showResults: 'Resultate anzeigen',
      showQRCodes: 'QR-Codes anzeigen',
    },
    lecturer: {
      noDataAvailable: 'Keine Daten verfügbar...',
      audienceInteractionNotActivated:
        'Publikumsinteraktion ist nicht aktiviert.',
      noFeedbacks: 'Bisher wurden keine Feedbacks eingegeben oder angepinnt...',
    },
    courseList: {
      showDetails: 'Kursinformationen anzeigen',
      selectCourse: 'Bitte wählen Sie einen Kurs aus',
      createNewCourse: 'Neuen Kurs erstellen',
      changeAvailabilityDateMicrolearnings:
        'Die Verfügbarkeit der Microlearnings wird basierend auf dem ursprünglichen Kursstartdatum an die neuen Kursdaten angepasst.',
      changeAvailabilityDateGroupActivities:
        'Die Verfügbarkeitsdaten der Gruppenaktivitäten werden entsprechend der Verschiebung zum ursprünglichen Kursstartdatum an die neuen Kursdaten angepasst.',
      courseDatesForCourseDuplicationTooltip:
        'Aus technischen Gründen sind die Kursdaten auf ein fixes Intervall festgelegt, das durch den ursprünglichen Kurs definiert ist. Sie können die Daten für den duplizierten Kurs anschliessend ändern.',
      fixedDateInterval:
        'Fixes Datumsintervall: {years, plural, =0 {} one {# Jahr } other {# Jahre }}{months, plural, =0 {} one {# Monat } other {# Monate }}{days, plural, =0 {} one {# Tag} other {# Tage}}',
      groupCreationDeadlineForCourseDuplicationTooltip:
        'Wenn Sie die Kursdaten ändern, wird diese Deadline anhand ihres ursprünglichen Abstands neu berechnet. Sie können sie anschliessend anpassen.',
      copyLiveQuizzesTooltip:
        'Wenn Sie diese Einstellung aktivieren, werden alle Live-Quizzes im Kurs in den neuen Kurs kopiert.',
      copyPracticeQuizzesTooltip:
        'Wenn Sie diese Einstellung aktivieren, werden alle Übungs-Quizzes im Kurs in den neuen Kurs kopiert.',
      copyMicroLearningsTooltip:
        'Wenn Sie diese Einstellung aktivieren, werden alle Microlearnings im Kurs in den neuen Kurs kopiert.',
      copyGroupActivitiesTooltip:
        'Wenn Sie diese Einstellung aktivieren, werden alle Gruppenaktivitäten im Kurs in den neuen Kurs kopiert. Wenn die Gruppenbildung-Einstellung deaktiviert wird, wird diese Einstellung deaktiviert.',
      courseDuplicationCopyInfo:
        'Beim Duplizieren eines Kurses werden unabhängige Aktivitätskopien erstellt und direkte Freigabeberechtigungen beibehalten. Die kopierten Aktivitätsinstanzen referenzieren weiterhin dieselben zugrundeliegenden Elemente. Wenn Sie einen Kurs duplizieren, der einer anderen Person gehört, behält diese Administratorzugriff auf die Kopie.',
      courseCopySuffix: 'Kopie',
      courseDuplicationEndDateInPast:
        'Das gewählte Enddatum liegt in der Vergangenheit. Der duplizierte Kurs ist bereits beendet, sobald er erstellt wird - verschieben Sie das Startdatum, falls Studierende auf den Kurs zugreifen sollen.',
      courseDuplicationFailed: 'Duplizieren des Kurses fehlgeschlagen.',
      courseDuplicationAlreadyInProgress:
        'Dieser Kurs wird bereits dupliziert.',
      courseDuplicationNoAccess:
        'Sie verfügen nicht mehr über ausreichende Berechtigungen, um diesen Kurs zu duplizieren.',
      courseDuplicationPartialFailure:
        'Nicht alle ausgewählten Aktivitäten oder Aktivitätsinstanzen konnten dupliziert werden. Es wurde kein unvollständiger Kurs erstellt.',
      courseDuplicationInProgress:
        'Das Duplizieren grosser Kurse kann einen Moment dauern.',
      courseDuplicationBackgroundInfo:
        'Sie können diesen Dialog schliessen. Sobald die Kopie bereit ist, erhalten Sie eine Benachrichtigung mit einem Link zum Öffnen.',
      courseDuplicationStatusTab: 'Kursduplizierungen',
      courseDuplicationStatusCount:
        '{count, plural, one {# laufender Kursduplizierungsauftrag} other {# laufende Kursduplizierungsaufträge}}',
      courseDuplicationStatusTitle: 'Laufende Kursduplizierungen',
      courseDuplicationStatusDescription:
        'Sie können weiterarbeiten, während diese Kurse kopiert werden.',
      courseDuplicationStatusSource: 'Kopie von "{source}"',
      courseDuplicationSucceeded: 'Kurs "{name}" wurde erfolgreich dupliziert.',
      courseDuplicationOpenCourse: 'Kurs öffnen',
      noCoursesFound:
        'Es konnten keine Kurse gefunden werden. Bitte erstellen Sie einen neuen Kurs.',
      createCourseNow: 'Jetzt einen Kurs erstellen!',
      courseNameReq: 'Bitte geben Sie einen Namen für den Kurs an.',
      courseDisplayNameReq:
        'Bitte geben Sie einen Anzeigenamen für den Kurs an.',
      courseColorReq: 'Bitte wählen Sie eine Farbe für den Kurs.',
      courseStartReq:
        'Bitte geben Sie ein Startdatum für Ihren Kurs ein. Die Daten können auch nach Erstellen des Kurses noch verändert werden.',
      courseEndReq:
        'Bitte geben Sie ein Enddatum für Ihren Kurs ein. Die Daten können auch nach dem Erstellen des Kurses noch verändert werden.',
      courseStartBeforeEarliestActivityStart:
        'Das Kursstartdatum muss vor dem Startdatum der ersten Aktivität ({date}) liegen.',
      endBeforeEarliestActivityEnd:
        'Das Kursenddatum muss nach dem Enddatum der letzten Aktivität ({date}) liegen.',
      groupDeadlineBeforeFirstGroupActivity:
        'Die Deadline für die Gruppenbildung muss vor dem Start der ersten Gruppenaktivität ({date}) liegen.',
      endDateFuture: 'Das Enddatum muss in der Zukunft liegen.',
      endAfterStart: 'Das Enddatum muss nach dem Startdatum liegen.',
      courseName: 'Kursname',
      courseNameTooltip:
        'Der Kursname dient Ihnen zur Identifizierung des Kurses. Den Studierenden wird dieser Name nicht angezeigt.',
      courseDisplayName: 'Kursanzeigename',
      courseDisplayNameTooltip:
        'Der Anzeigename wird den Studierenden angezeigt. Er kann vom Kursnamen abweichen.',
      courseDescriptionTooltip:
        'Die Beschreibung wird den Studierenden angezeigt. Sie können hier z.B. die Ziele des Kurses beschreiben.',
      addDescription: 'Beschreibung hinzufügen',
      notificationEmail: 'Benachrichtigungs-E-Mail',
      notificationEmailTooltip:
        'Die E-Mail-Adresse, an welche kurs-spezifische Benachrichtigungen gesendet werden (z.B. Anmerkungen von Studierenden zu fehlerhaften Fragen). Diese E-Mail-Adresse kann später in den Kurseinstellungen geändert werden und ist für die Studierenden nicht sichtbar.',
      notificationEmailPlaceholder: 'finance@uzh.ch',
      notificationEmailInvalid:
        'Bitte geben Sie eine gültige E-Mail-Adresse ein.',
      notificationEmailReq:
        'Bitte geben Sie eine E-Mail-Adresse für Kurs-spezifische Benachrichtigungen an.',
      courseLanguage: 'Kurs-Sprache',
      startDate: 'Startdatum',
      startDateTooltip:
        'Ab dem Startdatum können die Studierenden auf die freigeschalteten Inhalte des Kurses zugreifen. Das Startdatum können Sie auch nach Erstellen des Kurses noch verändern.',
      endDate: 'Enddatum',
      endDateTooltip:
        'Nach dem Enddatum wird der Kurs für die Studierenden als archiviert angezeigt, sie können aber weiterhin auf die Inhalte zugreifen. Das Enddatum können Sie auch nach Erstellen des Kurses noch verändern.',
      courseColor: 'Kursfarbe',
      languageTooltip:
        'Wählen Sie eine Sprache, welche beim Export von Kurs-Links, etc. als Standard verwendet werden soll. Studierende haben nach wie vor die Möglichkeit, die Sprache in der Studierenden-App zu ändern.',
      courseCreationFailed: 'Erstellen des Kurses fehlgeschlagen...',
      groupDeadlineFuture:
        'Die Deadline für die Gruppenbildung muss in der Zukunft liegen.',
      groupDeadlineBeforeEnd:
        'Die Deadline für die Gruppenbildung muss vor dem Kursenddatum liegen.',
      groupDeadlineAfterStart:
        'Die Deadline für die Gruppenbildung muss nach dem Kursstartdatum liegen.',
      groupDeadlineReq:
        'Bitte geben Sie ein gültiges Datum für die Gruppenbildung an.',
      maxGroupSizeMin: 'Die maximale Gruppengrösse muss mindestens 2 betragen.',
      maxGroupSizeLargerThanPreferred:
        'Die maximale Gruppengrösse muss strikt grösser als die bevorzugte Gruppengrösse sein, um sicherzustellen, dass automatisch generierte Gruppen niemals die maximale Gruppengrösse überschreiten.',
      maxGroupSizeReq:
        'Bitte geben Sie eine gültige maximale Gruppengrösse an.',
      preferredGroupSizeMin:
        'Die bevorzugte Gruppengrösse muss mindestens 2 betragen.',
      preferredGroupSizeReq:
        'Bitte geben Sie eine gültige bevorzugte Gruppengrösse an.',
      gamificationTooltip:
        'Gamifizierung kann nach Erstellung des Kurses nur noch aktiviert (nicht mehr deaktiviert) werden.',
      groupCreationEnabled: 'Gruppenbildung möglich',
      groupCreationDisabledTooltip:
        'Um die Gruppenbildung für Ihre Studierenden zu aktivieren, aktivieren Sie bitte zuerst die Gamifizierung für diesen Kurs.',
      groupCreationEnabledTooltip:
        'Wenn Sie diese Einstellung deaktivieren, können Studierende in diesem Kurs keine Gruppen bilden und Sie können keine Gruppenaktivitäten erstellen. Falls initial deaktiviert, kann die Gruppenbildung später in der Kursübersicht aktiviert werden.',
      groupCreationDeadline: 'Deadline Gruppenbildung',
      groupCreationDeadlineTooltip:
        'Studierende können bis zur Deadline neue Gruppen erstellen oder einer bestehenden Gruppe beitreten.',
      maxGroupSize: 'Maximale Gruppengrösse',
      maxGroupSizeTooltip:
        'Die maximale Anzahl Studierender in einer Gruppe. Nach Erstellen des Kurses kann diese Einstellung nicht mehr verändert werden. Die minimale Gruppengrösse ist auf zwei Teilnehmende festgelegt, um eine zufällige Gruppenbildung zu ermöglichen.',
      preferredGroupSize: 'Bevorzugte Gruppengrösse',
      preferredGroupSizeTooltip:
        'Die bevorzugte Anzahl Studierender in einer Gruppe. Nach Erstellen des Kurses kann diese Einstellung nicht mehr verändert werden. Wenn Studierende die automatisierte Gruppenbildungsfunktion wählen, wird der Algorithmus so viele Gruppen wie möglich mit dieser Grösse erstellen.',
      groupDeadlineChangedToPast:
        'Die Deadline für die Gruppenbildung liegt in der Vergangenheit. Mit dieser Einstellung können Studierende keine Gruppen mehr erstellen oder zu welchen beitreten und Studierende, welche die automatische Gruppenbildung gewählt haben, werden innerhalb von eines Tages automatisch Gruppen zugewiesen, wenn möglich. Um die Gruppeneinteilung sofort zu finalisieren, nutzen Sie bitte die Funktion auf der Gruppenübersicht.',
      gamificationGroupsFixed:
        'Gamifizierung und Gruppenbildung sind für diesen Kurs aktiviert. Diese Einstellungen können später nicht deaktiviert werden, falls gamifizierte Aktivitäten oder Gruppen vorhanden sind. Initial deaktivierte Optionen können später aktiviert werden.',
      gamificationFixed:
        'Gamifizierung ist für diesen Kurs aktiviert. Diese Einstellung kann später nicht deaktiviert werden, falls gamifizierte Aktivitäten vorhanden sind. Initial deaktivierte Optionen können später aktiviert werden.',
      openPreview: 'Vorschau öffnen',
      openEvaluation: 'Evaluation öffnen',
      archiveOnlyPastCourses:
        'Nur Kurse mit einem Enddatum in der Vergangenheit können archiviert werden.',
      noDeletionAssessment:
        'Kurse im Assessment-Modus können nicht gelöscht werden.',
      archiveCourse: 'Kurs archivieren',
      unarchiveCourse: 'Kurs wiederherstellen',
      confirmCourseArchive:
        'Bitte bestätigen Sie, dass Sie diesen Kurs archivieren möchten. Archivierte Kurse und darin enthaltene Aktivitäten bleiben für Studierende zugänglich.',
      confirmCourseUnarchive:
        'Bitte bestätigen Sie, dass Sie diesen Kurs wieder aktivieren möchten. Wiederhergestellte Kurse werden Studierenden anders angezeigt.',
      showArchive: 'Archiv anzeigen',
      hideArchive: 'Archiv verbergen',
      deleteCourse: 'Kurs löschen',
      courseDeletionMessage:
        'Bitte bestätigen Sie die Löschung aller mit diesem Kurs verbundenen Elemente und bestätigen Sie die unwiderrufliche Löschung des Kurses. Beachten Sie, dass alle Studierenden den Zugriff auf den Kurs sowie alle zugehörigen Kursmaterialien und Aktivitäten verlieren.',
      noParticipationsToDelete: 'Dieser Kurs enthält keine Teilnehmenden.',
      deleteParticipations:
        '{number} Teilnehmende(r) dieses Kurses verlieren ihre gesammelten Punkte und den Zugriff auf alle Kursmaterialien und Aktivitäten.',
      noLiveQuizzesDisconnected: 'Dieser Kurs enthält keine Live-Quizzes.',
      disconnectLiveQuizzes:
        '{number} Live-Quizz(es) werden vom Kurs getrennt. Sie können weiterhin über die Aktivitätenliste aufgerufen werden.',
      deleteDraftActivitiesOption:
        'Alle verknüpften Aktivitäten im Entwurfsstatus ebenfalls unwiderruflich löschen.',
      deleteDraftActivities:
        'Alle verknüpften Aktivitäten im Entwurfsstatus werden unwiderruflich gelöscht. Alle übrigen Live-Quizzes werden vom Kurs getrennt und bleiben über die Aktivitätenliste zugänglich.',
      noPracticeQuizzesToDelete: 'Dieser Kurs enthält keine Übungs-Quizzes.',
      deletePracticeQuizzes:
        '{number} Übungs-Quizz(es) (inklusive deren Resultate) werden unwiderruflich gelöscht.',
      noMicroLearningsToDelete: 'Dieser Kurs enthält keine Microlearnings.',
      deleteMicroLearnings:
        '{number} Microlearning(s) (inklusive deren Resultate) werden unwiderruflich gelöscht.',
      noGroupActivitiesToDelete:
        'Dieser Kurs enthält keine Gruppenaktivitäten.',
      deleteGroupActivities:
        '{number} Gruppenaktivität(en) (inklusive der zugehörigen Abgaben) werden unwiderruflich gelöscht.',
      noParticipantGroupsToDelete:
        'Dieser Kurs enthält keine Teilnehmergruppen.',
      deleteParticipantGroups:
        '{number} Teilnehmergruppe(n) werden unwiderruflich gelöscht.',
      noLeaderboardEntriesToDelete:
        'Dieser Kurs enthält keine Leaderboard-Einträge.',
      deleteLeaderboardEntries:
        '{number} Leaderboard-Einträge werden unwiderruflich gelöscht.',
      activityAnalytics: 'Quiz Analysen',
    },
    course: {
      modifyCourse: 'Kurs bearbeiten',
      shareCourse: 'Kurs teilen',
      duplicateCourse: 'Kurs duplizieren',
      learningAnalytics: 'Learning Analytics',
      moreCourseActions: 'Weitere Kursaktionen',
      pointCorrections: 'Punktekorrekturen',
      assessmentResults: 'Assessment Resultate',
      participantInvitations: 'Teilnehmendeneinladungen',
      appliedCorrections: 'Angewendete Punktkorrekturen',
      nameWithPin: 'Kurs: {name} (PIN: {pin})',
      joinCourse: 'Kurs beitreten',
      viewCourse: 'Kurs einsehen',
      viewActivities: 'Aktivitäten einsehen',
      executeActivities: 'Aktivitäten ausführen',
      modifyCourseSettings: 'Kurseinstellungen ändern',
      modifyContainedActivities: 'Aktivitäten im Kurs bearbeiten',
      manageParticipantGroups: 'Teilnehmergruppen verwalten',
      deleteCourse: 'Kurs löschen',
      removeCourse: 'Kurs entfernen',
      confirmCourseRemoval:
        'Bitte bestätigen Sie die folgenden Effekte der Entfernung des Kurses <b>{name}</b> aus Ihrem Nutzerkonto.',
      courseRemovalFinal:
        'Durch die Entfernung des Kurses wird dieser aus Ihrem Benutzerkonto entfernt, aber nicht dessen Inhalt gelöscht. Zudem bleiben alle Kursinhalte für die Studierenden weiterhin verfügbar. Die Aktion kann nicht rückgängig gemacht werden.',
      courseRemovalDependencyAccess:
        'Allfällige abgeleitete Berechtigungen auf Kursinhalte (Aktivitäten, Elemente, etc.) werden automatisch widerrufen, sofern deren Erhalt nicht technisch erforderlich ist.',
      requiredPin: 'Die für den Beitritt benötigte PIN lautet: <b>{pin}</b>',
      nParticipants: '{number} Teilnehmende',
      saveDescription: 'Beschreibung speichern',
      noDescriptionNotification: 'Keine Beschreibung vorhanden',
      reviewProgress: 'Review-Fortschritt',
      activityNotAvailableAssessment:
        '{activityType} werden in Assessment-Kursen leider aktuell noch nicht unterstützt.',
      withGroups: 'Mit Gruppen',
      assessmentWithGroups: 'Mit Gruppen (Assessment)',
      withoutGroups: 'Ohne Gruppen',
      changedDate: 'Datum wurde erfolgreich angepasst.',
      dateChangeFailed:
        'Beim Anpassen des Datums ist ein Fehler aufgetreten. Bitte überprüfen Sie die Eingabe.',
      noLiveQuizzes: 'Keine Live Quizzes vorhanden',
      noPracticeQuizzes: 'Keine Übungs-Quizzes vorhanden',
      noMicrolearnings: 'Keine Microlearnings vorhanden',
      noGroupActivities: 'Keine Gruppenaktivitäten vorhanden',
      courseLeaderboard: 'Kurs Leaderboard',
      groupLeaderboard: 'Gruppen Leaderboard',
      groups: 'Gruppen',
      assignRandomGroups: 'Zufällige Gruppen zuweisen',
      emailsInLeaderboardExport:
        'Um zusätzlich zu den Nutzernamen auch die hinterlegten E-Mail Adressen der Studierenden einzusehen, exportieren Sie bitte die untenstehende Tablle über die CSV-Export Funktion. Studierende ohne Punkte werden nur auf dem Leaderboard für den ganzen Kurs angezeigt (nicht auf wöchentlichen Leaderboards).',
      lastModified: 'Zuletzt verändert',
      participantsLeaderboard: 'Teilnehmende (Rangliste/Total): {number}',
      avgPoints: 'Durchschnittl. Punkte: {points}',
      quickSelection: 'Schnellauswahl',
      entireCourse: 'Gesamter Kurs',
      weekly: 'Wöchentlich',
      lastWeek: 'Letzte Woche',
      lastTwoWeeks: 'Letzte 2 Wochen',
      rolling7: '7 Tage (fortlaufend)',
      rolling14: '14 Tage (fortlaufend)',
      custom: 'Benutzerdefiniert',
      leaderboardType: 'Leaderboard Typ',
      leaderboardTypeTooltip:
        'Wählen Sie die Daten aus, die im Leaderboard angezeigt werden sollen. Das wöchentliche und benutzerdefinierte Leaderboard zeigt die Anzahl der gesammelten Punkte innerhalb des ausgewählten Zeitraums. Alle Daten werden täglich um Mitternacht oder manuell mit dem entsprechenden Button aktualisiert.',
      timeRange: 'Zeitraum',
      runningLiveQuiz: 'Laufendes Live Quiz',
      publicAccess: 'Öffentlicher Zugriff',
      restrictedAccess: 'Restriktierter Zugriff',
      startAt: 'Start: {time}',
      endAt: 'Ende: {time}',
      nQuestions: '{number} Fragen',
      courseQRDescription:
        'Teilen Sie diesen Link oder den QR-Code mit Ihren Teilnehmenden, damit sie dem Kurs beitreten können.',
      calendarView: 'Kalenderansicht',
      backToListView: 'Zurück zur Listenansicht',
      calendarAllDay: 'Ganztägig',
      calendarMore: 'weitere',
      calendarNoEntries: 'Keine Einträge',
      calendarCourseStart: 'Kursstart',
      calendarCourseEnd: 'Kursende',
      calendarCourseGroupFormationDeadline: 'Gruppenbildungs-Deadline',
      copyAccessLink: 'Zugriffslink kopieren',
      copyLTIAccessLink: 'LTI Link kopieren',
      liveQuizList: 'Live Quiz Liste',
      practiceQuizList: 'Übungs-Quiz Liste',
      microLearningList: 'Microlearning Liste',
      linkAccessCopied:
        'Der Link für den Zugriff wurde in die Zwischenablage kopiert.',
      linkLTICopied:
        'Der Link für die Einbettung per LTI (z. B. in OpenOLAT) wurde in die Zwischenablage kopiert.',
      linkLTIError:
        'Beim Kopieren des LTI-Links ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
      linkLTILeaderboardLabel: 'Leaderboard',
      linkLTIDocsLabel: 'Dokumentation',
      linkLTILiveQuizzesLabel: 'Live Quizzes',
      linkLTIPracticeQuizzesLabel: 'Übungs-Quizzes',
      linkLTIMicroLearningsLabel: 'Microlearnings',
      linkLTIAccountManagement: 'Account Management',
      editMicrolearning: 'Microlearning bearbeiten',
      duplicateMicroLearning: 'Microlearning duplizieren',
      extendMicroLearning: 'Microlearning verlängern',
      extendMicroLearningDescription:
        'Verwenden Sie dieses Dialogfeld, um das Enddatum des Microlearnings zu ändern. Bitte beachten Sie, dass nur zukünftige Daten als Enddatum gewählt werden können.',
      newEndDate: 'Neues Enddatum',
      futureEndDateRequired: 'Bitte geben Sie ein Enddatum in der Zukunft ein.',
      unpublishMicrolearning: 'Veröffentlichung aufheben',
      convertMicroLearningToPracticeQuiz: 'In Übungs-Quiz umwandeln',
      shareMicroLearning: 'Microlearning teilen',
      removeMicroLearning: 'Microlearning entfernen',
      deleteMicroLearning: 'Microlearning löschen',
      deleteMicroLearningMessage:
        'Bitte bestätigen Sie die Löschung aller mit diesem Microlearning verbundenen Resultate. Beachten Sie, dass alle Studierenden den Zugriff auf das Microlearning, dessen Inhalte und alle Resultate verlieren.',
      publishItemPRACTICE_QUIZ: 'Übungs-Quiz veröffentlichen',
      publishItemMICROLEARNING: 'Microlearning veröffentlichen',
      publishItemGROUP_ACTIVITY: 'Gruppenaktivität veröffentlichen',
      confirmPublishingMicrolearning:
        'Bitte bestätigen Sie, dass Sie das Microlearning <b>{name}</b> veröffentlichen möchten. Diese Aktion macht es für alle Teilnehmenden im folgenden Zeitfenster verfügbar:',
      microlearningPublishingHint:
        'Dieser Prozess kann nur rückgängig gemacht werden, wenn das Startdatum in der Zukunft liegt. Änderungen am Inhalt der enthaltenen Elemente sind nach der Veröffentlichung nicht mehr möglich.',
      confirmPublishingGroupActivity:
        'Bitte bestätigen Sie, dass Sie die Gruppenaktivität <b>{name}</b> veröffentlichen möchten. Diese Aktion macht sie für alle Gruppen im folgenden Zeitfenster verfügbar:',
      groupActivityPublishingHint:
        'Dieser Prozess kann nur rückgängig gemacht werden, wenn das Startdatum in der Zukunft liegt. Änderungen am Inhalt der enthaltenen Elemente sind nach der Veröffentlichung nicht mehr möglich.',
      practicePublishingHint:
        'Das Publizieren dieses Übungs-Quizzes macht das Element ab sofort für alle Teilnehmenden über den Zuganglink und die KlickerUZH App sichtbar. Dieser Prozess kann nicht rückgängig gemacht werden.',
      practiceSchedulingHint:
        'Das Publizieren dieses Übungs-Quizzes aktiviert die automatische Veröffentlichung am von Ihnen gesetzen Datum: {date}. Ab diesem Zeitpunkt wird das Übungs-Quiz automatisch für alle Teilnehmenden sichtbar sein. Bis zum {date} können Sie die Veröffentlichung noch rückgängig machen.',
      editPracticeQuiz: 'Übungs-Quiz bearbeiten',
      duplicatePracticeQuiz: 'Übungs-Quiz duplizieren',
      sharePracticeQuiz: 'Übungs-Quiz teilen',
      removePracticeQuiz: 'Übungs-Quiz entfernen',
      deletePracticeQuiz: 'Übungs-Quiz löschen',
      deletePracticeQuizMessage:
        'Bitte bestätigen Sie die Löschung aller mit diesem Übungs-Quiz verbundenen Resultate. Beachten Sie, dass alle Studierenden den Zugriff auf die Aktivität, deren Inhalte und alle Resultate verlieren.',
      noResponsesToDelete:
        'Für diese Aktivität wurden noch keine Antworten von angemeldeten Teilnehmenden gespeichert.',
      deleteResponses:
        '{number} Antwort(en) von angemeldeten Teilnehmenden werden gelöscht.',
      noAnonymousResponsesToDelete:
        'Für diese Aktivität wurden noch keine anonymen Antworten gespeichert.',
      deleteAnonymousResponses:
        '{number} anonyme Antwort(en) für diese Aktivität werden gelöscht.',
      unpublishPracticeQuiz: 'Veröffentlichung aufheben',
      editGroupActivity: 'Gruppenaktivität bearbeiten',
      endGroupActivity: 'Gruppenaktivität beenden',
      endGroupActivityMessage:
        'Bitte bestätigen Sie, dass Sie diese Gruppenaktivität beenden möchten. Beachten Sie, dass nach dem Beenden der Gruppenaktivität keine weiteren Abgaben mehr akzeptiert werden.',
      endMicroLearning: 'Microlearning beenden',
      endMicroLearningMessage:
        'Bitte bestätigen Sie, dass Sie dieses Microlearning beenden möchten. Beachten Sie, dass nach dem Beenden des Microlearnings keine weiteren Abgaben mehr akzeptiert werden.',
      noResponsesToMicroLearning:
        'Bisher haben keine angemeldeten Teilnehmenden Antworten für Elemente in diesem Microlearning abgesendet.',
      responsesToMicroLearning:
        '{number} Antwort(en) von angemeldeten Teilnehmenden wurden für Elemente in diesem Microlearning abgesendet.',
      noAnonResponsesToMicroLearning:
        'Für dieses Microlearning wurden noch keine anonymen Antworten abgesendet.',
      anonResponsesToMicroLearning:
        '{number} anonyme Antwort(en) für diese Aktivität wurden abgesendet.',
      noStartedInstancesLosingAccess:
        'Es gibt keine Gruppen, die die Gruppenaktivität gestartet haben, aber ihre Resultate noch nicht abgesendet haben.',
      startedInstancesLosingAccess:
        '{number} Gruppe(n) haben die Gruppenaktivität gestartet, aber noch keine Resultate abgesendet. Sie verlieren den Zugriff auf die Gruppenaktivität.',
      noSubmissionsToActivity:
        'Es gibt noch keine Abgaben für diese Gruppenaktivität.',
      unaffectedSubmissions:
        '{number} Gruppen haben ihre Resultate erfolgreich abgesendet und sind nicht vom Beenden der Gruppenaktivität betroffen.',
      startGroupActivityNow: 'Gruppenaktivität jetzt starten',
      startGroupActivityNowMessage:
        'Bitte bestätigen Sie, dass Sie die Gruppenaktivität jetzt starten möchten. Beachten Sie, dass eine Gruppenaktivität nach dem Starten nicht mehr bearbeitet werden kann.',
      noParticipantGroupsAvailable:
        'In diesem Kurs wurden bisher keine Teilnehmergruppen gebildet, welche eine Gruppenaktivität lösen könnten. Bitte warten Sie die Gruppenbildung ab oder verschieben Sie die entsprechende Deadline über die Kurseinstellungen in die Zukunft.',
      groupFormationNotCompleted:
        'Die Gruppenbildung wurde noch nicht abgeschlossen. Bitte warten Sie das eingestellte Enddatum ab oder wählen sie die sofortige Gruppenzuteilung.',
      numOfParticipantGroupsGettingAccess:
        '{number} Teilnehmergruppe(n) erhalten nach dem Start der Gruppenaktivität sofort Zugriff auf den entsprechenden Inhalt.',
      groupActivityAvailableUntil:
        'Das Enddatum der Gruppenaktivität wird durch das frühzeitige Starten nicht beeinflusst. Die Gruppenaktivität ended Planmässig am {date}. Sie können die Gruppenaktivität über die entsprechende Aktion frühzeitig beenden.',
      shareGroupActivity: 'Gruppenaktivität teilen',
      removeGroupActivity: 'Gruppenaktivität entfernen',
      deleteGroupActivity: 'Gruppenaktivität löschen',
      deleteGroupActivityMessage:
        'Bitte bestätigen Sie die Löschung aller mit dieser Gruppenaktivität verbundenen Resultate. Beachten Sie, dass alle Studierenden den Zugriff auf die Aktivität, deren Inhalte und alle Resultate verlieren.',
      noStartedInstancesToDelete:
        'Aktuell haben keine Gruppen offene Instanzen dieser Gruppenaktivität.',
      deleteStartedInstance:
        '{number} Gruppe(n), welche diese Gruppenaktivität gestartet haben, verlieren den Zugriff darauf.',
      noSubmissionsToDelete:
        'Es gibt keine Abgaben für diese Gruppenaktivität.',
      deleteSubmissions:
        '{number} Abgabe(n) von separaten Gruppen für diese Aktivität werden gelöscht.',
      unpublishGroupActivity: 'Veröffentlichung aufheben',
      extendGroupActivity: 'Gruppenaktivität verlängern',
      extendGroupActivityDescription:
        'Verwenden Sie dieses Dialogfeld, um das Enddatum der Gruppenaktivität zu ändern. Bitte beachten Sie, dass nur zukünftige Daten als Enddatum gewählt werden können.',
      gradeGroupActivity: 'Gruppenaktivität bewerten',
      courseElements: 'Kurs-Elemente',
      ltiLinks: 'LTI Links',
      enableGamification: 'Gamifizierung aktivieren',
      enableGamificationWarning:
        'Möchten Sie Gamifizierung für diesen Kurs aktivieren? Dies erlaubt Ihnen, dem Kurs gamifizierte Elemente zuzuweisen, Leaderboards einzusehen, etc. Bitte beachten Sie, dass die Gamifizierung nicht mehr deaktiviert werden kann!',
      poolForRandomAssignment: 'Pool for Zufällige Zuweisung',
      randomGroupsNotPossible:
        'Es können keine zufälligen Gruppen gebildet werden, wenn sich nur ein Studierender im Zuweisungspool oder in einer Gruppe mit einem Teilnehmenden befindet. Bitte überprüfen Sie die Einstellungen für die Gruppenbildung im Kurs.',
      groupAssignmentFinalizedMessage:
        'Die Gruppenzuweisung wurde entweder manuell von Ihnen oder automatisch durch das System finalisiert, da die Gruppendeadline abgelaufen ist. Um die Erstellung von Gruppen wieder zu ermöglichen, verschieben Sie einfach die Deadline zur Gruppenbildung in den Kurseinstellungen in die Zukunft.',
      finalizeRandomGroupAssignment: 'Zufällige Gruppenzuweisung Finalisieren',
      confirmRandomGroupAssignment: `Sobald Sie die Finalisierung der zufälligen Gruppenzuweisung bestätigen, werden die folgenden Aktionen automatisch von KlickerUZH durchgeführt:
        <ul><li>Alle Studierenden, die sich noch im Pool der zufälligen Zuweisung befinden, werden in Gruppen eingeteilt.</li>
        <li>Gruppen mit nur einem Teilnehmer werden gelöscht und die entsprechenden Studierenden werden in Gruppen eingeteilt.</li>
        <li>Die Zuweisung zu zufälligen Gruppen kann nicht rückgängig gemacht werden!</li>
        <li>Die Möglichkeit für Studierende, Gruppen manuell über die Studierenden-App zu erstellen oder zu verlassen, wird automatisch deaktiviert. Wenn Sie diese Möglichkeit wieder aktivieren möchten, verschieben Sie einfach das Gruppendeadline-Datum in den Kurseinstellungen in die Zukunft.</li></ul>`,
      groupAssignmentFailed:
        'Beim Zuweisen der Gruppen ist ein Fehler aufgetreten. Bitte überprüfen Sie, ob genügend Studierende im Zuweisungspool sind und versuchen Sie es erneut.',
      groupAssignmentSuccessful:
        'Die Gruppenzuweisung war erfolgreich. Alle Studierenden aus dem Pool wurden in zufällige Gruppen eingeteilt.',
      practiceQuizPublishImmediately: 'Sofort Veröffentlichen',
      practiceQuizPublishingHint:
        'Wenn Sie diese Option wählen, wird das Übungs-Quiz "{title}" sofort für alle Studierenden in Ihrem Kurs sichtbar. Da Studierende Antworten auf alle veröffentlichten Übungs-Quizzes abgeben können, können diese nur gelöscht, aber nicht mehr unveröffentlicht werden.',
      confirmPublication: 'Veröffentlichung bestätigen',
      schedulePublication: 'Veröffentlichung planen',
      practiceQuizSchedulingHint:
        'Bei der geplanten Veröffentlichung des Übungs-Quizzes "{title}" wird dieses automatisch zum von Ihnen festgelegten Zeitpunkt für alle Studierenden im Kurs sichtbar. Bevor das geplante Veröffentlichungsdatum erreicht ist, kann die Aktivität noch unveröffentlicht und bearbeitet werden. Bei der Eingabe eines Startdatums in der Vergangenheit wird das Übungs-Quiz sofort veröffentlicht.',
      confirmScheduling: 'Geplante Veröffentlichung bestätigen',
    },
    pointCorrections: {
      stepIndicator: 'Schritt {current} von {total}',
      actionApply: 'Korrekturen anwenden',
      errorNoAdjustment:
        'Bitte wählen Sie mindestens eine Punkteanpassung aus.',
      scopeTitle: 'Anwendungsbereich auswählen',
      scopeDescription:
        'Bitte wählen Sie aus, ob die Korrektur für eine einzelne Frage des Quiz oder für alle Fragen des Quiz angewendet werden soll.',
      scopeLabel: 'Bereich',
      scopePlaceholder: 'Bereich auswählen',
      scopeOptionInstanceTitle: 'Einzelne Quizfrage',
      scopeOptionInstanceDescription:
        'Anpassung der Basis-, Korrektheits- oder Bonuspunkte für eine einzelne Frage des Quiz.',
      scopeOptionQuizTitle: 'Gesamtes Quiz',
      scopeOptionQuizDescription:
        'Anpassung der Basis-, Korrektheits- oder Bonuspunkte für alle Fragen des Quiz.',
      selectQuizAndInstanceDescription:
        'Bitte wählen Sie das Quiz und, falls zutreffend, die spezifische Frage aus, auf welche die Punktekorrektur angewendet werden soll.',
      quizLabel: 'Quiz',
      quizPlaceholder: 'Quiz auswählen',
      instanceLabel: 'Instanz',
      instancePlaceholder: 'Instanz auswählen',
      historyTitle: 'Bisherige Korrekturen',
      historyToggleShow: 'Alle bisherigen Korrekturen anzeigen',
      historyToggleHide: 'Bisherige Korrekturen ausblenden',
      historyPlaceholder:
        'Sobald Punktkorrekturen für das ausgewählte Quiz vorgenommen wurden, erscheinen diese hier.',
      historyPlaceholderInstance:
        'Sobald Punktkorrekturen speziell für die ausgewählte Quizfrage vorgenommen wurden, erscheinen diese hier. Für das gesamte Quiz vorgenommene Punktkorrekturen werden nicht angezeigt, wenn eine einzelne Frage für die Korrektur ausgewählt ist.',
      historyApplied: 'Angewendet am {appliedAt} durch {user}',
      historyScopeParticipantUnknown: 'Unbekannte Person',
      historyScopeParticipantsUnknown: 'Unbekannte Personen',
      historyScopeSingle: 'Einzelne Person ({participant})',
      historyScopeMultiple: 'Mehrere Personen ({participants})',
      historyScopeParticipatingQuiz:
        'Alle Studierenden mit mindestens einer Antwort in diesem Quiz',
      historyScopeParticipatingInstance:
        'Alle Studierenden mit einer abgegebenen Antwort für die folgende Frage: {name}',
      historyScopeCourse: 'Alle Teilnehmenden des Assessment-Kurses',
      historyScopeUnknown: 'Bereich nicht verfügbar',
      audienceTitle: 'Zielgruppe wählen',
      audienceDescription:
        'Bestimmen Sie, auf die Antworten welcher Nutzer die Punktkorrektur angewendet werden soll. Sie können eine einzelne Person, alle teilnehmenden Nutzer oder alle Nutzer im Assessment-Kurs auswählen. Teilnehmende Nutzer bei einer Frage sind jene, die eine Antwort für die entsprechende Frage im Quiz abgegeben haben, während teilnehmende Nutzer eines Quizzes mindestens für eine Frage im entsprechenden Quiz eine Antwort abgegeben haben müssen. Nutzer welche ausgewählt wurden, aber keine entsprechende Antwort besitzen erhalten dennoch die ausgewählten Punkte.',
      audienceLabel: 'Zielgruppe',
      audiencePlaceholder: 'Zielgruppe auswählen',
      audienceOptionSingle: 'Einzelne Person',
      audienceOptionMultiple: 'Mehrere Personen',
      audienceOptionParticipating: 'Alle teilnehmenden Nutzer',
      audienceOptionCourse: 'Alle Teilnehmer des Assessment-Kurses',
      participantLabel: 'Teilnehmende Person',
      participantsLabel: 'Teilnehmende Personen',
      participantPlaceholder: 'Teilnehmende Person auswählen',
      participantsPlaceholder: 'Teilnehmende Personen auswählen',
      participantScopeSingle: 'Ausgewählte Person',
      participantScopeMultiple: 'Ausgewählte Personen',
      participantScopeParticipating: 'Alle teilnehmenden Nutzer',
      participantScopeCourse: 'Alle Teilnehmer des Assessment-Kurses',
      adjustmentsTitle: 'Punkte anpassen',
      adjustmentsDescription:
        'Wählen Sie aus, welche Punktekategorien gutgeschrieben oder abgezogen werden sollen. Das Gutschreiben und Abziehen derselben Kategorie ist gegenseitig ausgeschlossen. Das Gutschreiben einer Punktekategorie bedeutet, dass alle betroffenen Studierenden die <b>maximal verfügbare Punktzahl</b> für diese Kategorie erhalten, während das Abziehen der Punkte <b>den Wert auf null setzt</b> für alle betroffenen Abgaben.',
      adjustmentsBaseLabel: 'Basispunkte',
      adjustmentsCorrectnessLabel: 'Korrektheitspunkte',
      adjustmentsBonusLabel: 'Bonuspunkte',
      adjustmentsAwardLabel: 'Punkte gutschreiben',
      adjustmentsDeductLabel: 'Punkte abziehen',
      reasonTitle: 'Korrektur begründen',
      reasonDescription:
        'Dokumentieren Sie, weshalb diese Korrektur notwendig ist. Halten Sie eine interne Notiz zur eigenen Referenz beziehungsweise für andere Administratoren des Assessment-Kurses fest und formulieren Sie die Nachricht, welche den Studierenden im Zusammenhang mit der Korrektur angezeigt wird.',
      reasonLecturerLabel: 'Interne Notiz zur Referenz',
      reasonLecturerPlaceholder:
        'Grund für die Punktekorrektur (nicht für Studierende sichtbar).',
      reasonUseSameMessageLabel:
        'Interne Notiz als Studierenden-Nachricht verwenden',
      reasonStudentLabel:
        'Nachricht für Studierende (sichtbar für Studierende)',
      reasonStudentPlaceholder:
        'Grund für die Punktekorrektur (sichtbar für Studierende).',
      summaryTitle: 'Prüfen und bestätigen',
      summaryDescription:
        'Bitte überprüfen Sie ihre gemachten Eingaben nochmals und bestätigen Sie die Anwendung der eingegebenen Punktkorrektur. Vorgenommene Korrekturen können nicht rückgängig gemacht werden. Im Fall eines Fehlers nehmen Sie bitte eine neue Korrektur vor.',
      summaryScopeLabel: 'Bereich',
      summaryQuizLabel: 'Quiz',
      summaryInstanceLabel: 'Instanz',
      summaryParticipantLabel: 'Zielgruppe',
      summaryAdjustmentsLabel: 'Punkteänderungen',
      summaryLecturerReasonLabel: 'Begründung für Dozierende',
      summaryStudentReasonLabel: 'Begründung für Studierende',
      summaryQuizNotSelected: 'Noch kein Quiz ausgewählt',
      summaryInstanceNotSelected: 'Noch keine Instanz ausgewählt',
      summaryAllInstances: 'Alle Instanzen des Quiz',
      summaryParticipantScopeNotSelected: 'Noch keine Zielgruppe ausgewählt',
      summaryParticipantNotSelected: 'Noch keine Person ausgewählt',
      summaryAdjustmentBaseAward: 'Basispunkte gutschreiben',
      summaryAdjustmentBaseDeduct: 'Basispunkte abziehen',
      summaryAdjustmentCorrectnessAward: 'Korrektheitspunkte gutschreiben',
      summaryAdjustmentCorrectnessDeduct: 'Korrektheitspunkte abziehen',
      summaryAdjustmentBonusAward: 'Bonuspunkte gutschreiben',
      summaryAdjustmentBonusDeduct: 'Bonuspunkte abziehen',
      summaryNoAdjustments:
        'Es wurden noch keine Punkteanpassungen ausgewählt.',
      errorQuizRequired: 'Bitte wählen Sie ein Quiz aus.',
      errorInstanceRequired:
        'Bitte wählen Sie eine Instanz aus, wenn Sie eine Punktekorrektur für eine einzelne Quizfrage vornehmen möchten.',
      errorParticipantRequired:
        'Bitte wählen Sie eine Person aus, wenn Sie eine Punktekorrektur für eine einzelne Person vornehmen möchten.',
      errorParticipantsRequired:
        'Bitte wählen Sie mindestens eine Person aus, wenn Sie eine Punktekorrektur für mehrere Personen vornehmen möchten.',
      errorLecturerReasonRequired:
        'Bitte geben Sie eine Notiz für diese Korrektur aus, welche Ihnen eine Zuordnung zu einem späteren Zeitpunkt erlaubt.',
      errorStudentReasonRequired:
        'Bitte geben Sie eine Mitteilung für die Studierenden ein, welche ihnen im Zusammenhang mit der Korrektur angezeigt wird.',
      missingInputsSubmission:
        'Ihre Eingaben für die Punktkorrektur sind unvollständig. Bitte überprüfen Sie Ihre Angaben und versuchen Sie es erneut.',
      successSubmission: 'Die Punktkorrektur wurde erfolgreich angewendet.',
      errorSubmission:
        'Beim Anwenden der Punktkorrektur ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
      responseCorrectionsApplied:
        'Punktkorrekturen, welche auf diese Antwort angewendet wurden und deren Auswirkungen auf die vergebenen Punkte:',
      noAdjustmentsApplied:
        'Es wurden keine Punktkorrekturen auf diese Antwort angewendet.',
    },
    resources: {
      mediaLibrary: 'Mediathek',
      mediaLibraryAvailableSoon:
        'Bald wird hier Ihre Mediathek verfügbar sein und Ihnen ermöglichen, hochgeladene Ressourcen einzusehen.',
      chatbots: 'Chatbots',
      resources: 'Ressourcen',
      switchChatbot: 'Chatbot wechseln',
      chatbotNotFound:
        'Dieser Chatbot wurde nicht gefunden oder Ihnen fehlt der Zugriff.',
      availableChatbots: 'Verfügbare Chatbots',
      noChatbots: 'Es wurden noch keine Chatbots erstellt.',
      chatbotDetails: 'Chatbot-Details',
      overview: 'Überblick',
      chatbotId: 'Chatbot-ID',
      avatarUrl: 'Avatar-URL',
      avatarNone: 'Kein Avatar',
      linkedCourses: 'Verknüpfte Kurse',
      linkedCoursesList: 'Verknüpft mit: {courses}',
      noLinkedCourses: 'Noch keine Kurse verknüpft.',
      chatbotStatusDraft: 'Entwurf',
      chatbotStatusPendingApproval: 'Ausstehende Freigabe',
      chatbotStatusPublished: 'Veröffentlicht',
      chatbotStatusPaused: 'Pausiert',
      chatbotStatusRejected: 'Abgelehnt',
      chatbotStatusUnknown: 'Unbekannter Status',
      chatbotNotLive:
        'Der Teilnehmenden-Zugriff ist in diesem Status nicht verfügbar.',
      credits: 'Credits',
      creditInitialCredits: 'Start-Credits',
      creditResetPeriod: 'Zurücksetzungsintervall',
      creditResetAmount: 'Zurücksetzungsmenge',
      creditMaxCredits: 'Maximale Credits',
      modelSelection: 'Modellauswahl',
      modelSelectionEnabled: 'Aktiviert',
      modelSelectionDisabled: 'Deaktiviert',
      modelSelectionEnabledDescription:
        'Teilnehmende können zwischen den erlaubten Modellen wählen.',
      modelSelectionDisabledDescription:
        'Die Modellauswahl erfolgt automatisch basierend auf der Credit-Verfügbarkeit.',
      allowedModels: 'Erlaubte Modelle',
      allowedModelsAll: 'Alle',
      chatbotModelSettings: 'Modell- und Reasoning-Einstellungen',
      reasoningEffortsByModel: 'Reasoning-Level pro Modell',
      singleReasoningEffortFixed: 'Vom Modell vorgegeben: {effort}',
      chatbotModelSettingsSave: 'Modelleinstellungen speichern',
      chatbotModelSettingsSaving: 'Speichern...',
      chatbotModelSettingsSaveSuccess: 'Modelleinstellungen gespeichert.',
      chatbotModelSettingsSaveError:
        'Die Chatbot-Modelleinstellungen konnten nicht gespeichert werden. Bitte erneut versuchen.',
      creditResetPeriodDaily: 'Täglich',
      creditResetPeriodWeekly: 'Wöchentlich',
      creditResetPeriodBiweekly: 'Alle zwei Wochen',
      creditResetPeriodMonthly: 'Monatlich',
      creditResetPeriodNone: 'Keine Zurücksetzung',
      usageSummary: 'Nutzungsübersicht',
      usageThreads: 'Threads',
      usageMessages: 'Nachrichten',
      usageParticipants: 'Teilnehmende',
      usageLastActivity: 'Letzte Aktivität',
      usageTotalCredits: 'Gesamt-Credits',
      usageCurrentCredits: 'Aktuelle Credits',
      usageTotalResets: 'Anzahl Zurücksetzungen',
      usageLastReset: 'Letzte Zurücksetzung',
      disclaimer: 'Disclaimer',
      noDisclaimer: 'Kein Disclaimer zugewiesen.',
      disclaimerName: 'Name',
      disclaimerTitle: 'Titel',
      disclaimerAccepted: 'Akzeptiert',
      disclaimerDeclined: 'Abgelehnt',
      disclaimerPending: 'Ausstehend',
      mcpConfigurations: 'MCP-Konfigurationen',
      knowledgeBase: 'Wissensdatenbank',
      noEnabledKnowledgeBase:
        'Es ist keine Wissensdatenbank verknüpft. Dieser Chatbot kann Kursmaterial nicht durchsuchen.',
      noMcpConfigurations: 'Keine MCP-Konfigurationen.',
      mcpServerActive: 'Server aktiv',
      mcpServerInactive: 'Server inaktiv',
      mcpChatMode: 'Chat-Modus',
      mcpStatus: 'Status',
      mcpStatusEnabled: 'Aktiviert',
      mcpStatusDisabled: 'Deaktiviert',
      mcpPriority: 'Priorität',
      mcpAllowedTools: 'Erlaubte Tools',
      openChatbot: 'Chatbot öffnen',
      openOwnerPreview: 'Eigentümer-Vorschau öffnen',
      responseExamples: 'Antwortbeispiele',
      responseExamplesDescription:
        'Überprüfen Sie Antwortbeispiele, bevor Sie sie aktivieren.',
      responseExamplesLoading: 'Antwortbeispiele werden geladen ...',
      responseExamplesError:
        'Die Antwortbeispiele konnten nicht geladen werden. Bitte versuchen Sie es erneut.',
      responseExamplesEmpty:
        'Für diesen Chatbot sind keine Antwortbeispiele verfügbar.',
      responseExampleCandidate: 'Vorschlag',
      responseExampleApproved: 'Freigegeben',
      responseExampleRejected: 'Abgelehnt',
      responseExampleNeedsReview: 'Überprüfung erforderlich',
      responseExampleQuestion: 'Frage',
      responseExampleReferenceAnswer: 'Erwartete Chatbot-Antwort',
      responseExampleResponseStyle: 'Antwortstil',
      responseExampleSources: 'Quellennachweise',
      responseExampleSourcesDescription:
        'Diese Verweise zeigen, worauf sich die Zitate beziehen. Der Quelleninhalt wird hier nicht angezeigt.',
      responseExampleCitationParityComplete:
        'Alle hinterlegten Nachweise sind in dieser Antwort zitiert.',
      responseExampleCitationParityIncomplete:
        'Nachweise und Zitate müssen vor der Freigabe geprüft werden.',
      responseExampleNoSources: 'Es sind keine Quellennachweise hinterlegt.',
      responseExampleSourceId: 'Quellen-ID',
      responseExampleChunkId: 'Chunk-ID',
      responseExampleCitationIndex: 'Zitat',
      responseExampleCitationAnchor: 'Zitationsanker',
      responseExampleContentHash: 'Inhaltshash',
      responseExampleSourceDetails: 'Technische Quelldetails',
      responseExampleCitationLabel: 'Zitat {index}',
      responseExampleSourceAvailable: 'Nachweis ist zugelassen',
      responseExampleSourceUnavailable: 'Nachweis muss geprüft werden',
      responseExampleStyleGuidedQuestions: 'Leitende Fragen stellen',
      responseExampleStyleStepByStepExplanation: 'Schritt für Schritt erklären',
      responseExampleStyleConciseAnswer: 'Kurz antworten',
      responseExampleStyleClarifyingQuestion: 'Rückfrage stellen',
      responseExampleStyleWorkedExample: 'An einem Beispiel erklären',
      responseExampleStyleCompareOptions: 'Optionen vergleichen',
      responseExampleSourcesRequired:
        'Vor der Freigabe muss eine Quelle hinterlegt und als [1], [2], ... zitiert sein.',
      responseExampleModeUnavailable:
        'Wählen Sie einen verfügbaren Chat-Modus dieses Chatbots.',
      responseExampleDuplicate:
        'Ein Antwortbeispiel mit dieser Frage existiert für diesen Chat-Modus bereits.',
      responseExampleApprove: 'Freigeben',
      responseExampleEditAndApprove: 'Bearbeiten und freigeben',
      responseExampleReject: 'Ablehnen',
      responseExampleEditTitle: 'Antwortbeispiel bearbeiten',
      responseExampleEditChatMode: 'Chat-Modus',
      responseExampleEditQuestion: 'Frage',
      responseExampleEditReferenceAnswer: 'Erwartete Chatbot-Antwort',
      responseExampleEditReferenceAnswerPlaceholder:
        'Schreiben Sie die erwartete Chatbot-Antwort aus. Formatierung wird automatisch angewendet; Quellen als [1], [2], ... zitieren.',
      responseExampleEditReferenceAnswerLength: '{count} / {max} Zeichen',
      responseExampleEditResponseStyle: 'Antwortstil',
      responseExampleSave: 'Speichern und freigeben',
      responseExampleReviewActionError:
        'Dieses Antwortbeispiel konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.',
      responseExampleStaleUpdate:
        'Dieses Beispiel wurde während Ihrer Bearbeitung geändert. Ihr Entwurf ist weiterhin geöffnet. Schliessen Sie den Dialog und öffnen Sie das Beispiel erneut, bevor Sie wieder speichern.',
      responseExampleReviewForbidden:
        'Nur die Eigentümerin oder der Eigentümer des Chatbots kann Antwortbeispiele überprüfen.',
      answerCollections: 'Antwort-Sammlungen',
      answerCollectionsDescription:
        'Hier finden Sie alle Ihre Antwort-Sammlungen. Sie benötigen diese zur Erstellung bestimmter komplexer Fragetypen, wie beispielsweise Auswahl-Fragen und Fallstudien. Um bestehende Antwort-Sammlungen anderer Nutzer zu importieren oder Zugriff auf diese zu beantragen, besuchen Sie bitte den <link>Katalog</link>.',
      selectCreateAnswerCollection:
        'Bitte wählen Sie eine Aktion auf einer bestimmten Antwort-Sammlung aus oder erstellen Sie eine neue.',
      newAnswerCollection: 'Neue Antwort-Sammlung',
      addSharedAnswerCollection: 'Geteilte Antwort-Sammlung hinzufügen',
      answerOptionUsed:
        'Antwort-Optionen, welche mit dem Warnsymbold gekennzeichnet sind, werden bereits durch Sie oder andere Nutzer (im Fall einer geteilten Sammlung) in einer Frage oder einer Aktivitätsvorlage als korrekte Lösung oder Fallstudien-Element verwendet. Bitte beachten Sie dies beim Bearbeiten der Antwort. Die Option kann nicht gelöscht werden.',
      name: 'Name',
      nameTooltip:
        'Wählen Sie einen Namen für Ihre Antwort-Sammlung, damit diese bei der Elementerstellung oder als geteilte Sammlung identifiziert werden kann. Der Name wird den Studierenden nicht angezeigt.',
      access: 'Zugriff',
      accessTooltip:
        "Wählen Sie aus, ob dieses Objekt durch alle Nutzer mit Zugriff auf die ausgewählte Katalog-Sammlung importiert / genutzt werden kann. Bei einem 'eingeschränkten' Zugriff müssen andere Nutzer diesen explizit beantragen.",
      catalogCollection: 'Katalog-Sammlung',
      descriptionTooltip:
        'Beschreiben Sie den Inhalt und Zweck der Antwort-Sammlung. Bei geteilten Antwortsammlungen wird diese Beschreibung den anderen Nutzern bereits vor dem Import oder gewährten Zugriff angezeigt.',
      descriptionPlaceholder:
        'Beschreiben Sie den Inhalt und Zweck der Antwort-Sammlung...',
      answerEntry: 'Antwort-Eintrag {index}',
      addValue: 'Wert hinzufügen',
      nameRequired: 'Bitte geben Sie einen Namen für die Antwort-Sammlung an.',
      descriptionRequired:
        'Bitte geben Sie eine Beschreibung für die Antwort-Sammlung an.',
      valueRequired: 'Bitte geben Sie einen Wert für den Eintrag an.',
      minTwoEntriesRequired:
        'Bitte fügen Sie mindestens zwei Einträge zu Ihrer Sammlung hinzu.',
      uniqueValuesRequired:
        'Alle Optionen in einer Antwort-Sammlung müssen einen einzigartigen Wert haben. Bitte stellen Sie sicher, dass keine zwei Antwortoptionen übereinstimmen.',
      collectionCreationSuccess:
        'Die Antwort-Sammlung wurde erfolgreich erstellt.',
      collectionCreationError:
        'Beim Erstellen der Antwort-Sammlung ist ein Fehler aufgetreten. Bitte stellen Sie sicher, dass der Name der Sammlung einzigartig ist und versuchen Sie es erneut.',
      availableAnswerCollections: 'Verfügbare Antwort-Sammlungen',
      noAnswerCollections:
        'Es wurden noch keine Antwort-Sammlungen erstellt oder aus dem Katalog importiert.',
      createAnswerCollection: 'Antwort-Sammlung erstellen',
      numOfAnswers: '{number} Antworten',
      byOwner: 'von {owner}',
      cancelRequest: 'Anfrage zurückziehen',
      answerCollection: 'Antwort-Sammlung: {name}',
      nameAndDescription: 'Name und Beschreibung',
      saveBeforeClosing:
        'Bitte speichern Sie Ihre Änderungen, bevor Sie die Sektion schliessen.',
      searchAnswerOptions: 'Antwort-Option suchen...',
      noMatchingOptions: 'Keine passenden Optionen gefunden.',
      saveChanges: 'Änderungen speichern',
      saveMetadata: 'Metadaten speichern',
      successfulCollectionEdit:
        'Die Änderungen an der Antwort-Sammlung wurden erfolgreich gespeichert.',
      changesImmediateEffect:
        'Änderungen (und Löschungen) an Antwort-Optionen werden sofort gespeichert und in entsprechende Fragen übernommen. Fragen in bestehenden Aktivitäten müssen über den Element-Editor aktualisiert werden, um allfällige Änderungen zu übernehmen.',
      answerOptions: 'Antwort-Optionen',
      addAnswerOption: 'Antwort-Option hinzufügen',
      showAnswers: 'Antworten anzeigen',
      viewCollection: 'Sammlung ansehen',
      editCollection: 'Sammlung bearbeiten',
      shareCollection: 'Sammlung teilen',
      duplicateCollection: 'Sammlung duplizieren',
      viewUseCollectionContent: 'Inhalt einsehen / Sammlung verwenden',
      modifyContent: 'Inhalt bearbeiten',
      modifyCatalogAssignments: 'Katalog-Zuweisungen bearbeiten',
      modifyPermissions: 'Berechtigungen bearbeiten',
      revokeAccess: 'Zugriff entziehen',
      requestedAccess: 'Zugriff beantragt',
      deleteCollection: 'Sammlung löschen',
      deletionDisabledInUse:
        'Diese Sammlung wird durch mindestens eine Ihrer Fragen oder Vorlagen genutzt. Sie können die Sammlung daher nicht löschen. Um die Sammlung zu löschen, entfernen Sie sie bitte zuerst aus allen Fragen, die sie verwenden.',
      removeCollection: 'Sammlung entfernen',
      removalDisabledInUse:
        'Diese Sammlung wird durch mindestens eine Ihrer Fragen oder Vorlagen genutzt oder wurde mit Ihnen über eine Nutzergruppe geteilt. Sie können die Sammlung daher nicht entfernen.',
      deleteAnswerCollection: 'Antwort-Sammlung löschen',
      confirmCollectionDeletion:
        'Sind Sie sicher, dass Sie die Antwort-Sammlung "{name}" aus Ihrem Profil löschen möchten? Bei geteilten Antwort-Sammlungen bleibt der Zugriff für andere Nutzer bestehen, solange diese die Sammlung verwenden. Nutzer welche die Antwort-Sammlung nicht nutzen, verlieren den Zugriff.',
      confirmDeletion: 'Löschung bestätigen',
      deletionSuccessful: 'Die Antwort-Sammlung wurde erfolgreich gelöscht.',
      deletionFailed:
        'Beim Löschen der Antwort-Sammlung ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.',
      cancelSharingRequest: 'Zugriffs-Anfrage zurückziehen',
      transferOwnershipTitle: 'Eigentumsübertragung der Sammlung',
      duplicationNote:
        'Die Sammlung wird in ihrem aktuellen Zustand dupliziert und kann im Anschluss verändert werden. Bitte beachten Sie, dass ...',
      duplicationNote1:
        '... die neue Sammlung mit keiner der bisher abhängigen Fragen / Vorlagen verlinkt ist.',
      duplicationNote2:
        '... die neue Sammlung mit keinen anderen Nutzern geteilt ist.',
      duplicationNote3:
        '... die neue Sammlung umbenannt werden sollte, um eine Verwechslung mit dem Original bei der Integration in Fragen zu vermeiden.',
      duplicationFailure:
        'Duplizierung der Sammlung fehlgeschlagen. Bitte versuchen Sie es erneut.',
      duplicationSuccess: 'Sammlung wurde erfolgreich dupliziert.',
    },
    userGroups: {
      description:
        'Auf dieser Seite können Sie Nutzergruppen erstellen und verwalten. Um den Prozess des Teilens mehrerer Objekte mit denselben Nutzern oder der gemeinsamen Erstellung von Inhalten zu vereinfachen, können die Nutzer zuerst in Gruppen zusammengefasst werden. Berechtigungen, welche an Gruppen vergeben werden, verhalten sich genauso wie wenn sie allen Nutzern einzeln gewährt werden. Beachten Sie jedoch immer, dass je nach den gewährten Berechtigungsstufen die Gruppenmitglieder möglicherweise Objekte wiederverwenden können, was ihren Zugriff auf ein Objekt potenziell unwiderruflich macht. Für weitere Details konsultieren Sie bitte auch die offizielle Dokumentation.',
      existingUserGroups: 'Bestehende Nutzergruppen',
      noGroups:
        'Sie haben noch keine Nutzergruppen erstellt oder wurden noch keiner Gruppe hinzugefügt. Um Ihre erste Nutzergruppe zu erstellen, klicken Sie bitte auf die Schaltfläche auf der rechten Seite.',
      userGroupCreation: 'Erstellung Nutzergruppe',
      creationExplanation:
        'Bitte füllen Sie alle Felder des folgenden Formulars aus, um eine Nutzergruppe zu erstellen. Die Auswahl der Gruppen-Admins kann nach der Erstellung noch geändert werden. Admin-Nutzer können Mitglieder zur Gruppe hinzufügen oder entfernen und den Namen der Gruppe ändern.',
      newUserGroup: 'Neue Nutzergruppe',
      nameTooltip:
        'Bitte geben Sie einen Namen für die Nutzergruppe an. Dieser Name wird benötigt, um die Gruppe zu identifizieren.',
      nameRequired: 'Die Eingabe eines Namens für die Gruppe ist erforderlich.',
      member: 'Mitglied',
      members: 'Mitglieder',
      admin: 'Admin',
      admins: 'Admins',
      addMember: 'Mitglied hinzufügen',
      emailOrShortname: 'Email oder Kurzname',
      emailShortnameRequired:
        'Bitte stellen Sie sicher, dass eine E-Mail-Adresse oder ein Kurzname für jeden Nutzer angegeben ist.',
      minOneMemberRequired:
        'Für die Bildung einer Gruppe ist mindestens ein Mitglied erforderlich.',
      uniqueUsersRequired:
        'Bitte stellen Sie sicher, dass alle Nutzer eindeutig sind. Unterschiedliche Einträge für den gleichen Nutzer werden bei der Erstellung kombiniert.',
      creationSuccessMessage: 'Die Nutzergruppe wurde erfolgreich erstellt.',
      creationErrorMessage:
        'Bei der Erstellung der Nutzergruppe ist ein Fehler aufgetreten. Bitte stellen Sie sicher, dass gültige Angeben für mindestens einen Nutzer (nicht Sie selbst) eingegeben wurden und dass keine andere Nutzergruppe mit demselben Namen bereits existiert.',
      viewGroup: 'Nutzergruppe ansehen',
      editGroup: 'Nutzergruppe bearbeiten',
      leaveGroup: 'Nutzergruppe verlassen',
      deleteGroup: 'Nutzergruppe löschen',
      confirmLeaveGroup:
        'Sie sind dabei, die Nutzergruppe {groupName} zu verlassen. Durch das Verlassen dieser Gruppe verlieren Sie den Zugriff auf alle Objekte, die mit dieser Gruppe geteilt wurden. Wenn Sie sicher sind, bestätigen Sie bitte diese Aktion.',
      leaveGroupSuccess:
        'Sie haben die Nutzergruppe wurde erfolgreich verlassen.',
      leaveGroupError:
        'Beim Verlassen der Nutzergruppe ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.',
      deleteGroupSuccess: 'Die Nutzergruppe wurde erfolgreich gelöscht.',
      deleteGroupError:
        'Beim Löschen der Nutzergruppe ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.',
      confirmDeleteGroup:
        'Bitte überprüfen Sie die Auswirkungen der Löschung dieser Nutzergruppe "{groupName}" sorgfältig und bestätigen Sie diese, bevor Sie die Löschung abschließen.',
      resolveGroupConfirmation:
        'Durch die Auflösung dieser Gruppe werden alle Mitglieder und Admins entfernt.',
      revokeDirectPermissionsConfirmation:
        'Alle direkt der Gruppe erteilten Berechtigungen werden widerrufen, alle Gruppenmitglieder verlieren den Zugriff auf die entsprechenden Objekte.',
      irreversibleActionConfirmation:
        'Diese Aktion ist irreversibel und kann nicht rückgängig gemacht werden.',
      availableActions: 'Verfügbare Aktionen',
      promoteUserToAdmin: 'Beförderung Mitglied zu Admin',
      demoteAdminToMember: 'Herabstufung Admin zu Mitglied',
      removeUserFromGroup: 'Entfernung Nutzer aus Gruppe',
      transferOwnership: 'Übertragung Eigentümer',
      noAdmins: 'Dieser Gruppe wurden bisher keine Admins zugewiesen.',
      noMembers:
        'Dieser Gruppe wurden bisher keine Mitglieder (ohne Admin-Rechte) zugewiesen.',
      addAdminPlaceholder: 'Kurznamen oder E-Mail für neuen Admin eingeben...',
      addMemberPlaceholder:
        'Kurznamen oder E-Mail für neues Mitglied eingeben...',
      addUser: 'Nutzer hinzufügen',
      addUserGroupSuccess: 'Nutzer erfolgreich zur Gruppe hinzugefügt.',
      addUserGroupError:
        'Beim Hinzufügen des Nutzers zur Gruppe ist ein Fehler aufgetreten. Bitte verwenden Sie die Beförderungs- / Herabstufungsfunktionen, wenn der Nutzer bereits Mitglied der Gruppe ist.',
    },
    catalog: {
      accessTypes: 'Zugriffs-Typen',
      accessPUBLIC: 'Öffentlich',
      accessRESTRICTED: 'Eingeschränkt',
      infoAccessPUBLIC:
        'Öffentliche Objekte können von allen Nutzern mit Zugriff auf die entsprechende Katalog-Sammlung eingesehen und kopiert werden. Antwort-Sammlungen können zusätzlich direkt durch die entsprechenden Nutzer in Fragen verwendet werden (mit Leserechten).',
      infoAccessRESTRICTED:
        'Eingeschränkte Objekte können von anderen Nutzern im Katalog angefragt und nach Ihrer Zustimmung abhängig von den vergebenen Rechten genutzt werden.',
      objectType: 'Objekt-Typ',
      all: 'Alle',
      sharingRequests: 'Zugriffs-Anfragen',
      unresolved: 'Unbearbeitet',
      noObjectsFoundInCatalog:
        'Für die eingegebenen Suchkriterien und Filter konnten keine öffentlichen oder eingeschränkt verfügbaren Objekte gefunden werden.',
      requestAccess: 'Zugriff beantragen',
      useTemplate: 'Vorlage verwenden',
      copyObjectToAccount: 'Objekt in eigenen Account kopieren',
      copyObjectType: '{object} in eigenen Account kopieren',
      importObjectType: '{object} importieren (Leseberechtigungen)',
      accessRequested: 'Zugriff beantragt',
      accessGranted: 'Zugriff gewährt',
      copyPublicResource: 'Öffentliche Ressource kopieren',
      importPublicResource: 'Öffentliche Ressource importieren',
      requestPublicResource:
        'Durch das Beantragen des Zugriffs auf eine öffentliche Ressource können Sie das ursprüngliche geteilte Objekt einsehen und/oder bearbeiten, abhängig von den gewährten Berechtigungen. Gewährte Berechtigungen können vom Besitzer entzogen werden. Um eine unabhängige Kopie des Objekts in Ihr eigenes Konto zu importieren, verwenden Sie bitte die Option "Importieren".',
      sharingRequestsExplanation:
        'Bitte überprüfen Sie die folgenden Zugriffsanfragen für Ihre geteilten Objekte. Durch das Akzeptieren einer Zugriffsanfrage wird dem anfragenden Nutzer Zugriff auf das entsprechende Objekt gewährt, ohne eine Kopie zu erstellen. Alle Änderungen, die andere Nutzer mit Schreibzugriff auf Ihre Objekte vornehmen, sind direkt für alle Nutzer des Objekts sichtbar.',
      approveSharingRequest: 'Zugriffsanfrage bestätigen',
      specifyObjectPermissionLevel:
        'Bitte wählen Sie eine Zugriffsebene für das Teilen des Objekts "{objectName}" (Typ: {objectType}) mit dem Nutzer {userShortname} aus. Bitte beachten Sie, dass bei der Gewährung von Bearbeitungsrechten Änderungen anderer Nutzer direkt auf das geteilte Objekt wirken. Weitere Informationen zu den Berechtigungsstufen finden Sie in der Tabelle unten.',
      approvalSuccessful: 'Die Zugriffsanfrage wurde erfolgreich bestätigt.',
      approvalFailed:
        'Beim Bestätigen der Zugriffsanfrage ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.',
      declineSuccessful: 'Die Zugriffsanfrage wurde erfolgreich abgelehnt.',
      declineFailed:
        'Beim Ablehnen der Zugriffsanfrage ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.',
      addObjectToCatalog: 'Objekt hinzufügen',
      addObjectToCatalogTitle: 'Objekt zur Katalogsammlung hinzufügen',
      selectObjectType: 'Objekttyp auswählen',
      selectSpecificObject: 'Objekt auswählen',
      selectObjectTypeInstructions: 'Wählen Sie den Objekttyp aus',
      selectObjectTypeDescription:
        'Bitte wählen Sie über die folgenden Auswahlmöglichkeiten zuerst den Objekttyp und die Sichtbarkeit und im Anschluss das konkrete Objekt, welches Sie zu dieser Katalogsammlung hinzufügen möchten.',
      objectTypeTooltip:
        'Der Typ des Objekts, das zur Katalogsammlung hinzugefügt wird',
      objectTypeRequired: 'Bitte wählen Sie einen Objekttyp aus',
      accessRequired: 'Bitte wählen Sie eine Zugriffsebene aus',
      objectRequired: 'Bitte wählen Sie ein Objekt aus',
      selectSpecificObjectInstructions: 'Wählen Sie ein bestimmtes Objekt aus',
      selectSpecificObjectDescription:
        'Wählen Sie ein(e) {type} aus der Liste unten, um das Objekt zu dieser Katalogsammlung hinzuzufügen.',
      selectObject: 'Objekt auswählen',
      searchObjects: 'Objekte durchsuchen...',
      noObjectsFound: 'Keine Objekte gefunden',
      noObjectsAvailable:
        'Für den ausgewählten Typ sind keine Objekte verfügbar',
      objectAddedSuccess:
        'Objekt wurde erfolgreich zur Katalogsammlung hinzugefügt',
      objectAddedError:
        'Fehler beim Hinzufügen des Objekts zur Katalogsammlung',
      objectRemovalSuccess:
        'Objekt wurde erfolgreich aus der Katalogsammlung entfernt',
      objectRemovalFailed:
        'Beim Entfernen des Objekts aus der Katalogsammlung ist ein Fehler aufgetreten, bitte versuchen Sie es erneut',
      selectObjectTypeFirst: 'Bitte wählen Sie zuerst einen Objekttyp aus',
      changeAccessTitle: 'Zugriffsrechte ändern',
      changeAccessDescription:
        'Sind Sie sicher, dass Sie die Zugriffsrechte für {objectType} "{objectName}" auf {newAccess} ändern möchten?',
      changeAccessConfirm: 'Zugriff ändern',
      removeCATALOG_COLLECTION: 'Katalog-Sammlung entfernen',
      removeCATALOG_COLLECTIONtitle: 'Katalog-Sammlung entfernen',
      removeANSWER_COLLECTION: 'Antwort-Sammlung entfernen',
      removeANSWER_COLLECTIONtitle: 'Antwort-Sammlung aus Katalog entfernen',
      removeELEMENT: 'Element entfernen',
      removeELEMENTtitle: 'Element aus Katalog entfernen',
      removeLIVE_QUIZ_TEMPLATE: 'Live-Quiz Vorlage entfernen',
      removeLIVE_QUIZ_TEMPLATEtitle: 'Live-Quiz Vorlage aus Katalog entfernen',
      removePRACTICE_QUIZ_TEMPLATE: '',
      removePRACTICE_QUIZ_TEMPLATEtitle: '',
      removeMICRO_LEARNING_TEMPLATE: '',
      removeMICRO_LEARNING_TEMPLATEtitle: '',
      removeGROUP_ACTIVITY_TEMPLATE: '',
      removeGROUP_ACTIVITY_TEMPLATEtitle: '',
      removeLIVE_QUIZ: 'Live-Quiz entfernen',
      removeLIVE_QUIZtitle: '',
      removePRACTICE_QUIZ: 'Übungs-Quiz entfernen',
      removePRACTICE_QUIZtitle: '',
      removeMICRO_LEARNING: 'Microlearning entfernen',
      removeMICRO_LEARNINGtitle: '',
      removeGROUP_ACTIVITY: 'Gruppenaktivität entfernen',
      removeGROUP_ACTIVITYtitle: '',
      removeCOURSE: 'Kurs entfernen',
      removeCOURSEtitle: '',
      removeObjectDescription:
        'Sind Sie sicher, dass Sie {objectType} "{objectName}" aus der Katalogsammlung entfernen möchten? Nutzer verlieren dadurch die Möglichkeit, das Objekt aus dem Katalog zu importieren bzw. Zugriff darauf zu beantragen.',
      createCatalogCollection: 'Sammlung erstellen',
      createCatalogCollectionTitle: 'Katalog-Sammlung erstellen',
      createCatalogCollectionDescription:
        'Katalog-Sammlungen dienen dazu, Inhalte zu organisieren und sie für bestimmte Benutzer oder Benutzergruppen sichtbar zu machen. Der Zugriff auf Objekte innerhalb der Katalog-Sammlung wird separat gehandhabt. Die Existenz der Katalog-Sammlung ist immer für alle sichtbar, aber nur öffentliche Katalog-Sammlungen können von jedem eingesehen werden, was ihnen ermöglicht, den Zugriff auf alles darin zu beantragen. Zugriffs- und Verwaltungsprivilegien für eingeschränkte Katalog-Sammlungen können nach der Erstellung in einem separaten Dialog definiert werden.',
      collectionName: 'Name der Sammlung',
      collectionNameTooltip:
        'Geben Sie einen eindeutigen Namen für Ihre Katalog-Sammlung ein.',
      collectionNamePlaceholder: 'Name der Katalog-Sammlung',
      catalogAccessTooltip:
        'Wählen Sie, ob die Sammlung für alle Benutzer sichtbar sein soll oder ob der Zugriff eingeschränkt werden soll.',
      accessDescriptionPUBLIC:
        'Öffentliche Sammlungen sind für alle Benutzer sichtbar und können durchsucht werden.',
      accessDescriptionRESTRICTED:
        'Eingeschränkte Sammlungen können nur von Benutzern mit Zugriff durchsucht werden. Alle Benutzer von KlickerUZH können Zugriff auf diese Sammlungen beantragen oder erhalten diesen direkt durch die Freigabefunktionalität bei der Erstellung.',
      nameRequired: 'Bitte geben Sie einen Namen ein.',
      collectionCreationSuccess: 'Katalog-Sammlung wurde erfolgreich erstellt.',
      collectionCreationError:
        'Bei der Erstellung der Katalog-Sammlung ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
      backToCatalogOverview: 'Zurück zur Katalog-Übersicht',
      deleteCatalogCollection: 'Katalogsammlung löschen',
      openCatalogCollection: 'Sammlung öffnen',
      browseCatalogCollection: 'Sammlung durchsuchen / Objekte anfragen',
      modifyContent: 'Inhalt bearbeiten',
      modifyPermissions: 'Berechtigungen bearbeiten',
      revokeAccess: 'Zugriff entziehen',
      deleteCollection: 'Sammlung löschen',
      deleteCatalogCollectionTitle: 'Katalogsammlung löschen',
      deleteCatalogCollectionDescription:
        'Sind Sie sicher, dass Sie die Katalogsammlung "{name}" löschen möchten? Dies entfernt alle Objekte aus der Katalogsammlung und verhindert, dass Benutzer über die Katalogsammlung auf diese Objekte zugreifen können.',
      deleteConfirm: 'Löschen',
      deletionSuccessful: 'Die Katalogsammlung wurde erfolgreich gelöscht.',
      deletionFailed:
        'Beim Löschen der Katalogsammlung ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder wenden Sie sich an den Support.',
      requestCatalogObjectAccess: 'Zugriff auf {object} anfordern',
      requestCatalogObjectAccessDescription:
        'Hier können Sie Zugriff auf "<b>{name}</b>" (von {owner}) anfordern. Der Besitzer wird als Teil der Anfrage Ihren <b>Kurznamen</b> und Ihre <b>E-Mail-Adresse</b> sehen.',
      requestSuccessInfoCATALOG_COLLECTION:
        'Sobald der Besitzer Ihre Anfrage akzeptiert, haben Sie Zugriff auf die Katalogsammlung und können Objekte darin anfordern/importieren/kopieren.',
      requestSuccessInfoANSWER_COLLECTION:
        'Sobald der Besitzer Ihre Anfrage akzeptiert, haben Sie Zugriff auf die Antwort-Sammlung und können diese in Ihren Auswahl-Fragen und Fallstudien verwenden.',
      requestSuccessInfoLIVE_QUIZ: '',
      requestSuccessInfoPRACTICE_QUIZ: '',
      requestSuccessInfoMICRO_LEARNING: '',
      requestSuccessInfoGROUP_ACTIVITY: '',
      requestSuccessInfoCOURSE: '',
      requestSuccessInfoELEMENT:
        'Sobald der Besitzer Ihre Anfrage akzeptiert, können Sie das Element einsehen und möglicherweise in Ihren eigenen Aktivitäten wiederverwenden, abhängig von den gewährten Berechtigungen.',
      requestCatalogObjectSuccess:
        'Die Zugriffsanfrage wurde erfolgreich übermittelt.',
      requestCatalogObjectFailed:
        'Bei der Anforderung des Zugriffs ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder wenden Sie sich an den Support.',
      copyCatalogObjectDescription:
        'Hier können Sie eine Kopie von "<b>{name}</b>" (von {owner}) in Ihr eigenes Konto kopieren. Nach dem Kopieren können Sie das Objekt direkt verwenden oder bei Bedarf anpassen. Änderungen am ursprünglichen Objekt haben keinen Einfluss auf Ihre Kopie.',
      importCatalogObjectDescription:
        'Hier können Sie das Object "<b>{name}</b>" (von {owner}) mit Leseberechtigungen in Ihr eigenes Konto importieren. Änderungen am ursprünglichen Objekt werden automatisch auch für Sie sichtbar sein.',
      copyCatalogObjectSuccess:
        'Das Objekt wurde erfolgreich in Ihr Konto kopiert.',
      copyCatalogObjectFailed:
        'Beim kopieren des Objekts ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder wenden Sie sich an den Support.',
      importCatalogObjectSuccess:
        'Das Objekt wurde erfolgreich in Ihr Konto importiert.',
      importCatalogObjectFailed:
        'Beim importieren des Objekts ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder wenden Sie sich an den Support.',
      cancelCatalogObjectRequest: 'Zugriffsanfrage zurückziehen',
      cancelCatalogObjectRequestDescription: `Bitte bestätigen Sie, dass Sie die Zugriffsanfrage für "{name}" (von {owner}) zurückziehen möchten. Sie können später erneut Zugriff auf das Objekt beantragen.`,
      cancelRequest: 'Anfrage zurückziehen',
      requestCancellationSuccess:
        'Die Zugriffsanfrage wurde erfolgreich zurückgezogen.',
      requestCancellationFailed:
        'Beim Zurückziehen der Anfrage ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder wenden Sie sich an den Support.',
      collectionNameRequired:
        'Bitte geben Sie einen Namen für die Katalog-Sammlung an.',
      changeCatalogCollectionName: 'Namen der Katalog-Sammlung ändern',
      catalogCollectionNameChangeSuccess:
        'Der Name der Katalog-Sammlung wurde erfolgreich geändert.',
      catalogCollectionNameChangeError:
        'Beim Ändern des Namens der Katalog-Sammlung ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
      changeAccessError:
        'Beim Ändern der Object-Sichtbarkeit ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.',
    },
    sharing: {
      noAccess: 'Kein Zugriff',
      permissionsREAD: 'Leserechte',
      permissionsWRITE: 'Schreibrechte',
      permissionsADMIN: 'Adminrechte',
      permissionsEXECUTE: 'Ausführungsrechte',
      permissionsOWNER: 'Eigentümerrechte',
      labelOWNED: 'Eigentümer',
      labelSHARED: 'Geteilt',
      labelDEPENDENCY: 'Abhängigkeit',
      grantedPermissions: 'Bestehende Berechtigungen',
      transferOwnership: 'Eigentumsrechte übertragen',
      showDerivedPermissions: 'Abgeleitete Berechtigungen anzeigen',
      hideDerivedPermissions: 'Abgeleitete Berechtigungen ausblenden',
      minimumRequired: 'Minimale Berechtigungen',
      propagationOfPermissions: 'Propagierung von Berechtigungen',
      derivedPermissions: 'Abgeleitete Berechtigungen',
      derivedPermissionsDescription:
        'Bei abgeleiteten Berechtigungen handelt es sich um Berechtigungen, welche Nutzern den Zugriff auf dieses Element erlauben, ohne dass eine direkte Berechtigung besteht. Dies ist beispielsweise bei der Vererbung von Zugriffrechten der Fall, wenn andere Objekte auf diesem Objekt aufbauen und es daher benötigen. Abgeleitete Zugriffrechte können nicht verändert oder entzogen werden und entsprechen immer den minimalen technisch erforderlichen Berechtigungen. Für mehr Details, konsultieren Sie bitte die offizielle Dokumentation.',
      noDerivedPermissions:
        'Für dieses Objekt sind keine abgeleiteten Berechtigungen vorhanden.',
      whereDoesThisPermissionOriginate: 'Woher stammt diese Berechtigung?',
      derivedPermissionOrigin: 'Herkunft der abgeleiteten Berechtigung',
      derivedAccessFor:
        'Der abgeleitete Zugriff von Nutzer {user} auf diese Objekt stammt von folgendem Objekt ab:',
      originalObjectOwner: 'Besitzer des übergeordneten Objekts',
      originalObjectType: 'Typ des übergeordneten Objekts',
      originalObjectName: 'Name des übergeordneten Objekts',
      reasonDerivedAccess: 'Grund für den abgeleiteten Zugriff',
      ownerOfOriginalObject: 'Besitzer des übergeordneten Objekts',
      originalObjectSharedREAD: 'Leserechte auf übergeordnetes Objekt',
      originalObjectSharedEXECUTE:
        'Ausführungsrechte auf übergeordnetes Objekt',
      originalObjectSharedWRITE: 'Schreibrechte auf übergeordnetes Objekt',
      originalObjectSharedADMIN: 'Adminrechte auf übergeordnetes Objekt',
      viaUserGroup: 'über Nutzergruppe {name}',
      importantInformation: 'Wichtige Information',
      shortnameOrEmailRequired:
        'Bitte geben Sie einen Nutzernamen oder eine E-Mail Adresse ein.',
      confirmTransferOwnership: 'Eigentumsrechte übertragen',
      ownershipTransferSuccess:
        'Die Eigentumsrechte wurden erfolgreich übertragen.',
      ownershipTransferError:
        'Bei der Übertragung der Eigentumsrechte ist leider ein Fehler aufgetreten. Bitte stellen Sie sicher, dass E-Mail Adresse / Nutzername korrekt sind.',
      modifyOwnPermissionsTitle: 'Eigenen Zugriff ändern',
      ownAccess: '(Sie)',
      removeOwnPermissionsWarning:
        'Sie sind dabei, Ihren individuellen Zugriff auf diese Ressource zu entziehen. Nach der Bestätigung können Sie unter Umständen nicht mehr auf die Ressource zugreifen. Diese Aktion kann nicht rückgängig gemacht werden. Möchten Sie wirklich fortfahren?',
      changeOwnPermissionsWarning:
        'Sie sind dabei, Ihre eigenen Zugriffsrechte auf {permissionLevel} zu ändern. Dies kann Ihre Möglichkeit einschränken, bestimmte Aktionen mit dieser Ressource durchzuführen, einschließlich der erneuten Änderung Ihrer Zugriffsrechte. Möchten Sie wirklich fortfahren?',
      revokeAccessDisabledTooltip:
        'Der Zugriff kann nicht entzogen werden, da dieser Nutzer die Sammlung aktiv verwendet.',
      noUserGroupSelected: 'Keine Nutzergruppe ausgewählt',
      noUserGroupsAvailable: 'Keine Nutzergruppen verfügbar',
      shortnameEmailOrGroupRequired:
        'Bitte geben Sie einen Kurznamen / E-Mail Adresse ein oder wählen Sie eine Nutzergruppe.',
      noSelfSharing: 'Sie können keine Objekte mit sich selbst teilen.',
      infoTransferOwnershipCATALOG_COLLECTION:
        'Sie sind dabei, die Eigentumsrechte für die Katalog-Sammlung <b>{objectName}</b> an einen anderen Benutzer zu übertragen. Nach der Übertragung hat der neue Eigentümer die volle Kontrolle über diese Sammlung, während Sie automatisch einen Admin-Zugriff erhalten. Diese Aktion kann nicht rückgängig gemacht werden.',
      infoTransferOwnershipANSWER_COLLECTION:
        'Sie sind dabei, die Eigentumsrechte für die Antwort-Sammlung <b>{objectName}</b> an einen anderen Benutzer zu übertragen. Nach der Übertragung hat der neue Eigentümer die volle Kontrolle über diese Sammlung, während Sie automatisch einen Admin-Zugriff erhalten. Diese Aktion kann nicht rückgängig gemacht werden.',
      infoTransferOwnershipLIVE_QUIZ_TEMPLATE:
        'Sie sind dabei, die Eigentumsrechte für die Live-Quiz Vorlage <b>{objectName}</b> an einen anderen Benutzer zu übertragen. Nach der Übertragung hat der neue Eigentümer die volle Kontrolle über diese Vorlage, während Sie automatisch einen Admin-Zugriff erhalten. Diese Aktion kann nicht rückgängig gemacht werden.',
      infoTransferOwnershipPRACTICE_QUIZ_TEMPLATE: '',
      infoTransferOwnershipMICRO_LEARNING_TEMPLATE: '',
      infoTransferOwnershipGROUP_ACTIVITY_TEMPLATE: '',
      infoTransferOwnershipELEMENT:
        'Sie sind dabei, die Eigentumsrechte für das Element <b>{objectName}</b> an einen anderen Benutzer zu übertragen. Nach der Übertragung hat der neue Eigentümer die volle Kontrolle über dieses Element, während Sie automatisch einen Admin-Zugriff erhalten. Diese Aktion kann nicht rückgängig gemacht werden.',
      infoTransferOwnershipLIVE_QUIZ:
        'Sie sind dabei, die Eigentumsrechte für das Live-Quiz <b>{objectName}</b> an einen anderen Benutzer zu übertragen. Nach der Übertragung hat der neue Eigentümer die volle Kontrolle über dieses Quiz und erhält unwiderruflichen Admin-Zugriff auf alle enthaltenen Elemente (gemäss der technisch erfordlichen Berechtigungen), während Sie Admin-Zugriff auf das Live-Quiz behalten. Diese Aktion kann nicht rückgängig gemacht werden.',
      infoTransferOwnershipPRACTICE_QUIZ:
        'Sie sind dabei, die Eigentumsrechte für das Übungs-Quiz <b>{objectName}</b> an einen anderen Benutzer zu übertragen. Nach der Übertragung hat der neue Eigentümer die volle Kontrolle über dieses Quiz und erhält unwiderruflichen Admin-Zugriff auf alle enthaltenen Elemente (gemäss der technisch erfordlichen Berechtigungen), während Sie Admin-Zugriff auf das Übungs-Quiz behalten. Diese Aktion kann nicht rückgängig gemacht werden.',
      infoTransferOwnershipMICRO_LEARNING:
        'Sie sind dabei, die Eigentumsrechte für das Microlearning <b>{objectName}</b> an einen anderen Benutzer zu übertragen. Nach der Übertragung hat der neue Eigentümer die volle Kontrolle über dieses Micro-Learning und erhält unwiderruflichen Admin-Zugriff auf alle enthaltenen Elemente (gemäss der technisch erfordlichen Berechtigungen), während Sie Admin-Zugriff auf das Micro-Learning behalten. Diese Aktion kann nicht rückgängig gemacht werden.',
      infoTransferOwnershipGROUP_ACTIVITY:
        'Sie sind dabei, die Eigentumsrechte für die Gruppen-Aktivität <b>{objectName}</b> an einen anderen Benutzer zu übertragen. Nach der Übertragung hat der neue Eigentümer die volle Kontrolle über diese Gruppen-Aktivität, während Sie automatisch einen Admin-Zugriff erhalten. Diese Aktion kann nicht rückgängig gemacht werden.',
      infoTransferOwnershipCOURSE:
        'Sie sind dabei, die Eigentumsrechte für den Kurs <b>{objectName}</b> an einen anderen Benutzer zu übertragen. Nach der Übertragung hat der neue Eigentümer die volle Kontrolle über diesen Kurs und erhält unwiderruflichen Admin-Zugriff auf alle enthaltenen Aktivitäten und Elemente (gemäss der technisch erfordlichen Berechtigungen), während Sie automatisch einen Admin-Zugriff erhalten. Diese Aktion kann nicht rückgängig gemacht werden.',
      shareANSWER_COLLECTION: 'Antwort-Sammlung teilen',
      shareCATALOG_COLLECTION: 'Katalog-Sammlung teilen',
      shareLIVE_QUIZ: 'Live-Quiz teilen',
      sharePRACTICE_QUIZ: 'Übungs-Quiz teilen',
      shareMICRO_LEARNING: 'Microlearning teilen',
      shareGROUP_ACTIVITY: 'Gruppen-Aktivität teilen',
      shareCOURSE: 'Kurs teilen',
      shareELEMENT: 'Element teilen',
      infoSharingANSWER_COLLECTION:
        'Diese Ansicht erlaubt es Ihnen, die Antwort-Sammlung "<b>{objectName}</b>" mit anderen Nutzern oder Nutzergruppen zu teilen und vergebene Zugriffrechte zu verändern. Abhängig von den vergebenen Rechten können die entsprechenden Nutzer den Inhalt der Sammlung bearbeiten, weitere Nutzer hinzufügen oder andere Veränderungen vornehmen.',
      infoSharingCATALOG_COLLECTION:
        'Diese Ansicht erlaubt es Ihnen, die Katalog-Sammlung "<b>{objectName}</b>" mit anderen Nutzern oder Nutzergruppen zu teilen und vergebene Zugriffrechte zu verändern. Abhängig von den vergebenen Rechten können die entsprechenden Nutzer Objekte zur Sammlung hinzufügen, weitere Nutzer hinzufügen oder andere Veränderungen vornehmen.',
      infoSharingLIVE_QUIZ:
        'Diese Ansicht erlaubt es Ihnen, das Live-Quiz "<b>{objectName}</b>" mit anderen Nutzern oder Nutzergruppen zu teilen und vergebene Zugriffrechte zu verändern. Abhängig von den vergebenen Rechten können die entsprechenden Nutzer das Live-Quiz bearbeiten, weitere Nutzer hinzufügen oder andere Veränderungen vornehmen.',
      infoSharingPRACTICE_QUIZ:
        'Diese Ansicht erlaubt es Ihnen, das Übungs-Quiz "<b>{objectName}</b>" mit anderen Nutzern oder Nutzergruppen zu teilen und vergebene Zugriffrechte zu verändern. Abhängig von den vergebenen Rechten können die entsprechenden Nutzer das Übungs-Quiz bearbeiten, weitere Nutzer hinzufügen oder andere Veränderungen vornehmen.',
      infoSharingMICRO_LEARNING:
        'Diese Ansicht erlaubt es Ihnen, das Microlearning "<b>{objectName}</b>" mit anderen Nutzern oder Nutzergruppen zu teilen und vergebene Zugriffrechte zu verändern. Abhängig von den vergebenen Rechten können die entsprechenden Nutzer das Microlearning bearbeiten, weitere Nutzer hinzufügen oder andere Veränderungen vornehmen.',
      infoSharingGROUP_ACTIVITY:
        'Diese Ansicht erlaubt es Ihnen, die Gruppen-Aktivität "<b>{objectName}</b>" mit anderen Nutzern oder Nutzergruppen zu teilen und vergebene Zugriffrechte zu verändern. Abhängig von den vergebenen Rechten können die entsprechenden Nutzer die Gruppen-Aktivität bearbeiten, weitere Nutzer hinzufügen oder andere Veränderungen vornehmen.',
      infoSharingCOURSE:
        'Diese Ansicht erlaubt es Ihnen, den Kurs "<b>{objectName}</b>" mit anderen Nutzern oder Nutzergruppen zu teilen und vergebene Zugriffrechte zu verändern. Abhängig von den vergebenen Rechten können die entsprechenden Nutzer den Kurs bearbeiten, weitere Nutzer hinzufügen oder andere Veränderungen vornehmen.',
      infoSharingELEMENT:
        'Diese Ansicht erlaubt es Ihnen, das Element "<b>{objectName}</b>" mit anderen Nutzern oder Nutzergruppen zu teilen und vergebene Zugriffrechte zu verändern. Abhängig von den vergebenen Rechten können die entsprechenden Nutzer das Element bearbeiten, weitere Nutzer hinzufügen oder andere Veränderungen vornehmen.',
      propagatedPermissions: 'Abgeleitete Berechtigungen',
      propagatedPermissionsANSWER_COLLECTION: '',
      propagatedPermissionsCATALOG_COLLECTION: '',
      propagatedPermissionsELEMENT:
        'Wenn Ihr Element von einer Antwort-Sammlung abhängt, wird das Teilen des Elements automatisch auch zu Berechtigungen auf den entsprechenden Objekten führen. Für die gewährte Berechtigungsstufe für eine bestimmte Berechtigungsstufe auf dem Element siehe bitte die Tabelle unten.',
      propagatedPermissionsLIVE_QUIZ:
        'Abhängig von der gewährten Berechtigungsstufe werden die Berechtigungen auf die Elemente in diesem Live-Quiz übertragen und die entsprechenden Nutzer können Elemente und verlinkte Ressourcen mit anderen Nutzern auch ausserhalb der vorliegenden Aktivität wiederverwenden oder teilen. Für weitere Details zu den erlaubten Aktionen konsultieren Sie bitte die Berechtigungstabellen für die entsprechenden Objekte oder die offizielle Dokumentation.',
      propagatedPermissionsPRACTICE_QUIZ:
        'Abhängig von der gewährten Berechtigungsstufe werden die Berechtigungen auf die Elemente in diesem Übungs-Quiz übertragen und die entsprechenden Nutzer können Elemente und verlinkte Ressourcen mit anderen Nutzern auch ausserhalb der vorliegenden Aktivität wiederverwenden oder teilen. Für weitere Details zu den erlaubten Aktionen konsultieren Sie bitte die Berechtigungstabellen für die entsprechenden Objekte oder die offizielle Dokumentation.',
      propagatedPermissionsMICRO_LEARNING:
        'Abhängig von der gewährten Berechtigungsstufe werden die Berechtigungen auf die Elemente in diesem Microlearning übertragen und die entsprechenden Nutzer können Elemente und verlinkte Ressourcen mit anderen Nutzern auch ausserhalb der vorliegenden Aktivität wiederverwenden oder teilen. Für weitere Details zu den erlaubten Aktionen konsultieren Sie bitte die Berechtigungstabellen für die entsprechenden Objekte oder die offizielle Dokumentation.',
      propagatedPermissionsGROUP_ACTIVITY:
        'Abhängig von der gewährten Berechtigungsstufe werden die Berechtigungen auf die Elemente in dieser Gruppen-Aktivität übertragen und die entsprechenden Nutzer können Elemente und verlinkte Ressourcen mit anderen Nutzern auch ausserhalb der vorliegenden Aktivität wiederverwenden oder teilen. Für weitere Details zu den erlaubten Aktionen konsultieren Sie bitte die Berechtigungstabellen für die entsprechenden Objekte oder die offizielle Dokumentation.',
      propagatedPermissionsCOURSE:
        'Abhängig von der gewährten Berechtigungsstufe und Ihrer Auswahl, ob höhere Berechtigungen propagiert werden sollen, werden die technisch benötigten oder propagierten Berechtigungen auf den im Kurs enthaltenen Aktivitäten, Elementen, etc. wie in der folgenden Tabelle aufgeführt, gewährt. Für weitere Details zu den erlaubten Aktionen konsultieren Sie bitte die Berechtigungstabellen für die entsprechenden Objekte oder die offizielle Dokumentation.',
      sharingSuccessful: 'Das Objekt wurde erfolgreich geteilt.',
      sharingFailed:
        'Beim Teilen des Objekts ist ein Fehler aufgetreten bzw. der von Ihnen spezifizierte Nutzer konnte nicht gefunden werden.',
      accessRemovalSuccessful: 'Der Zugriff wurde erfolgreich entfernt.',
      accessRemovalFailed:
        'Beim Entfernen des Zugriffs ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.',
      removeCATALOG_COLLECTION: 'Katalog-Sammlung entfernen',
      removeANSWER_COLLECTION: 'Antwort-Sammlung entfernen',
      removeLIVE_QUIZ_TEMPLATE: 'Live-Quiz Vorlage entfernen',
      removeLIVE_QUIZ: 'Live-Quiz entfernen',
      removeCOURSE: 'Kurs entfernen',
      removeELEMENT: 'Element entfernen',
      confirmRemovalCATALOG_COLLECTION:
        'Sind Sie sicher, dass Sie die Katalog-Sammlung "{objectName}" aus Ihrem Profil entfernen möchten?',
      confirmRemovalANSWER_COLLECTION:
        'Sind Sie sicher, dass Sie die Antwort-Sammlung "{objectName}" aus Ihrem Profil entfernen möchten?',
      confirmRemovalLIVE_QUIZ_TEMPLATE:
        'Sind Sie sicher, dass Sie die Live-Quiz Vorlage "{objectName}" aus Ihrem Profil entfernen möchten?',
      confirmRemovalLIVE_QUIZ:
        'Sind Sie sicher, dass Sie das Live-Quiz "{objectName}" aus Ihrem Profil entfernen möchten?',
      confirmRemovalCOURSE:
        'Sind Sie sicher, dass Sie den Kurs "{objectName}" aus Ihrem Profil entfernen möchten?',
      confirmRemovalELEMENT:
        'Sind Sie sicher, dass Sie das Element "{objectName}" aus Ihrem Profil entfernen möchten?',
      confirmRemoval: 'Entfernung bestätigen',
      removalSuccessful:
        'Das Objekt wurde erfolgreich aus Ihrem Konto entfernt.',
      removalFailed:
        'Beim Entfernen des Objekts ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.',
      revokeDirectPermission: 'Direkten Zugriff entziehen',
      revokeUserPermission:
        'Bitte bestätigen Sie, dass Sie Nutzer <b>{username}</b> den direkten Zugriff auf dieses Objekt entziehen möchten.',
      revokeGroupPermission:
        'Bitte bestätigen Sie, dass Sie der Nutzergruppe <b>{groupName}</b> den direkten Zugriff auf dieses Objekt entziehen möchten.',
      derivedPermissionWarning:
        'Achtung: Das Entziehen der direkten Zugriffsrechte auf ein Objekt entfernt möglicherweise nicht den Zugriff des Nutzers darauf. Wenn ein Nutzer Zugriff auf andere Objekte hat, die von diesem Objekt abhängen, erhält er eine abgeleitete Berechtigung, die im unteren Bereich des Freigabedialogs eingesehen werden kann.',
    },
    groupActivity: {
      activityMissingOrNotCompleted:
        'Die von Ihnen gesuchte Gruppenaktivität existiert nicht oder ist noch nicht beendet. Bitte beachten Sie, dass Gruppenaktivitäten erst nach ihrem offiziellen Enddatum bewertet werden können.',
      gradingTitle: 'Bewertung Gruppenaktivität: {name}',
      submissions: 'Abgaben',
      noSubmissions:
        'Es sind keine Abgaben für diese Gruppenaktivität vorhanden.',
      submittedAt: 'Abgegeben am {datetime}',
      toGrade: 'Zu Bewerten',
      graded: 'Bewertet',
      notSubmitted: 'Nicht abgegeben',
      grading: 'Bewertung',
      noSubmissionSelected:
        'Bitte wählen Sie aus der Liste auf der linken seite eine Abgabe zur Bewertung aus. Bevor die Bewertung final abgeschlossen wird, können Sie die Bewertung jederzeit anpassen.',
      nPoints: '{number} Punkte',
      achievedScore: 'Erreichte Punktzahl',
      maxScoreTooltip:
        'Die maximale Punktzahl für eine Frage setzt sich aus den Multiplikatoren der Frage und der Gruppenaktivität zusammen.',
      passedMissingError:
        'Bitte geben Sie an, ob die Gruppenaktivität bestanden wurde oder nicht.',
      scoreMissingError:
        'Bitte stellen Sie sicher, dass alle Fragen mit einer gültigen Punktzahl bewertet wurden.',
      didGroupPass: 'Wurde die Gruppenaktivität bestanden?',
      optionalFeedback:
        'Geben Sie hier ein optionales generelles Feedback zur Gruppenchallenge ein',
      saveGrading: 'Bewertung speichern',
      optionalQuestionFeedback:
        'Geben Sie hier ein optionales Feedback zur beantworteten Frage ein.',
      generalFeedback: 'Generelles Feedback',
      switchSubmission: 'Abgabe wechseln',
      confirmSubmissionSwitch:
        'Sind Sie sich sicher, dass Sie zu einer anderen Abgabe der Gruppenaktivität wechseln möchten. Sie haben aktuell ungespeicherte Änderungen, welche bei diesem Wechsel verloren gehen.',
      totalAchievedPoints: 'Total: {achieved}/{total} Punkte',
      finalizeGrading: 'Bewertung abschliessen',
      confirmFinalizeGrading:
        'Sind Sie sich sicher, dass Sie die Bewertung der Gruppenaktivität abschliessen möchten? Nach dem Abschluss der Bewertung sind die Resultate für die Teilnehmen sichtbar und es können keine weiteren Änderungen vorgenommen werden.',
      stackGradingSuccess: 'Die Bewertung wurde erfolgreich gespeichert.',
      stackGradingError:
        'Beim Speichern der Bewertung ist ein Fehler aufgetreten. Bitte überprüfen Sie, ob alle erforderlichen Berwertungen vorgenommen wurden.',
      finalizeGradingSuccess: 'Die Bewertung wurde erfolgreich abgeschlossen.',
      finalizeGradingError:
        'Beim Abschliessen der Bewertung ist ein Fehler aufgetreten. Bitte stellen Sie sicher, dass alle Abgaben bewertet wurden und versuchen Sie es erneut.',
      alreadyGraded:
        'Die Bewertungen für diese Gruppenaktivität wurden bereits finalisiert und können nicht mehr geändert werden.',
      nOfTotalPoints: '{number}/{total} Punkte',
      gradingAlreadyFinalized:
        'Die Bewertung wurde bereits abgeschlossen und kann nicht mehr geändert werden. Wählen Sie eine Abgabe aus, um sich die eingegebene Bewertung anzusehen.',
    },
    analytics: {
      selectAnalyticsDashboard: 'Bitte wählen Sie ein Analyse-Dashboard aus',
      activity: 'Aktivität',
      performance: 'Leistung & Fortschritt',
      quizzes: 'Quizzes',
      olderCourses: 'Ältere Kurse...',
      activityDashboard: 'Aktivitäts-Dashboard',
      performanceDashboard: 'Leistungs- und Fortschritts-Dashboard',
      quizDashboard: 'Quiz-Dashboard',
      quizAnalytics: 'Quiz Analytics',
      featureUnavailable:
        'Learning Analytics sind für Ihr Benutzerkonto noch nicht verfügbar.',
      analyticsLoadingWait: 'Lade Analyse-Daten. Bitte warten...',
      analyticsLoadingFailed:
        'Beim Laden der Analyse-Daten ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut oder kontaktieren Sie den Support.',
      weeklyStudentActivity: 'Wöchentliche Aktivität der Studierenden',
      dailyStudentActivity: 'Tägliche Aktivität der Studierenden',
      totalParticipants: 'Kurs-Teilnehmende: {number}',
      dailyActivity: 'Tagesabhängige Aktivität',
      activeStudents: 'Aktive Studierende',
      percentageOfStudents: 'Prozentuale Verteilung der Studierenden',
      courseComparison: 'Kursvergleich',
      courseComparisonDescription:
        'Wählen Sie einen zweiten Kurs aus, um die entsprechenden Daten direkt zu vergleichen.',
      selectCourse: 'Kurs auswählen...',
      weekN: 'Woche {number}',
      studentN: 'Studierende(r) {number}',
      overallStudentActivity: 'Gesamte Studierendenaktivität',
      numberOfStudents: 'Anzahl Studierende',
      activeWeeks: 'Aktive Wochen',
      activeDaysPerWeek: 'Aktive Tage pro Woche',
      meanElementsPerDay: 'Durchschnittliche Elemente pro Tag',
      activityLevel: 'Aktivitätslevel',
      levelHigh: 'HOCH',
      levelMedium: 'MITTEL',
      levelLow: 'TIEF',
      asynchronousActivityProgress: 'Fortschritt in asynchronen Aktivitäten',
      started: 'Gestartet',
      completed: 'Abgeschlossen',
      repeated: 'Wiederholt',
      activityElementPerformanceRates:
        'Performance-Raten der Aktivitäten und Elemente',
      errorRate: 'Fehlerrate',
      partialRate: 'Partielle Fehlerrate',
      correctRate: 'Erfolgsrate',
      activities: 'Aktivitäten',
      elements: 'Elemente',
      answers: 'Antworten',
      allAttempts: 'Alle Versuche',
      firstAttempts: 'Erste Versuche',
      lastAttempts: 'Letzte Versuche',
      activityType: 'Aktivitätstyp',
      allActivityTypes: 'Alle Aktivitätstypen',
      elementType: 'Elementtyp',
      allElementTypes: 'Alle Elementtypen',
      noEntriesManageFilters:
        'Für die gewählten Filter existieren keine Einträge in diesem Kurs. Bitte passen Sie die Filter gegebenenfalls an oder setzen Sie alle Filter zurück',
      resetSelectors: 'Auswahl zurücksetzen',
      searchPlaceholder: 'Suche...',
      activityNameLabel: 'Aktivitätsname',
      elementNameLabel: 'Elementname',
      overallStudentPerformance:
        'Gesamtleistung der Studierenden (Fehlerraten)',
      totalErrorRate: 'Totale Fehlerrate',
      total: 'Total',
      firstAttempt: 'Erster Lösungsversuch',
      lastAttempt: 'Letzter Lösungsversuch',
      performanceLevel: 'Leistungslevel',
      feedbackOverviewActivityInstances:
        'Übersicht für Aktivitäts- und Element-Bewertungen',
      upvotes: 'Positive Bewertungen',
      downvotes: 'Negative Bewertungen',
      performanceRates: 'Performance-Raten',
      totalScore: 'Gesamtpunktzahl',
      activityProgress: 'Aktivitätsfortschritt',
      studentPerformance: 'Studierendenleistung',
      feedbackOverview: 'Feedback-Übersicht',
      dataSource: 'Datenquelle',
      selectActivityAnalytics:
        'Bitte wählen Sie eine Aktivität aus Ihrem Kurs aus, um die entsprechenden Analyse-Daten anzuzeigen. Bitte beachten Sie, dass die Analyse nur für Aktivitäten verfügbar ist, die für Studierende zugänglich sind.',
      noPracticeQuizzes: 'Dieser Kurs enthält keine Übungs-Quizzes.',
      noMicroLearnings: 'Dieser Kurs enthält keine Microlearnings.',
      searchPracticeQuizzes: 'Übungs-Quizzes durchsuchen...',
      searchMicroLearnings: 'Microlearnings durchsuchen...',
      backToActivitySelection: 'Zurück zur Aktivitätsauswahl',
      totalAnsweredElements:
        'Gesamtzahl beantworteter Elemente in {activityName}: <b>{number}</b>',
      averageTimeSpentActivity:
        'Durchschnittlich aufgewendete Gesamtzeit pro Studierender: <b>{min}:{sec} min</b>',
      successRates: 'Erfolgsraten',
      successRate: 'Erfolgsrate',
      partialErrorRate: 'Partielle Fehlerrate',
      microLearningOneSubmissionHint:
        'Für Microlearnings ist keine Trennung von ersten und letzten Lösungversuchen möglich, da Teilnehmende jedes Element der Aktivität nur einmal lösen können.',
      totalAnswers: 'Gesamtzahl Antworten: <b>{number}</b>',
      numberOfStudentsN: 'Anzahl Studierende: <b>{number}</b>',
      averageTimeSpentInstance:
        'Durchschnittliche Bearbeitungszeit: <b>{min}:{sec} min</b>',
      studentFeedback: 'Studierenden-Feedback (N = {numOfVotes})',
      noWeeklyActivityData:
        'Bisher sind keine wöchentlichen Aktivitätsdaten für diesen Kurs verfügbar.',
      noDailyActivityData:
        'Bisher sind keine täglichen Aktivitätsdaten für diesen Kurs verfügbar.',
      noActivityDistributionData:
        'Bisher sind keine Aktivitätsverteilungsdaten für diesen Kurs verfügbar.',
      noStudentActivity:
        'Bisher wurde keine Studierendenaktivität für diesen Kurs berechnet.',
      noAsynchronousActivityProgressData:
        'Bisher sind keine Daten zum Fortschritt in asynchronen Aktivitäten für diesen Kurs verfügbar.',
      noStudentPerformanceData:
        'Bisher sind keine Daten zur Studierendenleistung für diesen Kurs verfügbar.',
      noStudentActivityPerformanceData:
        'Bisher sind keine Daten zur Studierendenleistung für Aktivitäten in diesem Kurs verfügbar.',
      studentActivityPerformance: 'Leistung der Studierenden in Aktivitäten',
      studentUsername: 'Nutzername',
      studentEmail: 'E-Mail Adresse',
      emailMissing: 'n/a',
      selectAllActivities: 'Alle Aktivitäten auswählen',
      deselectAllActivities: 'Alle Aktivitäten abwählen',
      noActivitySelected:
        'Bitte wählen Sie mindestens eine Aktivität aus, um die gesammelten Punkte und den Fortschritt der Studierenden anzuzeigen.',
      participantActivityPerformanceDescription:
        'Diese Tabelle stellt den Fortschritt und die gesammelten Punkte der Studierenden in den ausgewählten Aktivitäten dar. Es werden alle berechneten Punkte (inkl. Repetitionen bei Übungs-Quizzes) dargestellt. Diese Zahl kann aufgrund der Bepunktungslogik bei Repetitionen von der Anzahl gesammelter Punkte auf dem Kurs-Leaderboard abweichen. Der prozentuale Fortschritt entspricht der Anzahl Elemente in der Aktivität, welche mindestens einmal beantwortet wurden. Eine Aktivität wird zu den abgeschlossenen Aktivitäten gezählt, wenn der prozentuale Fortschritt 100% beträgt.',
      completedActivitiesExplanation:
        'Abgeschlossene Aktivitäten (mit 100% Fortschritt)',
      completedActivities: 'Abgeschlossene Aktivitäten',
    },
  },
  control: {
    login: {
      header: 'KlickerUZH Controller-App (Token)',
      installAndroid:
        'Installieren Sie die KlickerUZH Controller-App auf Ihrem Handy, um Ihre Live Quizzes während der Vorlesungen direkt vom Handy aus zu steuern.',
      installIOS:
        "Öffnen Sie den Share-Dialog und klicken Sie auf 'Zum Startbildschirm hinzufügen', um die KlickerUZH Controller-App auf Ihrem Handy zu installieren und Live Quizzes direkt zu bedienen.",
      shortnameRequired: 'Bitte geben Sie Ihren Kurznamen ein.',
      tokenRequired:
        'Geben Sie einen gültigen Token ein. Bitte beachten Sie die bei der Token Generierung angezeigte Gültigkeit.',
      checkToken:
        'Login fehlgeschlagen. Bitte überprüfen Sie Ihre E-Mail Adresse und den Token. Beachten Sie die zeitlich begrenzte Gültigkeit des Tokens.',
    },
    home: {
      courseSelection: 'Kursauswahl',
      errorLoadingCourse:
        'Es ist ein Fehler aufgetreten beim Laden Ihrer Kurse. Bitte versuchenSie es später erneut.',
      selectCourse: 'Bitte wählen Sie einen Kurs aus:',
      archivedCourse: '{courseName} (Archiviert)',
      liveQuizzesNoCourse: 'Live Quizzes ohne Kurs',
      listLiveQuizzesNoCourse: 'Liste aller Live Quizzes ohne Kurs',
      loadingLiveQuizzesFailed:
        'Beim Laden Ihrer Live Quizzes ist ein Fehler aufgetreten. Bitte versuchen Sie es später erneut.',
    },
    course: {
      courseOverview: 'Kursübersicht',
      loadingFailed:
        'Es ist ein Fehler aufgetreten beim Laden Ihrer Kurse. Bitte versuchen Sie es später erneut.',
      completedLiveQuizzesHint:
        'Abgeschlossene Live Quizzes können auf der entsprechenden Seite in der KlickerUZH Management-App mit Resultaten betrachtet werden.',
      runningLiveQuizzes: 'Laufende Live Quizzes',
      noRunningLiveQuizzes: 'Keine laufenden Live Quizzes',
      plannedLiveQuizzes: 'Geplante Live Quizzes',
      noPlannedLiveQuizzes: 'Keine geplanten Live Quizzes',
      liveQuizStartFailed:
        'Leider konnte Ihr Live Quiz aufgrund eines Fehlers nicht gestartet werden. Bitte versuchen Sie es später erneut.',
      pptEmbedding: 'PPT-Einbettung Evaluation',
      startLiveQuiz: 'Quiz starten',
      confirmStartLiveQuiz:
        'Sind Sie sich sicher, dass sie das folgende Live Quiz starten möchten?',
      explanationStartLiveQuiz:
        'Bitte beachten Sie, dass ein gestartetes Live Quiz grundsätzlich öffentlich zugänglich ist. Laufende Live Quizzes können über die KlickerUZH Management-App abgebrochen oder gestoppt werden.',
    },
    liveQuiz: {
      liveQuizControl: 'Live Quiz-Steuerung',
      errorLoadingLiveQuiz:
        'Leider ist beim Laden des Live Quizzes ein Fehler aufgetreten. Bitte vergewissern Sie sich, dass das Live Quiz noch läuft oder versuchen Sie es später nochmals',
      containsNoQuestions:
        'Dieses Live quiz enthält keine Fragen und kann daher zum aktuellen Zeitpunkt nicht über die Controller-App gesteuert werden. Bitte benutzen sie die Manage-App mit allen Funktionalitäten.',
      liveQuizWithName: 'Live Quiz: {name}',
      activeBlock: 'Aktiver Block:',
      closeBlock: 'Block schliessen',
      nextBlock: 'Nächster Block:',
      activateBlockN: 'Block {number} aktivieren',
      hintAllBlocksClosed:
        'Es wurden bereits alle Blöcke dieses Live Quizzes ausgeführt und geschlossen. Mit dem Beenden des Live Quizzes wird auch der Feedback-Kanal geschlossen.',
      endQuiz: 'Quiz beenden',
      hintLastBlock:
        'Der aktuell laufende Block is der letzte dieses Live Quizzes. Nach Schliessen dieses Blockes kann das Live Quiz beendet werden.',
    },
    activity: {
      title: '{type} Aktivitäten',
      tooltip: 'Kommentare anzeigen',
      viewComments: 'Kommentare anzeigen',
      noActivity: 'Noch keine Aktivitäten.',
      addMessage:
        'Verwenden Sie das Formular unten, um die erste Nachricht hinzuzufügen.',
      messageInputPlaceholder: 'Nachricht eingeben...',
      send: 'Senden',
      sending: 'Wird gesendet...',
      missingId: 'Objekt-ID fehlt. Kommentare kann nicht angezeigt werden.',
    },
  },
}
