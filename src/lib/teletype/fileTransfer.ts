import {decode} from '@msgpack/msgpack'
import {rename, unlink, writeFile} from 'fs/promises'
import * as path from 'path'
import {RoomKey} from 'oorja/lib/connect/types'
import {EncryptedPayload, decrypt} from 'oorja/lib/encryption'

export type FileTransfer = {
  id: string
  batch_id: string
  name: string
  url: string
}

export const downloadTransferredFile = async (transfer: FileTransfer, cwd: string, roomKey: RoomKey) => {
  const destination = path.join(cwd, transfer.name)
  const temporary = `${destination}.tmp`

  try {
    const response = await fetch(transfer.url)
    if (!response.ok) {
      throw new Error(`file download failed with HTTP ${response.status}`)
    }

    const encrypted = decode(new Uint8Array(await response.arrayBuffer())) as EncryptedPayload
    await writeFile(temporary, decrypt(encrypted, roomKey))
    await rename(temporary, destination)
  } catch (error) {
    try {
      await unlink(temporary)
    } catch {}
    throw error
  }
}
