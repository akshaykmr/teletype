import {connect, type Socket} from 'node:net'

import type {HarnessHost} from 'oorja-harness-host/host'
import type {HarnessCommand, HarnessEvent} from 'oorja-harness-host/messages'

import {readMessages, sendMessage, SharedHostServer, type ServerMessage} from 'oorja/lib/harnessHost/sharedHost/server'

export class SharedHarnessHost {
  static open = async ({
    socketPath,
    roomId,
    workdir,
    createHost,
  }: {
    socketPath: string
    roomId: string
    workdir: string
    createHost: (emit: (event: HarnessEvent) => void) => Promise<HarnessHost>
  }) => {
    const owner = new SharedHostOwner(socketPath, createHost)
    const client = await SharedHostClient.open({
      socketPath,
      roomId,
      workdir,
      startServer: owner.start,
    })
    return new SharedHarnessHost(client, owner)
  }

  private constructor(
    private readonly client: SharedHostClient,
    private readonly owner: SharedHostOwner,
  ) {}

  listen = (receive: (event: HarnessEvent) => void) => {
    this.client.listen(receive)
  }

  handleCommand = (command: HarnessCommand) => {
    this.client.handleCommand(command)
  }

  emitState = () => {
    this.client.emitState()
  }

  stop = async () => {
    this.client.close()
    await this.owner.stop()
  }
}

class SharedHostClient {
  static open = async ({
    socketPath,
    roomId,
    workdir,
    startServer,
  }: {
    socketPath: string
    roomId: string
    workdir: string
    startServer: () => Promise<void>
  }) => {
    const client = new SharedHostClient(socketPath, roomId, workdir, startServer)
    await client.connect()
    return client
  }

  private state: ConnectionState = {type: 'connecting'}
  private pendingEvents: HarnessEvent[] = []
  private receive = (event: HarnessEvent) => {
    this.pendingEvents.push(event)
  }

  private constructor(
    private readonly socketPath: string,
    private readonly roomId: string,
    private readonly workdir: string,
    private readonly startServer: () => Promise<void>,
  ) {}

  listen = (receive: (event: HarnessEvent) => void) => {
    this.pendingEvents.forEach(receive)
    this.pendingEvents = []
    this.receive = receive
  }

  handleCommand = (command: HarnessCommand) => {
    sendMessage(this.connectedSocket(), {
      type: 'command',
      roomId: this.roomId,
      command,
      workdir: this.workdir,
    })
  }

  emitState = () => {
    sendMessage(this.connectedSocket(), {type: 'state', roomId: this.roomId})
  }

  close = () => {
    const state = this.state
    this.state = {type: 'closed'}
    if (state.type === 'connected') {
      state.socket.destroy()
    }
  }

  private connect = async () => {
    const socket = await connectToServer(this.socketPath, this.startServer)
    if (this.state.type === 'closed') {
      socket.destroy()
      return
    }
    this.state = {type: 'connected', socket}
    readMessages<ServerMessage>(socket, ({event}) => this.receive(event))
    socket.once('close', () => this.handleClose(socket))
  }

  private handleClose = (socket: Socket) => {
    if (this.state.type !== 'connected' || this.state.socket !== socket) {
      return
    }
    this.state = {type: 'connecting'}
    void this.reconnect()
  }

  private reconnect = async () => {
    while (this.state.type === 'connecting') {
      try {
        await this.connect()
        return
      } catch {
        await delay(100)
      }
    }
  }

  private connectedSocket = () => {
    if (this.state.type !== 'connected') {
      throw new Error('Harness host is not connected')
    }
    return this.state.socket
  }
}

class SharedHostOwner {
  private state: OwnerState = {type: 'available'}

  constructor(
    private readonly socketPath: string,
    private readonly createHost: (emit: (event: HarnessEvent) => void) => Promise<HarnessHost>,
  ) {}

  start = async () => {
    if (this.state.type === 'running') {
      return
    }
    const server = await SharedHostServer.start({
      socketPath: this.socketPath,
      createHost: this.createHost,
    })
    this.state = {type: 'running', server}
  }

  stop = async () => {
    if (this.state.type === 'running') {
      await this.state.server.stop()
      this.state = {type: 'available'}
    }
  }
}

type ConnectionState = {type: 'connecting'} | {type: 'connected'; socket: Socket} | {type: 'closed'}

type OwnerState = {type: 'available'} | {type: 'running'; server: SharedHostServer}

const connectToServer = async (socketPath: string, startServer: () => Promise<void>) => {
  try {
    return await openSocket(socketPath)
  } catch {
    try {
      await startServer()
    } catch (startError) {
      try {
        return await waitForSocket(socketPath)
      } catch {
        throw startError
      }
    }
    return openSocket(socketPath)
  }
}

const waitForSocket = async (socketPath: string) => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    try {
      return await openSocket(socketPath)
    } catch {
      await delay(50)
    }
  }
  return openSocket(socketPath)
}

const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds))

const openSocket = (socketPath: string) =>
  new Promise<Socket>((resolve, reject) => {
    const socket = connect(socketPath)
    socket.once('connect', () => {
      socket.removeListener('error', reject)
      resolve(socket)
    })
    socket.once('error', reject)
  })
