const { Select, Input } = require("enquirer");
import { URL } from "url";
import { Command, flags } from "@oclif/command";
const ora = require("ora");

import * as os from "os";
import * as chalk from "chalk";
import { teletypeApp, TeletypeOptions } from "../../lib/teletype";
import {
  determineENV,
  ROOM_LINK_SAMPLE,
  INVALID_ROOM_LINK_MESSAGE,
  env,
  getoorjaConfig,
} from "../../lib/config";
import { preflightChecks } from "../../lib/cli";
import { createRoom } from "../../lib/surya";
import { BadRequest } from "../../lib/surya/errors";
import { Room } from "../../lib/surya/types";

const DEFAULT_SHELL =
  os.platform() === "win32" ? "powershell.exe" : process.env.SHELL || "bash";

export default class TeleTypeCommand extends Command {
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
    } = this.parse(TeleTypeCommand);

    if (args.room) {
      await this.stream(args.room, { shell, multiplex, process });
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
          await this.stream(roomLink, { shell, multiplex, process });
          break;
        case NEW:
          // TODO: refactor, move into func
          const env = determineENV();
          await this.setup(env);

          const spinner = ora({
            text: chalk.blueBright("creating room with TeleType app"),
            discardStdin: false,
          }).start();
          let room: Room;
          try {
            room = await createRoom({
              roomName: "-",
              apps: {
                appList: [
                  { appId: "39", config: {} },
                  { appId: "31", config: {} },
                  { appId: "40", config: {} },
                ],
              },
            });
          } catch (e) {
            if (e instanceof BadRequest) {
              spinner.fail(
                "failed to create room. Note: you cannot create rooms as an anonymous user"
              );
              process.exit(9);
            }
          }
          spinner.succeed(chalk.greenBright("room created")).clear();
          const oorjaUrl = getoorjaConfig(env).url;
          const link = `${oorjaUrl}/rooms?id=${room!.id}`;
          console.log(`\n${chalk.cyanBright(link)}\n`);
          console.log(
            chalk.blueBright(
              "^^ you'll be streaming here, share this link with your friends."
            )
          );
          this.clearstdin();
          await teletypeApp({ roomId: room!.id, shell, multiplex, process });
          break;
      }
    } catch {
      process.exit(100);
    }
    process.exit(0);
  }

  private clearstdin() {
    process.stdin.read();
    process.stdin.resume(); // FIXME: investigate weird quirk. stdin hangs if this is not present
  }

  private async stream(
    roomLink: string,
    options: { shell: string; multiplex: boolean; process: NodeJS.Process }
  ) {
    const roomURL = this.parseLink(roomLink);
    const env = determineENV(roomURL);
    await this.setup(env);
    const roomId = roomURL.searchParams.get!("id");
    this.clearstdin();
    // @ts-ignore
    await teletypeApp({ roomId, ...options });
    this.exit(0);
  }

  private async setup(env: env) {
    return preflightChecks(env);
  }

  private parseLink(roomLink: string) {
    try {
      const url = new URL(roomLink);
      if (!url.searchParams.get("id")) throw "invalid";
      return url;
    } catch {
      console.log(INVALID_ROOM_LINK_MESSAGE);
      process.exit(0);
    }
  }
}
