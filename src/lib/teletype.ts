import { spawn } from "node-pty";
import * as os from "os";
import * as termSize from "term-size";
import * as chalk from "chalk";
import { joinChannel } from './surya';
import { Hash } from './surya/types';



enum MessageType {
  IN = "i",
  OUT = "o",
  DIMENSIONS = "d"
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
}


const getDimensions = (): dimensions => {
  const {rows, columns} =  termSize();
  return {rows, cols: columns};
}

const SELF = 'self';
const userDimensions: Hash<dimensions> = {};
userDimensions[SELF] = getDimensions();

export const teletypeApp = (config: TeletypeOptions) => {
  const username = os.userInfo().username;
  const hostname = os.hostname();

  return new Promise((resolve) => {
    const channel = joinChannel({
      channel: `teletype:${config.roomId}`,
      params: {
        username,
        hostname
      },
      onJoin: () => {
        console.log(chalk.green("joined room channel"));
        console.log(chalk.bold(chalk.blueBright("TeleType")))
        console.log(chalk.blue(`${chalk.bold(`${username}@${hostname}`)} spawning streaming shell: ${chalk.bold(`${config.shell}`)}`));
        console.log("note: The shell may resize for best view for all room participants.")
      },
      onClose: () => {
        console.log("connection closed");
        process.exit(3)
      },
      onError: () => {
        console.log("connection error")
        process.exit(4);
      },
      onMessage: console.log,
      handleSessionJoin: (s) => {},
      handleSessionLeave: (s) => {
        delete userDimensions[s]
        // resize
      },
    })
  })
}


