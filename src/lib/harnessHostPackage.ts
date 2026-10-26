export const loadHarnessHost = async () => {
  try {
    return await import('oorja-harness-host')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ERR_MODULE_NOT_FOUND') {
      throw new Error(
        'Harness hosting is not installed. Install it with: npm install --global oorja-harness-host',
        {cause: error},
      )
    }
    throw error
  }
}
