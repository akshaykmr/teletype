import inquirer from 'inquirer'

export const promptRoomLink = async () => {
  const {spaceLink} = await inquirer.prompt([
    {
      type: 'input',
      name: 'spaceLink',
      message: 'Enter the space secret link (copy URL from address bar in your browser):',
    },
  ])
  return spaceLink
}
