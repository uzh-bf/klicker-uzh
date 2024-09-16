const validateFieldSync = async (
  field: string,
  validateField: (field: string) => Promise<void> | Promise<string | undefined>
) => {
  try {
    await validateField(field)
  } catch (error) {
    console.error(error)
  }
}

export default validateFieldSync
