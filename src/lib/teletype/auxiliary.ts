import * as chalk from "chalk";
import * as termSize from "term-size";
import { IPty } from "node-pty";
import { Hash } from "../surya/types";

export const initScreen = (
  username: string,
  hostname: string,
  shell: string,
  multiplexed: boolean
) => {
  console.log(chalk.bold(chalk.blueBright("TeleType")));

  if (multiplexed) {
    console.log(
      chalk.yellowBright(
        "You have allowed room participants to write to your shell"
      )
    );
  }
  console.log(
    chalk.blue(
      `${chalk.bold(
        `${username}@${hostname}`
      )} spawning streaming shell: ${chalk.bold(`${shell}`)}`
    )
  );
  console.log(
    `Note: Your shell size may adjust for optimum viewing experience for all participants.\n
This session is end-to-end encrypted.
To terminate stream run ${chalk.yellowBright(
      "exit"
    )} or press ${chalk.yellowBright("ctrl-d")} \n`
  );
};

export type dimensions = {
  rows: number;
  cols: number;
};

export const getDimensions = (): dimensions => {
  const { rows, columns } = termSize();
  return { rows, cols: columns };
};

export const areDimensionEqual = (a: dimensions, b: dimensions): boolean => {
  return a.rows === b.rows && a.cols === b.cols;
};

export const resizeBestFit = (term: IPty, userDimensions: Hash<dimensions>) => {
  const allViewports = Object.values(userDimensions);
  const minrows = Math.min(...allViewports.map((d) => d.rows));
  const mincols = Math.min(...allViewports.map((d) => d.cols));
  term.resize(mincols, minrows);
};
