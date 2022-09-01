import React from 'react'

interface QuestionAreaProps {
  instances: any[]
}

function QuestionArea({ instances }: QuestionAreaProps): React.ReactElement {
  return <div className="w-full h-full">Question Area Component</div>
}

export default QuestionArea
