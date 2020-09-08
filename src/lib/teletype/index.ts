import { spawn, IPty } from "node-pty";
import * as os from "os";
import { joinChannel } from "../surya";
import { Hash, RoomKey } from "../surya/types";
import {
  getDimensions,
  dimensions,
  initScreen,
  areDimensionEqual,
  resizeBestFit,
} from "./auxiliary";
import chalk = require("chalk");
import { Unauthorized } from "../surya/errors";
import { encrypt, decrypt } from "../encryption";

enum MessageType {
  IN = "i",
  OUT = "o",
  DIMENSIONS = "d",
}

export type TeletypeOptions = {
  userId: string;
  roomKey: RoomKey;
  shell: string;
  multiplex: boolean;
  process: NodeJS.Process;
};

const SELF = "self";

export const teletypeApp = (config: TeletypeOptions) => {
  const username = os.userInfo().username;
  const hostname = os.hostname();

  const userDimensions: Hash<dimensions> = {};
  userDimensions[SELF] = getDimensions();

  let term: IPty;

  const reEvaluateOwnDimensions = () => {
    const lastKnown = userDimensions[SELF];
    const latest = getDimensions();

    if (areDimensionEqual(lastKnown, latest)) {
      return;
    }
    userDimensions[SELF] = latest;
    resizeBestFit(term, userDimensions);
  };

  return new Promise((resolve, reject) => {
    const channel = joinChannel({
      channel: `teletype:${config.roomKey.roomId}`,
      params: {
        username,
        hostname,
        multiplexed: config.multiplex,
      },
      onJoin: () => {
        initScreen(username, hostname, config.shell, config.multiplex);

        const stdin = config.process.stdin;
        const stdout = config.process.stdout;
        const dimensions = userDimensions[SELF];

        term = spawn(config.shell, [], {
          name: "xterm-256color",
          cols: dimensions.cols,
          rows: dimensions.rows,
          cwd: config.process.cwd(),
          // @ts-ignore
          env: config.process.env,
        });

        // track own dimensions and keep it up to date
        setInterval(reEvaluateOwnDimensions, 1000);

        term.on("data", (d: string) => {
          stdout.write(d);
          // revisit: is it worth having one letter names, instead of something descriptive
          // does it really save bytes?
          channel.push("new_msg", {
            t: MessageType.OUT,
            b: true,
            d: encrypt(d, config.roomKey),
          });
        });
        term.on("exit", () => {
          console.log(
            chalk.blueBright("terminated shell stream to oorja. byee!")
          );
          resolve();
        });

        stdin.setEncoding("utf8");
        stdin.setRawMode!(true);

        stdin.on("data", (d) => term.write(d));
      },
      onClose: () => {
        console.log(chalk.redBright("connection closed, terminated stream."));
        process.exit(3);
      },
      onError: (err?: any) => {
        if (err instanceof Unauthorized) {
          console.log(chalk.redBright(err.message));
        } else {
          console.log(chalk.redBright("connection error, terminated stream."));
        }
        process.exit(4);
      },
      onMessage: ({ from: { session }, t, d }) => {
        switch (t) {
          case MessageType.DIMENSIONS:
            userDimensions[session] = d;
            resizeBestFit(term, userDimensions);
            break;
          case MessageType.IN:
            const data = decrypt(d, config.roomKey);
            const userId = session.split(":")[0];
            if (config.multiplex) {
              term.write(data);
              return;
            }
            if (userId === config.userId) {
              term.write(data);
            } else {
              console.log(
                chalk.redBright(
                  `unexpected input from user: ${userId}, terminating stream for safety. Please report this issue`
                )
              );
              process.exit(5);
            }
        }
      },
      handleSessionJoin: (s) => {},
      handleSessionLeave: (s) => {
        delete userDimensions[s];
        resizeBestFit(term, userDimensions);
      },
    });
  });
};
