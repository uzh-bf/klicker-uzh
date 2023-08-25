import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import TreeItem from '@mui/lab/TreeItem'
import TreeView from '@mui/lab/TreeView'
import Layout from '@theme/Layout'
import { H1, H2, Tag } from '@uzh-bf/design-system'
import { useCases } from './constants'

export default function live_quiz() {
  const useCase = useCases.find(
    (useCase) => useCase.detailsRef === live_quiz.name
  )

  return (
    <Layout>
      <img
        className={'max-h-20 w-full object-cover md:max-h-80'}
        src={useCase.imageSrc}
      />
      <div className="p-4 m-auto max-w-7xl md:pt-8">
        <div className="grid items-start gap-4 grid-row md:grid-cols-11 md:flex-row md:gap-8">
          <div className="hidden col-span-2 border shadow rounded-xl md:grid">
            <TreeView
              aria-label="file system navigator"
              defaultCollapseIcon={<ExpandMoreIcon />}
              defaultExpandIcon={<ChevronRightIcon />}
              defaultExpanded={['1']}
              multiSelect
            >
              <TreeItem nodeId="1" label="📖 Content">
                <a
                  href="#Introduction"
                  className="text-inherit hover:text-inherit hover:no-underline"
                >
                  <TreeItem nodeId="2" label="Introduction" />
                </a>
                <a
                  href="#Background"
                  className="text-inherit hover:text-inherit hover:no-underline"
                >
                  <TreeItem nodeId="3" label="Background" />
                </a>
                <a
                  href="#Scenario"
                  className="text-inherit hover:text-inherit hover:no-underline"
                >
                  <TreeItem
                    nodeId="4"
                    label="Scenario Description with KlickerUZH"
                  />
                </a>
                <a
                  href="#Learnings"
                  className="text-inherit hover:text-inherit hover:no-underline"
                >
                  <TreeItem nodeId="5" label="Our Learnings" />
                </a>
              </TreeItem>
              <TreeItem nodeId="6" label="📚 Other Use Cases">
                {useCases.map((useCase) => (
                  <TreeItem
                    nodeId={useCase.title}
                    label={useCase.title}
                    onClick={() =>
                      window.open(`/use_cases/${useCase.detailsRef}`, '_self')
                    }
                  />
                ))}
              </TreeItem>
            </TreeView>
          </div>
          <div className="order-2 col-span-6 p-4 prose max-w-none md:order-1">
            <H1>{useCase.title}</H1>
            <div className="flex flex-row flex-wrap">
              {useCase.tags?.map((tag) => (
                <Tag label={tag} className={{ root: 'mr-1 mt-1 ' }} />
              ))}
            </div>

            <section id={'Introduction'}>
              <H2>Introduction</H2>
              <p>
                Teachers often face the challenge of engaging all students,
                especially in courses with large numbers of participants. Many
                students may hesitate to contribute verbally in front of their
                peers, leading to decreased participation. Classroom Response
                Systems (CRS) like the KlickerUZH are specifically designed to
                address this issue by providing a more comfortable and inclusive
                learning environment. The KlickerUZH enables students to
                actively participate in courses by quickly and easily responding
                to polls and answering prepared questions. This allows them to
                provide valuable feedback on their understanding of the subject
                matter, their level of knowledge or even opinions. Gamification
                elements improve motivation to answer the questions e.g., by
                distributing points for answering. Anonymity is a key feature
                that facilitates active contributions, as students have the
                option to participate anonymously, reducing potential barriers
                or fear of judgment.
              </p>
              <p>
                Teachers can create an environment that encourages active
                engagement and fosters student participation, ultimately
                enhancing the learning experience for all students.
              </p>
            </section>
            <section id="Background">
              <H2>Background</H2>
              <p>
                Interactivity and gamification elements in the context of
                teaching are widely researched areas and show positive effects
                on student learning outcomes. A significant element of classroom
                interactivity is the use of surveys and live quizzes that
                provide students with immediate feedback on their understanding
                of the material. As Hattie (2008) points out, this immediate
                feedback allows students to better grasp concepts and quickly
                clear up misconceptions. This active engagement with the subject
                matter fosters an interactive and dynamic learning environment,
                resulting in improved comprehension and retention of
                information. Furthermore, in their meta-analysis, Freeman et al.
                (2014) compared the performance of different teaching styles
                with and without the use of interactive elements. The results
                clearly show that interaction in an instructional context led to
                higher student engagement and deeper processing of content. This
                deeper processing in turn led to improved overall course
                performance compared to traditional teaching. Another effective
                tool in education is gamification. Research by Sailer & Homner
                (2020) examined the effects of gamification on cognitive and
                behavioral learning outcomes. The results show that gamified
                learning not only improves students' cognitive skills, but also
                positively influences their behavior in the learning
                environment. In this regard, the aspect of challenge in
                gamification has a motivating effect on students and may be
                evidenced by an increased interest in the learning content. Want
                to find out how to encourage active participation from your
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
            </section>
            <section id="Scenario">
              <H2>Scenario Description with KlickerUZH</H2>
              <p>
                You are a lecturer and want to increase the interaction between
                you and your students in a lecture or seminar in-person or
                online by using the KlickerUZH. To achieve this, it is essential
                to carefully plan and prepare questions in advance that you can
                ask your students during the session. It also makes sense to
                consider in advance what you can do with the results afterwards
                in order to optimally exploit them. You can discuss them in a
                plenary session, for example.
              </p>
              <p>You can implement questions with the following purposes:</p>
              <ul>
                <li>
                  Knowledge evaluation: To check whether the students have
                  understood the previously learned knowledge, single-choice
                  questions with a clear answer are suitable. (Example: What is
                  the definition of the Sharpe ratio?)
                </li>
                <li>
                  Surveys: To obtain students' opinions on the topic being
                  covered lecturers can ask questions without right or wrong
                  answers. (Example: Which factors influence stock prices the
                  most?). As the results are promptly available to you as
                  lecturer, you may choose to share the findings with the class
                  to facilitate further discourse and interaction.
                </li>
                <li>
                  Estimation questions: To activate students’ engagement,
                  questions can be asked without a clear answer. This makes
                  students think about the discussed topic and gets them
                  directly involved. (Example: Where will the SMI be at the end
                  of 2023?) Depending on your goals, you can add gamification
                  elements to your quizzes. Gamified live quizzes increase
                  student motivation and add a fun and competitive component to
                  lectures which can enhance students’ ambition and motivation.
                  Several questions can be asked directly after each other (with
                  a timer) to best create a quiz situation. Participants can
                  gather points while responding to questions. Points are
                  awarded based on the correctness of the answer, as well as the
                  speed/delay between the first correct answer and one’s own
                  answer (if correct). A leaderboard shows the current ranking
                  of participants within the quiz and gathered points are
                  transferred to the course leaderboard after the conclusion of
                  the quiz (if enabled on a course level). For more information
                  on gamification elements in lectures, please consult
                  Gamification.
                </li>
              </ul>
            </section>
            <section id="Learnings">
              <H2>Our Learnings</H2>
              <p>
                Since the KlickerUZH’s initial release and first implementation
                in 2011, the increasing number of user registrations confirms
                the need for such a tool in teaching.
              </p>
              <p>
                At the University of Zurich, the KlickerUZH has been used in
                small, large (200-400 students), and very large (800-1500
                students) lectures since its inception. Here are our combined
                learnings:
              </p>
              <ul>
                <li>
                  Lecture time consumption: Including a KlickerUZH question in a
                  lecture typically takes approximately 2 to 5 minutes,
                  considering the time required for answering and discussion.
                </li>
                <li>
                  Pre-lecture time consumption: The lecturer also needs time to
                  create and implement the questions in KlickerUZH before the
                  lecture.
                </li>
                <li>
                  Reaction to voting results: As a teacher, you have to react
                  quickly to the voting results. This can be challenging,
                  especially when the results are not as expected. It is
                  advisable to consider the reaction to the results in advance
                  of the lecture.
                </li>
                <li>
                  Submitted responses: The participation rate varies depending
                  on the course but can be estimated at an average of 50% of the
                  attending students. It should be noted that when lectures are
                  recorded, students who watch the recordings may not have the
                  opportunity to actively participate, thus missing out on the
                  interactive benefits offered by KlickerUZH.
                </li>
                <li>
                  Participation level: The participation level in gamified live
                  quizzes tended to be higher in smaller lectures, likely due to
                  the sense of belonging within a smaller group.
                </li>
                <li>
                  Student feedback: From the students' perspective, the use of
                  KlickerUZH is generally regarded as beneficial (average grade
                  across several years in different DBF lectures: 5.0/6.0). Some
                  critical voices express concerns about time loss and question
                  the effective benefits.
                </li>
                <li>
                  Question type: So far, single-choice questions have been
                  predominantly used.
                </li>
                <li>
                  Devices: According to an internal survey in spring semester
                  2023 in one of the KlickerUZH 3.0 pilot lectures, most
                  students (35 / 82) participated in the live quiz through the
                  Learning Management System (LMS). Another significant portion
                  (33 / 82) joined the quiz by scanning the QR code shared by
                  the lecturer. Only a small number of students (6 / 82) joined
                  through a bookmark, and (4 / 82) opted to participate using
                  the KlickerUZH App.
                </li>
                <li>
                  Number of uses per session: In the events organized by the
                  Department of Banking and Finance, KlickerUZH is mainly
                  utilized in bachelor-level lectures with a large number of
                  students (150-800 students). In a single semester (14 weeks),
                  KlickerUZH was used between three to seven times in these
                  sessions, with an average of three questions asked per
                  session.
                </li>
                <li>
                  Gamification: Incorporating gamification worked effectively by
                  creating a quiz-like atmosphere in the lecture hall and
                  considering incentives or rewards, such as small gifts, to
                  enhance participation and engagement.
                </li>
              </ul>
            </section>
          </div>

          <div className="order-1 col-span-6 p-4 prose rounded shadow md:order-2 md:col-span-3">
            <H2>🎯 Goals</H2>
            <ul>
              <li>
                Activate and encourage student engagement by incorporating
                interactive questions and surveys during the lecture.
              </li>
              <li>Make courses more relaxed, interactive and adaptive.</li>
              <li>
                Improve motivation by incorporating interactive gamification
                elements.
              </li>
              <li>
                Evaluate feedback from your students (e.g., opinions or level of
                knowledge).
              </li>
            </ul>
          </div>
        </div>
      </div>
    </Layout>
  )
}
