import {
  env,
  determineENV,
  getoorjaConfig,
  oorjaConfig,
  INVALID_ROOM_LINK_MESSAGE,
} from "../config";
import { User, RoomKey } from "../surya/types";
import { teletypeApp, TeletypeOptions } from "../teletype";
import { preflightChecks } from "./preflight";
import { createRoom, CreateRoomOptions } from "../surya";
import { URL } from "url";
import { importKey, createRoomKey, exportKey } from "../encryption";

export class InvalidRoomLink extends Error {}

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

  createRoom = async (options: CreateRoomOptions) => {
    const room = await createRoom(options);
    const roomKey = createRoomKey(room.id);
    return {
      room,
      roomKey,
    };
  };

  linkForRoom = (roomKey: RoomKey): string => {
    return `${this.oorjaURL()}/rooms?id=${roomKey.roomId}#${exportKey(
      roomKey.key
    )}`;
  };

  getRoomKey(roomLink: string): RoomKey {
    const url = parseRoomURL(roomLink);
    return {
      key: importKey(url.hash),
      roomId: url.searchParams.get("id") as string,
    };
  }

  linkForTokenGen = () => `${this.oorjaURL()}/access_token`;

  teletype = (options: Omit<TeletypeOptions, "userId">) =>
    teletypeApp({ userId: this.user!.id, ...options });

  private oorjaURL = () => {
    const { host, enableTLS } = this.config!;
    return enableTLS ? `https://${host}` : `http://${host}`;
  };
}

const parseRoomURL = (roomLink: string): URL => {
  const url = new URL(roomLink);
  if (!url.searchParams.get("id") || !url.hash) {
    console.log(INVALID_ROOM_LINK_MESSAGE);
    process.exit(3);
  }
  return url;
};

let currentEnv: env;
let oorja: OORJA;

export const getApp = (roomLink?: string): Promise<OORJA> => {
  const env = determineENV(roomLink ? parseRoomURL(roomLink) : undefined);
  if (oorja) {
    if (env !== currentEnv) {
      return Promise.reject("attempt to run different env in same session");
    }
    return Promise.resolve(oorja);
  }
  oorja = new OORJA();
  return oorja.initialize(env);
};
