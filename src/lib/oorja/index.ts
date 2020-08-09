import { env, determineENV, getoorjaConfig, oorjaConfig } from "../config";
import { User } from "../surya/types";
import { teletypeApp, TeletypeOptions } from "../teletype";
import { preflightChecks } from "./preflight";
import { createRoom } from "../surya";

class OORJA {
  // should capture domain related commands and queries
  user: User | null = null;

  private ready: boolean = false;
  private config?: oorjaConfig;

  initialize = (env: env) => {
    if (this.ready) throw "cannot reinit";
    this.config = getoorjaConfig(env);
    return preflightChecks(env, this.linkForTokenGen()).then((user) => {
      this.user = user;
      this.ready = true;
      return this;
    });
  };
  createRoom = createRoom;

  linkForRoom = (roomId: string): string => {
    return `${this.oorjaURL()}/rooms?id=${roomId}`;
  };

  linkForTokenGen = () => `${this.oorjaURL()}/access_token`;

  teletype = (options: Omit<TeletypeOptions, "userId">) =>
    teletypeApp({ userId: this.user!.id, ...options });

  private oorjaURL = () => {
    const { host, enableTLS } = this.config!;
    return enableTLS ? `https://${host}` : `http://${host}`;
  };
}

let currentEnv: env;
let oorja: OORJA;

export const getApp = (env: env = determineENV()): Promise<OORJA> => {
  if (oorja) {
    if (env !== currentEnv) {
      return Promise.reject("attempt to run different env in same session");
    }
    return Promise.resolve(oorja);
  }
  oorja = new OORJA();
  return oorja.initialize(env);
};
