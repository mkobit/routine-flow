import { test, expect, describe } from 'bun:test'
import { scriptHookBindingsToListItems } from '../src/settings-script-hook-list'
import { HookNameSchema } from '../src/domain/hook/hook-reference'

describe('scriptHookBindingsToListItems', () => {
  test('maps each binding to a display-only name/desc item, in order', () => {
    const items = scriptHookBindingsToListItems([
      { name: HookNameSchema.parse('log-focus-complete'), scriptPath: 'Scripts/log.js', scriptSource: 'console.log(1)' },
      { name: HookNameSchema.parse('increment-count'), scriptPath: 'Scripts/increment.js', scriptSource: 'return []' },
    ])

    expect(items).toEqual([
      { name: 'log-focus-complete', desc: 'Scripts/log.js' },
      { name: 'increment-count', desc: 'Scripts/increment.js' },
    ])
  })

  test('an empty binding list maps to an empty item list', () => {
    expect(scriptHookBindingsToListItems([])).toEqual([])
  })
})
