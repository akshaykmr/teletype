export const loadHarnessHost = async () => {
  try {
    import.meta.resolve('oorja-harness-host')
  } catch (error) {
    throw new Error('Harness hosting is not installed. Install it with: npm install --global oorja-harness-host', {
      cause: error,
    })
  }
  return import('oorja-harness-host')
}
