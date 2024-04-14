import inquirer from 'inquirer';

export const promptRoomLink = async () => {
  const { roomLink } = await inquirer.prompt([
    {
      type: 'input',
      name: 'roomLink',
      message: 'Enter the room secret link. (click the share button in the room)',
    }
  ]);
  return roomLink;
};
