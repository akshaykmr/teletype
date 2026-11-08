import {chmod, rm} from 'node:fs/promises'
import {createServer, type Server, type Socket} from 'node:net'

import type {HarnessHost} from 'oorja-harness-host/host'
import type {HarnessCommand, HarnessEvent} from 'oorja-harness-host/messages'

export type ClientMessage = {type: 'command'; command: HarnessCommand; workdir: string} | {type: 'state'}

export type ServerMessage = {type: 'event'; event: HarnessEvent}

export class SharedHostServer {
  static start = async ({
    socketPath,
    createHost,
  }: {
    socketPath: string
    createHost: (emit: (event: HarnessEvent) => void) => Promise<HarnessHost>
  }) => {
    const connections = new Set<Socket>()
    const host = await createHost((event) => {
      connections.forEach((socket) => sendMessage(socket, {type: 'event', event}))
    })
    const server = new SharedHostServer(socketPath, host, connections)
    try {
      await server.listen()
    } catch (error) {
      await host.stop()
      throw error
    }
    return server
  }

  private readonly server: Server

  private constructor(
    private readonly socketPath: string,
    private readonly host: HarnessHost,
    private readonly connections: Set<Socket>,
  ) {
    this.server = createServer(this.handleConnection)
  }

  stop = async () => {
    const closed = new Promise<void>((resolve) => this.server.close(() => resolve()))
    this.connections.forEach((socket) => socket.destroy())
    this.connections.clear()
    await closed
    await this.host.stop()
    await removeSocket(this.socketPath)
  }

  private listen = async () => {
    await removeSocket(this.socketPath)
    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject)
      this.server.listen(this.socketPath, () => {
        this.server.removeListener('error', reject)
        resolve()
      })
    })
    if (process.platform !== 'win32') {
      await chmod(this.socketPath, 0o600)
    }
  }

  private handleConnection = (socket: Socket) => {
    this.connections.add(socket)
    readMessages<ClientMessage>(socket, (message) => this.handleMessage(socket, message))
    socket.once('close', () => this.connections.delete(socket))
  }

  private handleMessage = (socket: Socket, message: ClientMessage) => {
    switch (message.type) {
      case 'command':
        void this.host.handleCommand(message.command, message.workdir)
        break
      case 'state':
        sendMessage(socket, {type: 'event', event: this.host.getState()})
        break
    }
  }
}

export const sendMessage = (socket: Socket, message: ClientMessage | ServerMessage) => {
  socket.write(`${JSON.stringify(message)}\n`)
}

export const readMessages = <Message>(socket: Socket, receive: (message: Message) => void) => {
  let pending = ''
  socket.setEncoding('utf8')
  socket.on('data', (data) => {
    pending += data
    const messages = pending.split('\n')
    pending = messages.pop() ?? ''
    messages.forEach((message) => receive(JSON.parse(message) as Message))
  })
}

const removeSocket = async (socketPath: string) => {
  if (process.platform !== 'win32') {
    await rm(socketPath, {force: true})
  }
}
