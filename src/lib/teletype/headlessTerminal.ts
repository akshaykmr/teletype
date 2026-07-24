import SerializePackage from '@xterm/addon-serialize'
import HeadlessPackage from '@xterm/headless'

import type {dimensions} from 'oorja/lib/teletype/auxiliary'

const {SerializeAddon} = SerializePackage
const {Terminal} = HeadlessPackage

export class HeadlessTerminal {
  private readonly terminal: InstanceType<typeof Terminal>
  private readonly serializer = new SerializeAddon()
  private frozen = false
  private trailingOutput = ''

  constructor({cols, rows}: dimensions) {
    this.terminal = new Terminal({
      allowProposedApi: true,
      cols,
      rows,
      scrollback: 0,
    })
    this.terminal.loadAddon(this.serializer)
  }

  write = (data: string) => {
    if (this.frozen) {
      this.trailingOutput += data
      return
    }
    this.terminal.write(data)
  }

  resize = ({cols, rows}: dimensions) => {
    if (this.frozen) {
      return
    }
    // Apply the resize after queued output has been parsed.
    this.terminal.write('', () => this.terminal.resize(cols, rows))
  }

  captureSnapshot = async () => {
    this.frozen = true
    await new Promise<void>((resolve) => this.terminal.write('', resolve))
    return this.serializer.serialize({scrollback: 0}) + this.trailingOutput
  }

  dispose = () => {
    this.terminal.dispose()
  }
}
