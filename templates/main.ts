import { run } from 'aiscii'
import * as program from './programs/plasma.ts'

run(program, {
  element: document.getElementById('canvas') as HTMLElement,
})
