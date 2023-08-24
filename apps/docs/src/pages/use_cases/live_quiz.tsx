import Layout from '@theme/Layout'
import { H1, H2, H3, Tag } from '@uzh-bf/design-system'

export default function live_quiz() {
  return (
    <Layout>
      <img
        className={'max-h-20 w-full object-cover md:max-h-80'}
        src="https://img.freepik.com/free-vector/web-help-support-page-template-design_1017-26772.jpg?w=996&t=st=1692859143~exp=1692859743~hmac=7f1540098197c20df60c26ceb08933f99857304b4aa230c0a795cd77d910323c"
      />
      <div className="flex flex-col max-w-6xl p-8 m-auto md:flex-row">
        <div className="p-4 md:w-2/3">
          <H1>(Gamified) Live Quizzes</H1>
          <div className="flex flex-row flex-wrap">
            <Tag
              label="Interactive lecture"
              className={{ root: 'mr-1 mt-1' }}
            />
            <Tag label="Student Engagement" className={{ root: 'mr-1 mt-1' }} />
            <Tag
              label="Interaction in teaching "
              className={{ root: 'mr-1 mt-1' }}
            />
            <Tag label="Immediate feedback" className={{ root: 'mr-1 mt-1' }} />
            <Tag
              label="Surveys and opinions"
              className={{ root: 'mr-1 mt-1' }}
            />
            <Tag
              label="Estimation questions"
              className={{ root: 'mr-1 mt-1' }}
            />
            <Tag
              label="Knowledge evaluation"
              className={{ root: 'mr-1 mt-1' }}
            />
            <Tag label="Gamification" className={{ root: 'mr-1 mt-1' }} />
          </div>
          <H3 className={{ root: 'pt-4' }}>Introduction</H3>
          <p>
            Teachers often face the challenge of engaging all students,
            especially in courses with large numbers of participants. Many
            students may hesitate to contribute verbally in front of their
            peers, leading to decreased participation. Classroom Response
            Systems (CRS) like the KlickerUZH are specifically designed to
            address this issue by providing a more comfortable and inclusive
            learning environment. The KlickerUZH enables students to actively
            participate in courses by quickly and easily responding to polls and
            answering prepared questions. This allows them to provide valuable
            feedback on their understanding of the subject matter, their level
            of knowledge or even opinions. Gamification elements improve
            motivation to answer the questions e.g., by distributing points for
            answering. Anonymity is a key feature that facilitates active
            contributions, as students have the option to participate
            anonymously, reducing potential barriers or fear of judgment.
            Teachers can create an environment that encourages active engagement
            and fosters student participation, ultimately enhancing the learning
            experience for all students.
          </p>
          <H3 className={{ root: 'pt-4' }}>Background</H3>
          <p>
            Interactivity and gamification elements in the context of teaching
            are widely researched areas and show positive effects on student
            learning outcomes. A significant element of classroom interactivity
            is the use of surveys and live quizzes that provide students with
            immediate feedback on their understanding of the material. As Hattie
            (2008) points out, this immediate feedback allows students to better
            grasp concepts and quickly clear up misconceptions. This active
            engagement with the subject matter fosters an interactive and
            dynamic learning environment, resulting in improved comprehension
            and retention of information. Furthermore, in their meta-analysis,
            Freeman et al. (2014) compared the performance of different teaching
            styles with and without the use of interactive elements. The results
            clearly show that interaction in an instructional context led to
            higher student engagement and deeper processing of content. This
            deeper processing in turn led to improved overall course performance
            compared to traditional teaching. Another effective tool in
            education is gamification. Research by Sailer & Homner (2020)
            examined the effects of gamification on cognitive and behavioral
            learning outcomes. The results show that gamified learning not only
            improves students' cognitive skills, but also positively influences
            their behavior in the learning environment. In this regard, the
            aspect of challenge in gamification has a motivating effect on
            students and may be evidenced by an increased interest in the
            learning content. Want to find out how to encourage active
            participation from your students, in addition to live quizzes and
            polling? Learn more by exploring the following advice on UZH
            Teaching Tools.
          </p>
        </div>
        <div className="p-4 bg-red-600 rounded shadow flex-non md:w-1/3">
          <H2>Goals</H2>
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
    </Layout>
  )
}
