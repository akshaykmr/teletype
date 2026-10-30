export const getSessionIdentity = (session: string) => {
  const [userId, , userType] = session.split(':')
  return {userId, userType}
}

export const canWrite = (session: string, userId: string, multiplex: boolean) => {
  const identity = getSessionIdentity(session)
  return identity.userId === userId || (multiplex && identity.userType !== 'task')
}
