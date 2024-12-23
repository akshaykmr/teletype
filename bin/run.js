#!/usr/bin/env node

import {execute} from '@oclif/core'

console.log(process.version)

await execute({dir: import.meta.url})
