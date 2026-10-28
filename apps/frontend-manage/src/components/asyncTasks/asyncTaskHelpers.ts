import {
  AsyncTaskStatus,
  type GetAsyncTasksQuery,
} from '@klicker-uzh/graphql/dist/ops'

export type AsyncTaskData = GetAsyncTasksQuery['asyncTasks'][number]

export function isActiveTask(task: AsyncTaskData) {
  return (
    task.status === AsyncTaskStatus.Queued ||
    task.status === AsyncTaskStatus.Running
  )
}

export function isTerminalTask(task: AsyncTaskData) {
  return (
    task.status === AsyncTaskStatus.Succeeded ||
    task.status === AsyncTaskStatus.Failed
  )
}

export function getManageCoursePath(courseId: string) {
  return `/courses/${courseId}`
}
