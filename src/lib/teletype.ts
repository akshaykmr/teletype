import { spawn, IPty } from "node-pty";
import * as os from "os";
import * as termSize from "term-size";
import * as chalk from "chalk";
import { joinChannel } from "./surya";
import { Hash } from "./surya/types";

enum MessageType {
  IN = "i",
  OUT = "o",
  DIMENSIONS = "d",
}

export type TeletypeOptions = {
  roomId: string;
  shell: string;
  multiplex: boolean;
  process: NodeJS.Process;
};

type dimensions = {
  rows: number;
  cols: number;
};

const getDimensions = (): dimensions => {
  const { rows, columns } = termSize();
  return { rows, cols: columns };
};

const areDimensionEqual = (a: dimensions, b: dimensions): boolean => {
  return a.rows === b.rows && a.cols === b.cols;
};

const SELF = "self";
const userDimensions: Hash<dimensions> = {};
userDimensions[SELF] = getDimensions();

const resizeBestFit = (term: IPty) => {
  const allViewports = Object.values(userDimensions);
  const minrows = Math.min(...allViewports.map((d) => d.rows));
  const mincols = Math.min(...allViewports.map((d) => d.cols));
  term.resize(mincols, minrows);
};

let term: IPty;

export const teletypeApp = (config: TeletypeOptions) => {
  const username = os.userInfo().username;
  const hostname = os.hostname();

  return new Promise((resolve) => {
    const channel = joinChannel({
      channel: `teletype:${config.roomId}`,
      params: {
        username,
        hostname,
        multiplexed: config.multiplex,
      },
      onJoin: () => {
        console.log(chalk.green("joined room channel"));
        console.log(chalk.bold(chalk.blueBright("TeleType")));
        console.log(
          chalk.yellowBright(
            "You have allowed room participants to write to your shell"
          )
        );
        console.log(
          chalk.blue(
            `${chalk.bold(
              `${username}@${hostname}`
            )} spawning streaming shell: ${chalk.bold(`${config.shell}`)}`
          )
        );
        console.log(
          `Note: Your shell size may adjust for optimum viewing experience for all participants.
To terminate stream run ${chalk.yellowBright(
            "exit"
          )} or press ${chalk.yellowBright("ctrl-d")}`
        );

        const stdin = config.process.stdin;
        const stdout = config.process.stdout;

        const dimensions = userDimensions[SELF];
        term = spawn(config.shell, [], {
          name: "xterm-color",
          cols: dimensions.cols,
          rows: dimensions.rows,
          cwd: config.process.cwd(),
          // @ts-ignore
          env: config.process.env,
        });

        setInterval(() => {
          // track own dimensions and keep it up to date
          const lastKnown = userDimensions[SELF];
          const latest = getDimensions();

          if (areDimensionEqual(lastKnown, latest)) {
            return;
          }
          userDimensions[SELF] = latest;
          resizeBestFit(term);
        }, 1000);

        term.on("data", (d: string) => {
          stdout.write(d);
          // revisit: is it worth having one letter names, instead of something descriptive
          // does it really save bytes?
          channel.push("new_msg", { t: MessageType.OUT, d: d, b: true });
        });
        term.on("exit", () => {
          console.log(
            chalk.blueBright("terminated shell stream to oorja. byee!")
          );
          resolve();
        });

        stdin.setEncoding("utf8");
        stdin.setRawMode!(true);
        stdin.setEncoding("utf8");

        stdin.on("data", (d) => term.write(d));
      },
      onClose: () => {
        console.log(chalk.redBright("connection closed, terminated stream."));
        process.exit(3);
      },
      onError: () => {
        console.log(chalk.redBright("connection error, terminated stream."));
        process.exit(4);
      },
      onMessage: ({ from: { session }, t, d }) => {
        switch (t) {
          case "d":
            userDimensions[session] = d;
            resizeBestFit(term);
            break;
          case "i":
            term.write(d);
            break;
        }
      },
      handleSessionJoin: (s) => {},
      handleSessionLeave: (s) => {
        delete userDimensions[s];
        resizeBestFit(term);
      },
    });
  });
};
