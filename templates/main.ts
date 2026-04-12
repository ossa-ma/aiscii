import { run } from 'aiscii'
import * as program from './programs/my-program.ts'

run(program, {
  element: document.getElementById('canvas') as HTMLElement,
})
