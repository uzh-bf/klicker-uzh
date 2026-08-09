import Image from '@theme/IdealImage'
import { H3 } from '@uzh-bf/design-system'
import Zoom from 'react-medium-image-zoom'
import 'react-medium-image-zoom/dist/styles.css'

interface FigureProps {
  imgSrc: string
  caption: string
  width?: number
}

function Figure({ imgSrc, caption, width }: FigureProps) {
  return (
    <figure className="m-0 mb-4 mt-2 text-left">
      <Zoom zoomMargin={100}>
        <Image
          img={imgSrc}
          className={'p-1 shadow'}
          style={{ maxWidth: `${width ?? 400}px` }}
        />
      </Zoom>
      <figcaption className="mt-2 text-sm text-gray-600">{caption}</figcaption>
    </figure>
  )
}

export const FEATURES = [
  {
    title: 'Interactive Learning',
    text: 'KlickerUZH offers a range of interactive features such as live quizzes, live Q&A and group activities promoting active student engagement and participation.',
  },
  {
    title: 'Timely Feedback',
    text: 'Instantaneous feedback on questions in a synchronous and asynchronous settings allows students to gauge their understanding and address any misconceptions promptly.',
  },
  {
    title: 'Gamification',
    text: 'With a built-in gamification system, KlickerUZH motivates students to actively participate, earn points, and unlock achievements, fostering a dynamic and rewarding learning environment.',
  },
  {
    title: 'Various Question Types',
    text: 'KlickerUZH supports question types like Single and Multiple Choice (SC/MC), Kprim (KP), Free Text (FT), and Numerical (NR). Questions can be grouped and/or stacked for sequential presentation. Sample solutions and explanations can be provided for all question types, answer-specific feedback for choice-based questions.',
  },
  {
    title: 'Wide Array of Learning Activities',
    text: 'Lecturers have the flexibility to select from five distinct learning activities that suit specific educational objectives and adapt to various teaching methods during live lectures (synchronous learning) or outside of the traditional lecture frame (asynchronous learning).',
  },
  {
    title: 'Course Integration',
    text: 'Courses help to implement KlickerUZH Learning Activities into a lecture structure, enabling lecturers to manage different activities and challenges effectively throughout a semester or over a certain period of time.',
  },
  {
    title: 'LMS Integration',
    text: 'KlickerUZH seamlessly integrates in Learning Management Systems (LMS) like OLAT, making it easy to incorporate into your current teaching setup.',
  },
  {
    title: 'Customization Options',
    text: 'Lecturers have the flexibility to customize quizzes, content, and challenges according to their specific course objectives, ensuring a tailored and targeted learning experience.',
  },
  {
    title: 'Open-Source and Easy to Get Started',
    text: 'KlickerUZH is an open-source project and licensed under the AGPL-3.0. The source code is available on GitHub and can be deployed on your own server. We also provide a hosted version of KlickerUZH, which is free to use for most educational scenarios.',
  },
  // {
  //   title: 'Monitoring and Analytics',
  //   text: 'KlickerUZH provides lecturers with valuable insights and analytics, allowing them to track student progress, identify areas for improvement, and adjust their teaching strategies accordingly.',
  // },
]

export const USE_CASE_CATEGORIES = {
  interaction: {
    title: 'Interaction',
    description:
      'Foster meaningful dialogue and collaboration between students and teachers through synchronous and asynchronous learning activities.',
    useCases: ['live_qa', 'live_quiz', 'group_activity', 'flipped_classroom'],
  },
  engagement: {
    title: 'Engagement',
    description:
      'Promote active learning and sustained student motivation through structured activities and personalized learning paths.',
    useCases: [
      'microlearning',
      'practice_quiz',
      'gamification',
      'learning_analytics',
    ],
  },
  ai_enhanced_learning: {
    title: 'AI-Enhanced Learning',
    description:
      'Support teaching and learning processes with artificial intelligence to provide personalized experiences and reduce administrative overhead.',
    useCases: [
      'ai_practice_content',
      'ai_formative_feedback',
      'chatbot_tutoring',
    ],
  },
}

const ACK_STANDARD =
  'We sincerely thank our collaborators and sponsors on this use case: Swissuniversities for funding the development of this use case as part of the P-8/DISK4U project; the University of Zurich (ULF) and the Department of Finance / Teaching Center for sponsoring the development of KlickerUZH and functionalities related to this use case.'

export const USE_CASES = {
  live_quiz: {
    acknowledgements: ACK_STANDARD,
    title: '(Gamified) Live Quizzes',
    headerImgSrc: '/img/use_cases/towfiqu-barbhuiya-oZuBNC-6E2s-unsplash.jpg',
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
    abstract:
      'Enhance student engagement and participation in large courses through interactive polling and gamified elements, providing a safe and inclusive learning environment.',
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
            rel="noopener"
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
          KlickerUZH. To achieve this, it is essential to carefully plan and
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
            <strong>Knowledge evaluation:</strong> To check whether the students
            have understood the previously learned knowledge, single-choice
            questions with a clear answer are suitable. (Example: What is the
            definition of the Sharpe ratio?)
          </li>
          <li>
            <strong>Surveys:</strong> To obtain students' opinions on the topic
            being covered lecturers can ask questions without right or wrong
            answers. (Example: Which factors influence stock prices the most?).
            As the results are promptly available to you as lecturer, you may
            choose to share the findings with the class to facilitate further
            discourse and interaction.
          </li>
          <li>
            <strong>Estimation questions:</strong> To activate students'
            engagement, questions can be asked without a clear answer. This
            makes students think about the discussed topic and gets them
            directly involved. (Example: Where will the SMI be at the end of
            2023?) Depending on your goals, you can add gamification elements to
            your quizzes. Gamified live quizzes increase student motivation and
            add a fun and competitive component to lectures which can enhance
            students' ambition and motivation. Several questions can be asked
            directly after each other (with a timer) to best create a quiz
            situation. Participants can gather points while responding to
            questions. Points are awarded based on the correctness of the
            answer, as well as the speed/delay between the first correct answer
            and one's own answer (if correct). A leaderboard shows the current
            ranking of participants within the quiz and gathered points are
            transferred to the course leaderboard after the conclusion of the
            quiz (if enabled on a course level). For more information on
            gamification elements in lectures, please consult Gamification.
          </li>
        </ul>
      </>
    ),
    learnings: (
      <>
        <p>
          Since KlickerUZH's initial release and first implementation in 2011,
          the increasing number of user registrations confirms the need for such
          a tool in teaching.
        </p>
        <p>
          At the University of Zurich, KlickerUZH has been used in small, large
          (200-400 students), and very large (800-1500 students) lectures since
          its inception. Here are the combined learnings from end-of-semester
          student evaluations, internal surveys with KlickerUZH users in the
          spring semester 2023 (n=63) as well as input from lecturers and
          content creators:
        </p>
        <ul>
          <li>
            <strong>Lecture time consumption:</strong> Including a KlickerUZH
            question in a lecture typically takes approximately 2 to 5 minutes,
            considering the time required for answering and discussion.
          </li>
          <li>
            <strong>Pre-lecture time consumption:</strong> "Good things take
            time" applies to the creation of good (multiple-choice) questions.
            Even experienced authors typically anticipate spending an average of
            one hour to produce a single multiple-choice question in exam
            quality (Krebs, 2004). This time is necessary to carefully consider
            the formulation of the question, select the answer options
            precisely, and avoid potential pitfalls. This conscientious approach
            ensures that the questions align with the desired learning outcomes
            and provide students with an appropriate level of challenge. The
            lecturer also needs time to implement the questions in KlickerUZH
            before the lecture.
          </li>
          <li>
            <strong>Reaction to voting results:</strong> As a teacher, you have
            to react quickly to the voting results. This can be challenging,
            especially when the results are not as expected. It is advisable to
            consider the reaction to the results in advance of the lecture.
          </li>
          <li>
            <strong>Submitted responses:</strong> The participation rate varies
            depending on the course but can be estimated at an average of 50% of
            the attending students.
          </li>
          <li>
            <strong>Live Streaming and Podcasts:</strong> It should be noted
            that when lectures are recorded, students who watch the recordings
            afterwards may not have the opportunity to actively participate,
            thus missing out on the interactive benefits offered by KlickerUZH.
            Furthermore, it is important for lecturers to take into account the
            average 30-second to 1-minute delay of the UZH live streaming
            service, as this affects the timing of KlickerUZH questions and
            student responses, requiring the questions to be open for a longer
            duration.
          </li>
          <li>
            <strong>Participation level:</strong> The participation level in
            gamified live quizzes tended to be higher in small lectures were
            students know each other, likely due to the sense of belonging
            within a smaller group.
          </li>
          <li>
            <strong>Student feedback:</strong> From the students' perspective,
            the use of KlickerUZH is generally regarded as beneficial (average
            grade across several years in different Department of Finance (DF)
            lectures: 5.0/6.0). Some critical voices express concerns about time
            loss and question the effective benefits.
          </li>
          <li>
            <strong>Question type:</strong> So far, single-choice questions have
            been predominantly used.
          </li>
          <li>
            <strong>Devices:</strong> According to an internal survey in spring
            semester 2023 in one of the KlickerUZH 3.0 pilot lectures, most
            students (35 / 82) participated in the live quiz through the
            Learning Management System (LMS). Another significant portion (33 /
            82) joined the quiz by scanning the QR code shared by the lecturer.
            Only a small number of students (6 / 82) joined through a personal
            bookmark, and (4 / 82) opted to participate using the KlickerUZH
            App. Providing all necessary components within a single system,
            integrating KlickerUZH into OLAT, even solely for live quizzes, is
            strongly recommended.
          </li>
          <li>
            <strong>Number of users per live quiz:</strong> In the events
            organized by the DBF, KlickerUZH is mainly utilized in
            bachelor-level lectures with a large number of students (150-800
            students). In a single semester (14 weeks), KlickerUZH was used
            between three to seven times in these sessions, with an average of
            three questions asked per quiz.
          </li>
          <li>
            <strong>Gamification:</strong> Incorporating gamification in live
            quizzes works effectively when creating a quiz-like atmosphere in
            the lecture hall and considering incentives or rewards, such as
            small gifts, to enhance participation and engagement.
          </li>
        </ul>
      </>
    ),
  },
  flipped_classroom: {
    acknowledgements: ACK_STANDARD,
    title: 'Flipped Classroom',
    headerImgSrc: '/img/use_cases/icons8-team-yTwXpLO5HAA-unsplash.jpg',
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
    abstract:
      'Implement the flipped classroom model by providing students with pre-class materials and focusing on interactive discussions during class time.',
    introduction: (
      <>
        <p>
          The concept of the Flipped Classroom, or Inverted Classroom, involves
          reversing the traditional teaching-learning approach by shifting the
          knowledge transfer phase (phase 1) to independent, self-paced learning
          before the actual course, and focusing on practice and consolidation
          (phase 2) during in-person sessions with the teacher utilizing cases,
          experiments, discussions or questions.
        </p>
        <p>
          By adopting this methodology, students can familiarize themselves with
          the course content at their own pace before the lecture, through
          comprehensive eLearning resources such as reading materials,
          multiple-choice questions, and videos. During the lecture, the
          acquired knowledge is then applied and practiced collaboratively with
          the lecturer, allowing for a deeper understanding of the new learning
          materials, the discussion of questions and more time to address
          specific queries.
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
            rel="noopener"
          >
            alignment between lecturers and students
          </a>{' '}
          as well as the{' '}
          <a
            href={'https://teachingtools.uzh.ch/en/tools/flipped-classroom'}
            target="_blank"
            rel="noopener"
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
          into KlickerUZH. These can be activated during the lecture for
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
          the setup of Flipped Classroom sessions with KlickerUZH based on this
          evaluation are the following:
        </p>
        <ul>
          <li>
            <strong>Preparation of the student:</strong> It is crucial for
            students to engage in self-learning and familiarize themselves with
            the learning materials before attending the lecture to maximize
            their takeaway from the session.
          </li>
          <li>
            <strong>Self-selection:</strong> There can be a high effect of
            self-selection, especially if classroom sessions are optional,
            meaning that students do not show up for sessions if they are not
            prepared. Vice versa, students attending class tend to be motivated
            to discuss the materials.
          </li>
          <li>
            <strong>Time consumption in the lecture:</strong> Each question
            being polled throughout the session requires a sufficient time slot
            to be appropriately polled and discussed. A good question can lead
            to 5 to 10 minutes of discussion, depending on the scope of the
            problem being asked.
          </li>
          <li>
            <strong>Pre-lecture time consumption:</strong> The lecturer needs
            time to create and implement the questions in KlickerUZH before the
            lecture. "Good things take time" also applies here. Even experienced
            authors typically anticipate spending an average of one hour to
            produce a single multiple-choice question in exam quality (Krebs,
            2004). This time is necessary to carefully consider the formulation
            of the question, select the answer options precisely, and avoid
            potential pitfalls. This conscientious approach ensures that the
            questions align with the desired learning outcomes and provide
            students with an appropriate level of challenge.
          </li>
          <li>
            <strong>Room for discussion:</strong> Questions used in the quiz
            should be designed such that they leave enough room for discussion
            and further explanation.
          </li>
          <li>
            <strong>Grading:</strong> It could be an option to make
            participation in sessions and/or passing of quizzes before or during
            sessions mandatory or part of the grade. However, this could also
            negatively influence the openness of the discussions.
          </li>
        </ul>
      </>
    ),
  },
  microlearning: {
    acknowledgements: ACK_STANDARD,
    title: 'Microlearning',
    headerImgSrc: '/img/use_cases/markus-winkler-afW1hht0NSs-unsplash.jpg',
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
    abstract:
      'Break down complex topics into bite-sized learning units that students can easily digest and review at their own pace.',
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
            <strong>Anywhere:</strong> When creating microlearning questions,
            ensure they can be answered without the need for a calculator, any
            other tool or reference materials, allowing students to engage with
            the content anywhere.
          </li>
          <li>
            <strong>Motivation and better understanding:</strong> Results
            indicate that students generally have a positive attitude towards
            microlearnings. In the internal survey, a majority of the
            participants, specifically 72%, expressed that engaging with the
            microlearning content increased their motivation to review the
            learning material. An even greater number claimed microlearning
            helped them remember and understand the material (87.0% of those who
            completed a session). Participants mentioned they found it very
            helpful to revise the material on a weekly basis and see whether
            they had understood the concepts. It was even requested to increase
            the number of questions in the microlearning sessions, which
            currently lay at 3.75 questions per microlearning.
          </li>
          <li>
            <strong>Level of difficulty:</strong> While some students have
            criticized that the questions are not of an exam-level difficulty,
            it is important to clarify in advance that the purpose of these
            questions is to facilitate repetition and enhance long-term
            retention of knowledge, rather than to directly prepare students for
            exams.
          </li>
          <li>
            <strong>Alignment to lecture content:</strong> Microlearning
            questions need to match the lecture content. If the originally
            planned content is not covered by the lecturer during the lecture,
            the questions may need to be rescheduled for the following week.
          </li>
          <li>
            <strong>Investment:</strong> Creating new weekly microlearning
            questions can be quite time-consuming, but the benefits of promoting
            active learning and retention make it worthwhile.
          </li>
          <li>
            <strong>Regularity:</strong> To ensure the effectiveness of
            microlearning, it is essential to schedule regular question sessions
            to provide ongoing practice and reinforcement of the course
            material. However, some students expressed a preference for having
            the microlearnings available continuously, rather than within a
            fixed time window.
          </li>
          <li>
            <strong>Integration of microlearning into LMS:</strong> To
            accommodate students who missed the microlearning sessions, we
            integrated the questions into the learning management system (OLAT)
            some days after the microlearning session. This enabled students to
            access and engage with the questions, even if they couldn't attend
            the microlearning sessions.
          </li>
        </ul>
      </>
    ),
  },
  practice_quiz: {
    acknowledgements: ACK_STANDARD,
    title: 'Practice Quiz, Flashcards, and Spaced Repetition',
    headerImgSrc: '/img/use_cases/dan-freeman-WHPsxhB4mWQ-unsplash.jpg',
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
    abstract:
      'Provide students with a comprehensive practice environment featuring quizzes, flashcards, and spaced repetition to reinforce learning.',
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
          relevance, ensure an individual's understanding, or raise repetition
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
          Therefore, you decide to provide practice quizzes via KlickerUZH,
          thanks to which your students can review and study online, using the
          KlickerUZH app, webpage or even the integration into the LMS. These
          learning activities have no restrictions on when or how often they can
          be completed. Furthermore, the questions within each set can be shown
          in sequence, shuffled, or ordered based on the date of the last
          response, providing varied experiences for students. KlickerUZH
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
          When using gamification, the time frame in which points can be
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
            <strong>High participation:</strong> According to our own analysis,
            around 75% of all students enrolled in the courses engaged with the
            practice quizzes in the LMS. This is almost double as high as
            students completing the microlearning.
          </li>
          <li>
            <strong>Peak:</strong> Striking is the over-proportional increase in
            total question entries between weeks 12 and 15, just before the
            exam. The number of users solving questions in this period is
            approximately double the number solving questions in the second week
            and the total number of questions solved is more than 5 times the
            start values; it becomes clear to see when exam preparation peaked.
          </li>
          <li>
            <strong>Gamification increased participation:</strong> First
            evaluation based on multiple questions in the self-learning on OLAT,
            the questions were identical (number and content) in the autumn
            semester 2020, 2021 and 2022. However, in 2022 we included the
            gamification approach and added microlearnings on the course level.
            We saw higher access numbers, more repetition across all students as
            well as more repetition per student (fall 20/21: Average: 1.96x per
            student, maximum: 21x vs. fall 2022: Average: 2.45x per student,
            Maximum: 41x).
          </li>
          <li>
            <strong>
              Repetition as the key performance factor in the mock exam:
            </strong>{' '}
            The most significant positive correlation with good performance in a
            mock exam in Banking and Finance II lies in the number of question
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
            <strong>Devices:</strong> The majority (85%) of the students
            participated in the practice quizzes by using their laptop.
          </li>
          <li>
            <strong>Quick win:</strong> If you already have practice questions
            in another tool (e.g., OLAT), you can easily implement them into the
            KlickerUZH. This allows you to leverage the advantages of peer
            answer distributions and the integration into the optional
            gamification course concept.
          </li>
        </ul>
      </>
    ),
  },
  group_activity: {
    acknowledgements: ACK_STANDARD,
    title: 'Group Activities',
    headerImgSrc: '/img/use_cases/marvin-meyer-SYTO3xs06fU-unsplash.jpg',
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
    abstract:
      'Foster collaborative learning through structured group activities that encourage peer interaction and knowledge sharing.',
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
          questions. Within KlickerUZH, students have the freedom to form their
          own groups, enabling them to collaboratively tackle the assigned
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
          Through KlickerUZH, students are encouraged to tackle a challenge
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
            rel="noopener"
          >
            group work
          </a>{' '}
          as well as the{' '}
          <a
            href="https://teachingtools.uzh.ch/en/tools/methoden-zur-gruppenbildung"
            target="_blank"
            rel="noopener"
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
          to use KlickerUZH to provide Group Activities where students can sign
          up as groups (of at least two people) and work on the provided tasks
          together. This can be done during the lecture for smaller tasks or
          alternatively for a longer period of time during which students can
          work on a more complex assignment. The following question types can be
          implemented: Single Choice (SC), Multiple Choice (MC), Kprim (KPRIM),
          Free Text (FT), and Numerical Response (NR). This is a great
          opportunity if you want to enable students to have an insight into
          practical considerations and tasks which they can work on as a team,
          outside of the traditional lecture.
        </p>
        <p>
          The teamwork is further encouraged thanks to distributed information.
          When providing group activities via KlickerUZH, the necessary
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
            <strong>Number of groups:</strong> Since the group activity was
            optional and the assessment courses demanded significant attention
            from students, only a limited number of groups participated in the
            group activities (autumn semester: 23 groups and spring semester: 6
            groups). It is worth considering that there may be more suitable
            lectures or courses that offer better opportunities for integrating
            group tasks, given the specific circumstances and requirements.
          </li>
          <li>
            <strong>Student feedback:</strong> In the internal survey, only
            20.63% claimed they had joined a group. Of those students who did
            not select "no opinion" in the question regarding their view on the
            group challenges, 28.6% found them cool, but 25.71% voted
            unnecessary. This, again, shows that a select few like the group
            setting and the extra efforts, but many see no added value with
            twice as many claiming the challenges are too much effort than
            requiring the right amount of effort.
          </li>
          <li>
            <strong>Real-world scenarios:</strong> The lecture focused on
            theory, while the group activity involved working with real data
            sourced from annual reports or price data from sources like Yahoo
            Finance. Careful consideration was given when selecting companies
            and data, recognizing that real-world scenarios can be complex.
            Simplification may be necessary to make the exercises more
            manageable within the scope of the course.
          </li>
          <li>
            <strong>Grading:</strong> KlickerUZH enables automatic grading for
            choice-based question types. However, for numerical response and
            free text questions, manual correction is required. It is crucial to
            consider the time and effort needed for manual grading as part of
            the overall lecture planning process.
          </li>
          <li>
            <strong>Discussion of results:</strong> Given the nature of
            real-life problems, there may not always be a single solution. This
            aspect needs to be considered during the correction process and
            feedback writing. Flexibility and consideration for different
            approaches or interpretations are often required when assessing the
            results of group activities based on real-world scenarios.
          </li>
        </ul>
      </>
    ),
  },
  live_qa: {
    acknowledgements: ACK_STANDARD,
    title: 'Live Q&A',
    headerImgSrc:
      '/img/use_cases/volodymyr-hryshchenko-V5vqWC9gyEU-unsplash.jpg',
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
    abstract:
      'Enable real-time student questions and interactions during lectures while maintaining focus and organization.',
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
          With KlickerUZH, students can ask their questions anonymously during
          the lecture. They can discuss their issues in a secure environment and
          express their uncertainties unashamedly. For lecturers, KlickerUZH
          serves as a helpful tool to keep an overview of the knowledge of their
          students and to see where there are any comprehension problems. It is
          up to the lecturers whether they make the questions visible to all and
          promote interaction among the students or whether they answer the
          questions in a pre-selected manner.
        </p>
        <p>
          With this approach, KlickerUZH creates a connection between lecturers
          and students and promotes an open and inclusive learning environment
          in which questions and discussions are actively encouraged.
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
          In an anonymous setting, such as the one KlickerUZH provides, a safe
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
          you start a session in KlickerUZH and enable the anonymous Q&A
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
            <strong>Moderation:</strong> In very large lectures, moderation of
            the Q&A channel becomes crucial due to the high volume of questions,
            including irrelevant ones. Moderation enables the filtering and
            approval of questions before they are visible to other participants,
            ensuring that only relevant and meaningful questions are addressed
            and displayed.
          </li>
          <li>
            <strong>Participation level:</strong> The participation level in the
            Q&A channel tends to be higher in larger lectures (500-800 students)
            compared to the smaller lectures (200 students). In the large
            assessment lectures based on our internal survey, more than half of
            the participants claimed to have posted questions in the Q&A in at
            least one lecture, 73% of these did so in 1-4 lectures during the
            semester.
          </li>
          <li>
            <strong>Effort to manage the Q&A channel:</strong> According to
            survey responses from lecturers, the effort required to manage the
            Q&A channel is considered valuable and worthwhile. Lecturers
            recognize the benefits of engaging with students through the Q&A
            functionality and find it beneficial for enhancing the learning
            experience.
          </li>
          <li>
            <strong>Continuing to use:</strong> All surveyed lecturers expressed
            a high likelihood, whether likely or extremely likely, to continue
            using the Q&A functionality in their future teaching. This suggests
            the positive impact and value that the Q&A channel brings to their
            instructional practices.
          </li>
          <li>
            <strong>Time consumption:</strong> Answering questions orally during
            class takes time. It is helpful not to answer questions too
            frequently so as not to disrupt the flow of the lesson.
          </li>
          <li>
            <strong>Interaction by students:</strong> Findings from the survey
            indicate that around 45% of students actively read or upvoted
            existing questions, indicating engagement with the Q&A channel.
            Additionally, 22% of students posted their own questions, showing
            active participation. Only a small percentage (5%) of students had
            not yet heard of the Q&A channel, suggesting a widespread awareness
            among the student population.
          </li>
          <li>
            <strong>Student feedback:</strong> Feedback from students indicates
            a positive perception of the Klicker Q&A functionality, with
            students acknowledging its benefits in improving their understanding
            of the lecture contents. The Q&A channel has provided a platform for
            students to seek clarification, receive answers to their questions,
            and gain a deeper understanding of the subject matter.
          </li>
          <li>
            <strong>Usage statistics:</strong> In November 2021, lecturers using
            the KlickerUZH Live Q&A functionality have received over 400
            questions, about 150 of which were resolved with a response through
            the tool. 62 were resolved without a response (e.g., orally or
            implicitly), and 68 were deleted (e.g., because of their
            irrelevance). The length of feedback responses ranged from extensive
            530 character explanations to single words like "No".
          </li>
        </ul>
      </>
    ),
  },
  gamification: {
    acknowledgements:
      'We sincerely thank our collaborators and sponsors on this use case: Swissuniversities for funding the development of this use case as part of the P-8/DISK4U project; the University of Zurich (ULF) and the Department of Finance / Teaching Center for sponsoring the development of KlickerUZH and functionalities related to this use case; Sarah Rasonyi for the contribution as part of her bachelor thesis "Fostering Engagement with Learning Contents Using Gamification and Microlearning (2023)".',
    title: 'Gamification',
    headerImgSrc: '/img/use_cases/brands-people-ZdqSuxl3Lak-unsplash.jpg',
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
    abstract:
      'Boost student motivation and engagement through game-like elements including points, achievements, and competitive challenges in educational activities.',
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
          In addition to the challenge system, KlickerUZH offers a design for a
          storyline and visual aspects that can be integrated optionally.
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
            <strong>Student feedback:</strong> 89.1% of participants claimed the
            full KlickerUZH concept helped them understand the learning content
            and 74.6% found the concept fun. These statistics are very
            encouraging to see; many students explicitly expressed their
            gratitude for the concept and named it the "best learning
            environment in the assessment!". 79.4% would like to see it in
            further lectures as a tool to revise and apply the material while
            interacting with other students. In a multiple-choice question,
            51.7% found the concept useful and more than 20% deem the workload
            and difficulty appropriate. These results indicate the majority of
            participants find added value in KlickerUZH and would like to engage
            in the concept in the future.
          </li>
          <li>
            <strong>BF Challenge:</strong> Even though 89.6% of the students
            enrolled in Banking and Finance II had created a KlickerUZH account,
            only 25.5% found the BF Challenge motivating. At no point in the
            spring semester did more than 40.9% of users join the leaderboard,
            meaning the pool of students who competed for prizes was relatively
            small. 55.6% of KlickerUZH survey participants claimed they had
            never been active in the self-learning environment with the sole
            objective of receiving points and 44% replied they had done so at
            least once. And 84.1% of participants felt the chance at potential
            prizes did not influence the number of points they collected; they
            would not have collected fewer had there been no prizes. This shows
            that not only were the majority of users not interested in the BF
            Challenge, but they were also not ambitious in reaching the top.
          </li>
          <li>
            <strong>Account creation:</strong> Even though they may not have
            wanted to compete for prizes on the leaderboard, new accounts were
            created each week and the ratio between completely inactive and
            active users declines throughout the spring semester. This shows
            there was still some general incentive to collect points or merely
            work with an avatar throughout the semester since most of the
            features could have also been completed without accounts. Students
            may have been interested to see how they compare to their peers in
            the leaderboard without wanting to compete, or they may have created
            an account for specific features, such as the awarding of points
            from the mock exam or the potential prizes after the two live
            quizzes.
          </li>
          <li>
            <strong>Gamification as a distractor:</strong> It is important to
            recognize that not all students may be receptive to gamification.
            Some individuals may have personal preferences or reasons for not
            enjoying or engaging with gamified elements. 4% found the KlickerUZH
            concept distracting, however, none deemed it unnecessary.
          </li>
          <li>
            <strong>Top20 users:</strong> Though the average user may not have
            been ambitious in climbing the leaderboard, several did stand out as
            the top20. These students participated, on average, in a more
            extensive range of the different features offered, such as the
            microlearning and mock exam, and achieved higher scores in them.
            More than a quarter of all practice quiz question entries stem from
            this pool of 5% of users; they were more than five times as active
            as their average peer and consistently scored high points not only
            in the leaderboard but also in the mock exam.
          </li>
          <li>
            <strong>Link to performance in the mock exam:</strong> The most
            significant positive correlation with good performance in the mock
            exam lies in the number of question entries students complete
            throughout the semester, much more so than in their accuracy or the
            completed range across all available questions. High numbers of
            question entries correlate the most strongly with high leaderboard
            points, too, leading to the conclusion that a high engagement level
            is the crucial factor influencing both the mock exam and leaderboard
            points.
          </li>
          <li>
            <strong>Peer pressure:</strong> The impact of gamification could
            also be influenced by the size of the class and the level of
            familiarity among students. Smaller classes (like the summer school
            course with around 40 students) benefit from stronger peer pressure
            and social dynamics, which can enhance the effectiveness of
            gamification.
          </li>
          <li>
            <strong>Overemphasis on competition:</strong> While competition can
            be a motivating factor, an excessive focus on rankings and
            leaderboards may create negative effects. Utilizing group activities
            and emphasizing cooperative achievements can help balance
            competition and collaboration.
          </li>
          <li>
            <strong>Choose motivational rewards:</strong> When implementing
            rewards, careful consideration should be given to selecting
            appropriate rewards that align with students' interests and
            preferences. Rewards do not need to be costly but should be
            meaningful and incentivize students' engagement and participation
            (this could also be choosing a song that is played in the break, or
            that winner can influence the company names / fictional people in an
            exam question in the future).
          </li>
          <li>
            <strong>Lecturer encouragement:</strong> Motivational encouragement
            from the lecturer is indeed crucial to foster student participation
            in gamified challenges.
          </li>
          <li>
            <strong>Time consumption:</strong> Effectively designing gamified
            experiences requires time, resources, and expertise. Poorly executed
            gamification attempts can lead to confusion or disengagement among
            students.
          </li>
        </ul>
      </>
    ),
  },
  learning_analytics: {
    acknowledgements:
      'We sincerely thank our collaborators and sponsors on this use case: Swissuniversities for funding the development of this use case as part of the P-8/DISK4U project; the University of Zurich (ULF) and the Department of Finance / Teaching Center for sponsoring the development of KlickerUZH and functionalities related to this use case; Alessio D\'Andrea for the contribution as part of his bachelor thesis on "Einsatz von Learning Analytics in der Hochschullehre (2024)"; Lisa Fang for the contribution as part of her bachelor thesis on "Learning analytics for students in Banking and Finance (2024)".',
    title: 'Learning Analytics',
    headerImgSrc: '/img/use_cases/dawid-zawila-OCMcTCu97EE-unsplash.jpg',
    tags: [
      'Educational engagement',
      'Data-driven pedagogy',
      'Student performance insights',
      'Student progress',
      'Self-regulated learning',
      'Learning patterns',
    ],
    abstract:
      'Leverage data analytics to gain insights into student learning patterns, identify areas for improvement, and make informed decisions to enhance educational outcomes.',
    goals: [
      [
        'For Lecturers',
        [
          'Use Learning Analytics (LA) to gain insights into and to understand students’ individual and collective engagement, knowledge levels, and performance to improve course design and delivery',
          'Monitor student activities to recognize disengagement early and provide targeted interventions for improved outcomes',
          'Analyze data on learning resource usage and success rates to align course content with student needs',
          'Utilize LA insights for data-driven adjustments to teaching strategies and future course iterations',
          'Engage in reflective practices to develop pedagogical skills based on LA-driven evaluations',
        ],
      ],
      [
        'For Students',
        [
          'Access personalized feedback and dashboards to monitor progress, set goals, and plan effective study strategies (self-regulated learning',
          'Utilize insights from LA to stay motivated and actively participate in learning activities',
          'Identify areas for improvement through detailed feedback and additional resources provided by LA tools',
        ],
      ],
    ],
    introduction: (
      <>
        <p>
          As a lecturer, have you ever wondered about the hidden dimensions of
          student learning? While you stand in front of the class week after
          week, teaching and answering questions, the students' learning
          activities outside the classroom remain largely invisible. How many
          hours do students invest in learning? How frequently do they review
          course materials? How often do they attempt self-assessment tasks? The
          complexity of understanding students' diverse learning behaviors has
          intensified with the increasing number of students in higher education
          and the proliferation of eLearning formats. Traditional teaching
          approaches struggle to provide comprehensive insights into individual
          learning processes.
        </p>
        <p>
          At the same time, students are also increasingly interested in
          understanding their academic performance relative to their peers and
          where their strengths and weaknesses are situated. Providing students
          with insights on these topics could also prove intrinsically
          motivating. Students seek to know: Have they completed self-learning
          modules? How do their formative assessment results compare to
          classmates?
        </p>
        <p>
          Learning Analytics offers a sophisticated solution to these
          challenges. Defined by Long et al. (2011) as "the measurement,
          collection, analysis, and reporting of data about learners and their
          contexts, for purposes of understanding and optimizing learning and
          the environments in which it occurs", this emerging field provides
          unprecedented visibility into educational engagement. The integration
          of online and blended learning has exponentially expanded the volume
          of educational data available. As Stewart (2017) highlighted, these
          data repositories serve as a foundational resource for analyzing
          student behavior, identifying improvement opportunities, and enhancing
          teaching and learning processes. Learning Analytics enables lecturers
          to gain nuanced insights into actual student learning patterns while
          simultaneously providing students with a comparative perspective on
          their academic performance. By transforming complex data into
          meaningful insights, this approach enhances our understanding of
          educational engagement.
        </p>
      </>
    ),
    background: (
      <>
        <p>
          In higher education, understanding students' diverse learning
          behaviors and engagement levels is crucial for lecturers aiming to
          enhance their teaching practices (Volungevičienė et al., 2019).
          However, the growth in student numbers has reduced opportunities for
          meaningful interactions, making it challenging for lecturers to fully
          grasp students' learning processes (Lowes, 2020). The integration of
          online and blended learning further amplifies this issue by generating
          vast amounts of educational data (Stewart, 2017). This data serves as
          a foundation for analyzing student behavior, identifying areas for
          improvement, and providing targeted support (Büching et al., 2019).
        </p>
        <p>
          Recognizing these challenges, Learning Analytics (LA) has emerged as a
          powerful tool to transform educational data into actionable insights.
          LA facilitates a shift towards evidence-based educational strategies,
          benefiting students, lecturers, and administrators by creating more
          effective and personalized learning experiences.
        </p>
        <p>
          One of LA's significant contributions lies in its ability to
          objectively assess student engagement, moving beyond traditional
          self-reports and surveys (Caspari-Sadeghi, 2022). By automatically
          tracking digital activities, LA provides lecturers with insights into
          students' knowledge levels, error patterns, and engagement, enabling
          them to adjust course designs and teaching methods effectively
          (Tervakari et al., 2014; Hui & Farvolden, 2017). LA also uncovers
          learning behavior patterns that may hinder effective learning
          (Tervakari et al., 2014). For instance, it can detect activity spikes
          near assignment deadlines and exam periods (Hui & Farvolden, 2017;
          Poon et al., 2017; Tervakari et al., 2014). As Tervakari et al. (2014)
          observe, such trends often leave insufficient time for peer
          discussions and result in an inadequate understanding of course
          materials. Recognizing these patterns enables lecturers to adjust
          course designs, such as introducing more structured peer-learning
          opportunities earlier in the semester.
        </p>
        <p>
          Insights into student learning behavior provide a crucial foundation
          for the critical reflection of lecturers, allowing them to evaluate
          and reconsider course materials, future course implementations, and
          pedagogical practices (Chatti et al., 2012; Karademir et al., 2021;
          Redmond et al., 2018). Based on this foundation, Learning Analytics
          supports lecturers in decision-making regarding adjustments in both
          current and future course implementations (Volungevičienė et al.,
          2019). According to Ifenthaler (2020), such reflections contribute to
          the professional development of educators in higher education.
        </p>
        <p>
          LA also plays a crucial role in identifying at-risk students, allowing
          for proactive interventions. As noted by Tervakari et al. (2014) and
          Caspari-Sadeghi (2022), early signs of disengagement can be detected,
          enabling personalized support strategies. Karademir et al. (2021)
          highlight the use of success rate intervals to provide additional
          resources for struggling students, while Herodotou et al. (2020)
          confirm the positive impact of such interventions on course progress
          and completion rates.
        </p>
        <p>
          Predictive analytics is another vital application of LA, focusing on
          early identification of students at risk of failing (Chatti et al.,
          2012; Banihashem et al., 2022). Broos et al. (2020) developed models
          to predict exam performance and identify at-risk students, while
          Sharif & Atif (2024) emphasize the role of predictive analytics in
          future pedagogical strategies.
        </p>
        <p>
          Furthermore, LA supports personalized and adaptive learning
          environments, catering to individual student needs to maximize
          academic potential (Berland et al., 2014; Schumacher & Ifenthaler,
          2018a). By offering immediate feedback through automated analysis of
          digital activities, LA enhances self-regulated learning processes,
          fostering autonomy and deeper engagement (Durall & Gros, 2014; Virkus
          et al., 2023). Despite its potential, integrating students' needs into
          LA system designs remains a challenge (Galaige et al., 2022). However,
          the insights provided by LA form a robust foundation for lecturers to
          critically evaluate and refine their pedagogical practices, supporting
          ongoing professional development and future course improvements
          (Ifenthaler, 2020).
        </p>
      </>
    ),
    scenario: (
      <>
        <p>
          In KlickerUZH, learning analytics allow both lecturers and students to
          gain insight into the learning behavior and success of their class
          and/or themselves.For lecturers, different dashboards provide insight
          into the activity, progress, and performance of an entire class. For
          students, analytics focus on their achievement of competencies and
          mastery in specific quizzes and topics of a course. Learning analytics
          are anonymized and shown in aggregate to ensure the privacy of
          individual students. An example of a future learning analytics
          dashboard is shown below.
        </p>
        <p>The three types of analytics for lecturers are the following:</p>
        <ul>
          <li>
            <strong>Activity Analytics</strong>: These visualizations aim to
            offer a comprehensive view of how students interact with the course
            materials, enabling lecturers to tailor their teaching strategies
            accordingly. They display the activity of students across the
            semester and highlight the changes from week to week.
            <Figure
              imgSrc="/img/learning_analytics/la_activity_dashboard_example.png"
              caption="Example illustration from the KlickerUZH activity dashboard"
              width={900}
            />
          </li>
          <li>
            <strong>Progress and Performance Analytics</strong>: These
            visualizations offer lecturers insights into course progress,
            students' knowledge levels across various course topics, and
            individual student performance. They supports lecturers in
            identifying areas where students excel or may need additional
            support, facilitating targeted interventions.
            <Figure
              imgSrc="/img/learning_analytics/la_performance_dashboard_example.png"
              caption="Example illustration of the KlickerUZH performance dashboard"
              width={700}
            />
          </li>
          <li>
            <strong>Quiz Performance Analytics</strong>: Survey results indicate
            that lecturers have the greatest interest in analyzing quiz results.
            Quiz performance analytics include an overview of error rates,
            student feedback on quizzes, and detailed views of aggregated quiz
            results and individual quiz questions. This enables lecturers to
            gain a deeper understanding of student performance and refine their
            assessment strategies.
            <Figure
              imgSrc="/img/learning_analytics/la_quiz_dashboard_example.png"
              caption="Example illustration of the KlickerUZH quiz dashboard"
              width={500}
            />
          </li>
        </ul>
      </>
    ),
    learnings: (
      <>
        <p>
          Our preliminary research on implementing Learning Analytics in
          KlickerUZH has yielded substantial initial insights. These findings
          emerge from two complementary sources: a comprehensive survey (n=11)
          with lecturers and teaching assistants from various disciplines and
          the methodological challenges encountered during the development of
          the LA.
        </p>
        <p>
          To systematically validate and further extend these findings, we will
          conduct comprehensive pilot studies during the spring term of 2025.
          Should you be interested in participating, please fill out the form at{' '}
          <a
            href="https://forms.office.com/e/K8CXM2pKhJ"
            target="_blank"
            rel="noopener"
          >
            https://forms.office.com/e/K8CXM2pKhJ
          </a>{' '}
          so that we may contact you. The results of the piloting will be
          evaluated and summarized as part of this use case.
        </p>
        <ul>
          <li>
            <strong>
              Understanding familiarity and application of learning analytics
            </strong>
            : The survey revealed varying levels of familiarity and
            implementation of Learning Analytics (LA) among lecturers. Task
            completion rate analysis was successfully used by 18.18% of
            participants, with 63.64% expressing interest in future adoption.
            Despite some unfamiliarity, the concept's potential is widely
            recognized, highlighting an opportunity for broader implementation.
          </li>

          <li>
            <strong>Adoption trends in quiz result analysis</strong>: According
            to the survey, quiz result analysis showed higher adoption, with
            36.36% of lecturers already using it and 45.45% interested in future
            application. While behavior analytics and interaction time analysis
            have yet to be integrated, they garnered significant interest,
            indicating a readiness to explore these tools to enhance teaching
            practices.
          </li>

          <li>
            <strong>Growing interest in learning analytics tools</strong>:
            According to the survey, there is a strong interest in adopting LA
            tools if they are more accessible, particularly through platforms
            like KlickerUZH. This suggests a growing recognition of LA's value
            in providing deeper insights into student performance and
            engagement, which can inform and improve educational strategies.
          </li>

          <li>
            <strong>Ensuring data availability and quality</strong>: The
            effectiveness of LA as a data-driven approach to improving education
            heavily depends on the quantity, quality, and relevance of the data
            collected. An identified limitation is the inability to track
            offline learning activities (e.g. reading a book or even a printed
            PDF script), which are not captured by digital tools. This gap can
            lead to incomplete representations of student engagement and hinder
            accurate predictions. Rets et al. (2021) suggest incorporating
            features to log offline study efforts in LA dashboards to enhance
            the accuracy of predictive analytics. If this is not possible or
            done, it is essential for lecturers to critically evaluate the data,
            recognizing that it encompasses only online activities and may not
            fully capture offline learning efforts. Being aware of these
            limitations allows educators to interpret the data more accurately
            and make informed decisions that consider the entire learning
            context.
          </li>

          <li>
            <strong>Ethical considerations and data privacy</strong>: Beyond
            technical challenges and limitations, the ethical and legal
            dimensions of data collection and usage play a pivotal role in LA
            adoption. Privacy concerns, data protection, and the lack of
            transparency in data usage have been widely debated (Ferguson et
            al., 2016; Khalil & Ebner, 2015; Pardo & Siemens, 2014). Addressing
            these concerns requires not only robust anonymization but also
            careful validation of data to ensure its relevance and reliability
            (Ifenthaler, 2015; Seufert et al., 2020).
          </li>
        </ul>
      </>
    ),
  },
  ai_formative_feedback: {
    acknowledgements: ACK_STANDARD,
    title: 'AI-assisted Formative Feedback',
    headerImgSrc:
      '/img/use_cases/glenn-carstens-peters-RLw-UC03Gwc-unsplash.jpg',
    tags: [
      'Formative feedback',
      'AI-assisted grading',
      'Personalized feedback',
    ],
    goals: [
      'Use AI to deliver detailed, personalized feedback on open-ended questions, tailored to individual student needs',
      'Provide immediate AI-generated feedback around the clock to minimize learning process interruptions. ',
      'Encourage self-regulated learning by offering iterative feedback that helps students refine responses and understand complex concepts',
      'Reducing educator workload while ensuring consistent, high-quality feedback for large groups',
      'Guide students toward deeper inquiry and understanding by using AI feedback to promote critical thinking and problem-solving skills',
    ],
    abstract:
      'Provide personalized, AI-powered feedback on student work to support continuous improvement and understanding.',
    introduction: (
      <>
        <p>
          To assess students' comprehension of course content, lecturers
          traditionally employ exercises and multiple-choice self-assessments in
          a formative (self-) test. Compared to multiple-choice questions,
          open-ended questions embody a more sophisticated pedagogical approach.
          When coupled with thoughtfully designed questions and corresponding
          feedback, they significantly enhance critical thinking and conceptual
          understanding. These questions are particularly valuable as they
          challenge students to articulate complex ideas and demonstrate deeper
          learning beyond simple factual recall.
        </p>

        <p>
          Historically, in large lectures, lecturers were limited to providing
          sample solutions for open-ended questions in formative
          self-assessments, offering minimal individualized learning support.
          Individual feedback was only possible through human grading, which is
          resource-intensive and costly. The emergence of Large Language Models
          has fundamentally transformed this educational paradigm by enabling
          immediate, personalized formative feedback for open-ended questions as
          well .
        </p>

        <p>
          This technological advancement supports self-regulated learning and
          helps students refine responses and understand complex concepts. The
          AI-generated feedback highlights strengths and suggests areas for
          improvement, helping students to deepen their understanding of course
          concepts. This feedback guides students toward refining their answers
          without directly providing the correct solution. Moreover, the system
          can dynamically assess response quality, potentially awarding points
          based on predefined performance thresholds.
        </p>
      </>
    ),
    background: (
      <>
        <p>
          AI-generated feedback has been shown to be a viable alternative or
          complement to traditional human feedback. Escalante's study on
          AI-generated feedback for English as a New Language (ENL) students
          revealed that there is a nearly equal preference for AI-generated and
          human-generated feedback among learners, suggesting that AI can
          effectively support educational practices without compromising
          learning outcomes (Escalante, 2023). This aligns with Schultze's
          findings, which emphasize that using large language models (LLMs) to
          augment human feedback can improve perceived feedback quality,
          addressing the common dissatisfaction students express regarding the
          quality of feedback they receive (Schultze, 2024). The implication
          here is that a blended approach, incorporating both AI and human
          feedback, can leverage the strengths of each to enhance the
          educational experience.
        </p>
        <p>
          However, AI-generated feedback has also been associated with a set of
          challenges. Bai and Stede's survey on machine learning approaches to
          free-text evaluation underscores the complexities involved in
          developing effective AI systems for educational feedback (Bai & Stede,
          2022). They argue that while AI can automate certain aspects of
          feedback delivery, it must be carefully designed to align with
          educational goals and learner needs. Similarly, Deeva et al. discuss
          the limitations of automated feedback systems, noting that while they
          can provide immediate responses, they may lack the nuanced
          understanding that human feedback can offer (Deeva et al., 2021). This
          highlights the importance of integrating human oversight in AI
          feedback systems to ensure that the feedback is not only timely but
          also contextually relevant and constructive.
        </p>
        <p>
          The effectiveness of AI in essay evaluation is further supported by
          Kostic's case study, which demonstrates the capabilities of LLMs in
          assessing various text attributes through natural language processing
          (NLP) algorithms (Kostic, 2024). These systems can evaluate writing
          style and content quality, thus providing a comprehensive analysis
          that can inform students about their writing strengths and weaknesses.
          However, the reliance on pre-graded corpora for training these models
          raises questions about the generalizability and fairness of AI
          evaluations, necessitating further research to refine these systems.
        </p>
        <p>
          The integration of human feedback within AI systems is a critical area
          of exploration. Wang et al. emphasize the need for a human-in-the-loop
          approach in natural language processing, which allows for continuous
          improvement of AI systems through human feedback (Wang et al., 2021).
          This approach not only enhances the accuracy of AI evaluations but
          also ensures that the feedback provided is aligned with educational
          objectives and learner expectations. The combination of human insights
          and AI efficiency can lead to more personalized and effective feedback
          mechanisms.
        </p>
        <p>
          The impact of feedback timing on learning outcomes is another
          important consideration. Research suggests that the timing of feedback
          delivery can significantly influence its effectiveness, with immediate
          feedback often being more beneficial for learning than delayed
          responses (Deeva et al., 2021). This is particularly relevant in the
          context of AI feedback systems, which can provide instantaneous
          responses, thereby facilitating a more dynamic learning environment.
          However, educators must remain aware of the potential pitfalls of
          over-reliance on automated systems, ensuring that feedback remains
          focused and constructive.
        </p>
      </>
    ),
    scenario: (
      <>
        <p>
          By using AI-driven formative feedback in KlickerUZH, you create an
          engaging and supportive learning environment that allows students to
          practice open-ended tasks in a non-assessment setting. When compared
          to the assessment setting, the application of AI in the practice
          scenario reduces the impact of potential mistakes made by the AI.
        </p>

        <H3>1. Preparing Questions for Formative Feedback</H3>

        <p>
          As a lecturer, you aim to provide your students with a flexible and
          interactive way to engage with course materials and practice their
          skills. To achieve this, you start by creating a course in KlickerUZH
          and developing a set of open-ended questions that align with your
          course objectives. For each of the questions, you provide model
          solutions that outline the key elements of ideal responses.
          Additionally, AI-generated grading rubrics are created to offer
          criteria for evaluating student responses. You have the option to
          review and modify these rubrics to ensure alignment with course goals
          and standards. After testing, you can embed the questions into any of
          the learning activities supported in KlickerUZH.
        </p>

        <p>
          Once configured, KlickerUZH allows you to integrate these learning
          activities directly into your learning management system (LMS) via LTI
          (e.g., OLAT). This integration ensures seamless access for students
          through familiar platforms. A student log-in and course participation
          is required to get formative feedback from the AI, allowing for both
          cost control and moderation of access.
        </p>

        <H3>2. Practicing Questions with Formative Feedback</H3>

        <p>
          Students access the learning activities through OLAT or the KlickerUZH
          app, selecting those that correspond to their current learning
          modules. This setup encourages self-paced learning and allows students
          to focus on areas where they need more practice. When students attempt
          free-text questions, the AI analyzes their responses, provides
          formative feedback that highlights strengths and suggests areas for
          improvement. This feedback guides students toward refining their
          answers without directly providing the correct solution.
        </p>

        <p>
          Students can revise their responses based on the feedback received and
          resubmit them for further evaluation. This iterative process continues
          until the AI deems the response sufficient according to the
          established criteria in the grading rubric. Once a student's response
          meets the required standards, points are awarded as part of a
          gamification strategy to enhance motivation and engagement. This
          system encourages students to view the learning process as an
          enjoyable challenge rather than a high-stakes assessment.
        </p>
      </>
    ),
    learnings: (
      <>
        <p>
          At the University of Zurich's Department of Finance, we are currently
          exploring the potential of Large Language Models (LLMs) to provide
          immediate, personalized formative feedback to students during their
          learning journey. This initiative builds upon our successful
          experiments with AI-assisted grading in examinations and aims to
          extend these capabilities to support continuous learning throughout
          the semester.
        </p>
        <p>
          To systematically validate and further extend these findings, we will
          conduct comprehensive pilot studies during the spring term of 2025.
          Should you be interested in participating, please fill out the form at{' '}
          <a
            href="https://forms.office.com/e/K8CXM2pKhJ"
            target="_blank"
            rel="noopener"
          >
            https://forms.office.com/e/K8CXM2pKhJ
          </a>{' '}
          so that we may contact you. The results of the piloting will be
          evaluated and summarized as part of this use case.
        </p>
        <p>
          Our initial assessment of this use case has also provided several
          significant insights and preliminary learnings regarding the general
          use of AI that are relevant for lecturers regarding the implementation
          of AI use cases. Information about the associated challenges,
          limitations, and remediation strategies for IT can be found here .
        </p>
        <p>Some of our most important preliminary findings include:</p>
        <ul>
          <li>
            <strong>Didactic challenges:</strong> A naive implementation where
            AI provides direct answers as feedback may hinder learning by
            discouraging critical thinking. Therefore, it is advised to use a
            tutoring approach for content-specific feedback that guides students
            toward solutions through hints or counter-questions without giving
            direct answers. Furthermore, it is important to focus on giving
            formative feedback that allows students to identify and improve
            their weaknesses. This corresponds to the way a conversational
            interface (e.g., chatbot) would be designed and encourages students
            to try again with another answer.
          </li>
          <li>
            <strong>Accuracy and contextual relevance:</strong> AI-generated
            feedback systems often struggle with accuracy and contextual
            relevance (e.g. the nuanced understanding that human feedback
            provides), leading to generic or misaligned responses. Additionally,
            language models tend to "hallucinate," inventing information or
            providing overly complex answers that are not grounded in the
            relevant knowledge base. To address these accuracy and reliability
            challenges, integrating a human-in-the-loop approach is essential,
            meaning that a human should review AI-generated feedbacks regularly
            and check for accuracy and context relevance, allowing for
            continuous improvement of AI-generated feedback through human input
            , for example adjusting the rubrics. When compared to the assessment
            setting, the application of AI in the practice scenario reduces the
            impact of potential mistakes made by the AI.
          </li>
          <li>
            <strong>Ethical considerations and data privacy:</strong> The
            collection and use of student data for generating personalized
            feedback raises concerns about consent, transparency, and potential
            misuse. At institutions like the University of Zurich (UZH), there
            are no clear guidelines on data privacy concerning AI applications
            at the time of writing, complicating compliance efforts. However, to
            address these considerations it is important to obtain informed
            consent from students regarding how their data is collected,
            processed, stored, and used (see the implemented privacy policy of
            KlickerUZH). The provider for AI services has to be carefully
            selected and it should be ensured that the data provided by students
            is not used for further training by the provider. Locally hosted
            models might provide a suitable alternative for small-scale use
            cases that are privacy-sensitive. Additionally, strict anonymization
            protocols can help protect personally identifiable information (PII
            ) that students might embed in prompts. It is not allowed for
            lecturers to use the AI-assisted feedback on free-text questions for
            the purpose of assessment without double-checking the scoring.
            Furthermore, if you, as a lecturer, wish to conduct your own
            research using the collected data (e.g., free-text responses), this
            intention must be communicated to the students in advance.
          </li>
          <li>
            <strong>Operational cost:</strong> Implementing AI-driven formative
            feedback systems involves operational costs related to AI use . To
            manage operational costs effectively, institutions should implement
            cost-control mechanisms like, e.g., limiting the number of student
            queries per time period. Exploring open-source models hosted locally
            (e.g., using Ollama) or by trusted providers can also lower expenses
            associated with proprietary solutions. Additionally, optimizing
            resource use by deploying lightweight models for basic queries while
            reserving more resource-intensive models for complex queries can
            help balance costs against educational benefits. The cost of all
            requests will be billed directly by your chosen API providers.
          </li>
        </ul>
      </>
    ),
  },
  ai_practice_content: {
    acknowledgements:
      'We sincerely thank our collaborators and sponsors on this use case: Swissuniversities for funding the development of this use case as part of the P-8/DISK4U project; the University of Zurich (ULF) and the Department of Finance / Teaching Center for sponsoring the development of KlickerUZH and functionalities related to this use case; Xinyu Gong, Qingyu Jiang, Chu Jia, Hailan Yang, Qingxuan Chen for the contribution as part of their master project (UZH IFI) on "AI-assisted Content Generation in KlickerUZH"; Prof. Thomas Fritz and Roy Rutishauser for the collaboration on supervising the aforementioned.',
    title: 'AI-generated Practice Content',
    headerImgSrc: '/img/use_cases/simon-kadula-8gr6bObQLOI-unsplash.jpg',
    tags: ['Content generation', 'Bloom’s taxonomy', 'Constructive alignment'],
    abstract:
      'Leverage artificial intelligence to automatically generate diverse practice questions tailored to your course content and student needs.',
    goals: [
      'Generate comprehensive and pedagogically sound practice materials by leveraging existing teaching resources, thereby significantly reducing the workload for lecturers in developing practice content',
      "Ensure complete coverage of lecture content through systematic question generation that aligns with different cognitive levels of Bloom's taxonomy",
      'Support diverse learning needs through varied question types and adaptation of content difficulty',
      'Maintain high educational quality through AI-assisted validation while preserving lecturer control over final materials',
    ],
    introduction: (
      <>
        <p>
          The creation of high-quality educational content, particularly
          practice questions and assessments, requires a significant time
          investment for lecturers in higher education. Traditional approaches
          require educators to manually craft questions that not only cover
          course material comprehensively but also address different cognitive
          levels of learning. This process becomes increasingly challenging as
          class sizes grow and course content evolves.
        </p>

        <p>
          Large Language Models (LLMs) have emerged as powerful tools for
          automating educational content genera-tion, offering the potential to
          significantly reduce the workload on educators while maintaining
          pedagogical quality. These models can generate diverse question types
          - including single choice, multiple choice, kprim, free text, and
          numerical response questions - from basic recall to complex analytical
          problems, aligned with established educational frameworks like Bloom's
          taxonomy. Research shows that LLM-generated questions can achieve
          quality comparable to manually crafted ones, with some metrics even
          indicating potential improvements in areas such as content coverage
          and learning objective alignment.
        </p>

        <p>
          The integration of AI-powered content generation into educational
          platforms enables a more systematic and efficient approach to creating
          learning materials directly embedding questions into platforms
          familiar to students, thereby eliminating the need for export and
          import processes.
        </p>

        <p>
          Furthermore, students benefit significantly from AI-powered content
          generation. The system provides questions of increasing difficulty,
          allowing learners to progressively develop their understanding from
          basic concepts to complex applications. Through varied question
          formats and comprehensive coverage of course materials, students
          remain engaged while ensuring no critical topics are missed in their
          learning journey.
        </p>

        <p>
          Looking ahead, this technology could potentially be made available
          directly to students, empowering them to generate their own practice
          materials based on specific topics they want to review or areas where
          they need additional reinforcement. Such a self-directed approach to
          content generation would further enhance the personalized learning
          experience while maintaining pedagogical quality through structured
          question generation aligned with educational frameworks.
        </p>
      </>
    ),
    background: (
      <>
        <p>
          AI technologies, particularly generative AI, have the potential to
          improve content creation in higher education . Generative AI can
          produce diverse and immersive educational content, facilitating the
          development of interactive learning materials that cater to various
          learning styles and preferences. By leveraging AI, educators can
          create personalized quizzes and practice questions that align with
          individual student needs, thereby enhancing engagement and retention
          (Kadaruddin, 2023; Murtaza et al., 2022).
        </p>

        <p>
          However, the use of AI in generating educational content is not
          without its challenges. Concerns regarding the accuracy and
          reliability of AI-generated materials are prevalent in literature. For
          instance, biases inherent in AI models can lead to the production of
          misleading or inappropriate content, raising questions about the
          ethical implications of using such technologies in educational
          settings (Alrayes, 2024; Alasadi & Baiz, 2023). Additionally, the
          ethical implications of AI-generated content, including issues of
          plagiarism and academic integrity, are critical concerns for educators
          and institutions (Alasadi & Baiz, 2023; Kanont, 2024).
        </p>

        <p>
          As AI technologies become more sophisticated, the risk of students
          relying on AI-generated materials without proper attribution or
          understanding increases. Therefore, it is essential for educational
          institutions to establish clear policies and guidelines regarding the
          use of AI-generated content to mitigate these risks (Jose, 2024).
          Furthermore, the lack of transparency in AI algorithms can hinder
          educators' ability to assess the quality of the generated content,
          potentially compromising the quality of the generated content (Kanont,
          2024). As such, it is crucial for institutions to establish guidelines
          and best practices for the ethical use of AI in content generation.
        </p>

        <p>
          In addition to ethical concerns, the acceptance of AI technologies by
          students and educators plays a significant role in their successful
          implementation. Research indicates that factors such as perceived
          usefulness, ease of use, and trust in AI systems influence students'
          willingness to engage with AI-generated content (Kanont, 2024).
          Understanding these factors can help educators design AI tools that
          are more likely to be embraced by learners, ultimately enhancing the
          effectiveness of AI in educational contexts.
        </p>

        <p>
          Moreover, the integration of AI in content generation can facilitate
          personalized learning experiences, which are increasingly recognized
          as essential for student success. AI systems can analyze student
          performance data to tailor content delivery, ensuring that learners
          receive materials that match their proficiency levels and learning
          goals (Murtaza et al., 2022; Roshanaei, 2023). This personalized
          approach not only fosters greater engagement but also supports diverse
          learning pathways, accommodating students with varying backgrounds and
          abilities (Jian, 2023).
        </p>

        <p>
          Collaborating with AI technologies allows educators to enhance their
          teaching practices while keeping education human-centered. AI can
          support tasks like creating practice quizzes aligned with course
          objectives, freeing instructors to focus on facilitating deeper
          learning experiences. This partnership positions educators as learning
          facilitators, promoting a more interactive and engaging educational
          environment.
        </p>
      </>
    ),
    scenario: (
      <>
        <p>
          By leveraging AI-driven content generation in KlickerUZH, lecturers
          can develop diverse educational materials. This setup allows lecturers
          to efficiently generate questions and learning materials while
          retaining full control over the final content.
        </p>

        <H3>1. Content Upload and Processing</H3>
        <p>
          As a lecturer, you begin by uploading your teaching materials (PDF
          lecture scripts, slides, or other documents) to KlickerUZH . The
          system uses advanced text segmentation algorithms to maintain the
          hierarchical structure and coherence of your content, preserving
          context and relationships between topics for more effective question
          generation.
        </p>

        <H3>2. AI-Powered Content Analysis</H3>
        <p>
          The system analyzes the provided materials to create a comprehensive
          topic overview and extract key knowledge points. This analysis helps
          identify learning objectives and suggests appropriate question types
          for different content segments. You can review this analysis and
          adjust the focus areas or learning objectives as needed, ensuring
          alignment with your course goals. You can also further parametrize the
          generation to, e.g., focus on questions of a specific type or format.
        </p>

        <H3>3. Question Generation and Selection</H3>
        <p>
          Based on the content analysis, KlickerUZH generates various question
          types (Single Choice, Multiple Choice, Kprim, Free Text, Numerical
          Response, Flashcards, and Content Elements) that align with different
          levels of Bloom's taxonomy. The system ensures balanced coverage
          across cognitive levels while maintaining pedagogical effectiveness.
          You can review, edit, or reject suggested questions, and your feedback
          helps improve future generations.
        </p>

        <H3>4. Quality Assurance and Integration</H3>
        <p>
          Generated questions undergo automated quality checks for relevance,
          fluency, and answerability. You maintain full editorial control, with
          the ability to modify questions or generate alternatives as needed .
          The approved questions can be directly used in learning activities,
          which integrate seamlessly with your course structure in KlickerUZH or
          your learning management system.
        </p>
      </>
    ),
    learnings: (
      <>
        <p>
          In collaboration with the Department of Informatics (IFI) and a
          student team doing their master project, we are currently exploring
          the potential of generating learning materials with AI-based
          approaches directly in KlickerUZH.
        </p>
        <p>
          To systematically validate and further extend these findings, we will
          conduct comprehensive pilot studies during the spring term of 2025.
          Should you be interested in participating, please fill out the form at{' '}
          <a
            href="https://forms.office.com/e/K8CXM2pKhJ"
            target="_blank"
            rel="noopener"
          >
            https://forms.office.com/e/K8CXM2pKhJ
          </a>{' '}
          so that we may contact you. The results of the piloting will be
          evaluated and summarized as part of this use case.
        </p>

        <p>
          Our initial assessment of this use case has also provided several
          significant insights and preliminary learnings regarding the general
          use of AI that are relevant for lecturers regarding the implementation
          of AI use cases. Information about the associated challenges,
          limitations, and remediation strategies for IT can be found here .
        </p>
        <p>Some of our most important preliminary findings include:</p>

        <ul>
          <li>
            <strong>
              Automating question generation through course structure
              understanding:
            </strong>
            Question generation works well when asking for a specific topic
            and/or question type based on given material. However, to achieve
            significant gains in terms of efficiency and to improve content
            coverage, an approach that further automates this step is required.
            The AI system needs to be able to grasp the overall learning goals
            and structure of a course/domain (based on, e.g., a lecture script)
            and should be able to derive practice material in a balanced way,
            making sure that all the content is covered by appropriate questions
            and question types. This essentially results in a two-stage process,
            where the first stage is purely about understanding the domain and
            planning the didactical approach, while the second stage is focused
            on generating content as specified by the defined approach. This
            process can be facilitated by using a dedicated prompt for the first
            and second stage respectively, by providing good examples for both
            stages, as well as by using reasoning models.
          </li>
          <li>
            <strong>
              Addressing challenges in generating higher-order and
              difficulty-specific questions:
            </strong>
            While question generation using prompting strategies works well
            (especially for foundational material), parametrizing for, e.g., a
            specific target difficulty can prove more challenging, due to
            limited reasoning capabilities of the model on this parameter.
            Creating questions on a higher level of Bloom's taxonomy that
            require networked thinking can therefore become a challenge. This
            could be improved by using reasoning models or by giving models
            additional examples (i.e., few shot prompting) of what would be
            classified in what level of Bloom's taxonomy/what difficulty.
          </li>
          <li>
            <strong>Critically analyzing AI-generated questions:</strong> While
            AI excels in generating diverse questions efficiently, it remains
            crucial for lecturers to manually review each question to that the
            questions align with the course objectives and make sense within the
            educational context. This critical analysis by educators ensures
            that the AI-generated content meets the required quality standards
            and effectively supports the learning process.
          </li>
        </ul>
      </>
    ),
  },
  chatbot_tutoring: {
    acknowledgements:
      'We sincerely thank our collaborators and sponsors on this use case: Swissuniversities for funding the development of this use case as part of the P-8/DISK4U project; the University of Zurich (ULF) and the Department of Finance / Teaching Center for sponsoring the development of KlickerUZH and functionalities related to this use case; the Executive Education Finance (UZH WWF) for their startup funding and collaboration when developing the course chatbot for students and participants in executive education.',
    title: 'Chatbots for Individual Tutoring',
    headerImgSrc:
      '/img/use_cases/possessed-photography-JjGXjESMxOY-unsplash.jpg',
    tags: [
      'Individual tutoring',
      'Self-directed learning',
      'Interactive engagement',
      'Personalized feedback',
    ],
    abstract:
      'Provide students with personalized, AI-powered tutoring support that is available 24/7, offering immediate assistance and guidance tailored to individual learning needs.',
    goals: [
      'Enhance the educational experience by supporting on-demand learning and practice',
      'Support personalized learning by tailoring responses to course-specific materials and individual student needs',
      'Enhance student engagement by promoting active problem-solving and critical thinking',
      'Reduce lecturers’ workload by automating responses to frequently asked questions while providing actionable insights through analytics',
      'Ensure seamless integration into existing teaching workflows through compatibility with platforms like OLAT',
    ],
    introduction: (
      <>
        <p>
          Throughout the academic semester, including weekends and evening
          hours, students continuously engage with course materials and may
          develop substantive questions regarding the content. Traditionally,
          students were constrained by limited feedback opportunities, typically
          awaiting responses from tutors in online forums or lecturers during
          intermittent teaching intervals. This is particularly challenging in
          large lecture settings, where instructors face difficulties in
          offering timely and individualized responses.
        </p>
        <p>
          The emergence of Chatbot tutors, powered by Large Language Models like
          ChatGPT and Claude, now enables a transformative approach to learning
          support. These advanced technologies facilitate immediate, detailed,
          and constructive answers to these questions outside regular teaching
          hours.
        </p>
      </>
    ),
    background: (
      <>
        <p>
          Chatbots leverage advanced AI techniques, including natural language
          processing (NLP), machine learning, and neural networks, to simulate
          human-like interactions. Unlike traditional rule-based chatbots, which
          rely on predefined responses, AI chatbots adapt to user inputs, learn
          from interactions, and offer personalized guidance, making them
          valuable tools for enhancing educational experience.
        </p>
        <h3>Educational Applications and Effectiveness</h3>
        <p>
          AI chatbots are used across various educational domains - including
          teaching, learning support, assessment, and administration – serving
          as virtual assistants that answer questions, guide problem-solving
          processes, and provide immediate feedback. For example, Harvard
          University's CS50 course implemented the "CS50 Duck", a virtual tutor
          that encourages reflective problem-solving rather than offering direct
          answers. This approach aligns with pedagogical principles that
          emphasize active learning and critical thinking.
        </p>
        <p>
          The systematic review by Kuhail et al. (2022) underscores the growing
          adoption of educational chatbots due to their cost-effectiveness and
          ability to engage students in personalized learning experiences,
          particularly in online settings where individual educator support is
          limited. Similarly, Mendoza et al. (2022) highlight their utility in
          facilitating access to academic procedures and services for both
          students and teachers. However, they caution that many existing
          chatbots lack the mechanisms necessary to adequately support the
          learning process, signaling a need for further development. Empirical
          evidence supports the effectiveness of AI chatbots in improving
          educational outcomes.
        </p>
        <p>
          Wu and Yu's (2023) meta-analysis of 24 studies found significant
          positive impacts on students' learning, including enhanced
          performance, motivation, interest, and self-efficacy, particularly in
          higher education. The novelty effect of short-term interventions was
          also noted.
        </p>

        <h3>Theoretical Foundations</h3>
        <p>
          The use of AI chatbots is grounded in learning theories such as
          Self-Determination Theory (SDT) and constructivist principles. SDT
          emphasizes the importance of fulfilling students' psychological needs
          for autonomy (choice), competence (effective feedback), and
          relatedness (connection), which chatbots can support by providing
          personalized guidance.
        </p>
        <p>
          Constructivist Learning is enhanced as chatbots encourage
          inquiry-based learning. Cerny (2023) highlights the importance of
          educators' understanding of chatbots to design effective tutoring
          scenarios.
        </p>

        <h3>Practical Benefits</h3>
        <p>
          AI chatbots offer scalability, handling large volumes of queries
          simultaneously, and personalization by tailoring responses to
          individual needs. They ensure accessibility with 24/7 availability and
          multilingual capabilities, and they improve cost efficiency by
          automating routine tasks. Chatbots also enhance engagement through
          natural language interactions, as noted by Huang et al. (2021). These
          benefits make AI chatbots an attractive solution for institutions
          seeking to enhance both academic support and administrative
          efficiency.
        </p>

        <h3>Challenges and Opportunities</h3>
        <p>
          Despite their benefits, implementing chatbots presents challenges.
          Hwang and Chang (2021) point out technical limitations and the need
          for robust design frameworks. Gabriel et al. (2021) stress identifying
          tasks suitable for automation while maintaining educators' focus on
          complex activities. Chiu et al. (2023) highlight the role of teacher
          involvement in fostering student motivation. To address these issues,
          thoughtful design strategies and collaboration between educators and
          developers are crucial.
        </p>
        <p>
          The literature reveals a complex interplay of benefits and challenges
          associated with chatbot use in higher education. While they offer
          promising avenues for enhancing student engagement and personalized
          learning experiences, successful implementation requires careful
          consideration of design principles, educator involvement, and ongoing
          development to address existing limitations. As institutions continue
          exploring these technologies, further research will be essential to
          fully realize their transformative potential.
        </p>
      </>
    ),
    scenario: (
      <>
        <p>
          By integrating a course-specific chatbot tutor into KlickerUZH, you
          create an engaging and supportive learning environment that
          complements traditional teaching methods while fostering autonomy and
          engagement among students. Future analytics capabilities will empower
          lecturers by offering data-driven insights into student learning
          behaviors and course effectiveness.
        </p>

        <h3>1. Preparing a Course Chatbot</h3>
        <p>
          As a lecturer, you aim to provide your students with a flexible and
          interactive way to engage with course materials outside the classroom.
          To achieve this, you start by creating a course in KlickerUZH and
          uploading relevant teaching materials, such as lecture slides, lecture
          transcripts , or additional resources. These materials form the
          knowledge base for the chatbot, enabling it to provide tailored
          responses to student queries. You can also customize the chatbot's
          settings, such as specifying the target language, adjusting the
          language proficiency level (A1-C2), and adding specific guidance or
          instructions for students.
        </p>

        <Figure
          imgSrc="/img/use_cases/chatbot_data.png"
          caption="Knowledge base for a course-specific chatbot as used in Banking
    and Finance I with 900 students"
        />

        <p>
          Once configured, KlickerUZH generates a unique link to your
          course-specific chatbot, which you can integrate directly into your
          learning management system (LMS) via LTI (e.g., OLAT). Additionally,
          your chatbot is available to students logged-in through the KlickerUZH
          app. This integration ensures seamless access for students through
          familiar platforms. A student log-in and course participation are
          required to interact with chatbots to allow for both cost control and
          moderation of access.
        </p>

        <Figure
          imgSrc="/img/use_cases/chatbot_example.png"
          caption="Example of a course-specific chatbot interface as used in Banking
    and Finance I with 900 students"
        />

        <p>
          Enabling the chatbot functionality requires providing an API key for
          one or multiple AI providers such as Azure OpenAI, OpenAI, Anthropic,
          or others. To manage costs effectively, you can set a usage limit per
          student and time period (e.g., $1 USD per month per student). The cost
          of chatbot requests will be billed directly by your chosen API
          providers. For an estimation of cost based on our experiences, please
          refer to the final section of our use case.
        </p>

        <h3>2. Using the Chatbot with Students</h3>
        <p>
          Students access the chatbot through OLAT or the KlickerUZH app and use
          it to ask questions related to the course content. The chatbot
          provides immediate, context-aware responses based on your uploaded
          materials. Rather than giving direct answers, the chatbot's tutoring
          mode seeks to encourage critical thinking by guiding students toward
          solutions, fostering deeper engagement with the material. This
          approach aligns with pedagogical best practices by promoting active
          problem-solving and self-directed learning.
        </p>
        <p>
          Students are able to select from a set of different language models –
          based on your parameters and provided API keys – and can choose a
          suitable chat mode. An additional “explainer” mode can be chosen by
          students for questions that are not suitable for tutoring or when a
          more detailed explanation is expected.
        </p>
        <p>
          Additionally, students are shown the number of credits they have
          remaining and the time at which the credits are reset. The number of
          available credits depends on the lecturer's settings regarding maximum
          cost per time period and student, as well as on the real usage of the
          student within that time period.
        </p>

        <h3>3. Learning Analytics on AI</h3>
        <p>
          In the future, advanced learning analytics for AI could further
          enhance the chatbot's value as an educational tool. These analytics
          provide lecturers with aggregated insights into student interactions
          with chatbots. For example, you will be able to identify topics that
          generate frequent queries, highlighting areas where students commonly
          struggle or need additional support. Sentiment analysis could also be
          used to detect patterns in student confidence or frustration levels
          during interactions.
        </p>
        <p>
          Metrics such as "response success rates" (how often students find
          chatbot responses helpful) and "engagement trends" (frequency and
          timing of student interactions) will offer actionable feedback on both
          student learning behaviors and the effectiveness of the chatbot. This
          data will help inform adjustments to teaching strategies or updates to
          course content. Importantly, all analytics will remain anonymized to
          protect student privacy while providing you with meaningful insights
          into collective learning trends.
        </p>

        <h3>4. Expanding your Knowledge Base</h3>
        <p>
          Based on student interactions with the chatbot, KlickerUZH's learning
          analytics could help identify and summarize frequently asked questions
          (FAQs). These FAQs can be reviewed by lecturers or teaching assistants
          to ensure their relevancy and alignment with course objectives. Once
          the response for these FAQs has been verified or adjusted, the FAQs
          can be added to the chatbot's knowledge base. Through this iterative
          process, the knowledge base is gradually extended, ensuring that
          future queries on similar topics are answered more efficiently while
          maintaining consistency across responses.
        </p>
      </>
    ),
    learnings: (
      <>
        <p>
          At the Department of Finance, University of Zurich, we have conducted
          initial tests with AI-powered tutors in our large-scale undergraduate
          courses with up to 900 students. In this use case, we share our
          practical experiences from initial testing phases, key considerations,
          and preliminary insights from our pilot implementations.
        </p>
        <p>
          To systematically validate and further extend these findings, we will
          conduct comprehensive pilot studies during the spring term of 2025.
          Should you be interested in participating, please fill out the form at{' '}
          <a
            href="https://forms.office.com/e/K8CXM2pKhJ"
            target="_blank"
            rel="noopener"
          >
            https://forms.office.com/e/K8CXM2pKhJ
          </a>{' '}
          so that we may contact you. The results of the piloting will be
          evaluated and summarized as part of this use case.
        </p>
        <p>
          Our initial assessment of this use case has also provided several
          significant insights and preliminary learnings regarding the general
          use of AI that are relevant for lecturers regarding the implementation
          of AI use cases. Information about the associated challenges,
          limitations, and remediation strategies for IT can be found here .
        </p>
        <p>Some of our most important preliminary findings include:</p>
        <ul>
          <li>
            <strong>Didactic challenges</strong>: AI chatbots, when implemented
            naively, may hinder learning by providing direct answers to all
            student queries. This approach risks discouraging critical thinking,
            problem solving, and inquiry based learning, as students may become
            overly reliant on the chatbot for solutions. Overuse of such tools
            can undermine the development of essential academic and cognitive
            skills, particularly in foundational courses where building a deep
            understanding of concepts is critical.
            <ul>
              <li>
                Evaluate a tutoring approach. Chatbots can guide students toward
                solutions by offering hints, asking counter questions, or
                breaking problems into smaller steps. This approach fosters
                active engagement and critical thinking. Encourage students to
                ask exploratory questions and reflect on their understanding by
                designing chatbot prompts that stimulate curiosity and deeper
                inquiry.
              </li>
              <li>
                Introduce mechanisms that prompt students to reflect on their
                interactions with the chatbot. For instance, limiting the number
                of queries per session can encourage thoughtful engagement and
                discourage over reliance on quick answers.
              </li>
              <li>
                Use analytics tools to track how students interact with the
                chatbot. Identify patterns of over reliance or surface level
                engagement and use this data to refine chatbot behavior and
                learning materials. For example, we identified that some
                students copy/paste questions from our practice quizzes or
                exercises to get additional explanations (which could mean that
                the explanations in these quizzes are not satisfactory).
              </li>
              <li>
                Create assignments that require higher order thinking,
                creativity, or personal reflection—tasks that are less likely to
                be fully solvable by chatbots (e.g., open ended questions,
                project based tasks). Encourage students to use AI on these
                tasks to help them build up essential AI skills.
              </li>
            </ul>
          </li>
          <li>
            <strong>Enabling specific use cases</strong>: There are many
            different use cases for chatbots in teaching. For example, chatbots
            can be used to explain complex topics, to tutor students while
            solving problems, or to provide students with practice material. The
            chatbot should be tuned for the specific use cases by means of
            specific prompts and examples such that the responses align with
            learning goals. In our example, after many students asked the tutor
            to "just give the explanation", we implemented a dedicated control
            for students where they could select between "Tutor" and "Explainer"
            mode, switching out the system prompt applied. While this is now
            heavily used, most students still manually select the tutoring mode
            to get step by step support. A recent use case we can see is
            students trying to generate practice questions from contents, or
            summarizing the entire lecture content, which are future use cases
            we might cover with dedicated options (as the existing modes do not
            cover these use cases with dedicated examples).
          </li>
          <li>
            <strong>Adoption rate and usage</strong>: While early student
            feedback has been very positive, we also observed that adoption
            rates varied significantly, with some students seeming very invested
            in using the chatbot and others continuing to use familiar tools
            like ChatGPT or choosing not to engage with AI systems at all. In
            our first semester course with 900 students, some students used
            multiple millions of tokens across all of their conversations.
            During exam time, we received up to 750 messages per day from
            students preparing for the exam. Overall, the chatbot served about
            14'000 responses throughout the semester, more than half of it
            during the last month of the semester.
          </li>
          <li>
            <strong>Student feedback</strong>: Overall, the students that used
            the chatbot really liked the experience. Some specific points that
            were mentioned in a survey include the following:
            <ul>
              <li>
                Students liked that the knowledge base was restricted and did
                not introduce material outside of the course contents, and that
                the tutor mode did not provide the solution immediately (and
                ChatGPT or similar would have to be explicitly told to not
                respond out of scope).
              </li>
              <li>
                The inclusion of lecture transcripts was noted as a plus as also
                administrative matters and current developments are included,
                though it is recommended to double check transcripts before
                adding them to the knowledge base.
              </li>
              <li>
                Students also liked that the chatbot provided references to the
                source material, though in some cases these could also be
                hallucinated (which could be automatically identified as a
                future improvement).
              </li>
              <li>
                Students also highlighted the capability of switching language
                models and the learning effect when interacting with different
                models (more and less capable, across different providers). This
                seems to be an important skill when interacting with AI and is a
                large benefit.
              </li>
              <li>
                Some students would have liked a way of uploading files to get a
                solution (e.g., an exercise) though this was explicitly not the
                goal of our tutoring approach.
              </li>
              <li>
                Sometimes, the tutoring mode leads into a different direction
                than the original question, as there will always be a follow up
                question (no going back to the original topic once the question
                has been answered).
              </li>
              <li>
                Some students noted that they did not use the chatbot at all
                because they do not trust AI to respond with accurate
                information and that they rather look at the source materials on
                their own (e.g., the lectures, the e learning, the lecture
                script).
              </li>
            </ul>
          </li>
          <li>
            <strong>Operational cost</strong>: We estimate that future
            iterations of such a course could cost about $1.5 per student (with
            further improvements in efficiency/performance and providing the
            full experience, and assuming similar adoption). The cost of AI is
            largely based on the consumed "tokens" for the input sent to the AI
            provider (e.g., OpenAI) and the output generated by them. In our
            pilots, token usage varied between about 5000 to 30000 tokens for a
            single request from a student (depending on the size of the context,
            the length of the chat history, etc.). With AI being mostly billed
            per million tokens (e.g., $2.50/$10.00 for input/output of GPT-4o),
            this would place the cost of a normal request with a capable model
            (e.g., GPT-4o, Claude Sonnet 3.5) at about $0.05 to $0.10 (for just
            the AI provider, there are a few other cost elements that are not
            directly visible). Using more capable models (e.g., with reasoning
            capabilities) would increase this cost, while using smaller models
            (e.g., Llama 3.3 70b or GPT-4o mini) would significantly decrease
            this cost. There are further measures to reduce AI cost (e.g.,
            caching) that are either taken automatically by the provider
            (OpenAI) or have to be applied manually (Anthropic).
          </li>
          <li>
            <strong>Cost control</strong>: To control cost, we provided students
            with "credits" that they were able to use for AI requests.
            Initially, students got 1000 credits corresponding to about $1 in AI
            usage, with a monthly reset of these credits. Later on in the
            semester, these credits were changed to a weekly and then daily
            reset to allow students to prepare for the exam. This made sure that
            all students had the same allowance and our budget would not run out
            unexpectedly. Additionally, the restriction encouraged students to
            think about the requests they want to send to the chatbot, and to be
            mindful when choosing the AI model to use (e.g., choose cheaper
            models for easier questions). It is therefore recommended to always
            add some kind of restriction even in the case of budget not being a
            concern.
          </li>
          <li>
            <strong>Maintenance effort</strong>: Chatbots require a maintenance
            effort in that the cost and resource usage needs to be monitored and
            billing accounts (e.g., OpenAI platform) need to be topped up
            regularly. The knowledge base needs to be continuously updated,
            especially if lecture transcripts or slides are provided to the
            chatbot (which might make sense to have more current and
            organizational information included).
          </li>
          <li>
            <strong>Copyright</strong>: For copyright reasons, only materials
            for which the lecturer/creator of the chatbot has the rights to
            redistribute them should be added to the knowledge base. The chatbot
            will implicitly redistribute these materials to students and might
            output them "verbatim" from time to time. Also, consent from all
            lecturers of the course should be gathered, especially if
            transcripts are to be generated and used for the chatbot (such that
            they are aware of the implications).
          </li>
          <li>
            <strong>Monitoring</strong>: Student behavior when using the chatbot
            should be monitored (by looking at the questions asked and responses
            generated) such that potential misuse can be identified and
            addressed early on. For example, certain conversations and materials
            are not allowed by the API providers (e.g., OpenAI) and it might
            result in problems if students continuously engage in such a way.
            This requires the usage of an LLM monitoring software that allows
            tracking user sessions and "traces" (user messages) along the token
            usage and cost of requests.
          </li>
          <li>
            <strong>Digital literacy</strong>: Not all students have equal
            access to digital tools or possess the skills needed to effectively
            use AI chatbots. This may exacerbate educational inequalities,
            potentially leaving some students at a disadvantage. To enhance
            digital literacy, lecturers should offer workshops or training
            sessions during class aimed at improving students' digital literacy
            and AI skills.
          </li>
          <li>
            <strong>Ethical Considerations and Data Privacy</strong>: The
            integration of AI chatbots into higher education presents
            significant ethical and privacy concerns. Although well designed
            systems can reduce the transmission of personal data to external
            providers and the use of queries for model training, there remains a
            risk that students might inadvertently include sensitive information
            in their interactions/prompts. This could result in the external
            processing or storage of personal data, potentially violating
            privacy regulations and eroding user trust. In your lectures, ensure
            that students are fully informed about how their data is collected,
            processed, stored, and used. Clearly label chatbots as non human
            entities in compliance with the EU AI Act. Implement mechanisms to
            monitor chatbot interactions to identify potential ethical issues or
            misuse. Educate students on responsible chatbot use through
            onboarding materials or reminders within the chatbot interface,
            emphasizing the importance of avoiding the inclusion of sensitive
            information in queries. While there are also technical measures to
            prevent the leakage of personal information, these are more
            difficult to set up and would require an LLM that runs locally.
          </li>
          <li>
            <strong>Missing accuracy and contextual relevance</strong>: AI
            chatbots, while powerful, are prone to generating incorrect or
            misleading responses ("hallucinations"). These inaccuracies can
            confuse students, particularly when the chatbot provides overly
            complex or irrelevant answers that do not align with course
            materials. Additionally, the static nature of pre trained models
            means they lack real time updates, which can exacerbate
            inconsistencies in their responses. When allowing students to flag
            low quality responses, provide feedback (e.g., thumbs up, comment),
            or request regeneration, a human moderator should review these
            questions and adjust the learning materials/knowledge base or other
            chatbot parameters. It is also an option to provide corrections for
            wrong responses or to label responses as "human verified", though
            this is challenging in terms of workload.
          </li>
        </ul>
      </>
    ),
  },
}
