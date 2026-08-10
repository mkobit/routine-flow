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

  test('attaches re-confirm extra button when onReconfirm is provided', () => {
    let reconfirmedIndex: number | undefined
    const items = scriptHookBindingsToListItems(
      [{ name: HookNameSchema.parse('log-focus-complete'), scriptPath: 'Scripts/log.js', scriptSource: 'console.log(1)' }],
      (index) => {
        reconfirmedIndex = index
      },
    )

    expect(items).toHaveLength(1)
    expect(items[0]?.name).toBe('log-focus-complete')
    expect(items[0]?.desc).toBe('Scripts/log.js')
    expect(items[0]?.render).toBeDefined()

    let onClickHandler: (() => void) | undefined
    const mockSetting = {
      addExtraButton: (cb: (btn: { setIcon: (icon: string) => unknown, setTooltip: (tooltip: string) => unknown, onClick: (fn: () => void) => unknown }) => void) => {
        const mockBtn = {
          setIcon: () => mockBtn,
          setTooltip: () => mockBtn,
          onClick: (fn: () => void) => {
            onClickHandler = fn
            return mockBtn
          },
        }
        cb(mockBtn)
      },
    }

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- mock object for Setting component in unit test
    items[0]?.render?.(mockSetting as never, {} as never)
    expect(onClickHandler).toBeDefined()
    onClickHandler?.()
    expect(reconfirmedIndex).toBe(0)
  })
})
