const { Select, Input } = require("enquirer");
import { URL } from "url";
import { Command, flags } from "@oclif/command";
const ora = require("ora");

import * as os from "os";
import * as chalk from "chalk";
import {
  determineENV,
  ROOM_LINK_SAMPLE,
  INVALID_ROOM_LINK_MESSAGE,
} from "../../lib/config";
import { BadRequest } from "../../lib/surya/errors";
import { Room } from "../../lib/surya/types";
import { getApp } from "../../lib/oorja";

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
      await this.streamToLink({ shell, multiplex, roomLink: args.room });
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
    } catch {
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
    // TODO: move link validation to oorja-lib, if I have to do this at more places
    const roomURL = this.parseLink(roomLink);
    const env = determineENV(roomURL);
    const app = await getApp(env);
    const roomId = roomURL.searchParams.get!("id");
    this.clearstdin();
    // @ts-ignore
    await app.teletype({ roomId, ...options, process });
    this.exit(0);
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
      text: chalk.blueBright("creating room with TeleType app"),
      discardStdin: false,
    }).start();
    let room: Room;
    try {
      room = await app.createRoom({
        roomName: "-",
        apps: {
          defaultFocus: "39",
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
    const link = app.linkForRoom(room!.id);
    console.log(`\n${chalk.cyanBright(link)}\n`);
    console.log(
      chalk.blueBright(
        "^^ you'll be streaming here, share this link with your friends."
      )
    );
    this.clearstdin();
    return await app.teletype({ roomId: room!.id, shell, multiplex, process });
  }

  private parseLink(roomLink: string): URL {
    try {
      const url = new URL(roomLink);
      if (!url.searchParams.get("id")) throw "invalid";
      return url;
    } catch {
      console.log(INVALID_ROOM_LINK_MESSAGE);
      process.exit(0);
    }
  }

  private clearstdin() {
    process.stdin.read();
    process.stdin.resume(); // FIXME: investigate weird quirk. stdin hangs if this is not present
  }
}
