type ProfileType = 'GitHub' | 'Google' | 'anon'

export type RoomApp = {
  appId: string
  config: any
}

export type RoomApps = {
  defaultFocus?: string
  appList: RoomApp[]
}

export type UserProfile = {
  id: string
  name: string
  nickname: string
  picture: string
  profileType: ProfileType
}

type ResourceTimestamps = {
  createdAt: Date
  updatedAt: Date
}

export type CliManifest = {
  cliVersion: number
}

export type User = UserProfile & ResourceTimestamps

export type Room = {
  id: string
  creator_id: string
  locked: boolean
  name: string
  participants: UserProfile[]
  apps: RoomApps
}

export type RoomKey = {
  roomId: string
  key: Buffer
}

export type ParticipantAccess = 'full_access' | 'can_edit' | 'can_view'

export type RoomInvite = {
  id: string
  creatorId: string
  insertedAt: string
  inviteCode: string
  participantAccess: ParticipantAccess
  roomId: string
}

export type NewRoomInviteResponse = {
  allInvites: RoomInvite[]
  data: RoomInvite
}
