const messages = {
  shared: {
    generic: {
      incorrect: 'Falsch',
    },
    types: {
      COMPETENCE_TREE: 'Kompetenzbaum',
    },
  },
  pwa: {
    practiceQuiz: {
      adaptive: {
        intro: {
          title: 'Adaptives Übungs-Quiz',
          purpose:
            'Die Fragen passen sich an deine Antworten an und ermitteln dein aktuelles Kompetenzniveau.',
          expectedLength:
            '{maximum, plural, one {Das Quiz umfasst höchstens # Frage.} other {Das Quiz umfasst höchstens # Fragen.}}',
          noBacktracking:
            'Nach dem Absenden kannst du nicht zu früheren Fragen zurückkehren.',
          resumable: 'Du kannst das Quiz verlassen und später fortsetzen.',
          privacy:
            'Dein Ergebnis zeigt dir, was du als Nächstes üben kannst. Kursdozierende sehen nur anonymisierte Gruppenergebnisse.',
        },
        question: {
          testingInfo: 'Testinformationen — für Studierende nicht sichtbar',
          testingInfoDescription:
            'Lösungen und Debugging-Daten sind für diese Umgebung aktiviert.',
          testingSolution: 'Lösung',
          testingElement: 'Element',
          testingTags: 'Tags',
          testingNone: 'keine',
          testingSubcompetence: 'Teilkompetenz',
          testingItemLevel: 'Niveau der Frage',
          testingOverallEstimate: 'Aktuelle Schätzung (gesamt)',
          testingCompetenceEstimate: 'Schätzung Kompetenz',
          testingSubcompetenceEstimate: 'Schätzung Teilkompetenz',
          testingNoEstimate: 'Noch keine Schätzung',
          testingNoLevel: 'kein Niveau',
          testingTentative: '(beste Schätzung)',
          testingEstimateDetails:
            'θ {theta} [{lower}, {upper}], SE {standardError}, {count, plural, one {# Antwort} other {# Antworten}}',
          testingTrue: 'Richtig',
          testingFalse: 'Falsch',
          remainingTime: 'Verbleibende Zeit: {time}',
          timeLimitReached:
            'Die Zeit ist abgelaufen. Dein Ergebnis wird geprüft…',

          progress: 'Frage {current}, höchstens {maximum}',
          timer: 'Dauer {time}',
          status: {
            building: 'Dein Kompetenzprofil wird aufgebaut',
            refining: 'Dein Kompetenzprofil wird verfeinert',
          },
        },
        actions: {
          start: 'Quiz starten',
          resume: 'Quiz fortsetzen',
          submit: 'Antwort senden',
          startOver: 'Neu starten',
          startOverTitle: 'Neu starten?',
          startOverDescription:
            'Dein aktueller Versuch und die zugehörigen Antworten werden verworfen.',
          startOverConfirm: 'Neu starten',
          practiceAgain: 'Erneut üben',
        },
        errors: {
          load: 'Das adaptive Übungs-Quiz konnte nicht geladen werden.',
          start:
            'Das Quiz konnte nicht gestartet werden. Bitte versuche es erneut.',
          resume:
            'Das Quiz konnte nicht fortgesetzt werden. Bitte versuche es erneut.',
          startOver:
            'Ein neuer Versuch konnte nicht gestartet werden. Bitte versuche es erneut.',
          submit:
            'Deine Antwort konnte nicht übermittelt werden. Bitte versuche es erneut.',
          result:
            'Dein Ergebnis konnte nicht geladen werden. Bitte versuche es erneut.',
        },
        feedback: {
          correct: 'Richtig',
          incorrect: 'Noch nicht richtig',
          score: 'Punktzahl: {score} %',
        },
        unavailable: {
          title: 'Quiz nicht verfügbar',
          description:
            'Dieses adaptive Übungs-Quiz ist zurzeit nicht verfügbar.',
        },
        preview: {
          label: 'Vorschau',
          description: 'Du siehst eine Vorschau dieses adaptiven Übungs-Quiz.',
        },
        validation: {
          numericRequired: 'Gib eine Zahl ein.',
          numericInvalid: 'Gib eine gültige Zahl ein.',
          numericRange: 'Gib einen Wert zwischen {min} und {max} ein.',
          numericMin: 'Gib einen Wert von mindestens {min} ein.',
          numericMax: 'Gib einen Wert von höchstens {max} ein.',
          numericPercentRange: 'Gib einen Prozentwert zwischen 0 und 100 ein.',
          numericPercentAllowed: 'Prozenteingaben sind möglich.',
          freeTextRequired: 'Gib eine Antwort ein.',
          freeTextTooLong:
            '{maxLength, plural, one {Gib höchstens # Zeichen ein.} other {Gib höchstens # Zeichen ein.}}',
        },
        result: {
          timeLimit: {
            zeroAnswered:
              'Das Zeitlimit wurde erreicht, bevor du eine Antwort gesendet hast. Es ist keine Niveauschätzung verfügbar.',
            answered:
              'Das Zeitlimit wurde erreicht. Ein Ergebnis unten beruht nur auf den Antworten, die vor Ablauf der Zeit gesendet wurden.',
          },
          placementPilot: {
            notice:
              'Experimenteller Einstufungs-Pilot: Dieses Ergebnis dient zur Orientierung und kann sich während der Auswertung des Piloten ändern.',
            estimatedLevel: 'Geschätzte Stufe: {level}',
            adjacentRange: 'Geschätzter benachbarter Bereich: {levels}',
            noEvidence: 'Noch keine geschätzte Stufe verfügbar',
            resultHelp:
              'Dieser experimentelle Pilot zeigt zur Orientierung eine geschätzte Stufe oder einen benachbarten Bereich.',
          },
          uncertainty: {
            title: 'Modellbasierter geschätzter Bereich',
            description:
              'Ein breiterer Bereich bedeutet mehr Unsicherheit über deine Stufe. Dies ist eine Schätzung anhand deiner Antworten, keine Garantie.',
          },

          retakeAvailableAt:
            'Du kannst dieses Quiz ab {date} erneut absolvieren. Dein aktuelles Ergebnis bleibt hier verfügbar.',
          retakeUnavailable:
            'Für dieses Quiz sind keine Wiederholungen möglich. Dein Ergebnis bleibt hier verfügbar.',
          title: 'Dein Ergebnis',
          headline: 'Dein aktuelles Niveau: {level}',
          incompleteHeadline: 'Noch kein vollständiges Ergebnis',
          betweenHeadline: 'Zwischen {levels}',
          poolLimitedHeadline: 'Weitere passende Fragen werden benötigt',
          researchHeadline: 'Übung abgeschlossen',
          incomplete:
            'Es liegen noch nicht genügend Daten für ein Gesamtniveau vor.',
          probability: '({probability} % Wahrscheinlichkeit)',
          answeredQuestions:
            '{count, plural, one {# Frage beantwortet} other {# Fragen beantwortet}}',
          classification: {
            CLASSIFIED: {
              label: 'Niveau bestimmt',
              description:
                'Die verfügbaren Daten stützen dieses Niveau. Der Bereich unten zeigt die verbleibende Unsicherheit.',
            },
            BETWEEN_LEVELS: {
              label: 'Zwischen zwei Niveaus',
              description:
                'Deine Antworten stützen zwei benachbarte Niveaus. Der Bereich unten zeigt, wo das Ergebnis beide überlappt.',
            },
            INSUFFICIENT_EVIDENCE: {
              label: 'Nicht genügend Daten',
              description:
                'Es liegen noch nicht genügend Daten für eine verlässliche Niveaueinstufung vor.',
            },
            POOL_LIMITED: {
              label: 'Fragenpool begrenzt',
              description:
                'Mit den verfügbaren Fragen konnte die Schätzung nicht ausreichend eingegrenzt werden.',
            },
            RESEARCH_ONLY: {
              label: 'Kein Kompetenzresultat',
              description:
                'Diese Runde sammelt Antworten für die Kalibrierung und weist kein Kompetenzniveau aus.',
            },
          },
          nextStep: {
            title: 'Nächster Schritt',
            CLASSIFIED:
              'Übe mit Material auf diesem Niveau weiter und wiederhole Kompetenzbereiche, die darunter liegen.',
            BETWEEN_LEVELS:
              'Übe auf dem höheren der beiden Niveaus und wiederhole das Quiz mit mehr Erfahrung.',
            INSUFFICIENT_EVIDENCE:
              'Übe in allen Kompetenzbereichen und wiederhole das Quiz, um mehr Daten zu sammeln.',
            POOL_LIMITED:
              'Nutze das Kompetenzprofil zur Orientierung und frage nach zusätzlichen Übungsmaterialien.',
            RESEARCH_ONLY: '',
          },
          interpretation: {
            MASTERY: {
              headline: 'Höchste nachgewiesene Stufe: {level}',
              description:
                'Die Einstufungsregel zeigt die höchste Stufenschwelle, die Ihre Schätzung erreicht. Berücksichtigen Sie bei der Interpretation die Aussagekraft und das Kompetenzprofil.',
            },
            NEAREST: {
              headline: 'Geschätzte Stufe: {level}',
              description:
                'Die Diagnoseregel zeigt den Stufenanker, der Ihrer aktuellen Schätzung am nächsten liegt. Berücksichtigen Sie bei der Interpretation die Aussagekraft und das Kompetenzprofil.',
            },
          },
        },
        confidence: {
          label: 'Aussagekraft',
          HIGH: 'Hoch',
          MODERATE: 'Mittel',
          LOW: 'Tief',
          INSUFFICIENT_DATA: 'Unzureichende Daten',
        },
        nearBoundary: {
          label: 'Nahe an einer Stufengrenze',
          description:
            'Dein Ergebnis liegt nahe an der Grenze zwischen zwei Niveaus.',
        },
        stopReasons: {
          TIME_LIMIT:
            'Das Quiz wurde beendet, weil das Zeitlimit erreicht wurde.',
          ABANDONED:
            'Dieser Versuch wurde vor dem vollständigen Abschluss beendet.',
          CLASSIFIED: 'Dein Niveau konnte zuverlässig geschätzt werden.',
          ALL_ROOTS_CLASSIFIED:
            'Die übergeordneten Kompetenzbereiche konnten eingeschätzt werden. Für einzelne Teilkompetenzen können noch Antworten fehlen.',
          TOTAL_QUESTION_CAP:
            'Das Quiz endete nach der maximalen Anzahl Fragen.',
          NODE_QUESTION_CAP:
            'Die Fragengrenze für einen Kompetenzbereich wurde erreicht.',
          POOL_EXHAUSTED: 'Es waren keine weiteren passenden Fragen verfügbar.',
          INSUFFICIENT_DATA:
            'Es lagen nicht genügend Daten für ein vollständiges Ergebnis vor.',
        },
        trajectory: {
          evidenceHelp:
            'Die Linie zeigt, wie sich Ihre Schätzung mit den Antworten verändert hat. Frühe Schätzungen sind vorläufig: Zu diesem Zeitpunkt kann die Stufe noch offen sein, obwohl inzwischen ein Endergebnis vorliegt. Der schattierte Bereich zeigt die verbleibende Unsicherheit.',
          notYetDetermined: 'Noch nicht bestimmt',
          title: 'Verlauf der Schätzung',
          questionAxis: 'Beantwortete Fragen',
          levelAxis: 'Geschätztes Niveau',
          question: 'Frage {number}',
          estimate: 'Schätzung',
          confidenceRange: 'Unsicherheitsbereich',
          finalResult: 'Endergebnis',
          noData: 'Es sind keine Verlaufsdaten verfügbar.',
          summary:
            '{count, plural, one {Nach # beantworteter Frage liegt deine abschliessende Schätzung bei {level}.} other {Nach # beantworteten Fragen liegt deine abschliessende Schätzung bei {level}.}}',
          incompleteSummary:
            '{count, plural, one {Nach # beantworteter Frage liegen noch nicht genügend Daten für ein Gesamtniveau vor.} other {Nach # beantworteten Fragen liegen noch nicht genügend Daten für ein Gesamtniveau vor.}}',
        },
        profile: {
          earlyIndication: 'Erste Einschätzung: {level}',
          plausibleRange: 'Plausibler Bereich: {range}',
          fewResponses:
            '{count, plural, one {Basiert auf nur # Antwort. Dies ist eine erste, noch sehr unsichere Einschätzung.} other {Basiert auf nur # Antworten. Dies ist eine erste, noch sehr unsichere Einschätzung.}}',
          supportedEstimate:
            'Deine Antworten stützen diese Einschätzung. Der schattierte Bereich zeigt die verbleibende Unsicherheit.',
          uncertainEstimate:
            'Dein Niveau ist noch unsicher. Weitere Antworten in diesem Bereich würden helfen, die Spanne einzugrenzen.',
          noResponses: 'In diesem Bereich wurden keine Fragen beantwortet.',
          evidenceHelp:
            'Jede Zeile verwendet Antworten aus dem jeweiligen Bereich. Nach wenigen Antworten ist die Einschätzung vorläufig. Die schattierte Spanne zeigt die Unsicherheit: Je breiter sie ist, desto unsicherer ist dein Niveau. Bereiche ohne Antworten haben keine Schätzung.',
          title: 'Kompetenzprofil',
          overall: 'Gesamt',
          responses: '{count, plural, one {# Antwort} other {# Antworten}}',
          insufficientData: 'Unzureichende Daten',
          betweenLevels: 'Zwischen {levels}',
          poolLimited: 'Fragenpool begrenzt',
          researchOnly: 'Kein Kompetenzresultat',
          expand: 'Details zu {name} anzeigen',
          collapse: 'Details zu {name} ausblenden',
        },
      },
    },
  },
  manage: {
    adaptiveActivitySummary: {
      title: 'Adaptiver Übungsquiz',
      tree: 'Kompetenzbaum',
      notAssigned: 'Noch kein Kompetenzbaum zugewiesen',
      poolCount:
        '{count, plural, one {# Element im Fragenpool des Quiz} other {# Elemente im Fragenpool des Quiz}}',
      treeCount:
        '{count, plural, one {# Element dem Baum zugewiesen} other {# Elemente dem Baum zugewiesen}}',
    },
    general: {
      sortAscending: 'Aufsteigend sortieren',
      sortDescending: 'Absteigend sortieren',
      selectAllElements: 'Alle Elemente auswählen',
      deselectAllElements: 'Alle Elemente abwählen',
    },
    activities: {
      adaptiveInfo: 'Adaptiver Fragenpool · individuell ausgewählte Fragen',
    },
    elements: {
      adaptiveMapping: {
        selectTrees: 'Kompetenzbäume',
        multipleTreesHint:
          'Wählen Sie einen oder mehrere Bäume. Legen Sie für jeden ausgewählten Baum eine Teilkompetenz und einen Schwierigkeitsgrad fest.',
        enableAdaptive: 'Adaptives Lernen aktivieren',
        disableHint:
          'Entfernen Sie die Baumzuordnungen unten, um adaptives Lernen für dieses Element zu deaktivieren. Bereits veröffentlichte Quiz behalten ihre gespeicherten Fragen.',

        title: 'Adaptive Zuordnung',
        description:
          'Ordnen Sie dieses Element in einem oder mehreren Kompetenzbäumen einer Blatt-Teilkompetenz und einer Stufe zu. Für die adaptive Schätzung gelten nur vollständig richtige Antworten als richtig; Teilpunkte werden als falsch gewertet.',
        unsupportedType:
          'Adaptive Zuordnungen sind nur für numerische, Single-Choice-, Multiple-Choice-, KPRIM- und Freitextfragen mit kontrollierter Antwort verfügbar.',
        saveElementFirst:
          'Speichern Sie das Element, bevor Sie seine adaptiven Zuordnungen ändern.',
        assignDuringCreation: 'Einem Kompetenzbaum zuweisen',
        createAndAssign: 'Element erstellen und zuweisen',
        noTrees: 'Es sind keine Kompetenzbäume verfügbar.',
        noAdditionalTrees:
          'Keine weiteren Kompetenzbäume entsprechen der Suche.',
        tree: 'Kompetenzbaum',
        searchTrees: 'Kompetenzbäume durchsuchen',
        selectTree: 'Kompetenzbaum auswählen...',
        noAssignableLeaves:
          'Dieser Kompetenzbaum enthält keine aktivierte Blatt-Stufen-Kombination für eine Zuordnung.',
        leaf: 'Blatt-Teilkompetenz',
        selectLeaf: 'Blatt-Teilkompetenz auswählen...',
        additionalLeaves: 'Weitere Blatt-Teilkompetenzen',
        addAdditionalLeaf: 'Weitere Teilkompetenz hinzufügen',
        removeAdditionalLeaf: 'Teilkompetenz entfernen',
        additionalLeavesDraftOnly:
          'Weitere Teilkompetenzzuordnungen werden als Entwurfsmetadaten gespeichert. Sie können erst veröffentlicht werden, wenn die Bewertung mehrfacher Zuordnungen verfügbar ist.',
        level: 'Stufe',
        expectedDifficulty: 'Erwartete Itemschwierigkeit',
        expectedDifficultyTooltip:
          'Wählen Sie die Stufe, auf der dieses Item voraussichtlich am informativsten ist. Diese anfängliche Schätzung wird durch eine genehmigte Kalibrierung ersetzt.',
        selectLevel: 'Stufe auswählen...',
        enabled: 'In adaptiven Quizzes verwenden',
        enablePercentInput: 'Prozenteingabe erlauben',
        selectedB: 'Gewählte Schwierigkeit (b)',
        defaultA: 'Standard-Trennschärfe (a)',
        effectiveA: 'Effektive Trennschärfe (a)',
        inferredC: 'Abgeleitete Ratewahrscheinlichkeit (c)',
        choiceCount: 'Antwortoptionen',
        notAssigned: 'Nicht zugeordnet',
        add: 'Zuordnung hinzufügen',
        remove: 'Zuordnung entfernen',
        save: 'Zuordnung speichern',
        assignmentErrors: {
          locked:
            'Dieser Kompetenzbaum wird bereits von einem Übungsquiz verwendet. Duplizieren Sie den Baum, bevor Sie dieses Element hinzufügen.',
          coverage:
            'Die gewählte Blatt- und Stufenkombination ist nicht mehr aktiviert. Wählen Sie eine verfügbare Kombination.',
          invalid:
            'Diese adaptive Zuordnung ist ungültig. Prüfen Sie das gewählte Blatt, die Stufe und die Antwortkonfiguration.',
          unavailable:
            'Dieser Kompetenzbaum kann nicht mehr bearbeitet werden. Aktualisieren Sie den Katalog oder wählen Sie einen anderen Baum.',
        },
        states: {
          archived: 'Archiviert',
          locked: 'Struktur gesperrt',
          owner: 'Eigener Baum',
          readOnly: 'Schreibgeschützt',
        },
      },
    },
    activityWizard: {
      adaptive: {
        loadFailed: 'Das adaptive Übungs-Quiz konnte nicht geladen werden.',
        mode: {
          label: 'Quizmodus',
          standard: 'Standard',
          adaptive: 'Adaptiv',
          standardDescription:
            'Verwendet die in diesem Quiz konfigurierten Fragenstapel und deren Reihenfolge.',
          adaptiveDescription:
            'Wählt Fragen dynamisch aus einem verknüpften Kompetenzbaum und zeigt stufenbasierte Resultate.',
          confirmTitle: 'Quizmodus wechseln?',
          confirmDescription:
            'Beim Wechsel zum Modus {mode} werden die modusspezifischen Fragen und Einstellungen entfernt. Dies kann nicht rückgängig gemacht werden.',
          confirmAction: 'Modus wechseln',
          rolloutUnavailable:
            'Adaptives Lernen ist derzeit nur in ausgewählten Pilotkursen verfügbar.',
        },
        preset: {
          DIAGNOSTIC: 'Diagnose / Selbsteinschätzung',
          PLACEMENT: 'Einstufung / Kompetenznachweis',
          PLACEMENT_UNAVAILABLE: 'Einstufung (noch nicht verfügbar)',
          RESEARCH: 'Forschung / Kalibrierung',
        },
        placementPilot: {
          label: 'Gesamteinstufung (Pilot)',
          notice:
            'Experimenteller Einstufungs-Pilot: Er verwendet die gewählte Skala, verwendet dein eingestelltes Fragenlimit und verlangt mindestens 4 Antworten pro Hauptkompetenz.',
        },
        research: {
          nonClassifying:
            'Der Forschungsmodus sammelt Antworten für die Itemkalibrierung. Lernende werden nicht klassifiziert und erhalten kein Kompetenzniveau.',
        },
        attemptPolicy: {
          FIRST_COMPLETED: 'Erster abgeschlossener Versuch',
          LATEST_COMPLETED: 'Letzter abgeschlossener Versuch',
        },
        levelMapping: {
          MASTERY: 'Beherrschungsschwelle',
          NEAREST: 'Nächstgelegene Stufe',
        },
        stopping: {
          pilotPolicy:
            'Endet nach der Mindestabdeckung frühzeitig, wenn die Gesamtschätzung ausreichend konzentriert ist. Sonst läuft der Test bis zum Fragen- oder Zeitlimit und kann einen Bereich anzeigen. Dieser Pilot ist nicht empirisch validiert.',
          title: 'Wann soll das Quiz enden?',
          description:
            'Das Quiz kann früher enden, sobald für jede aktive Kompetenz genügend Antworten vorliegen und ihr Unsicherheitsintervall innerhalb einer Stufe liegt.',
          maxQuestions: 'Maximale Anzahl Fragen',
          maxQuestionsHint: 'Das Quiz stellt nie mehr Fragen als dieses Limit.',
          interval: 'Konfidenzintervall für vorzeitiges Beenden',
          interval80: '80% · kürzere Quiz (Standard)',
          interval90: '90% · mehr Antworten',
          interval95: '95% · vorsichtiger',
          customInterval: 'Bestehende individuelle Einstellung (z = {value})',
          intervalHint:
            'Ein höherer Prozentsatz ergibt ein breiteres Unsicherheitsintervall und benötigt meist mehr Fragen. Dies ist ein modellbasiertes Intervall, keine Garantie für die Richtigkeit der angezeigten Stufe.',
          scalePolicy:
            'Konfidenz und vorzeitiges Beenden folgen der genehmigten Regel der gewählten kalibrierten Skala. Die Frage- und Zeitlimits gelten weiterhin.',
          enableTimeLimit: 'Zusätzlich ein Zeitlimit setzen',
          timeLimitMinutes: 'Maximale Dauer (Minuten)',
          limitHint:
            'Das zuerst erreichte Frage- oder Zeitlimit beendet das Quiz, auch wenn Unsicherheit verbleibt. Das Ergebnis zeigt die verfügbare Schätzung und ihre Unsicherheit.',
          coverage: 'Abdeckung einstellen (optional)',
          coverageHint:
            'Vor dem vorzeitigen Beenden sind einige Antworten pro Unterkompetenz erforderlich. Lassen Sie die maximale Anzahl pro Unterkompetenz leer, um nur das Gesamtlimit zu verwenden.',
          minPerLeaf: 'Mindestanzahl Fragen pro Unterkompetenz',
          maxPerLeaf: 'Maximale Anzahl Fragen pro Unterkompetenz (optional)',
        },
        settings: {
          noPoints:
            'Adaptive Übungs-Quizzes vergeben weder Punkte noch Erfahrungspunkte.',
          preset: 'Voreinstellung',
          totalQuestionCap: 'Maximale Fragenzahl',
          showTimer: 'Timer anzeigen',
          attemptPolicy: 'Versuch für die Auswertung',
          advanced: 'Erweiterte adaptive Einstellungen',
          perLeafQuestionCap: 'Maximale Fragen pro Blatt',
          minQuestionsPerLeaf: 'Minimale Fragen pro Blatt',
          classificationZ: 'Klassifikations-Z-Wert',
          levelMappingRule: 'Stufenzuordnung',
          topInformationRatio: 'Anteil der informationsreichsten Items',
          defaultDiscrimination: 'Standard-Trennschärfe (a)',
        },
        assignments: {
          title: 'Fragenpool',
          searchPlaceholder: 'Nach Elementname oder ID suchen...',
          allLeaves: 'Alle Blätter',
          allLevels: 'Alle Stufen',
          state: {
            ALL: 'Alle Status',
            ENABLED: 'Aktiviert',
            DISABLED: 'Deaktiviert',
          },
          use: 'Verwenden',
          element: 'Element',
          leaf: 'Blatt',
          level: 'Stufe',
          effective: 'Effektiver Pool',
          discrimination: 'Trennschärfe (a)',
          included: 'Enthalten',
          excluded: 'Ausgeschlossen',
        },
        coverage: {
          title: 'Abdeckungsstatus',
          leaf: 'Blatt',
        },
        hierarchy: {
          title: 'Quiz-Hierarchie',
          directIntent:
            'Änderungen gelten nur für dieses Quiz; der gemeinsame Kompetenzbaum bleibt unverändert.',
          effectiveState: 'Effektiver Status',
          competence: 'Kompetenz',
          subcompetence: 'Teilkompetenz',
          weight: 'Gewicht',
          cap: 'Fragenlimit',
          effectiveEnabled: 'Enthalten',
          effectiveDisabled: 'Ausgeschlossen',
          disableConfirmTitle: 'Hierarchiezweig ausschliessen?',
          disableConfirmDescription:
            '"{name}" ausschliessen? Dadurch werden auch {descendants, plural, one {# untergeordneter Knoten} other {# untergeordnete Knoten}} und {assignments, plural, one {# zugeordnetes Element} other {# zugeordnete Elemente}} aus diesem Quiz ausgeschlossen.',
          disableAction: 'Zweig ausschliessen',
        },
        setup: {
          enableTimeLimit: 'Zeitlimit festlegen',
          timeLimitMinutes: 'Maximale Dauer (Minuten)',
          timeLimitHint:
            'Beginnt mit der ersten Frage und läuft bei Pausen oder geschlossenem Quiz weiter. Deaktiviert bedeutet unbegrenzte Zeit.',

          title: 'Adaptive Konfiguration',
          tooltip:
            'Wählen Sie einen Kompetenzbaum, konfigurieren Sie den effektiven Pool und prüfen Sie die Veröffentlichungsbereitschaft.',
          tree: 'Kompetenzbaum',
          searchTrees: 'Kompetenzbäume durchsuchen',
          selectTree: 'Kompetenzbaum auswählen...',
          linkedTrees: 'Mit diesem Kurs verknüpft',
          ownedUnlinkedTrees: 'Eigene, nicht verknüpfte Bäume',
          loadMoreLinked: 'Weitere verknüpfte Bäume laden',
          loadMoreOwned: 'Weitere eigene Bäume laden',
          linkSuccess: 'Der Kompetenzbaum wurde mit dem Kurs verknüpft.',
          linkFailed:
            'Der Kompetenzbaum konnte nicht mit dem Kurs verknüpft werden.',
          linkTree: 'Mit Kurs verknüpfen',
          courseRequired:
            'Wählen Sie einen Kurs, bevor Sie die adaptive Durchführung konfigurieren.',
          linkRequired:
            'Verknüpfen Sie den gewählten Kompetenzbaum mit diesem Kurs, bevor Sie fortfahren.',
        },
        scale: {
          title: 'Skala und Kalibrierung',
          version: 'Skalenversion {version}',
          noActive:
            'Dieser Kompetenzbaum hat keine aktive Skala. Erstellen, prüfen und aktivieren Sie eine Skala vor der Veröffentlichung.',
          legacyMeasurement:
            'Dieses Quiz verwendet noch das bisherige Messmodell. Verwenden Sie die aktive Skalenversion {version}, um Bayessche IRT zu konfigurieren.',
          newerActiveAvailable:
            'Eine neuere aktive Skalenversion {version} ist verfügbar. Bereits veröffentlichte Versuche behalten ihre ursprüngliche Skala.',
          useActive: 'Skalenversion {version} verwenden',
          standardSetting: 'Standardsetzung genehmigt',
          empiricalValidation: 'Empirische Holdout-Prüfung genehmigt',
        },
        preview: {
          emptyResponse: 'Die adaptive Vorschau hat keine Daten zurückgegeben.',
          refresh: 'Vorschau aktualisieren',
        },
        readiness: {
          notChecked:
            'Die Veröffentlichungsbereitschaft wurde noch nicht geprüft.',
          ready: 'Bereit zur Veröffentlichung',
          notReady: 'Nicht bereit zur Veröffentlichung',
          stale: 'Vorschau veraltet',
          expectedLength: 'Erwartete Fragenzahl',
          duration: 'Geschätzte Dauer',
          minutes: '{value} Min.',
          roots: 'Aktive Kompetenzen',
          leaves: 'Aktive Blätter',
          assignments: 'Aktive Zuordnungen',
          errors: 'Blockierende Probleme',
          warnings: 'Warnungen',
          reachability: 'Erreichbarkeit der Hauptkompetenzen',
          root: 'Hauptkompetenz',
          available: 'Verfügbare Items',
          allocated: 'Zugewiesene Fragen',
          levels: 'Klassifizierbare Stufen',
          minimumSe: 'Minimal erreichbarer SE',
          issues: {
            ADAPTIVE_COURSE_DISABLED:
              'Adaptives Lernen ist für diesen Kurs nicht aktiviert.',
            ADAPTIVE_COMPETENCE_TREE_UNAVAILABLE:
              'Der Kompetenzbaum wurde archiviert, gelöscht oder von diesem Kurs getrennt.',
            ADAPTIVE_NO_ENABLED_COMPETENCE:
              'Aktivieren Sie mindestens eine Hauptkompetenz.',
            ADAPTIVE_COMPETENCE_WITHOUT_ENABLED_LEAF:
              'Die aktive Kompetenz "{nodeName}" hat kein aktives Blatt.',
            ADAPTIVE_ITEM_UNAVAILABLE:
              'Das Element "{elementName}" wurde gelöscht und kann keinem neuen adaptiven Pool hinzugefügt werden.',
            ADAPTIVE_ITEM_ACCESS_REVOKED:
              'Die Eigentümerin oder der Eigentümer des Kompetenzbaums kann nicht mehr auf das Element "{elementName}" zugreifen. Stellen Sie den Zugriff wieder her oder duplizieren Sie den Baum mit einem verfügbaren Element.',
            ADAPTIVE_ITEM_NOT_SCORABLE:
              'Das Element "{elementName}" hat keine kontrollierte Antwort, die adaptiv bewertet werden kann.',
            ADAPTIVE_ITEM_PARAMETERS_INVALID:
              'Das Element "{elementName}" hat ungültige effektive Itemparameter.',
            ADAPTIVE_COVERAGE_CELL_EMPTY:
              'Jede aktive Kombination aus Blatt und Stufe benötigt mindestens ein aktives Element.',
            ADAPTIVE_COVERAGE_BELOW_PRODUCT_MINIMUM:
              'Produktive Voreinstellungen benötigen {minimumValue} unabhängige, aktive und automatisch bewertbare Elemente in dieser Blatt-Stufen-Kombination; {enabledAssignmentCount} sind verfügbar.',
            ADAPTIVE_COVERAGE_BELOW_TARGET:
              'Das Ziel sind {targetItemCount} Elemente, aber nur {enabledAssignmentCount} {enabledAssignmentCount, plural, one {Element ist} other {Elemente sind}} verfügbar.',
            ADAPTIVE_MINIMUM_EVIDENCE_UNREACHABLE:
              'Das Blatt "{nodeName}" benötigt {requiredQuestionCount} Fragen, aber nur {availableItemCount} aktive Elemente sind verfügbar.',
            ADAPTIVE_MINIMUM_EVIDENCE_CAPPED:
              'Der Knoten "{nodeName}" benötigt {requiredQuestionCount} Fragen, sein effektives Limit ist jedoch {effectiveQuestionCap}.',
            ADAPTIVE_MULTIPLE_SUBCOMPETENCES_DRAFT_ONLY:
              'Elemente mit mehreren Unterkompetenzen benötigen die Einstufung mit einer Kompetenzskala. Andere Quizmodi unterstützen diese Zuordnungen nicht.',
            ADAPTIVE_PLACEMENT_PILOT_LIMITS_INVALID:
              'Die Einstufung prüft eine Auswahl der Unterkompetenzen. Entfernen Sie die Fragenlimits einzelner Unterkompetenzen, um fortzufahren.',
            ADAPTIVE_ROOT_MINIMUM_EVIDENCE_CAPPED:
              'Erlauben Sie mindestens {requiredQuestionCount} Fragen, damit jede Hauptkompetenz vier Antworten erhalten kann. Das aktuelle Limit beträgt {totalQuestionCap}.',
            ADAPTIVE_ROOT_MINIMUM_EVIDENCE_UNREACHABLE:
              'Die Kompetenz "{nodeName}" benötigt mindestens vier verfügbare Fragen und ein Fragenlimit von mindestens vier.',
            ADAPTIVE_GLOBAL_MINIMUM_EVIDENCE_CAPPED:
              'Die aktiven Blätter benötigen {requiredQuestionCount} Fragen, das Gesamtlimit ist jedoch {totalQuestionCap}.',
            ADAPTIVE_CLASSIFICATION_BANDS_UNREACHABLE:
              'Die Planungsschätzung unterstützt für "{nodeName}" ein präzises Ergebnis in {classifiableLevelCount} von {levelCount} Stufen. Mit diesem Fragelimit können Ergebnisse unsicher bleiben.',
            ADAPTIVE_TIME_BUDGET_EXCEEDED:
              'Die Abdeckung dauert voraussichtlich etwa {estimatedDurationMinutes} Minuten bei {secondsPerItem} Sekunden pro Item.',
            ADAPTIVE_CONFIG_INTEGER_RANGE:
              'Die Einstellung {field} muss eine ganze Zahl zwischen {minimumValue} und {maximumValue} sein.',
            ADAPTIVE_PER_LEAF_CAP_INVALID:
              'Das Limit pro Blatt muss positiv und darf nicht grösser als das Gesamtlimit von {totalQuestionCap} sein.',
            ADAPTIVE_MIN_QUESTIONS_EXCEEDS_TOTAL:
              'Die minimale Fragenzahl pro Blatt darf das Gesamtlimit von {totalQuestionCap} nicht überschreiten.',
            ADAPTIVE_CLASSIFICATION_Z_INVALID:
              'Der Klassifikations-Z-Wert muss grösser als 0 und höchstens {maximumValue} sein.',
            ADAPTIVE_TOP_INFORMATION_RATIO_INVALID:
              'Der Anteil der informationsreichsten Items muss grösser als 0 und höchstens {maximumValue} sein.',
            ADAPTIVE_DEFAULT_DISCRIMINATION_INVALID:
              'Die Standard-Trennschärfe muss grösser als 0 und höchstens {maximumValue} sein.',
            ADAPTIVE_STACKS_FORBIDDEN:
              'Adaptive Übungs-Quizzes dürfen keine Standard-Fragenstapel enthalten.',
            ADAPTIVE_RESEARCH_SETTINGS_FORBIDDEN:
              'Erweiterte Forschungseinstellungen sind nur mit der Forschungsvoreinstellung verfügbar.',
            ADAPTIVE_ASSIGNMENT_INVALID:
              'Die Zuordnung {assignmentId} hat keinen unterstützten Elementtyp und keine gültige Stufe.',
            ADAPTIVE_NODE_OVERRIDE_INVALID:
              'Die Knotenanpassung {nodeId} ist doppelt vorhanden oder gehört nicht zum gewählten Baum.',
            ADAPTIVE_NON_ROOT_WEIGHT_FORBIDDEN:
              'Quiz-Gewichte können nur für Hauptkompetenzen gesetzt werden.',
            ADAPTIVE_NODE_CAP_INVALID:
              'Fragenlimits für Knoten müssen ganze Zahlen zwischen 1 und {maximumValue} sein.',
            ADAPTIVE_ELEMENT_OVERRIDE_INVALID:
              'Die Elementanpassung {assignmentId} ist doppelt vorhanden oder gehört nicht zum gewählten Baum.',
            ADAPTIVE_DISCRIMINATION_OVERRIDE_FORBIDDEN:
              'Quiz-spezifische Anpassungen der Trennschärfe benötigen die Forschungsvoreinstellung.',
            ADAPTIVE_DISCRIMINATION_OVERRIDE_INVALID:
              'Die Trennschärfe muss grösser als 0 und höchstens {maximumValue} sein.',
            ADAPTIVE_ROOT_WEIGHT_INVALID:
              'Die aktive Kompetenz "{nodeName}" benötigt ein positives endliches Gewicht.',
            ADAPTIVE_CONFIG_MISSING:
              'Die Konfiguration des adaptiven Übungs-Quizzes wurde nicht gefunden.',
            ADAPTIVE_V2_SCALE_NOT_ACTIVE:
              'Die gewählte Kompetenzskala ist nicht aktiv oder wird nicht mehr unterstützt.',
            ADAPTIVE_V2_PLACEMENT_UNAVAILABLE:
              'Die Einstufung ist für kalibrierte adaptive Quizzes noch nicht verfügbar. Wählen Sie Diagnose oder Forschung.',
            ADAPTIVE_V2_CALIBRATION_MISSING:
              'Das Element "{elementName}" benötigt eine genehmigte Kalibrierung für die gewählte Skala.',
            ADAPTIVE_V2_CALIBRATION_VERSION_MISMATCH:
              'Das Element "{elementName}" wurde nach der Kalibrierung geändert. Importieren Sie eine Kalibrierung für die aktuelle Version.',
            ADAPTIVE_V2_CALIBRATION_FLAGGED:
              'Das Element "{elementName}" wurde bei der Kalibrierungsprüfung ausgeschlossen.',
            ADAPTIVE_V2_INFORMATION_GAP:
              'Die kalibrierte Itembank enthält zu wenig Information nahe einer Stufengrenze.',
            ADAPTIVE_V2_CUT_SCORE_UNREACHABLE:
              'Die kalibrierte Itembank enthält keine geeigneten Fragen nahe einer Stufengrenze.',
            ADAPTIVE_V2_RESEARCH_ANCHORS_REQUIRED:
              'Jedes aktive Blatt und Stufenband benötigt mindestens ein kalibriertes Ankeritem für den Forschungsmodus.',
            ADAPTIVE_V2_RESEARCH_DESIGN_DISCONNECTED:
              'Der Forschungsmodus benötigt eine aktivierte Kalibrierungsdatenerhebung im Kurs und mindestens ein geeignetes Feldtest-Item.',
            ADAPTIVE_V2_EMPIRICAL_VALIDATION_REQUIRED:
              'Die Diagnose-Veröffentlichung benötigt eine unabhängig genehmigte Holdout-Prüfung.',
            ADAPTIVE_V2_EMPIRICAL_VALIDATION_FAILED:
              'Die empirische Prüfung erfüllt die Freigabekriterien für eine Diagnose-Veröffentlichung nicht.',
            ADAPTIVE_V2_EMPIRICAL_VALIDATION_STALE:
              'Die genehmigte empirische Prüfung stimmt nicht mit der aktuellen kalibrierten Itembank überein.',
            unknown:
              'Die adaptive Konfiguration enthält ein unbekanntes Problem.',
          },
        },
        validation: {
          number: 'Geben Sie eine gültige Zahl ein.',
          required: 'Dieses Feld ist erforderlich.',
          integer: 'Geben Sie eine ganze Zahl ein.',
          positive: 'Geben Sie einen Wert grösser als 0 ein.',
          questionCapMax: 'Geben Sie höchstens 1000 Fragen ein.',
          classificationZMax: 'Geben Sie einen Wert von höchstens 5 ein.',
          ratioMax: 'Geben Sie einen Wert von höchstens 1 ein.',
          discriminationMax: 'Geben Sie einen Wert von höchstens 10 ein.',
          treeRequired: 'Wählen Sie einen Kompetenzbaum.',
          courseNotEnabled:
            'Wählen Sie einen Kurs, der für den Pilotbetrieb des adaptiven Lernens aktiviert ist.',
          nonNegative: 'Geben Sie 0 oder einen positiven Wert ein.',
        },
      },
    },
    adaptivePublication: {
      immediateOnly:
        '"{title}" kann derzeit nur sofort veröffentlicht werden. Eine geplante Veröffentlichung ist für adaptive Übungs-Quizzes nicht verfügbar.',
      checkingReadiness: 'Veröffentlichungsbereitschaft wird geprüft...',
      emptyResponse:
        'Die Veröffentlichung des adaptiven Übungs-Quizzes hat keine Daten zurückgegeben.',
      publishFailed:
        'Das adaptive Übungs-Quiz konnte nicht veröffentlicht werden.',
      researchNonClassifying:
        'Der Forschungsmodus sammelt Antwortdaten für die Kalibrierung. Studierende erhalten weder eine Kompetenzklassifikation noch ein Stufenergebnis.',
      researchConfirmation:
        'Mir ist bewusst, dass diese Veröffentlichung Kalibrierungsdaten sammelt und Studierende nicht klassifiziert.',
    },
    evaluation: {
      adaptive: {
        title: 'Adaptive Kohortenauswertung',
        attemptSummary: 'Versuchsübersicht',
        attempts: {
          total: 'Gesamt',
          completed: 'Abgeschlossene Resultate',
          inProgress: 'In Bearbeitung',
          abandoned: 'Abgebrochen',
          classified: 'Stufe bestimmt',
          betweenLevels: 'Zwischen Stufen',
          insufficientEvidence: 'Unzureichende Evidenz',
          poolLimited: 'Fragenpool begrenzt',
          researchOnly: 'Nur Forschung',
          capped: 'Fragenlimit erreicht',
          poolExhausted: 'Fragenpool ausgeschöpft',
          stoppedInsufficientData: 'Mit unzureichenden Daten beendet',
          insufficientData: 'Unzureichende Daten',
          nearBoundary: 'Nahe an einer Stufengrenze',
        },
        distributionEstimates: {
          description:
            'Alle verfügbaren Stufenschätzungen für diesen Bereich werden angezeigt, auch wenn das Fragelimit erreicht wurde. Die Sicherheit wird für jeden Bereich separat beurteilt.',
          determined: 'Stufe bestimmt',
          provisional: 'Vorläufige Schätzung',
          empty:
            'Für diesen Bereich sind noch keine Stufenschätzungen verfügbar.',
          barLabel: '{level}: {determined} bestimmt, {provisional} vorläufig',
          counts: '{determined} bestimmt · {provisional} vorläufig',
          included:
            '{count} Ergebnisse mit einer Schätzung für diesen Bereich. Die Balken zeigen den Anteil an diesen Ergebnissen.',
          excluded:
            '{count} Ergebnisse ohne verwendbare Schätzung für diesen Bereich werden nicht angezeigt.',
        },
        distributionStatuses: {
          betweenLevels: 'Zwischen Stufen',
          insufficientEvidence: 'Unzureichende Evidenz',
          poolLimited: 'Fragenpool begrenzt',
          researchOnly: 'Nur Forschung',
        },
        stopSummary: 'Beendigungsgründe',
        qualitySummary: 'Qualitätsmerkmale',
        suppressedValue: '-',
        notEnoughData: 'Nicht genügend Daten',
        suppression: {
          cohort:
            'Ein Strich (-) bedeutet, dass noch kein Ergebnis vorliegt; er bedeutet nicht null.',
          summary:
            'Ergebniszahlen sind verfügbar, sobald eine Person das Quiz abgeschlossen hat.',
          distribution:
            'Diese Verteilung ist verfügbar, sobald eine Person das Quiz abgeschlossen hat.',
          pilot:
            '«Nicht genügend Daten» bedeutet, dass die Datengrundlage für die Berechnung fehlt.',
        },
        pilot: {
          itemOverview: 'Elementübersicht',
          itemCount: '{count} Elemente',
          itemOverviewHelp:
            'Öffnen Sie eine Kompetenz und Unterkompetenz, um die zugehörigen Elemente anzuzeigen. Jede Liste zeigt standardmässig 10 Elemente pro Seite.',
          unassignedItems: 'Weitere Elemente',
          sortBy: 'Elemente sortieren nach',
          sortOptions: {
            default: 'Standardreihenfolge',
            nameAsc: 'Name (A–Z)',
            nameDesc: 'Name (Z–A)',
            responsesDesc: 'Meiste Antworten',
            responsesAsc: 'Wenigste Antworten',
          },
          questionDistribution: 'Beantwortete Fragen',
          timeDistribution: 'Bearbeitungszeit',
          boxPlotHelp:
            'Box: mittlere 50% · Linie: Median · Antennen: Minimum und Maximum',
          boxPlotCount: '{count} abgeschlossene Resultate',
          boxPlotDurationNote:
            'Nur Resultate mit erfasster Bearbeitungszeit werden berücksichtigt.',
          boxPlotEmpty: 'Keine erfassten Werte verfügbar.',
          boxPlotMin: 'Minimum',
          boxPlotQ1: '25. Perzentil',
          boxPlotMedian: 'Median',
          boxPlotQ3: '75. Perzentil',
          boxPlotMax: 'Maximum',
          boxPlotTimeFormat: 'HH:MM:SS',

          title: 'Qualitätsmonitoring des Piloten',
          description:
            'Aggregierte Indikatoren zu Testlänge, Exposition und deskriptiver Itempassung. Sie kalibrieren keine Items neu und ersetzen nicht die didaktische Prüfung.',
          medianQuestions: 'Median der Fragenzahl',
          p95Questions: '95. Perzentil der Fragenzahl',
          medianDuration: 'Median der Bearbeitungsdauer',
          p95Duration: '95. Perzentil der Bearbeitungsdauer',
          nearBoundaryRate: 'Anteil nahe Stufengrenzen',
          responseIntegrity: 'Integrität der Antwortanzahl',
          durationCompleteness: 'Vollständigkeit der Zeitangaben',
          issueDetected: 'Problem erkannt',
          noIssue: 'Kein Problem',
          responseCountMismatch:
            'Gespeicherte Schätzungen und kanonische Antwortzeilen stimmen nicht überein. Prüfen Sie diese Datenwarnung vor der Interpretation des Piloten.',
          durationMissing:
            'Mindestens ein ausgewählter Versuch hat keine vollständige clientseitig gemeldete Bearbeitungsdauer.',
          columnHelp: {
            item: 'Die Frage in der veröffentlichten Version des Quiz.',
            competence:
              'Die mit dieser Frage erfasste Kompetenz und Teilkompetenz.',
            level: 'Die zugewiesene Stufe im veröffentlichten Fragenpool.',
            responses:
              'Anzahl Antworten auf diese Frage in der freigegebenen Gruppe.',
            exposure:
              'Anteil der freigegebenen Teilnehmenden, denen diese Frage gestellt wurde. Bei adaptiver Auswahl sehen nicht alle dieselben Fragen.',
            observed: 'Anteil der als richtig bewerteten Antworten.',
            expected:
              'Durchschnittliche vom Modell vorhergesagte Erfolgswahrscheinlichkeit aus früheren Antworten und Frageparametern. Eine Modellschätzung, keine angestrebte Bestehensquote.',
            residual:
              'Beobachteter minus vorhergesagter Anteil richtiger Antworten in Prozentpunkten. Positive Werte bedeuten mehr richtige Antworten als erwartet. Mindestens 30 Antworten und ausreichende Gruppengrössen erforderlich. Kein Signifikanztest.',
            flags:
              'Hohe Exposition bedeutet, dass diese Frage mehr als 40% der Teilnehmenden in diesem Bericht gestellt wurde. Dies ist ein Prüfhinweis, kein Fehler; die adaptive Auswahl kann manche Fragen häufiger verwenden.',
          },
          item: 'Item',
          competence: 'Kompetenzpfad',
          level: 'Stufe',
          responses: 'Antworten',
          exposure: 'Exposition',
          observed: 'Beobachtet korrekt',
          expected: 'Vom Modell erwartet',
          residual: 'Differenz (PP)',
          flags: 'Prüfhinweise',
          highExposure: 'Hohe Exposition',
          reviewFit: 'Passung prüfen',
          notEnoughResponses: 'Nicht genügend Antworten',
          noFlags: 'Keine',
        },
        overallDistribution: 'Gesamte Stufenverteilung',
        rootDistributions: 'Kompetenzverteilungen',
        insufficientData: 'Unzureichende Daten',
        noDistributionData: 'Es sind noch keine Verteilungsdaten verfügbar.',
        expandNode: '{node} aufklappen',
        collapseNode: '{node} zuklappen',
        distributionBarLabel:
          '{level}: {count} {count, plural, one {Versuch} other {Versuche}}',
      },
    },
    courseList: {
      deletionErrors: {
        retainedAdaptiveHistory:
          'Dieser Kurs enthält aufbewahrungspflichtige Daten aus adaptiven Übungs-Quizzes und kann nicht gelöscht werden. Archivieren Sie den Kurs stattdessen.',
        generic:
          'Der Kurs konnte nicht gelöscht werden. Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.',
      },
    },
    resources: {
      competenceTrees: 'Kompetenzbäume',
    },
    competenceTree: {
      overviewRoots: 'Hauptkompetenzen',
      overviewChildren: 'Teilkompetenzen',
      overviewElements: 'Elemente',
      overviewWeightHint: 'Beitrag zum Gesamtergebnis',
      numberField: {
        required: 'Gib einen Wert ein.',
        invalid: 'Gib eine gültige Zahl ein.',
        min: 'Gib einen Wert von mindestens {min} ein.',
        max: 'Gib einen Wert von höchstens {max} ein.',
      },
      guidance: {
        missingSubcompetence:
          '„{name}“ braucht eine Teilkompetenz. Füge mindestens eine Fähigkeit darunter hinzu oder entferne diese Kompetenz, wenn du sie nicht brauchst.',
        missingEnabledSubcompetence:
          '„{name}“ hat keine aktive Teilkompetenz. Aktiviere mindestens eine Fähigkeit darunter.',
        missingCoverage:
          'Wähle in den Baumeinstellungen mindestens ein Niveau aus, das für „{name}“ geprüft werden soll.',
        missingNodeName: 'Gib dieser Kompetenz oder Teilkompetenz einen Namen.',
        nodeTooDeep:
          '„{name}“ ist zu tief verschachtelt. Verschiebe sie in der Hierarchie nach oben oder erhöhe die erlaubte Tiefe in den Baumeinstellungen.',
        invalidWeight:
          'Setze für die ausgewählte Kompetenz „{name}“ ein Gewicht grösser als null.',
        missingTreeName:
          'Ergänze unter Struktur einen internen Namen für den Baum.',
        missingDisplayName:
          'Ergänze unter Struktur den Namen, den Lernende sehen sollen.',
        invalidDepth:
          'Wähle in den Baumeinstellungen eine maximale Hierarchietiefe zwischen 1 und 5.',
        missingRoot: 'Füge unter Struktur mindestens eine Kompetenz hinzu.',
        missingLevels:
          'Füge unter Fragen mindestens zwei Niveaubezeichnungen hinzu.',
        fewLevels:
          'Mit mindestens drei Niveaus lassen sich die Fähigkeiten der Lernenden besser unterscheiden.',
        missingLevelName:
          'Gib jedem Niveau unter Fragen → Niveaubezeichnungen einen Namen.',
        duplicateLevelName:
          '„{name}“ wird für mehrere Niveaus verwendet. Gib jedem Niveau einen eigenen Namen.',
        invalidAssignment:
          'Ordne „{name}“ einer Teilkompetenz zu, unter der keine weiteren Teilkompetenzen liegen.',
        missingAssignmentLevel: 'Wähle für „{name}“ ein erwartetes Niveau.',
        assignmentCoverage:
          'Aktiviere in den Baumeinstellungen das Niveau von „{name}“ für die zugeordnete Teilkompetenz.',
        invalidCoverageTarget:
          'Setze die Zielanzahl der Fragen für dieses Niveau auf mindestens 1.',
        other:
          'Prüfe diese Einstellung vor dem Speichern. Die Details unten erklären, was angepasst werden muss.',
        unnamed: 'Unbenannte Kompetenz',
        technicalDetails: 'Validierungsdetails anzeigen',
        editCompetence: 'Kompetenz bearbeiten',
        editLevels: 'Niveaus bearbeiten',
        editSettings: 'Baumeinstellungen öffnen',
        editQuestions: 'Fragen bearbeiten',
        editStructure: 'Struktur bearbeiten',
      },
      stepStructure: 'Struktur',
      stepQuestions: 'Fragen',
      stepReview: 'Prüfen',
      setupSteps: 'Kompetenzbaum einrichten',
      wizardDraftHint:
        'Speichere deinen Fortschritt als Entwurf auf diesem Gerät.',
      backToSetup: 'Zurück zum Baum',
      advancedSettings: 'Erweiterte Abdeckung und Kalibrierung',
      quizDefaults: 'Quiz-Voreinstellungen',
      quizDefaultsHint:
        'Diese Werte werden beim Erstellen eines neuen adaptiven Quiz übernommen und können dort angepasst werden. Bestehende Quiz behalten ihre gespeicherten Einstellungen.',
      defaultMaxQuestions: 'Maximale Fragenanzahl',
      enableTimeLimit: 'Zeitlimit festlegen',
      defaultMaxMinutes: 'Maximale Dauer (Minuten)',
      timeLimitHint:
        'Das Zeitlimit beginnt mit der ersten Frage und läuft auch bei einer Pause oder geschlossenem Quiz weiter.',
      treeSettings: 'Baumeinstellungen',
      levelLabels: 'Niveaubezeichnungen',
      continueQuestions: 'Weiter zu den Fragen',
      continueReview: 'Weiter zur Prüfung',
      reviewTitle: 'Kompetenzbaum prüfen',
      reviewHint:
        'Prüfe die Struktur und die Fragenzuordnungen vor dem Speichern. Das Speichern veröffentlicht keinen Quiz.',
      reviewMissingNames:
        'Ergänze unter Struktur einen internen Namen und einen Anzeigenamen vor dem Speichern.',
      reviewUnmapped:
        'Wähle vor dem Speichern für jede Frage eine Teilkompetenz und ein erwartetes Niveau.',
      reviewStructureCount:
        '{roots, plural, one {# Kompetenz} other {# Kompetenzen}} · {leaves, plural, one {# Blatt-Teilkompetenz} other {# Blatt-Teilkompetenzen}}',
      reviewQuestionCount:
        '{count, plural, =0 {Noch keine Fragen hinzugefügt. Du kannst die Struktur speichern und später Fragen ergänzen.} one {# Frage hinzugefügt} other {# Fragen hinzugefügt}}',
      editStructure: 'Struktur bearbeiten',
      editQuestions: 'Fragen bearbeiten',
      settingsHint:
        'Lege Voreinstellungen für neue Quiz, Niveaubezeichnungen und erweiterte Modelleinstellungen fest. Speichere den Baum, um Änderungen zu übernehmen.',
      scaleAfterSave:
        'Skala und Kalibrierung sind nach dem Speichern des Baums verfügbar.',
      optionalDescription: 'Beschreibung (optional)',
      nodeOptions: 'Kompetenzdetails',

      restoreDraftPrompt:
        'Aktuelle Änderungen durch den gespeicherten Browser-Entwurf ersetzen?',
      tagFilter: 'Tag',
      allTags: 'Alle Tags',
      sortElements: 'Elemente sortieren',
      sortName: 'Name (A–Z)',
      sortModified: 'Zuletzt geändert',
      draftDescription:
        'Speichern Sie einen unfertigen Entwurf in diesem Browser, auch wenn Pflichtfelder fehlen. Mit «Speichern» wird ein gültiger Baum auf dem Server gespeichert. Fragen und Kalibrierung können später ergänzt werden; keine dieser Aktionen veröffentlicht ein Quiz.',
      draftSaved:
        'Entwurf für Ihr Konto in diesem Browser gespeichert. Er ist noch nicht auf dem Server gespeichert.',
      draftAvailable:
        'In diesem Browser ist ein unfertiger Entwurf vorhanden. Die Wiederherstellung ersetzt den aktuellen Inhalt des Editors.',
      restoreDraft: 'Entwurf wiederherstellen',
      localDraftError:
        'Der Browser konnte den Entwurf nicht speichern. Lassen Sie die Seite geöffnet oder speichern Sie einen gültigen Baum auf dem Server.',
      draft: 'Entwurf',
      saveDraft: 'Entwurf speichern',
      advancedTitle: 'Erweitert: Kompetenzskala und Fragenkalibrierung',
      advancedDescription:
        'Stufen beschreiben die Fähigkeiten der Lernenden. Die Kalibrierung ordnet Fragen auf einer gemeinsamen Schwierigkeitsskala ein, damit das adaptive Quiz passende Fragen auswählen und eine Stufe schätzen kann. Die Fragenpool-Karte hilft Fachpersonen, Lücken und Abdeckung zu prüfen; zur Zuordnung vorhandener Bibliothekselemente ist sie nicht nötig.',
      previewElement: 'Vorschau von {name}',
      previewError: 'Die Elementvorschau konnte nicht geladen werden.',
      retryPreview: 'Erneut versuchen',
      chooseSubcompetence: 'Teilkompetenz wählen…',
      chooseLevel: 'Niveau wählen…',
      competenceGroup: 'Gruppe',
      assignElementLeaf: 'Teilkompetenz für {name}',
      assignElementLevel: 'Erwartetes Niveau für {name}',
      unmappedElements:
        'Wähle für jedes Element eine Teilkompetenz und ein erwartetes Niveau, bevor du den Baum speicherst. Einen unvollständigen Entwurf kannst du auf diesem Gerät speichern. Elemente gehören zur untersten Teilkompetenz. Füge einer neuen Kompetenz eine Teilkompetenz hinzu, um ihr Elemente zuzuordnen.',
      batchLimit:
        'Ein Baum unterstützt bis zu 10.000 Zuordnungen. Grenze die Filter ein oder wähle weniger Elemente aus.',
      bulkDescription:
        'Filtere bereite Fragen mit Musterlösung, wähle eine Seite oder alle Treffer und ordne die Auswahl einer Teilkompetenz und einer Stufe zu. Bestehende Zuordnungen bleiben erhalten. Ein Filterwechsel leert die Auswahl. Speichere den Baum, um die Änderungen zu übernehmen.',
      selectPage: 'Diese Seite auswählen',
      selectMatching: 'Alle passenden Elemente auswählen',
      clearSelection: 'Auswahl aufheben',
      selectedCount: '{count} ausgewählt',
      addSelected: 'Ausgewählte Elemente hinzufügen',
      batchAdded:
        '{count} Elemente hinzugefügt. Speichere den Baum, um die Zuordnungen zu übernehmen.',
      browseElements: 'Vorhandene Elemente hinzufügen',
      searchElements: 'Elemente nach Name oder Inhalt suchen',
      allTypes: 'Alle Fragetypen',
      selectLeaf: 'Teilkompetenz zuordnen',
      selectLevel: 'Erwartete Stufe',
      addElement: 'Zum Baum hinzufügen',
      assigned: 'Zum Baum hinzugefügt',
      pickerDescription:
        'Sieh dir fertige Bibliothekselemente in der Vorschau an und füge sie dem Baum hinzu. Wähle danach in jeder hinzugefügten Zeile eine Teilkompetenz und ein erwartetes Niveau.',
      loadElementsError: 'Die Elementbibliothek konnte nicht geladen werden.',
      noElements: 'Keine passenden Elemente. Passen Sie Suche oder Filter an.',
      assignmentSearch: 'Elemente im Baum suchen',
      sortBy: 'Sortieren nach',
      sortOptions: {
        default: 'Standardreihenfolge',
        nameAsc: 'Name (A–Z)',
        nameDesc: 'Name (Z–A)',
      },
      allLevels: 'Alle Stufen',
      allCompetences: 'Alle Teilkompetenzen',
      libraryDescription:
        'Erstellen und verwalten Sie wiederverwendbare Kompetenzbäume für adaptive Übungs-Quizzes.',
      create: 'Kompetenzbaum erstellen',
      searchLabel: 'Kompetenzbäume durchsuchen',
      searchPlaceholder: 'Kompetenzbäume durchsuchen...',
      loadMore: 'Weitere laden',
      moreCourseLinks: '+{count} weitere',
      ownershipFilter: 'Nach Eigentum filtern',
      filterOwned: 'Eigene',
      filterLinked: 'Verknüpfte',
      filterAll: 'Alle',
      allCourses: 'Alle Kurse',
      showArchived: 'Archivierte anzeigen',
      tree: 'Kompetenzbaum',
      linkedCourses: 'Verknüpfte Kurse',
      structure: 'Struktur',
      usage: 'Verwendung',
      actions: 'Aktionen',
      owned: 'Eigener Baum',
      linkedReadOnly: 'Verknüpft, schreibgeschützt',
      archived: 'Archiviert',
      noLinkedCourses: 'Keine verknüpften Kurse',
      levelCount: '{count} {count, plural, one {Stufe} other {Stufen}}',
      nodeCount: '{count} {count, plural, one {Knoten} other {Knoten}}',
      assignmentCount:
        '{count} {count, plural, one {Zuordnung} other {Zuordnungen}}',
      draftUsage: 'Quiz-Entwürfe: {count}',
      publishedUsage: 'Veröffentlichte Quizzes: {count}',
      structurallyLocked: 'Struktur gesperrt',
      open: 'Öffnen',
      duplicate: 'Duplizieren',
      saveBeforeDuplicate:
        'Speichern oder verwerfen Sie Ihre Änderungen vor dem Duplizieren.',
      leaveUnsavedTitle: 'Ungespeicherte Änderungen verwerfen?',
      leaveUnsavedDescription:
        'Ihre Änderungen an diesem Kompetenzbaum wurden nicht gespeichert.',
      leaveUnsavedAction: 'Änderungen verwerfen',
      manageLinks: 'Kursverknüpfungen verwalten',
      archive: 'Archivieren',
      restore: 'Wiederherstellen',
      emptyLibrary: 'Keine Kompetenzbäume entsprechen den aktuellen Filtern.',
      archiveTitle: 'Kompetenzbaum archivieren?',
      archiveWarning:
        '"{tree}" archivieren? Der Baum bleibt in bestehenden Quizzes verfügbar, kann aber nicht für neue Zuordnungen oder Quizzes ausgewählt werden.',
      actionError: 'Die Kompetenzbaum-Aktion konnte nicht ausgeführt werden.',
      newTitle: 'Kompetenzbaum erstellen',
      editTitle: 'Kompetenzbaum bearbeiten',
      backToLibrary: 'Zurück zu den Kompetenzbäumen',
      save: 'Kompetenzbaum speichern',
      saveError: 'Der Kompetenzbaum konnte nicht gespeichert werden.',
      treeNotFound: 'Der Kompetenzbaum wurde nicht gefunden.',
      readOnlyNotice:
        'Dieser Baum gehört einer anderen Person. Sie können ihn einsehen und duplizieren, aber nur die Eigentümerin oder der Eigentümer kann ihn bearbeiten.',
      lockedNotice:
        'Dieser Baum wird von einem adaptiven Quiz verwendet. Seine Metadaten können weiterhin bearbeitet werden; duplizieren Sie den Baum, um Stufen, Hierarchie, Abdeckung oder Zuordnungen zu ändern.',
      defaultLevelLow: 'Tief',
      defaultLevelMedium: 'Mittel',
      defaultLevelHigh: 'Hoch',
      defaultRoot: 'Kompetenz 1',
      defaultLeaf: 'Teilkompetenz 1',
      metadataTitle: 'Baum benennen',
      metadataDescription:
        'Verwende einen internen Namen für deine Bibliothek und einen Anzeigenamen für Lernende.',
      internalName: 'Interner Name',
      displayName: 'Anzeigename',
      description: 'Beschreibung',
      modelSettings: 'Modelleinstellungen',
      structureSettings: 'Struktureinstellungen',
      maxDepth: 'Maximale Hierarchietiefe',
      thetaMin: 'Minimaler Theta-Wert',
      thetaMax: 'Maximaler Theta-Wert',
      defaultDiscrimination: 'Standard-Trennschärfe (a)',
      mappingRule: 'Stufenzuordnung',
      mappingNearest: 'Nächstgelegener Stufenanker',
      mappingMastery: 'Höchste erreichte Stufe',
      levelsTitle: 'Stufen',
      levelsDescription:
        'Definieren Sie geordnete Stufenbezeichnungen. Grenzwerte und erwartete Itempositionen werden in der Kompetenzskala unten versioniert.',
      addLevel: 'Stufe hinzufügen',
      newLevel: 'Neue Stufe',
      levelLabel: 'Bezeichnung',
      theta: 'Anker (b)',
      band: 'Stufenband',
      moveUp: 'Nach oben verschieben',
      moveDown: 'Nach unten verschieben',
      deleteLevel: 'Stufe löschen',
      assignmentsAffectedTitle: 'Zuordnungen werden geändert',
      levelReorderWarning:
        'Durch das Verschieben von Stufen ändern sich deren Schwierigkeitsanker; bestehende Zuordnungen können betroffen sein. Fortfahren?',
      levelDeleteWarning:
        'Beim Löschen dieser Stufe werden auch ihre Abdeckungsfelder und Zuordnungen entfernt. Fortfahren?',
      hierarchyTitle: 'Kompetenzhierarchie',
      hierarchyDescription:
        'Erstellen Sie Hauptkompetenzen und verschachtelte Teilkompetenzen. Elemente können nur Blatt-Teilkompetenzen zugeordnet werden.',
      selectedNode: 'Ausgewählter Knoten',
      addRootCompetence: 'Kompetenz hinzufügen',
      addSubcompetence: 'Teilkompetenz hinzufügen',
      addSubcompetenceTo: 'Teilkompetenz zu {name} hinzufügen',
      addChild: 'Untergeordneten Knoten hinzufügen',
      maxDepthReached: 'Maximale Hierarchietiefe erreicht',
      duplicateBranch: 'Zweig duplizieren',
      deleteBranch: 'Zweig löschen',
      nodeName: 'Knotenname',
      parent: 'Übergeordneter Knoten',
      rootNode: 'Hauptkompetenz',
      nodeDescription: 'Knotenbeschreibung',
      nodeType: 'Knotentyp',
      competence: 'Kompetenz',
      subcompetence: 'Teilkompetenz',
      depth: 'Tiefe',
      rootWeight: 'Gewicht der Hauptkompetenz',
      normalizedWeight: 'Normalisiert: {percentage}%',
      noNodeSelected:
        'Wählen Sie einen Knoten, um seine Details zu bearbeiten.',
      expandNode: 'Knoten aufklappen',
      collapseNode: 'Knoten zuklappen',
      newCompetence: 'Neue Kompetenz',
      newSubcompetence: 'Neue Teilkompetenz',
      deleteBranchTitle: 'Hierarchiezweig löschen?',
      deleteBranchWarning:
        'Beim Löschen dieses Zweigs werden seine Zuordnungen für {assignments, plural, one {# Element} other {# Elemente}} entfernt. Zuordnungen ausserhalb dieses Zweigs bleiben erhalten. Fortfahren?',
      coverageTitle: 'Abdeckungsziele',
      contentBlueprintTitle: 'Inhaltlicher Bauplan',
      coverageDescription:
        'Planen Sie die erforderlichen Inhalte für jedes Blatt und jede Stufe. Dieser Bauplan zeigt keine Kalibrierungsbereitschaft; wählen Sie ein Feld, um die Zuordnungen darunter zu filtern.',
      searchLeaves: 'Blätter durchsuchen...',
      allRoots: 'Alle Hauptkompetenzen',
      leaf: 'Blatt-Teilkompetenz',
      coverageDisabled: 'Deaktiviert',
      coverageReady: 'Bereit',
      coverageMissing: 'Unvollständig',
      coverageTargetLabel: 'Zielanzahl Items für {leaf} auf Stufe {level}',
      coverageEnabledLabel: '{leaf} auf Stufe {level} aktivieren',
      coverageFilterLabel: 'Zuordnungen für {leaf} auf Stufe {level} anzeigen',
      coverageAssignmentCount: '{count} von {target} aktiviert',
      noMatchingLeaves: 'Keine Blätter entsprechen den aktuellen Filtern.',
      itemParameters: {
        title: 'Itemparameter',
        difficulty: 'Geschätzte Schwierigkeit (b)',
        difficultySource: 'Abgeleitet aus Stufe: {level}',
        missingLevel: 'Eine Stufe zuweisen, um die Schwierigkeit zu berechnen.',
        guessing: 'Angenommene Ratewahrscheinlichkeit (c)',
        guessingSource: 'Abgeleitet aus Fragetyp und Antwortoptionen.',
        note: 'Schreibgeschützte Annahmen für die Erstellung, keine kalibrierten Schätzungen. Veröffentlichte Quiz behalten ihre gespeicherten Parameter.',
      },
      structureOverview: 'Übersicht',
      assignedElements: 'Zugeordnete Elemente',
      assignmentInactive: 'Inaktiv',
      assignFromLibrary:
        'Hier siehst du die aktuellen Zuordnungen. Füge oben mehrere Elemente hinzu oder verwalte einzelne Zuordnungen in der Elementbibliothek.',
      openElementLibrary: 'Elementbibliothek öffnen',
      overallWeight: 'Gesamtgewicht',
      weightExplanation:
        'Die Gewichte der Hauptkompetenzen bestimmen ihren Beitrag zum Gesamtergebnis. Teilkompetenzen liefern Evidenz innerhalb ihrer Hauptkompetenz.',
      assignmentsTitle: 'Elementzuordnungen',
      assignmentsDescription:
        'Wählen Sie vorhandene Bibliothekselemente und ordnen Sie sie einer Teilkompetenz und Stufe zu. Änderungen werden beim Speichern des Baums übernommen.',
      createElement: 'Element erstellen',
      clearCoverageFilter: 'Feldfilter aufheben',
      assignmentFilter: 'Zuordnungen für {leaf} auf Stufe {level}.',
      element: 'Element',
      elementType: 'Typ',
      level: 'Stufe',
      expectedDifficulty: 'Erwartete Itemschwierigkeit',
      discriminationParameter: 'Trennschärfe (a)',
      difficultyParameter: 'Schwierigkeit (b)',
      guessingParameter: 'Ratewahrscheinlichkeit (c)',
      enabled: 'Aktiviert',
      assignmentEnabledLabel: '{element} in diesem Kompetenzbaum verwenden',
      percentInput: 'Prozenteingabe',
      yes: 'Ja',
      no: 'Nein',
      removeAssignment: 'Zuordnung entfernen',
      noAssignments: 'Dieser Kompetenzbaum enthält keine Elementzuordnungen.',
      noFilteredAssignments:
        'Keine Zuordnungen entsprechen dem gewählten Blatt und der Stufe.',
      scale: {
        title: 'Kompetenzskala',
        description:
          'Verwalten Sie unveränderliche Stufengrenzen, Evidenz zur Standardsetzung und die aktive Skala für kalibrierte adaptive Quizzes.',
        createDraft: 'Skalenentwurf erstellen',
        draftTitle: 'Neuer Skalenentwurf',
        draftDescription:
          'Legen Sie explizite Stufengrenzen und erwartete Itempositionen fest. Reichen Sie danach ein Evidenzartefakt zur unabhängigen Prüfung ein.',
        priorMean: 'Mittelwert der Populationsprior',
        priorStandardDeviation: 'Standardabweichung der Populationsprior',
        rangeStart: 'Skalenanfang',
        rangeEnd: 'Skalenende',
        gridStep: 'Schätzschritt',
        lowerBound: 'Untere Grenze',
        openLowerBound: 'Offen',
        version: 'Version',
        versionLabel: 'Version {version} - {status}',
        versionNumber: 'Version {version}',
        active: 'Aktive Skala',
        noActive: 'Keine aktive Skala',
        emptyState:
          'Es ist noch keine Skala vorhanden. Erstellen Sie einen Entwurf aus den aktuellen Stufenbezeichnungen.',
        readOnly:
          'Dieser verknüpfte Baum ist schreibgeschützt. Seine aktive Skala und Bereitschaft werden unten angezeigt.',
        readinessSummary: 'Kalibrierungsbereitschaft',
        activeScaleVersion: 'Aktive Skalenversion',
        enabledAssignments: 'Aktive Zuordnungen',
        calibratedAssignments: 'Kalibrierte Zuordnungen',
        blockingAssignments: 'Zuordnungen mit Kalibrierungsbedarf',
        readinessStatus: {
          NO_ACTIVE_SCALE: 'Der Baum hat keine aktive Skala.',
          CALIBRATION_INCOMPLETE:
            'Für Zuordnungen auf der aktiven Skala fehlen noch genehmigte Kalibrierungen der exakten Elementversion.',
          CALIBRATED_BANK:
            'Jede aktive Zuordnung hat auf der aktiven Skala eine genehmigte Kalibrierung der exakten Elementversion.',
        },
        empty: 'Die Skalenaktion hat keine Daten zurückgegeben.',
        created: 'Der Skalenentwurf wurde erstellt.',
        activated: 'Die genehmigte Skala ist jetzt aktiv.',
        loadFailed:
          'Skalen- und Kalibrierungsdaten konnten nicht geladen werden.',
        standardSetting: 'Evidenz zur Standardsetzung',
        standardSettingDescription:
          'Laden Sie das strikte JSON-Evidenzartefakt hoch und reichen Sie diesen Entwurf zur unabhängigen Prüfung ein.',
        submitForReview: 'Evidenz zur Prüfung einreichen',
        reviewSubmitted:
          'Die Skala wurde zur unabhängigen Prüfung eingereicht.',
        activate: 'Genehmigte Skala aktivieren',
        standardSettingStatus: 'Standardsetzung genehmigt',
        empiricalValidationStatus: 'Empirische Holdout-Prüfung genehmigt',
        scaleLinkStatus: 'Skalenverknüpfung genehmigt',
        status: {
          DRAFT: 'Entwurf',
          IN_REVIEW: 'In Prüfung',
          APPROVED: 'Genehmigt',
          ACTIVE: 'Aktiv',
          REJECTED: 'Abgelehnt',
          SUPERSEDED: 'Ersetzt',
        },
      },
      calibration: {
        title: 'Kalibrierung',
        status: {
          PROVISIONAL: 'Vorläufig',
          PILOT: 'Pilot',
          CALIBRATED: 'Kalibriert',
          FLAGGED: 'Markiert',
          RETIRED: 'Ausgemustert',
          MISSING: 'Fehlt',
        },
        importTitle: 'Kalibrierungen importieren',
        importDescription:
          'Laden Sie ein striktes Kalibrierungsartefakt hoch. Ungültige, veraltete oder inkompatible Einträge werden vom Server abgelehnt.',
        import: 'Artefakt importieren',
        imported:
          '{count, plural, one {# Kalibrierung wurde importiert.} other {# Kalibrierungen wurden importiert.}}',
        invalidJson: 'Wählen Sie ein gültiges JSON-Artefakt.',
        exportTitle: 'Kalibrierungsdaten exportieren',
        exportDescription:
          'Fordern Sie einen kurzlebigen, datenschutzkontrollierten Datensatz für die externe Kalibrierung an.',
        datasetVersion: 'Datensatzversion',
        export: 'Export anfordern',
        exportQueued: 'Der Kalibrierungsexport wurde eingeplant.',
        exportStatus: 'Exportstatus: {status}',
        download: 'Export herunterladen',
      },
      itemBank: {
        title: 'Karte der kalibrierten Itembank',
        description:
          'Prüfen Sie die Itemabdeckung über die aktive Skala. Die hinterlegte Fläche zeigt die verfügbare Testinformation; Symbole unterscheiden die Elementtypen.',
        axis: 'Itemschwierigkeitsskala',
        missingCut:
          'Nahe der Grenze für "{level}" befindet sich kein kalibriertes Item.',
        tableCaption:
          'Barrierefreie Itembankliste mit erwarteter Schwierigkeit und Kalibrierungsstatus.',
        search: 'Itembank durchsuchen',
        empty: 'Diesem Kompetenzbaum sind keine Elemente zugeordnet.',
        positionSource: {
          CALIBRATED: '(kalibriert)',
          EXPECTED: '(erwartet)',
        },
      },
      validationTitle: 'Validierung',
      validationDescription:
        'Prüfe, ob der Baum gespeichert werden kann. Nötige Änderungen werden unten aufgelistet.',
      validate: 'Baum validieren',
      validationNotRun: 'Die Validierung wurde noch nicht ausgeführt.',
      validationValid: 'Der Kompetenzbaum ist gültig.',
      validationErrors:
        '{count, plural, one {# Punkt vor dem Speichern zu korrigieren} other {# Punkte vor dem Speichern zu korrigieren}}',
      validationWarnings:
        '{count} {count, plural, one {Warnung} other {Warnungen}}',
      validationRequestError:
        'Der Kompetenzbaum konnte nicht validiert werden.',
      jumpToSection: 'Zum Abschnitt',
      courseLinksTitle: 'Kursverknüpfungen für {tree}',
      courseLinksDescription:
        'Verknüpfte Kurse können diesen Baum in adaptiven Übungs-Quizzes verwenden. Die Verknüpfung überträgt kein Eigentum.',
      courseLinkError: 'Die Kursverknüpfung konnte nicht aktualisiert werden.',
      inactiveCourse: 'Inaktiver Kurs',
      courseWriteRequired:
        'Zum Ändern dieser Verknüpfung ist Bearbeitungszugriff erforderlich.',
      courseLinkSwitchLabel: '{course} mit diesem Kompetenzbaum verknüpfen',
      linked: 'Verknüpft',
      notLinked: 'Nicht verknüpft',
      updating: 'Wird aktualisiert...',
      noActiveCourses: 'Es sind keine Kurse zum Verknüpfen verfügbar.',
      close: 'Schliessen',
      confirm: 'Bestätigen',
      cancel: 'Abbrechen',
    },
  },
}

export default messages
