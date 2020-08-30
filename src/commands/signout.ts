import { Command } from "@oclif/command";
import { determineENV, setENVAccessToken } from "../lib/config";
export class SignOut extends Command {
  static description = `sign-out of oorja. clears saved auth-token`;
  async run() {
    const env = determineENV();
    setENVAccessToken(env, "");
    console.log("sign-out complete");
  }
}
