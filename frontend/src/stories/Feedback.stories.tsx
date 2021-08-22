import React from 'react'
import { ComponentStory, ComponentMeta } from '@storybook/react'

import Feedback from '../components/interaction/feedbacks/Feedback'

export default {
  title: 'Example/Feedback',
  component: Feedback,
} as ComponentMeta<typeof Feedback>

const Template: ComponentStory<typeof Feedback> = (args) => <Feedback {...args} />

export const Primary = Template.bind({})

Primary.args = {
  votes: 2,
  content: 'Feedback',
}
