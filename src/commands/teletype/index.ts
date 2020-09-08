const { Select, Input } = require("enquirer");
import { Command, flags } from "@oclif/command";
const ora = require("ora");

import * as os from "os";
import * as chalk from "chalk";
import {
  determineENV,
  ROOM_LINK_SAMPLE,
  INVALID_ROOM_LINK_MESSAGE,
} from "../../lib/config";
import { getApp, InvalidRoomLink } from "../../lib/oorja";

const DEFAULT_SHELL =
  os.platform() === "win32" ? "powershell.exe" : process.env.SHELL || "bash";

export default class TeleTypeCommand extends Command {
  static aliases = ["tty"];
  static description = `Launch a terminal streaming session in oorja.`;

  static examples = [
    `${chalk.blueBright("$ teletype")}
will prompt to choose streaming destination - existing room or create a new one.

`,
    `${chalk.blueBright(`$ teletype '${ROOM_LINK_SAMPLE}'`)}
will stream to the room specified by secret link, you must have joined the room before streaming.

`,
    `${chalk.blueBright(`$ teletype -m '${ROOM_LINK_SAMPLE}'`)}
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
        "allows room users to WRITE TO YOUR SHELL i.e enables collaboration mode. Make sure you trust room participants. Off by default",
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
      await this.streamToLink({ shell, multiplex, roomLink: args.room });
      process.exit(0);
    }

    console.log("(use -h for description and options) \n");

    // room not known, prompt
    const ROOM = "to an existing room (you have the room link)";
    const NEW = "new room";
    try {
      const answer = await new Select({
        name: "",
        message: "Choose streaming destination",
        choices: [NEW, ROOM],
      }).run();
      switch (answer) {
        case ROOM:
          await this.streamToLink({ shell, multiplex });
          break;
        case NEW:
          await this.createRoomAndStream({ shell, multiplex });
          break;
      }
    } catch (e) {
      process.exit(100);
    }
    process.exit(0);
  }

  private async streamToLink(options: {
    shell: string;
    multiplex: boolean;
    roomLink?: string;
  }) {
    const roomLink =
      options.roomLink ||
      (await new Input({
        name: "room secret link",
        message:
          "enter the room secret link. (click the share button in the room)",
      }).run());
    try {
      const app = await getApp(roomLink);
      const roomKey = app.getRoomKey(roomLink);
      this.clearstdin();
      await app.teletype({ roomKey, ...options, process });
    } catch (e) {
      if (e instanceof InvalidRoomLink) {
        console.log(INVALID_ROOM_LINK_MESSAGE);
        process.exit(3);
      }
    }
  }

  private async createRoomAndStream({
    shell,
    multiplex,
  }: {
    shell: string;
    multiplex: boolean;
  }) {
    const app = await getApp();
    const spinner = ora({
      text: chalk.bold("creating room with TeleType app"),
      discardStdin: false,
    }).start();
    try {
      const { roomKey } = await app.createRoom({
        roomName: "-",
        apps: {
          defaultFocus: "39",
          appList: [
            { appId: "39", config: {} },
            { appId: "31", config: {} },
            { appId: "40", config: {} },
            { appId: "100", config: {} },
          ],
        },
      });
      spinner.succeed(chalk.bold("room created")).clear();
      const link = app.linkForRoom(roomKey);
      console.log(`\n${chalk.bold(chalk.blueBright(link))}\n`);
      console.log(
        chalk.bold(
          "^^ you'll be streaming here, share this link with your friends."
        )
      );
      this.clearstdin();
      return await app.teletype({ roomKey, shell, multiplex, process });
    } catch (e) {
      console.log("failed to create room.");
      process.exit(9);
    }
  }

  private clearstdin() {
    process.stdin.read();
    process.stdin.resume(); // FIXME: investigate weird quirk. stdin hangs if this is not present
  }
}
