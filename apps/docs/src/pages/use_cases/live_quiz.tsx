import UseCaseLayout from '@site/src/components/usecases/UseCaseLayout'
import USE_CASES from '../../constants'

const useCase = USE_CASES['live_quiz']

function LiveQuiz() {
  return (
    <UseCaseLayout
      path="/use_cases/live_quiz"
      headerImgSrc={useCase.headerImgSrc}
      title={useCase.title}
      tags={useCase.tags}
      introduction={useCase.introduction}
      background={useCase.background}
      scenario={useCase.scenario}
      learnings={useCase.learnings}
      goals={useCase.goals}
    />
  )
}

export default LiveQuiz
