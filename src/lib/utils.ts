const { Input } = require("enquirer");

export const promptRoomLink = async (): Promise<string> => {
  return await new Input({
    name: "room secret link",
    message: "Enter the room secret link. (click the share button in the room)",
  }).run();
};
