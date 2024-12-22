import * as crypto from 'crypto'
import {RoomKey} from './connect/types.js'
import {encode, decode} from '@msgpack/msgpack'

export type EncryptedPayload = {
  iv: Buffer | Uint8Array
  data: Buffer | Uint8Array
}

const ALG = 'aes-128-gcm'
const KEY_SIZE = 16 // 128 bit AES
const AUTH_TAG_LEN = 16

export const createRoomKey = (roomId: string): RoomKey => ({
  roomId,
  key: createAESEncryptionKey(),
})

const createAESEncryptionKey = () => crypto.randomBytes(KEY_SIZE)

export const exportKey = (key: Buffer) => key.toString('base64')

export const importKey = (exportedKey: string) => Buffer.from(exportedKey, 'base64')

const createIV = () => crypto.randomBytes(16)

export const encrypt = (data: any, roomKey: RoomKey): EncryptedPayload => {
  const iv = createIV()
  const cipher = crypto.createCipheriv(ALG, roomKey.key, iv)
  return {
    iv,
    data: Buffer.concat([cipher.update(encode(data)), cipher.final(), cipher.getAuthTag()]),
  }
}

export const decrypt = (payload: EncryptedPayload, roomKey: RoomKey): any => {
  const data = payload.data.slice(0, payload.data.length - AUTH_TAG_LEN)
  const authTag = payload.data.slice(payload.data.length - AUTH_TAG_LEN)
  const decipher = crypto.createDecipheriv(ALG, roomKey.key, payload.iv)
  decipher.setAuthTag(authTag)
  return decode(Buffer.concat([decipher.update(data), decipher.final()]))
}
