import { Command } from "@oclif/core";
import { determineENV, setENVAccessToken } from "../lib/config.js";
export class SignOut extends Command {
  static description = `Sign-out of oorja. Clears saved auth-token`;
  async run() {
    const env = determineENV();
    setENVAccessToken(env, "");
    console.log("Sign-out complete");
  }
}
