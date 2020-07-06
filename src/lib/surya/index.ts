const camelcaseKeys = require("camelcase-keys");
import axios, { AxiosError, AxiosInstance } from "axios";
import { Unauthorized } from "./errors";


import { defaultParser } from "./resources";
import { User, RoomApps, Room, CliManifest } from './types';
import { SuryaConfig } from '../config';

export class SuryaError extends Error {}

let client: AxiosInstance;

export const initializeSurya = (config: SuryaConfig) => {
  client = axios.create({
    baseURL: `${config.url}/api/v1`,
    timeout: 5000,
    responseType: "json",
    headers: {
      'x-access-token': config.token || ''
    },
  });
}


const handleError = (error: AxiosError): never => {
  const { response } = error;
  if (response) {
    switch (response.status) {
      case 401:
        throw new Unauthorized();
    }
  }
  console.error("API error")
  console.error(error);
  process.exit(0)
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
