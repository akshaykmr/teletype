import {Command} from '@oclif/core'
import {Config} from '../lib/config.js'
export class SignOut extends Command {
  static description = `Sign-out of oorja. Clears saved auth-token`
  async run() {
    const config = new Config(this.config.configDir)
    config.setAccessToken('')
    console.log('Sign-out complete')
  }
}
