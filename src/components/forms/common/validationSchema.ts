import { string, ref } from 'yup'

export default {
  email: string().email().lowercase(),
  institution: string(),
  password: string().min(8),
  passwordRepeat: string()
    .min(8)
    .oneOf([ref('password'), null]),
  sessionName: string().min(1),
  shortname: string()
    .min(3)
    .max(8)
    .matches(/^[A-Za-z0-9]+$/)
    .lowercase(),
  useCase: string(),
}
