export default {
  live_quiz: {
    title: '(Gamified) Live Quizzes',
    headerImgSrc: '/img_v3/towfiqu-barbhuiya-oZuBNC-6E2s-unsplash.jpg',
    tags: [
      'Interactive lecture',
      'Student engagement',
      'Interaction in teaching',
      'Immediate feedback',
      'Surveys and opinions',
      'Estimation questions',
      'Knowledge evaluation',
      'Gamification',
    ],
    goals: [
      'Activate and encourage student engagement by incorporating interactive questions and surveys during the lecture.',
      'Make courses more relaxed, interactive and adaptive.',
      'Improve motivation by incorporating interactive gamification elements.',
      'Evaluate feedback from your students (e.g., opinions or level of knowledge).',
    ],
    introduction: (
      <>
        <p>
          Teachers often face the challenge of engaging all students, especially
          in courses with large numbers of participants. Many students may
          hesitate to contribute verbally in front of their peers, leading to
          decreased participation. Classroom Response Systems (CRS) like the
          KlickerUZH are specifically designed to address this issue by
          providing a more comfortable and inclusive learning environment. The
          KlickerUZH enables students to actively participate in courses by
          quickly and easily responding to polls and answering prepared
          questions. This allows them to provide valuable feedback on their
          understanding of the subject matter, their level of knowledge or even
          opinions. Gamification elements improve motivation to answer the
          questions e.g., by distributing points for answering. Anonymity is a
          key feature that facilitates active contributions, as students have
          the option to participate anonymously, reducing potential barriers or
          fear of judgment.
        </p>
        <p>
          Teachers can create an environment that encourages active engagement
          and fosters student participation, ultimately enhancing the learning
          experience for all students.
        </p>
      </>
    ),
    background: (
      <>
        <p>
          Interactivity and gamification elements in the context of teaching are
          widely researched areas and show positive effects on student learning
          outcomes.
        </p>
        <p>
          A significant element of classroom interactivity is the use of surveys
          and live quizzes that provide students with immediate feedback on
          their understanding of the material. As Hattie (2008) points out, this
          immediate feedback allows students to better grasp concepts and
          quickly clear up misconceptions. This active engagement with the
          subject matter fosters an interactive and dynamic learning
          environment, resulting in improved comprehension and retention of
          information. Furthermore, in their meta-analysis, Freeman et al.
          (2014) compared the performance of different teaching styles with and
          without the use of interactive elements. The results clearly show that
          interaction in an instructional context led to higher student
          engagement and deeper processing of content. This deeper processing in
          turn led to improved overall course performance compared to
          traditional teaching.
        </p>
        <p>
          Another effective tool in education is gamification. Research by
          Sailer & Homner (2020) examined the effects of gamification on
          cognitive and behavioral learning outcomes. The results show that
          gamified learning not only improves students' cognitive skills, but
          also positively influences their behavior in the learning environment.
          In this regard, the aspect of challenge in gamification has a
          motivating effect on students and may be evidenced by an increased
          interest in the learning content.
        </p>
        <p>
          Want to find out how to encourage active participation from your
          students, in addition to live quizzes and polling? Learn more by
          exploring the following advice on{' '}
          <a
            href={
              'https://teachingtools.uzh.ch/en/tools/classroom-response-systeme'
            }
            target="_blank"
          >
            UZH Teaching Tools
          </a>
          .
        </p>
      </>
    ),
    scenario: (
      <>
        <p>
          You are a lecturer and want to increase the interaction between you
          and your students in a lecture or seminar in-person or online by using
          the KlickerUZH. To achieve this, it is essential to carefully plan and
          prepare questions in advance that you can ask your students during the
          session. In order for lecturers to organize their questions, they can
          group the questions into activities for sequential or stacked
          presentation as well as they are able to group them into question
          blocks (a question block signifies a group of questions that are shown
          to the audience simultaneously in a sequence and are also evaluated as
          such (as a "block"). A lecture may contain an arbitrary sequence of
          said question blocks). It also makes sense to consider in advance what
          you can do with the results afterwards in order to optimally exploit
          them. You can discuss them in a plenary session, for example.
        </p>
        <p>You can implement questions with the following purposes: </p>
        <ul>
          <li>
            Knowledge evaluation: To check whether the students have understood
            the previously learned knowledge, single-choice questions with a
            clear answer are suitable. (Example: What is the definition of the
            Sharpe ratio?)
          </li>
          <li>
            Surveys: To obtain students' opinions on the topic being covered
            lecturers can ask questions without right or wrong answers.
            (Example: Which factors influence stock prices the most?). As the
            results are promptly available to you as lecturer, you may choose to
            share the findings with the class to facilitate further discourse
            and interaction.
          </li>
          <li>
            Estimation questions: To activate students’ engagement, questions
            can be asked without a clear answer. This makes students think about
            the discussed topic and gets them directly involved. (Example: Where
            will the SMI be at the end of 2023?) Depending on your goals, you
            can add gamification elements to your quizzes. Gamified live quizzes
            increase student motivation and add a fun and competitive component
            to lectures which can enhance students’ ambition and motivation.
            Several questions can be asked directly after each other (with a
            timer) to best create a quiz situation. Participants can gather
            points while responding to questions. Points are awarded based on
            the correctness of the answer, as well as the speed/delay between
            the first correct answer and one’s own answer (if correct). A
            leaderboard shows the current ranking of participants within the
            quiz and gathered points are transferred to the course leaderboard
            after the conclusion of the quiz (if enabled on a course level). For
            more information on gamification elements in lectures, please
            consult Gamification.
          </li>
        </ul>
      </>
    ),
    learnings: (
      <>
        <p>
          Since the KlickerUZH’s initial release and first implementation in
          2011, the increasing number of user registrations confirms the need
          for such a tool in teaching.
        </p>
        <p>
          At the University of Zurich, the KlickerUZH has been used in small,
          large (200-400 students), and very large (800-1500 students) lectures
          since its inception. Here are the combined learnings from
          end-of-semester student evaluations, internal surveys with KlickerUZH
          users in the spring semester 2023 (n=63) as well as input from
          lecturers and content creators:
        </p>
        <ul>
          <li>
            Lecture time consumption: Including a KlickerUZH question in a
            lecture typically takes approximately 2 to 5 minutes, considering
            the time required for answering and discussion.
          </li>
          <li>
            Pre-lecture time consumption: "Good things take time" applies to the
            creation of good (multiple-choice) questions. Even experienced
            authors typically anticipate spending an average of one hour to
            produce a single multiple-choice question in exam quality{' '}
            <mark>(Krebs, 2004)</mark>. This time is necessary to carefully
            consider the formulation of the question, select the answer options
            precisely, and avoid potential pitfalls. This conscientious approach
            ensures that the questions align with the desired learning outcomes
            and provide students with an appropriate level of challenge. The
            lecturer also needs time to implement the questions in KlickerUZH
            before the lecture.
          </li>
          <li>
            Reaction to voting results: As a teacher, you have to react quickly
            to the voting results. This can be challenging, especially when the
            results are not as expected. It is advisable to consider the
            reaction to the results in advance of the lecture.
          </li>
          <li>
            Submitted responses: The participation rate varies depending on the
            course but can be estimated at an average of 50% of the attending
            students.
          </li>
          <li>
            Live Streaming and Podcasts: It should be noted that when lectures
            are recorded, students who watch the recordings afterwards may not
            have the opportunity to actively participate, thus missing out on
            the interactive benefits offered by KlickerUZH. Furthermore, it is
            important for lecturers to take into account the average 30-second
            to 1-minute delay of the UZH live streaming service, as this affects
            the timing of KlickerUZH questions and student responses, requiring
            the questions to be open for a longer duration.
          </li>
          <li>
            Participation level: The participation level in gamified live
            quizzes tended to be higher in small lectures were students know
            each other, likely due to the sense of belonging within a smaller
            group.
          </li>
          <li>
            Student feedback: From the students' perspective, the use of
            KlickerUZH is generally regarded as beneficial (average grade across
            several years in different Department of Banking and Finance (DBF)
            lectures: 5.0/6.0). Some critical voices express concerns about time
            loss and question the effective benefits.
          </li>
          <li>
            Question type: So far, single-choice questions have been
            predominantly used.
          </li>
          <li>
            Devices: According to an internal survey in spring semester 2023 in
            one of the KlickerUZH 3.0 pilot lectures, most students (35 / 82)
            participated in the live quiz through the Learning Management System
            (LMS). Another significant portion (33 / 82) joined the quiz by
            scanning the QR code shared by the lecturer. Only a small number of
            students (6 / 82) joined through a personal bookmark, and (4 / 82)
            opted to participate using the KlickerUZH App. Providing all
            necessary components within a single system, integrating KlickerUZH
            into OLAT, even solely for live quizzes, is strongly recommended.
          </li>
          <li>
            Number of uses per session: In the events organized by the DBF,
            KlickerUZH is mainly utilized in bachelor-level lectures with a
            large number of students (150-800 students). In a single semester
            (14 weeks), KlickerUZH was used between three to seven times in
            these sessions, with an average of three questions asked per
            session.
          </li>
          <li>
            Gamification: Incorporating gamification in live quizzes works
            effectively when creating a quiz-like atmosphere in the lecture hall
            and considering incentives or rewards, such as small gifts, to
            enhance participation and engagement.
          </li>
        </ul>
      </>
    ),
  },
  flipped_classroom: {
    title: 'Flipped Classroom',
    headerImgSrc: '/img_v3/icons8-team-yTwXpLO5HAA-unsplash.jpg',
    tags: [
      'Interactive lecture',
      'Self-paced learning',
      'Application and practice',
      'Timely feedback',
      'Increased student engagement',
      'Effective learning outcomes',
      'Individual learning styles',
      'Inclusive learning environment',
    ],
    goals: [
      'Gain time to explore content in greater depth.',
      'Promote application and enable students to apply and practice the knowledge they have gained through their self-study, allowing for a more hands-on learning experience.',
      'Promote individual learning styles.',
      'Provide timely feedback and help students understand where they stand and address any concerns they may have.',
      'Foster stronger interaction between the lecturer and students during the lecture and encourage active participation.',
    ],
    introduction: (
      <>
        <p>
          The concept of the Flipped Classroom, or Inverted Classroom, involves
          reversing the traditional teaching-learning approach by shifting the
          knowledge transfer phase (phase 1) to independent, self-paced learning
          before the actual course, and focusing on practice and consolidation
          (phase 2) during in-person sessions with the teacher utilizing cases,
          experiments, discussions, or questions.
        </p>
        <p>
          By adopting this methodology, students can familiarize themselves with
          the course content at their own pace before the lecture, through
          individual self-study. This can be facilitated using comprehensive
          eLearning resources such as reading materials, multiple-choice
          questions, and videos. During the lecture, the acquired knowledge is
          then applied and practiced collaboratively with the lecturer, allowing
          for a deeper understanding of the new learning materials, the
          discussion of questions and more time to address specific queries.
        </p>
      </>
    ),
    background: (
      <>
        <p>
          This approach offers a variety of benefits, including increased
          student engagement and more effective learning outcomes as
          demonstrated in the following studies.
        </p>
        <p>
          In their research, Gilboy et al. (2015) describe the Flipped Classroom
          from the students' perspective. They show that a majority of students
          consider the approach to be positive. Points such as that knowledge
          can be acquired at a student's own pace and that this knowledge can be
          directly applied in class are seen as beneficial. However, Gilboy et
          al. (2015) point out that it is essential to explain to students the
          purpose and desired effect of the Flipped Classroom. In this way,
          students can best engage with this new approach and understand why
          their learning will be most successful if they become familiar with
          the material prior to the class.
        </p>
        <p>
          Zainuddin and Halili (2016) also note numerous positive aspects of
          this form of teaching in their research. By working through the
          lecture material before class, students feel more confident during
          class interactions, which in turn increases their motivation and leads
          to improved overall performance.
        </p>
        <p>
          Lage et al. (2000) emphasize additionally the need to consider the
          different learning styles of students and the variety of teaching
          styles of instructors. They point out that the match between the
          lecturer's teaching style and the student's learning style is crucial
          for an optimal learning experience. With the Flipped Classroom
          approach, the lecturer takes into account a variety of different
          learning styles. This creates an inclusive learning environment and
          fosters greater student understanding. Please see UZH Teaching Tools
          for more information on the{' '}
          <a
            href={
              'https://teachingtools.uzh.ch/en/tools/constructive-alignment'
            }
            target="_blank"
          >
            alignment between lecturers and students
          </a>{' '}
          as well as the{' '}
          <a
            href={'https://teachingtools.uzh.ch/en/tools/flipped-classroom'}
            target="_blank"
          >
            Flippeed Classroom
          </a>{' '}
          concept.
        </p>
      </>
    ),
    scenario: (
      <>
        <p>
          You are a lecturer and wish to have a stronger interaction with your
          students during the lecture rather than doing frontal teaching. One
          way of achieving this is to implement the Flipped Classroom design by
          using cases, experiments, discussions or questions within the
          KlickerUZH during the lecture.
        </p>
        <p>
          You can prepare and implement various questions and survey questions
          into the KlickerUZH. These can be activated during the lecture for
          students to answer, enabling them to apply their previously acquired
          knowledge. Additionally, this allows you as the lecturer to identify
          any open questions or areas of confusion based on the results.
          Furthermore, the KlickerUZH platform can be used by students to ask
          questions about the material they prepared beforehand, providing an
          alternative to asking questions in person. The lecturer can then
          directly respond to these questions. For more information on student
          questions during lectures, have a look at our use case on Live Q&A.
        </p>
      </>
    ),
    learnings: (
      <>
        <p>
          After its beta release in spring 2023, KlickerUZH has been evaluated
          in Flipped Classroom sessions in the ETH lecture “Netzwerke und
          Schaltungen II”. Each session consisted of experiments and 10 to 15
          KlickerUZH questions which were used to evaluate the comprehension of
          self-learning materials, as well as to explain and discuss the studied
          topics more in-depth. Some of the most important learnings regarding
          the setup of Flipped Classroom sessions with the KlickerUZH based on
          this evaluation are the following:
        </p>
        <ul>
          <li>
            Preparation of the student: It is crucial for students to engage in
            self-learning and familiarize themselves with the learning materials
            before attending the lecture to maximize their takeaway from the
            session.
          </li>
          <li>
            Self-selection: There can be a high effect of self-selection,
            especially if classroom sessions are optional, meaning that students
            do not show up for sessions if they are not prepared. Vice versa,
            students attending class tend to be motivated to discuss the
            materials.
          </li>
          <li>
            Time consumption in the lecture: Each question being polled
            throughout the session requires a sufficient time slot to be
            appropriately polled and discussed. A good question can lead to 5 to
            10 minutes of discussion, depending on the scope of the problem
            being asked.
          </li>
          <li>
            Pre-lecture time consumption: The lecturer needs time to create and
            implement the questions in KlickerUZH before the lecture. "Good
            things take time" also applies here. Even experienced authors
            typically anticipate spending an average of one hour to produce a
            single multiple-choice question in exam quality{' '}
            <mark>(Krebs, 2004)</mark>. This time is necessary to carefully
            consider the formulation of the question, select the answer options
            precisely, and avoid potential pitfalls. This conscientious approach
            ensures that the questions align with the desired learning outcomes
            and provide students with an appropriate level of challenge.
          </li>
          <li>
            Room for discussion: Questions used in the quiz should be designed
            such that they leave enough room for discussion and further
            explanation.
          </li>
          <li>
            Grading: It could be an option to make participation in sessions
            and/or passing of quizzes before or during sessions mandatory or
            part of the grade. However, this could also negatively influence the
            openness of the discussions. Mi
          </li>
        </ul>
      </>
    ),
  },
  microlearning: {
    title: 'Microlearning',
    headerImgSrc: '/img_v3/markus-winkler-afW1hht0NSs-unsplash.jpg',
    tags: [
      'Mobile learning',
      'Repetition opportunity',
      'Active learning',
      'Long-term knowledge retention',
      'Compact learning units',
      'Accessible repetition',
      'Efficient knowledge transfer',
      'Flexible and informal learning',
    ],
    goals: [
      'Make studying more accessible for students by encouraging mobile learning.',
      'Encourage active learning and student engagement beyond the classroom by integrating it into students’ everyday lives.',
      'Improve accessibility and availability of learning content.',
      'Promote long-term knowledge-retention.',
      'Provide timely feedback and help students understand where they stand and address any concerns they may have.',
    ],
    introduction: (
      <>
        <p>
          Everyday student life often follows this pattern: Despite knowing the
          importance of carefully reviewing lectures, consistent preparation and
          reviewing often falls behind. Students usually have to spend a lot of
          time recapitulating the material in a short time period before the
          exam. But what if there was an efficient and modern way to tackle this
          problem and to encourage regular repetition?
        </p>
        <p>
          This is exactly where the microlearning concept kicks in.
          Microlearning is a teaching approach characterized by delivering
          concise and focused units of learning material, often in the form of
          short activities. It refers to sessions ranging from several seconds
          to 15 minutes (Buchem & Hamelmann, 2010) and from 30 seconds to five
          minutes according to Jahnke et al. (2020). Generally, an average
          between the two is used. Such short durations have two main
          advantages: (1) they can be completed at convenient times of a busy
          day, for example, while commuting or during a lunch break, and (2)
          learners are likely to stay focused for the entire session since it
          does not extend their relatively short average attention spans.
        </p>
        <p>
          Microlearning is designed to counter the effects of the ‘Forgetting
          Curve’, according to which our ability to retain information rapidly
          declines after twenty minutes.  It offers students the opportunity to
          consume knowledge in compact units, often directly on their
          smartphones. The most important content from lectures is presented
          briefly and precisely. With targeted questions, students can test
          themselves, refresh and consolidate their knowledge - regardless of
          time and place.
        </p>
      </>
    ),
    background: (
      <>
        <p>
          Microlearning leads to an efficient and sustainable transfer of
          knowledge. This can be shown by several studies:
        </p>
        <p>
          For example, Gassler et al. (2004) show that better accessibility to
          learning content, e.g., via smartphone, motivates students to actually
          use the learning platforms and integrate them into their everyday
          lives. Regular repetition of learning units can counteract the
          ‘Forgetting Curve’ and promote long-term retention of knowledge.
        </p>
        <p>
          Another important aspect of microlearning is the short and easily
          digestible learning sessions. Due to the small portions in which the
          learning content is served, the learning material can be better
          processed, and information overload can thus be prevented, much to the
          benefit of the students and their learning outcome (Bruck et al.,
          2012).
        </p>
        <p>
          Overall, microlearning is a crucial step in closing the gap between
          formal learning, such as in universities and schools, and informal
          learning via digital channels, such as with smartphones (Buchem &
          Hamelmann, 2010). This step enables flexible learning and sets new
          accents for the learning experience in the digital age.
        </p>
      </>
    ),
    scenario: (
      <>
        <p>
          As a lecturer you would like to allow your students to revise what
          they heard in your lecture after the lecture outside of the classroom.
          Therefore, you decide to provide your students with microlearning
          questions which you can provide via the KlickerUZH on the mobile app.
        </p>
        <p>
          To enhance student motivation and engagement, microlearning sessions
          are designed to include concise summaries and visual illustrations of
          key concepts. It is recommended to limit the question set to a range
          of five to ten questions. In order to incentivize student
          participation, microlearning sessions can be made available for a
          specific duration at fixed intervals throughout the week, such as one
          day after the corresponding lecture.
        </p>
        <p>
          Since the questions are meant to be answered whenever students find
          time to do so, the level of difficulty should not be too elevated.
          Nevertheless, these short learning sequences have a positive effect on
          concentration and thus promote your long-term knowledge absorption. In
          this context the questions posed should have a clear answer.
        </p>
        <p>
          If you wish to do so, the microlearning sessions can be incorporated
          into a gamification context where students are rewarded for engaging
          in these questions (if correct). Students can collect bonus points if
          they complete the question set within the selected timeframe.
        </p>
      </>
    ),
    learnings: (
      <>
        <p>
          KlickerUZH Microlearning has been implemented in two large-scale
          first-year lectures, accommodating up to 800 students, as well as in
          bachelor courses at the University of Zurich since 2022. In order to
          assess the effectiveness of this microlearning approach in higher
          education, we conducted an internal surveys with a sample size of 63
          participants. Please note that the results presented here are based on
          qualitative feedback and are not derived from a statistically
          significant dataset or formal analysis. In addition to the survey
          data, we also gathered insights from lecturers and content creators to
          further enhance our understanding. Based on this collective input, the
          following learnings have emerged:
        </p>
        <ul>
          <li>
            Anywhere: When creating microlearning questions, ensure they can be
            answered without the need for a calculator, any other tool or
            reference materials, allowing students to engage with the content
            anywhere.
          </li>
          <li>
            Motivation and better understanding: Results indicate that students
            generally have a positive attitude towards microlearnings. In the
            internal survey, a majority of the participants, specifically 72%,
            expressed that engaging with the microlearning content increased
            their motivation to review the learning material. An even greater
            number claimed microlearning helped them remember and understand the
            material (87.0% of those who completed a session). Participants
            mentioned they found it very helpful to revise the material on a
            weekly basis and see whether they had understood the concepts. It
            was even requested to increase the number of questions in the
            microlearning sessions, which currently lay at 3.75 questions per
            microlearning.
          </li>
          <li>
            Level of difficulty: While some students have criticized that the
            questions are not of an exam-level difficulty, it is important to
            clarify in advance that the purpose of these questions is to
            facilitate repetition and enhance long-term retention of knowledge,
            rather than to directly prepare students for exams.
          </li>
          <li>
            Alignment to lecture content: Microlearning questions need to match
            the lecture content. If the originally planned content is not
            covered by the lecturer during the lecture, the questions may need
            to be rescheduled for the following week.
          </li>
          <li>
            Investment: Creating new weekly microlearning questions can be quite
            time-consuming, but the benefits of promoting active learning and
            retention make it worthwhile.
          </li>
          <li>
            Regularity: To ensure the effectiveness of microlearning, it is
            essential to schedule regular question sessions to provide ongoing
            practice and reinforcement of the course material. However, some
            students expressed a preference for having the microlearnings
            available continuously, rather than within a fixed time window.
          </li>
          <li>
            Integration of microlearning into LMS: To accommodate students who
            missed the microlearning sessions, we integrated the questions into
            the learning management system (OLAT) some days after the
            microlearning session. This enabled students to access and engage
            with the questions, even if they couldn't attend the microlearning
            sessions.
          </li>
        </ul>
      </>
    ),
  },
  practice_quiz: {
    title: 'Practice Quiz, Flashcards, and Spaced Repetition',
    headerImgSrc: '/img_v3/dan-freeman-WHPsxhB4mWQ-unsplash.jpg',
    tags: [
      'Repeated learning',
      'Sustained memoriation',
      'Individual needs',
      'Student engagement',
      'Regular and spaced learning',
      'Flashcards',
      'Immediate feedback',
      'Active learning',
    ],
    goals: [
      'Provide an opportunity for students to engage in asynchronous learning, allowing them to learn at their own pace.',
      'Assess and monitor learning progress and helping students assess the understanding of the course material and monitor the progress in learning over time. By completing the practice quizzes, students can identify areas of strength and areas that require further study.',
      'Provides a streamlined and familiar interface for students to access and complete the quizzes in the LMS.',
    ],
    introduction: (
      <>
        <p>
          "How well do I understand a topic?" - A phrase most students are all
          too familiar with. Practice questions serve as a valuable tool for
          students to practice and apply their understanding of a topic. While a
          topic may seem simple when heard or read, the actual application can
          pose challenges. By engaging with practice questions, students have
          the opportunity to bridge the gap between theory and application. This
          process fosters a deeper comprehension of the subject matter, and
          helps identify any gaps in knowledge. Regularly practicing questions
          equips students with the necessary skills and familiarity with the
          format, preparing them for assessments and improving overall learning
          outcomes.
        </p>
        <p>
          The practice quiz activity in KlickerUZH allows for asynchronous
          learning with longer question sets (also including flashcards) that
          specifically target modules or topics and that can be embedded within
          Learning Management Systems (LMS) like OLAT.
        </p>
      </>
    ),
    background: (
      <>
        <p>
          For sustainable learning to occur, information entering the short-term
          memory must be transferred to the long-term memory. Sustainable
          learning largely depends on two aspects: the meaning and sense of the
          information, as well as the time it is processed by our brain. To
          maximize sustainable learning, therefore, one can either increase the
          relevance, ensure an individual’s understanding, or raise repetition
          and reinforcement and thus the processing time. (Sousa, 2022) Not only
          is the time relevant but also the number of confrontations with the
          information: ‘exposure effects’ positively influence the probability
          of retention (Johnson & Hasher, 1987). Information becomes more likely
          to pass to long-term memory areas and to be recalled through stronger
          fibre connections.
        </p>
        <p>
          When the learning content is repeated at regular intervals, the
          so-called spacing effect is created, which improves memory and enables
          students to internalize their knowledge not only in the short term,
          but in the long term (Cepeda et al., 2006).
        </p>
        <p>
          Kornell's (2009) research looks at the spacing effect in the context
          of flashcards and explains the benefit of spaced learning by repeating
          information in different time, physical, and mental contexts. This
          leads to a richer and more varied process of knowledge acquisition in
          contrast to massing (repeating content in short, intensive sessions
          with a large amount of information) or cramming (learning a massive
          amount of material just before the exam).
        </p>
        <p>
          Overall, the research results show that with the help of spaced
          learning, students are not only well prepared for the next exam, but
          are also able to benefit from the learned knowledge in their academic
          and professional careers long after the exam.
        </p>
      </>
    ),
    scenario: (
      <>
        <p>
          You are a lecturer and would like to provide your students with an
          opportunity to revisit the lecture content after the lecture.
          Therefore, you decide to provide practice quizzes via the KlickerUZH,
          thanks to which your students can review and study online, using the
          KlickerUZH app, webpage or even the integration into the LMS. These
          learning activities have no restrictions on when or how often they can
          be completed. Furthermore, the questions within each set can be shown
          in sequence, shuffled, or ordered based on the date of the last
          response, providing varied experiences for students. The KlickerUZH
          supports the following question types – many of which are used in an
          exam setting: Single Choice (SC), Multiple Choice (MC), Kprim (KPRIM),
          Free Text (FT), and Numerical Response (NR). Additionally, the
          KlickerUZH offers flashcards (question with an interface to enter an
          answer, but with a sample solution) that make regular repetition of
          the course content easy and accessible.
        </p>
        <p>
          For all choice-based question types as well as for the numerical
          response, after answering a question, students not only receive
          feedback on their own response (correct or incorrect and why) but also
          gain insight into the distribution of answers among their peers. This
          allows them to observe common mistakes that others have made, and
          identify the level of difficulty of the question.
        </p>
        <p>
          ShapeWhen using gamification, the time frame in which points can be
          collected from responding to the questions can be customized to, e.g.,
          once a week or day.
        </p>
      </>
    ),
    learnings: (
      <>
        <p>
          The inclusion of practice questions for knowledge assessment and exam
          preparation has been a long-standing practice. Previously at DBF,
          practice questions were integrated into the Learning Management System
          (LMS), while flashcards were made available through card2brain (an
          external app). Furthermore, we conducted an analysis of data from the
          pilot lectures, namely Banking and Finance I and Banking and Finance
          II, during the autumn semester of 2022 and the spring semester of
          2023. Based on these experiences, the following insights have emerged:
        </p>
        <ul>
          <li>
            High participation: According to our own analysis, around 75% of all
            students enrolled in the courses engaged with the practice quizzes
            in the LMS. This is almost double as high as students completing the
            microlearning.
          </li>
          <li>
            Peak: Striking is the over-proportional increase in total question
            entries between weeks 12 and 15, just before the exam. The number of
            users solving questions in this period is approximately double the
            number solving questions in the second week and the total number of
            questions solved is more than 5 times the start values; it becomes
            clear to see when exam preparation peaked.
          </li>
          <li>
            Gamification increased participation: First evaluation based on
            multiple questions in the self-learning on OLAT, the questions were
            identical (number and content) in the autumn semester 2020, 2021 and
            2022. However, in 2022 we included the gamification approach and
            added microlearnings on the course level. We saw higher access
            numbers, more repetition across all students as well as more
            repetition per student (fall 20/21: Average: 1.96x per student,
            maximum: 21x vs. fall 2022: Average: 2.45x per student, Maximum:
            41x).
          </li>
          <li>
            Repetition as the key performance factor in the mock exam: The most
            significant positive correlation with good performance in a mock
            exam in Banking and Finance II lies in the number of question
            entries, much more so than in their accuracy or the completed range
            across all available questions. High numbers of question entries
            also correlate the most strongly with high leaderboard points,
            leading to the conclusion that a high engagement level is the
            crucial factor influencing both the mock exam and leaderboard
            points. The reason for this may lie in the fact that answering many
            questions more than once (which is necessary to achieve a high total
            question entry count), means students are repeating information.
            Thus, repetition priming by drawing upon and reusing already
            established neural connections is key to success.
          </li>
          <li>
            Devices: The majority (85%) of the students participated in the
            practice quizzes by using their laptop.
          </li>
          <li>
            Quick win: If you already have practice questions in another tool
            (e.g., OLAT), you can easily implement them into the KlickerUZH.
            This allows you to leverage the advantages of peer answer
            distributions and the integration into the optional gamification
            course concept.
          </li>
        </ul>
      </>
    ),
  },
  group_activity: {
    title: 'Group Activities',
    headerImgSrc: '/img_v3/marvin-meyer-SYTO3xs06fU-unsplash.jpg',
    tags: [
      'Group collaborations',
      'Teamwork skills',
      'Cooperative learning',
      'Real-world application',
      'Practical insights',
      'Interpersonal relationships',
      'Problem-solving skills',
      'Effective communication',
      'Successful professional development',
    ],
    goals: [
      "Promote and strengthen group collaborations among students, encouraging them to work together as a team and profit from each other's skills and perspectives.",
      'Offer practical insights and provide students with real-world scenarios where they can apply their knowledge, skills, and teamwork outside of the traditional lecture setting.',
      'Enable students to develop (transversal) teamwork skills and learn to collaborate efficiently as a group.',
      'Prepare students for future professional challenges requiring collaboration and teamwork.',
    ],
    introduction: (
      <>
        <p>
          Group activities involve collaborative work in small teams to achieve
          shared objectives, offering numerous benefits. They enhance students'
          creative, problem-solving, and critical thinking abilities by
          leveraging collective knowledge and experiences. Additionally, group
          activities promote strong communication skills through idea sharing
          and meaningful discussions, expanding perspectives and deepening
          understanding. Students also develop a sense of shared responsibility
          and accountability, learning effective collaboration, task management,
          and meeting deadlines. By navigating diverse opinions and resolving
          conflicts, students cultivate effective communication strategies.
          These experiences prepare them for success in academic and
          professional contexts where collaboration is essential.
        </p>
        <p>
          However, incorporating group projects into lectures presents a
          significant challenge, particularly in large courses, despite
          acknowledging their immense importance as mentioned earlier.
          KlickerUZH offers a solution by facilitating group activities and
          tasks that extend over a lecture or spread over a longer period of
          time. It supports various aspects such as group formation,
          distributing the initial situation, and implementing the corresponding
          questions. Within the KlickerUZH, students have the freedom to form
          their own groups, enabling them to collaboratively tackle the assigned
          tasks. This ensures that teamwork is no longer neglected, even in
          large study courses.
        </p>
      </>
    ),
    background: (
      <>
        <p>
          It is no coincidence that cooperative learning is one of the
          predominant teaching methods worldwide. The positive attributes of
          this form of instruction are many and not only influence student
          motivation and achievement, but also strengthen interpersonal
          relationships among learners (Johnson & Johnson, 2009).
        </p>
        <p>
          Through the KlickerUZH, students are encouraged to tackle a challenge
          together and work out solutions as a team. This not only enhances
          students' problem-solving skills, but also provides an opportunity to
          develop creative skills (Hämäläinen & Vähäsantanen, 2011). Students
          learn how to communicate effectively and share their ideas to be
          successful in a team and achieve common goals. Binkley et al. (2011)
          demonstrated that these social skills play a crucial role in the
          contemporary work environment, enabling students to effectively
          prepare for their careers and thrive in a highly interconnected
          society. These skills are invaluable for fostering successful
          professional development and adaptation.
        </p>
        <p>
          For more information on the benefits of{' '}
          <a
            href="https://teachingtools.uzh.ch/en/tools/gruppenarbeiten"
            target="_blank"
          >
            group work
          </a>{' '}
          as well as the
          <a
            href="https://teachingtools.uzh.ch/en/tools/methoden-zur-gruppenbildung"
            target="_blank"
          >
            methods to make group formation a success
          </a>
          , please go to UZH Teaching Tools.
        </p>
      </>
    ),
    scenario: (
      <>
        <p>
          As a lecturer you would like to strengthen group collaborations and
          see value in having your students work together. Therefore, you decide
          to use the KlickerUZH to provide Group Activities where students can
          sign up as groups (of at least two people) and work on the provided
          tasks together. This can be done during the lecture for smaller tasks
          or alternatively for a longer period of time during which students can
          work on a more complex assignment. The following question types can be
          implemented: Single Choice (SC), Multiple Choice (MC), Kprim (KPRIM),
          Free Text (FT), and Numerical Response (NR). This is a great
          opportunity if you want to enable students to have an insight into
          practical considerations and tasks which they can work on as a team,
          outside of the traditional lecture.
        </p>
        <p>
          The teamwork is further encouraged thanks to distributed information.
          When providing group activities via the KlickerUZH the necessary
          information needed to solve the task can be distributed between the
          team members so that they are required to work together and exchange
          information and ideas.
        </p>
        <p>
          If you wish to do so, the group activities can be incorporated into a
          gamification context where students are rewarded for engaging in these
          tasks.
        </p>
      </>
    ),
    learnings: (
      <>
        <p>
          These kinds of group activities have been implemented in two large
          first-year lectures at the DBF in 2022 / 2023, with up to 800
          students. In these lectures, students had the opportunity to engage in
          exercises related to real-world scenarios, focused on topics such as
          company valuation, bonds, shares, and portfolio optimization (as soon
          as the respective topic was covered in the lecture). Each team member
          was provided with a portion of the information needed to solve the
          exercise, resulting in the complete information being available to the
          group as a whole. The goal was for students to collaborate, analyze
          the given data and questions, and make decisions collectively. After
          submitting their calculations and thoughts, the Teaching Center of the
          DBF provided personalized feedback. Participation in these group
          activities was incorporated as part of the lecture's gamification
          concept, therefore, groups that took part in these exercises were
          rewarded with points.
        </p>
        <p>Our learning was the following:</p>
        <ul>
          <li>
            Number of groups: Since the group activity was optional and the
            assessment courses demanded significant attention from students,
            only a limited number of groups participated in the group activities
            (autumn semester: 23 groups and spring semester: 6 groups). It is
            worth considering that there may be more suitable lectures or
            courses that offer better opportunities for integrating group tasks,
            given the specific circumstances and requirements.
          </li>
          <li>
            Student feedback: In the internal survey, only 20.63% claimed they
            had joined a group. Of those students who did not select “no
            opinion” in the question regarding their view on the group
            challenges, 28.6% found them cool, but 25.71% voted unnecessary.
            This, again, shows that a select few like the group setting and the
            extra efforts, but many see no added value with twice as many
            claiming the challenges are too much effort than requiring the right
            amount of effort.
          </li>
          <li>
            Real-world scenarios: The lecture focused on theory, while the group
            activity involved working with real data sourced from annual reports
            or price data from sources like Yahoo Finance. Careful consideration
            was given when selecting companies and data, recognizing that
            real-world scenarios can be complex. Simplification may be necessary
            to make the exercises more manageable within the scope of the
            course.
          </li>
          <li>
            Grading: KlickerUZH enables automatic grading for choice-based
            question types. However, for numerical response and free text
            questions, manual correction is required. It is crucial to consider
            the time and effort needed for manual grading as part of the overall
            lecture planning process.
          </li>
          <li>
            Discussion of results: Given the nature of real-life problems, there
            may not always be a single solution. This aspect needs to be
            considered during the correction process and feedback writing.
            Flexibility and consideration for different approaches or
            interpretations are often required when assessing the results of
            group activities based on real-world scenarios.
          </li>
        </ul>
      </>
    ),
  },
  live_qa: {
    title: 'Live Q&A',
    headerImgSrc: '/img_v3/volodymyr-hryshchenko-V5vqWC9gyEU-unsplash.jpg',
    tags: [
      'Large class',
      'Interactive lecture',
      'Anonymous Channel',
      'Quick feedback',
      'Continuous dialogue',
      'Encourage student participation',
      'Efficient Q&A workflow',
      'Identfying common questions and problems',
    ],
    goals: [
      'Encourage students to ask questions by providing them with an anonymous channel.',
      'Enable students to get answers to questions as soon as they come up instead of postponing them (e.g., to forum posts).',
      'Make remote participants feel included by allowing them to ask questions during lectures.',
      'Enable lecturers and their team to provide rapid feedback on incoming questions.',
      'Improve the efficiency of the Q&A workflow by batching questions (in sessions, with upvotes, etc.).',
    ],
    introduction: (
      <>
        <p>
          In order to maintain a continuous dialog with the students, it is
          important to give them space to ask questions. However, many students
          may hesitate to contribute verbally in front of their peers,
          especially in large courses. This can be for a variety of reasons,
          from shame and insecurity to fear that their questions might seem
          trivial.
        </p>
        <p>
          With the KlickerUZH, students can ask their questions anonymously
          during the lecture. They can discuss their issues in a secure
          environment and express their uncertainties unashamedly. For the
          lecturers, the KlickerUZH serves as a helpful tool to keep an overview
          of the knowledge of their students and to see where there are any
          comprehension problems. It is up to the lecturers whether they make
          the questions visible to all and promote interaction among the
          students or whether they answer the questions in a pre-selected
          manner.
        </p>
        <p>
          With this approach, the KlickerUZH creates a connection between
          lecturers and students and promotes an open and inclusive learning
          environment in which questions and discussions are actively
          encouraged.
        </p>
      </>
    ),
    background: (
      <>
        <p>
          Asking questions undoubtedly promotes learning and understanding. But
          what exactly makes the dialogue between lecturers and students so
          effective and successful?
        </p>
        <p>
          In an anonymous setting, such as the KlickerUZH provides, a safe
          environment is created for students which has been shown to encourage
          student participation (Roberts & Rajah-Kanagasabai, 2013).
        </p>
        <p>
          Tan et al. (2020) show further advantages of such Q&A sessions, which
          affect not only students but also lecturers. Namely, Q&A provides an
          efficient way to identify students' most common questions and problems
          and answer them directly in the lecture for everyone, rather than
          individually after the lecture.
        </p>
        <p>
          With regard to large lectures with hundreds of students, the research
          of Exeter et al. (2010) show that the interaction with students as in
          the setting of smaller classes can be very supportive. Thus, it is
          important to create a platform where students can ask questions easily
          and feel well taken care of, as in small classes. This motivates
          students, allows them to process the course material better and,
          ideally, stimulates their critical thinking by engaging with the
          course topic.
        </p>
      </>
    ),
    scenario: (
      <>
        <p>
          You are a lecturer delivering large-class lectures with limited
          opportunities for personal interaction. To enable students to interact
          with you in a more approachable way even if they participate online,
          you start a session in the KlickerUZH and enable the anonymous Q&A
          channel. Throughout the lecture, students access the Q&A channel on
          their own devices to post new questions or upvote existing ones.
          Depending on your preference, you can choose either the unmoderated
          Q&A channel, where questions are immediately available for interaction
          by all participants, or enable moderation to pre-approve incoming
          questions before they are visible to others.
        </p>
        <p>
          You have the option to respond to questions during the lecture, either
          immediately or after briefly reviewing them during a break.
          Alternatively, if you have a teaching assistant, they can provide
          prompt responses to straightforward questions. Any particularly
          important or challenging questions that require more in-depth answers
          can be pinned to the lecturer cockpit, allowing you to address them
          orally during the lecture. At the end of the lecture, you export the
          questions and answers from the Q&A channel and post them to the
          learning management system (LMS), ensuring that students can access
          and review your responses even after the lecture ends.
        </p>
        <p>
          While KlickerUZH employs gamification to incentivize various
          activities, it's important to highlight that the live Q&A feature
          operates differently compared to other learning activities. The aim is
          to foster active participation and meaningful knowledge sharing,
          rather than encouraging questions solely for the sake of earning
          points. Therefore, no points are awarded for asking questions during
          live Q&A sessions.
        </p>
      </>
    ),
    learnings: (
      <>
        <p>
          The KlickerUZH Q&A has been successfully implemented in various large
          lectures at UZH, including classes with up to 1,000 students, since
          its inception in 2021. In order to assess the effectiveness of the Q&A
          approach in university teaching, two surveys were conducted in 2021
          and 2022. One survey was distributed to the lecturers who integrated
          the live Q&A feature (n=5 lecturers), while the other survey was
          displayed to students during the live Q&A through a banner (n=29
          students). The insights gained from these surveys, along with valuable
          inputs from lecturers and content creators, have yielded the following
          valuable learnings:
        </p>
        <ul>
          <li>
            Moderation: In very large lectures, moderation of the Q&A channel
            becomes crucial due to the high volume of questions, including
            irrelevant ones. Moderation enables the filtering and approval of
            questions before they are visible to other participants, ensuring
            that only relevant and meaningful questions are addressed and
            displayed.
          </li>
          <li>
            Participation level: The participation level in the Q&A channel
            tends to be higher in larger lectures (500-800 students) compared to
            the smaller lectures (200 students). In the large assessment
            lectures based on our internal survey, more than half of the
            participants claimed to have posted questions in the Q&A in at least
            one lecture, 73% of these did so in 1-4 lectures during the
            semester.
          </li>
          <li>
            Effort to manage the Q&A channel: According to survey responses from
            lecturers, the effort required to manage the Q&A channel is
            considered valuable and worthwhile. Lecturers recognize the benefits
            of engaging with students through the Q&A functionality and find it
            beneficial for enhancing the learning experience.
          </li>
          <li>
            Continuing to use: All surveyed lecturers expressed a high
            likelihood, whether likely or extremely likely, to continue using
            the Q&A functionality in their future teaching. This suggests the
            positive impact and value that the Q&A channel brings to their
            instructional practices.
          </li>
          <li>
            Time consumption: Answering questions orally during class takes
            time. It is helpful not to answer questions too frequently so as not
            to disrupt the flow of the lesson.
          </li>
          <li>
            Interaction by students: Findings from the survey indicate that
            around 45% of students actively read or upvoted existing questions,
            indicating engagement with the Q&A channel. Additionally, 22% of
            students posted their own questions, showing active participation.
            Only a small percentage (5%) of students had not yet heard of the
            Q&A channel, suggesting a widespread awareness among the student
            population.
          </li>
          <li>
            Student feedback: Feedback from students indicates a positive
            perception of the Klicker Q&A functionality, with students
            acknowledging its benefits in improving their understanding of the
            lecture contents. The Q&A channel has provided a platform for
            students to seek clarification, receive answers to their questions,
            and gain a deeper understanding of the subject matter.
          </li>
          <li>
            In November 2021, lecturers using the KlickerUZH Live Q&A
            functionality have received over 400 questions, about 150 of which
            were resolved with a response through the tool. 62 were resolved
            without a response (e.g., orally or implicitly), and 68 were deleted
            (e.g., because of their irrelevance). The length of feedback
            responses ranged from extensive 530 character explanations to single
            words like "No".
          </li>
        </ul>
      </>
    ),
  },
  gamification: {
    title: 'Gamification',
    headerImgSrc: '/img_v3/brands-people-ZdqSuxl3Lak-unsplash.jpg',
    tags: [
      'Engagement and motivation',
      'Active participation',
      'Playful learning',
      'Challenge/reward system',
      'Competition and prizes',
      'Immediate feedback and recognition',
      'Increased interest and achievement',
      'Dynamic and enriching educational experience',
    ],
    goals: [
      'Enhance engagement and motivation by incorporating game elements into learning experience.',
      'Encourage active participation and involvement of students in the lecture.',
      'Increase motivation by incorporating a challenge/reward system throughout the lecture including points, groups and group activities, badges / achievements, levels, and prizes.',
      'Enhance the learning experience by creating a dynamic and immersive learning environment where students can interact with the course material in a more engaging way.',
      'Provide opportunities for healthy competition, encouraging students to strive for achievements, rewards, or higher scores, which can drive their learning progress.',
      "Offer immediate feedback, rewards, and recognition for accomplishments, supporting students' progress and growth.",
    ],
    introduction: (
      <>
        <p>
          Gamification is the integration of game-typical elements to
          educational contexts (Deterding et al., 2011). By incorporating these
          game elements, gamification aims to create a more interactive and
          immersive environment, where students actively participate, compete,
          and explore course content. It leverages intrinsic motivators, such as
          curiosity, competition, and a sense of achievement, to foster deeper
          learning, retention of knowledge, and the development of skills.
        </p>
        <p>
          As an exemplary framework to implement gamification, Nah et al. (2014)
          propose the following design elements after reviewing 15 papers on the
          literature on gamification. In addition to the eight elements, it is
          important to keep in mind that Khurana and Kumar (2012) find a crucial
          factor for determining the success of the gamified content in
          improving student performance is the inclusion of ‘fun’. This is not
          surprising – if ever a non-compulsory game stops being fun, players
          will stop playing it.
        </p>
        <table>
          <thead>
            <tr>
              <th className="p-2">Design Element</th>
              <th>Explanation</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="p-2">Points</td>
              <td>
                Measure success and progress, potentially leading to rewards
              </td>
            </tr>
            <tr>
              <td className="p-2">Levels / Stages</td>
              <td>
                Players can progress throughout the game with levels increasing
                in difficulty
              </td>
            </tr>
            <tr>
              <td className="p-2">Badges</td>
              <td>
                Mark special achievements or acomplishments, useful for looking
                into the future
              </td>
            </tr>
            <tr>
              <td className="p-2">Leaderboards</td>
              <td>
                Create a competitive setting, often show only a limited number
                of participants to avoid demotivation
              </td>
            </tr>
            <tr>
              <td className="p-2">Prizes and Rewards</td>
              <td>
                Serves as motivation, generally better to receive many small
                rewards than one big one
              </td>
            </tr>
            <tr>
              <td className="p-2">Progress Bars</td>
              <td>Track progress towards overall or individual goals</td>
            </tr>
            <tr>
              <td className="p-2">Storyline</td>
              <td>Narrative for learning context and consistent motivation</td>
            </tr>
            <tr>
              <td className="p-2">Feedback</td>
              <td>The more frequent and concise, the better</td>
            </tr>
          </tbody>
        </table>
        <p>
          All the afore-mentioned design elements are seamlessly integrated into
          KlickerUZH and can be utilized at the course level, with many of them
          applicable to specific live quizzes as well. This approach not only
          motivates students, but also encourages deeper engagement with course
          content in a way that is not only educational, but also entertaining.
        </p>
      </>
    ),
    background: (
      <>
        <p>
          A number of studies show promising findings with regard to
          gamification. For instance, research by Sailer & Homner (2020)
          investigates the effect of gamification on cognitive and behavioral
          learning outcomes. The results showed that gamified learning not only
          improves students' cognitive skills, but also positively influences
          their behavior in the learning environment. In this regard, the
          challenging aspect of gamification has a motivating effect on students
          and may be evidenced by an increased interest in the learning content.
        </p>
        <p>
          But what are the effects of gamification in large classes? Especially
          in a big class, it is often a challenge to ensure the engagement of
          individual students and to keep them motivated. The element of
          gamification can help in this regard. Gamification can create a
          playful and competitive environment that encourages student engagement
          and, accordingly, leads to higher achievement as a study of Stott &
          Neustaedte (2013) shows.
        </p>
        <p>
          Ultimately, the application of gamification in large classes allows
          for an enriching and motivating learning environment that has the
          potential to create a dynamic atmosphere and sustainably improve the
          educational experience for students.
        </p>
      </>
    ),
    scenario: (
      <>
        <p>
          You are a lecturer and wish to add gamification elements to your
          lecture. KlickerUZH allows this either at the course level or by
          implementing gamification into specific live quizzes (for the later,
          see the use case on the (gamified) live quizzes).
        </p>
        <p>
          At the course level, KlickerUZH incorporates an optional challenge
          system that allows students to actively engage in the course
          throughout the semester or a self-selected period. Students can create
          an avatar and earn points by actively engaging in the course, whether
          through participation in live or practice quizzes, microlearnings or
          by completing group activities. These points are displayed on a course
          leaderboard, showcasing the top 10 students as well as a participant's
          individual ranking within the challenge. However, a participant's
          individual ranking within the challenge is only visible to themselves
          and not shared with other students. Within a course, students can also
          form groups to check how their peers are doing with regard to their
          ranking and take part in collaborative group activities. Based on the
          points achieved there are levels which can be reached and that
          increases their motivation to engage in the course.
        </p>
        <p>
          In addition to the challenge system, the KlickerUZH offers a design
          for a storyline and visual aspects that can be integrated optionally.
        </p>
        <p>
          Lecturers have the freedom to further personalize the implementation
          of gamification elements according to their preferences. They can
          award achievements to recognize individual participants'
          accomplishments (e.g., Team spirit for taking part in a group
          activity) or giving gifts or rewards to further incentivize students'
          engagement and participation.
        </p>
        <p>
          To ensure easy accessibility and improve participation, it is
          recommended to prepare a semester-long timeline outlining the gamified
          learning activities in KlickerUZH and the challenge details (e.g., if
          there are any awards for winning the challenge). This provides
          students with a clear understanding of what to expect during the
          semester, including when and where they can earn points to progress in
          the competition. If these elements are clear, students could end up
          frustrated and quit playing.
        </p>
      </>
    ),
    learnings: (
      <>
        <p>
          The gamification concept has been successfully implemented in two
          large first-year lectures, accommodating up to 800 students (Banking
          and Finance I and II), as well as two bachelor courses at the
          University of Zurich during the autumn semester of 2022 and the spring
          semester of 2023. The integration of various activities aimed to
          create a fully gamified lecture. To evaluate the effectiveness of this
          approach, multiple sources were utilized for the conclusion. This
          included an end-of-semester course evaluation completed by the
          students, an internal survey distributed to the students of the latter
          lecture (n=63), as well as valuable input from lecturers and content
          creators. Furthermore, in the second course, a mock exam was
          administered and corrected, and the points achieved in the mock exam
          were considered in conjunction with student participation in the BF
          challenge. These multiple sources of information provided a
          comprehensive perspective on the outcomes of the gamified approach:
        </p>
        <ul>
          <li>
            Student feedback: 89.1% of participants claimed the full KlickerUZH
            concept helped them understand the learning content and 74.6% found
            the concept fun. These statistics are very encouraging to see; many
            students explicitly expressed their gratitude for the concept and
            named it the “best learning environment in the assessment!". 79.4%
            would like to see it in further lectures as a tool to revise and
            apply the material while interacting with other students. In a
            multiple-choice question, 51.7% found the concept useful and more
            than 20% deem the workload and difficulty appropriate. These results
            indicate the majority of participants find added value in the
            KlickerUZH and would like to engage in the concept in the future.
          </li>
          <li>
            BF Challenge: Even though 89.6% of the students enrolled in Banking
            and Finance II had created a KlickerUZH account, only 25.5% found
            the BF Challenge motivating. At no point in the spring semester did
            more than 40.9% of users join the leaderboard, meaning the pool of
            students who competed for prizes was relatively small. 55.6% of
            KlickerUZH survey participants claimed they had never been active in
            the self-learning environment with the sole objective of receiving
            points and 44% replied they had done so at least once. And 84.1% of
            participants felt the chance at potential prizes did not influence
            the number of points they collected; they would not have collected
            fewer had there been no prizes. This shows that not only were the
            majority of users not interested in the BF Challenge, but they were
            also not ambitious in reaching the top.
          </li>
          <li>
            Account creation: Even though they may not have wanted to compete
            for prizes on the leaderboard, new accounts were created each week
            and the ratio between completely inactive and active users declines
            throughout the spring semester. This shows there was still some
            general incentive to collect points or merely work with an avatar
            throughout the semester since most of the features could have also
            been completed without accounts. Students may have been interested
            to see how they compare to their peers in the leaderboard without
            wanting to compete, or they may have created an account for specific
            features, such as the awarding of points from the mock exam or the
            potential prizes after the two live quizzes.
          </li>
          <li>
            Gamification as a distractor: It is important to recognize that not
            all students may be receptive to gamification. Some individuals may
            have personal preferences or reasons for not enjoying or engaging
            with gamified elements. 4% found the KlickerUZH concept distracting,
            however, none deemed it unnecessary.
          </li>
          <li>
            Top20 users: Though the average user may not have been ambitious in
            climbing the leaderboard, several did stand out as the top20. These
            students participated, on average, in a more extensive range of the
            different features offered, such as the microlearning and mock exam,
            and achieved higher scores in them. More than a quarter of all
            learning element question entries stem from this pool of 5% of
            users; they were more than five times as active as their average
            peer and consistently scored high points not only in the leaderboard
            but also in the mock exam.
          </li>
          <li>
            Link to performance in the mock exam: The most significant positive
            correlation with good performance in the mock exam lies in the
            number of question entries students complete throughout the
            semester, much more so than in their accuracy or the completed range
            across all available questions. High numbers of question entries
            correlate the most strongly with high leaderboard points, too,
            leading to the conclusion that a high engagement level is the
            crucial factor influencing both the mock exam and leaderboard
            points.
          </li>
          <li>
            Peer pressure: The impact of gamification could also be influenced
            by the size of the class and the level of familiarity among
            students. Smaller classes (like the summer school course with around
            40 students) benefit from stronger peer pressure and social
            dynamics, which can enhance the effectiveness of gamification.
          </li>
          <li>
            Overemphasis on competition: While competition can be a motivating
            factor, an excessive focus on rankings and leaderboards may create
            negative effects. Utilizing group activities and emphasizing
            cooperative achievements can help balance competition and
            collaboration.
          </li>
          <li>
            Choose motivational rewards: When implementing rewards, careful
            consideration should be given to selecting appropriate rewards that
            align with students' interests and preferences. Rewards do not need
            to be costly but should be meaningful and incentivize students'
            engagement and participation (this could also be choosing a song
            that is played in the break, or that winner can influence the
            company names / fictional people in an exam question in the future).
          </li>
          <li>
            Lecturer encouragement: Motivational encouragement from the lecturer
            is indeed crucial to foster student participation in gamified
            challenges.
          </li>
          <li>
            Time consumption: Effectively designing gamified experiences
            requires time, resources, and expertise. Poorly executed
            gamification attempts can lead to confusion or disengagement among
            students.
          </li>
        </ul>
      </>
    ),
  },
}
