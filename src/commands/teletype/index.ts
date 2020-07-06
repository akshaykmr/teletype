const { Select, Input } = require("enquirer");
import { URL } from "url";
import { Command, flags } from "@oclif/command";

import * as os from "os";
import * as chalk from "chalk";
import { TeletypeOptions } from "../../lib/teletype";
import {
  determineENV,
  ROOM_LINK_SAMPLE,
  INVALID_ROOM_LINK_MESSAGE,
  env,
} from "../../lib/config";
import { preflightChecks } from "../../lib/cli";

const DEFAULT_SHELL =
  os.platform() === "win32" ? "powershell.exe" : process.env.SHELL || "bash";

export default class TeleType extends Command {
  static aliases = ["tty"];
  static description = "launch a terminal streaming session in oorja.";

  static examples = [
    `${chalk.blueBright("$ oorja teletype")}
will prompt to choose streaming destination - existing room or create a new one.

`,
    `${chalk.blueBright(`$ oorja teletype '${ROOM_LINK_SAMPLE}'`)}
will stream to the room specified by secret link, you must have joined the room before streaming.

`,
    `${chalk.blueBright(`$ oorja teletype -m '${ROOM_LINK_SAMPLE}'`)}
Will also allow room participants to write to your terminal!

`,
  ];

  static flags = {
    help: flags.help({ char: "h" }),
    shell: flags.string({
      char: "s",
      description: "shell to use. e.g. bash, fish",
      default: DEFAULT_SHELL,
    }),
    multiplex: flags.boolean({
      char: "m",
      description:
        "allows room users to WRITE TO YOUR SHELL. Can be helpful or painful. Off by default",
      default: false,
    }),
  };

  static args = [{ name: "room" }];

  async run() {
    const {
      args,
      flags: { shell, multiplex },
    } = this.parse(TeleType);

    if (args.room) {
      await this.stream(args.room, { shell, multiplex });
      return;
    }

    console.log("(use -h for description and options) \n");

    // room not known, prompt
    const ROOM = "to an existing room (you have the room link)";
    const NEW = "new room";
    try {
      const answer = await new Select({
        name: "",
        message: "Choose streaming destination",
        choices: [ROOM, NEW],
      }).run();

      switch (answer) {
        case ROOM:
          const roomLink = await new Input({
            name: "room secret link",
            message:
              "enter the room secret link. (copy browser url from an open room)",
          }).run();
          await this.stream(roomLink, { shell, multiplex });
          break;
        case NEW:
          console.log(chalk.blue("coming soon"));
          const env = determineENV();
          await this.setup(env);
          // setup env
          break;
      }
    } catch {
      process.exit(100);
    }
  }

  private async stream(
    roomLink: string,
    options: { shell: string; multiplex: boolean }
  ) {
    const roomURL = this.parseLink(roomLink);
    const env = determineENV(roomURL);
    await this.setup(env);

    this.exit(0);
  }

  private async setup(env: env) {
    return preflightChecks(env);
  }

  private parseLink(roomLink: string) {
    try {
      return new URL(roomLink);
    } catch {
      console.log(INVALID_ROOM_LINK_MESSAGE);
      process.exit(0);
    }
  }
}
