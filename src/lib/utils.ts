import inquirer from 'inquirer'

export const promptRoomLink = async () => {
  const {roomLink} = await inquirer.prompt([
    {
      type: 'input',
      name: 'roomLink',
      message: 'Enter the room secret link (copy URL from address bar in your browser):',
    },
  ])
  return roomLink
}
