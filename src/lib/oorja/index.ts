import {
  env,
  determineENV,
  getoorjaConfig,
  oorjaConfig,
  INVALID_ROOM_LINK_MESSAGE,
  setENVAccessToken,
} from "../config";
import { User, RoomKey } from "../surya/types";
import { teletypeApp, TeletypeOptions } from "../teletype";
import { CreateRoomOptions, SuryaClient } from "../surya";
import { URL } from "url";
import { importKey, createRoomKey, exportKey } from "../encryption";
import {
  loginByRoomOTP,
  preflight,
  promptAuth,
  resumeSession,
  validateCliVersion,
} from "./preflight";

export class InvalidRoomLink extends Error {}

class OORJA {
  // should capture domain related commands and queries
  constructor(
    private config: oorjaConfig,
    private suryaClient: SuryaClient,
    public user: User
  ) {}

  createRoom = async (options: CreateRoomOptions) => {
    const room = await this.suryaClient.createRoom(options);
    const roomKey = createRoomKey(room.id);
    return {
      room,
      roomKey,
    };
  };

  linkForRoom = (roomKey: RoomKey): string => {
    return `${oorjaURL(this.config)}/rooms?id=${roomKey.roomId}#${exportKey(
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

  teletype = (options: Omit<TeletypeOptions, "userId" | "joinChannel">) => {
    return teletypeApp({
      userId: this.user!.id,
      joinChannel: this.suryaClient.joinChannel,
      ...options,
    });
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

const getRoomId = (roomURL: URL) => {
  const id = roomURL.searchParams.get("id");
  return id || undefined;
};

const oorjaURL = (config: oorjaConfig) => {
  const { host, enableTLS } = config!;
  return enableTLS ? `https://${host}` : `http://${host}`;
};

const linkForTokenGen = (config: oorjaConfig) =>
  `${oorjaURL(config)}/access_token`;

const init = async (env: env, options: { roomId?: string } = {}) => {
  const config = getoorjaConfig(env);
  let suryaClient = new SuryaClient(env);

  await validateCliVersion(suryaClient);
  let user = await resumeSession(env, suryaClient, options.roomId);

  if (!user) {
    let token: string = "";
    if (options.roomId) {
      token = await loginByRoomOTP(suryaClient, options.roomId);
    } else {
      token = await promptAuth(suryaClient, linkForTokenGen(config));
      if (!token) {
        console.log("Token not provided :(");
        process.exit(12);
      }
    }
    setENVAccessToken(env, token);
  }

  await suryaClient.destroy();
  suryaClient = new SuryaClient(env);
  user = await preflight(env, suryaClient);

  return new OORJA(config, suryaClient, user);
};

let currentEnv: env;
let oorja: OORJA;

export const getApp = async (
  options: { roomLink?: string } = {}
): Promise<OORJA> => {
  const { roomLink } = options;
  const roomURL = roomLink ? parseRoomURL(roomLink) : undefined;
  const env = determineENV(undefined);
  if (oorja) {
    if (env !== currentEnv) {
      return Promise.reject("Attempt to run different env in same session");
    }
    return Promise.resolve(oorja);
  }
  return await init(env, { roomId: roomURL ? getRoomId(roomURL) : undefined });
};
