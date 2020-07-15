const https = require("https");
import axios, { AxiosError, AxiosInstance } from "axios";
import { encode, decode } from "@msgpack/msgpack";

import { defaultParser } from "./resources";
import { User, RoomApps, Room, CliManifest } from "./types";
import { SuryaConfig } from "../config";
import { Unauthorized, BadRequest } from "./errors";
import { Socket, Channel, Presence } from "./vendor/phoenix";

const camelcaseKeys = require("camelcase-keys");

export class SuryaError extends Error {}

let client: AxiosInstance;
let socket: Socket;

export const initializeSurya = (config: SuryaConfig) => {
  client = axios.create({
    httpsAgent: new https.Agent({
      minVersion: "TLSv1.2",
      maxVersion: "TLSv1.2",
    }),
    baseURL: `${config.url}/api/v1`,
    timeout: 5000,
    responseType: "json",
    headers: {
      "x-access-token": config.token || "",
    },
  });
};

const handleError = (error: AxiosError) => {
  const { response } = error;
  if (response) {
    switch (response.status) {
      case 401:
        throw new Unauthorized();
      case 400:
        throw new BadRequest();
    }
  }
  throw error;
};

export const fetchCliManifest = async (): Promise<CliManifest> => {
  try {
    const response = await client.get("/cli");
    return camelcaseKeys(response.data) as CliManifest;
  } catch (error) {
    return handleError(error);
  }
};

export const fetchSessionUser = async (): Promise<User> => {
  try {
    const response = await client.get("/session/user");
    return defaultParser(response.data.data) as User;
  } catch (error) {
    return handleError(error);
  }
};

type CreateRoomOptions = {
  roomName: string;
  apps: RoomApps;
};

export const createRoom = async ({
  roomName,
  apps,
}: CreateRoomOptions): Promise<Room> => {
  const body = {
    room: {
      apps,
      locked: false,
      name: roomName || "-",
    },
  };
  try {
    const response = await client.post("/rooms", body);
    return defaultParser(response.data.data) as Room;
  } catch (error) {
    return handleError(error);
  }
};

export const fetchRoom = async (roomId: string): Promise<Room> => {
  try {
    const response = await client.get(`/rooms/${roomId}`);
    return defaultParser(response.data.data) as Room;
  } catch (error) {
    return handleError(error);
  }
};

export const establishSocket = (config: SuryaConfig): Promise<void> => {
  let encodeMessage = (rawdata: any, callback: any) => {
    if (!rawdata) return;
    return callback(encode(rawdata));
  };

  let decodeMessage = (rawdata: any, callback: any) => {
    if (!rawdata) return;
    const data = new Uint8Array(rawdata);
    return callback(decode(data.buffer));
  };
  return new Promise((resolve, reject) => {
    let initialConnection = false;
    socket = new Socket(`${config.wsUrl}/socket`, {
      params: {
        access_token: config.token,
      },
      binaryType: "arraybuffer",
      encode: encodeMessage,
      decode: decodeMessage,
    });
    socket.onOpen(() => {
      initialConnection = true;
      resolve();
    });
    socket.onError(() => {
      if (!initialConnection) {
        reject();
        return;
      }
      console.error("connection error");
      process.exit(2);
    });
    // @ts-ignore
    socket.connect();
  });
};

// leaving specific types for later,
// when there are more channel users
export type JoinChannelOptions<T> = {
  channel: string;
  params: T;
  onJoin?: () => void;
  onError?: (reason: any) => void;
  onClose?: (payload: any, ref: any, joinRef: any) => void;
  onMessage: (payload: any) => void;
  handleSessionJoin: (session: string) => void;
  handleSessionLeave: (session: string) => void;
};

export const joinChannel = ({
  channel,
  params,
  onJoin,
  onClose,
  onError,
  onMessage,
  handleSessionJoin,
  handleSessionLeave,
}: JoinChannelOptions<any>): Channel => {
  if (!socket) throw Error("no socket connection");
  const chan = socket.channel(channel, params);
  if (onError) chan.onError(onError);
  if (onClose) chan.onClose(onClose);

  let presences: any = [];

  chan.on("new_msg", (msg: any) => {
    onMessage(msg);
  });

  chan.on("presence_state", (response: any) => {
    Presence.syncState(presences, response, handleSessionJoin, undefined);
    presences = response;
  });
  chan.on("presence_diff", (newPresence: any) => {
    presences = Presence.syncDiff(
      presences,
      newPresence,
      handleSessionJoin,
      handleSessionLeave
    );
  });

  chan
    .join()
    .receive("ok", () => {
      if (onJoin) onJoin();
    })
    .receive("error", (resp: any) => {
      console.error("Unable to join", resp);
      process.exit(3);
    });
  return chan;
};
