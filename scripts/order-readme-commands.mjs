import {readFileSync, writeFileSync} from 'node:fs'

const readmePath = new URL('../README.md', import.meta.url)
const commandOrder = ['oorja teletype [STREAMKEY]', 'oorja signout', 'oorja help [COMMAND]']

const rank = (command) => {
  const index = commandOrder.indexOf(command)
  return index === -1 ? commandOrder.length : index
}

const sortByCommandOrder = (items, getCommand) =>
  items
    .map((item, index) => ({index, item}))
    .sort((left, right) => rank(getCommand(left.item)) - rank(getCommand(right.item)) || left.index - right.index)
    .map(({item}) => item)

const between = (text, start, stop) => {
  const startIndex = text.indexOf(start)
  const stopIndex = text.indexOf(stop)
  if (startIndex === -1 || stopIndex === -1 || stopIndex < startIndex) {
    throw new Error(`Could not find ${start} block in README.md`)
  }

  return {
    before: text.slice(0, startIndex + start.length),
    body: text.slice(startIndex + start.length, stopIndex),
    after: text.slice(stopIndex),
  }
}

const readme = readFileSync(readmePath, 'utf8')

const commands = between(readme, '<!-- commands -->', '<!-- commandsstop -->')
const commandsBody = commands.body.trim()
const firstCommandSection = commandsBody.indexOf('\n## `')

if (firstCommandSection === -1) {
  throw new Error('Could not find generated command sections in README.md')
}

const tocItems = commandsBody
  .slice(0, firstCommandSection)
  .trim()
  .split('\n')
  .filter(Boolean)

const sortedTocItems = sortByCommandOrder(tocItems, (item) => item.match(/\[`([^`]+)`\]/)?.[1] ?? '')
const commandBlocks = commandsBody
  .slice(firstCommandSection)
  .trim()
  .split(/\n(?=## `)/)
  .filter(Boolean)

const sortedCommandBlocks = sortByCommandOrder(commandBlocks, (block) => block.match(/^## `([^`]+)`/)?.[1] ?? '')
const orderedReadme = `${commands.before}\n${sortedTocItems.join('\n')}\n\n${sortedCommandBlocks.join('\n\n')}\n${commands.after}`

writeFileSync(readmePath, orderedReadme, 'utf8')
