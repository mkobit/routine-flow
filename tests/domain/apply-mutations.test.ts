import { mock, test, expect, describe } from 'bun:test'
import { FileMutationSchema } from '../../src/domain/mutation/file-mutation'
import type { FileMutation } from '../../src/domain/mutation/file-mutation'
import { applyMutations } from '../../src/domain/mutation/apply-mutations'
import type { FileMutationPort } from '../../src/domain/mutation/apply-mutations'
import { TaskQueueItemIdSchema } from '../../src/domain/queue/task-source'

type PortMethodName = keyof FileMutationPort

function createFakePort(rejections: Partial<Record<PortMethodName, unknown>> = {}) {
  let order: PortMethodName[] = []
  const make = (name: PortMethodName) => mock(async (_mutation: FileMutation) => {
    order = [...order, name]
    if (name in rejections) {
      throw rejections[name]
    }
  })
  const port: FileMutationPort = {
    writeFrontmatter: make('writeFrontmatter'),
    appendText: make('appendText'),
    reorderQueueItem: make('reorderQueueItem'),
    changeQueueItemStatus: make('changeQueueItemStatus'),
  }
  return { port, getOrder: () => order }
}

const frontmatterMutation: FileMutation = FileMutationSchema.parse({
  kind: 'frontmatter',
  filePath: 'task.md',
  property: 'sessions',
  value: 1,
})

const appendMutation: FileMutation = FileMutationSchema.parse({
  kind: 'append',
  filePath: 'daily-note.md',
  text: '- Completed a focus phase',
})

const reorderMutation: FileMutation = FileMutationSchema.parse({
  kind: 'queueReorder',
  itemId: 'item-1',
  position: 'back',
})

const statusChangeMutation: FileMutation = FileMutationSchema.parse({
  kind: 'queueStatusChange',
  itemId: 'item-1',
  status: 'done',
})

describe('applyMutations', () => {
  test('dispatches each mutation kind to its matching port method', async () => {
    const { port } = createFakePort()
    const result = await applyMutations(port, [frontmatterMutation, appendMutation, reorderMutation, statusChangeMutation])

    expect(result.success).toBe(true)
    expect(port.writeFrontmatter).toHaveBeenCalledTimes(1)
    expect(port.writeFrontmatter).toHaveBeenCalledWith(frontmatterMutation)
    expect(port.appendText).toHaveBeenCalledTimes(1)
    expect(port.appendText).toHaveBeenCalledWith(appendMutation)
    expect(port.reorderQueueItem).toHaveBeenCalledTimes(1)
    expect(port.reorderQueueItem).toHaveBeenCalledWith(reorderMutation)
    expect(port.changeQueueItemStatus).toHaveBeenCalledTimes(1)
    expect(port.changeQueueItemStatus).toHaveBeenCalledWith(statusChangeMutation)
  })

  test('dispatches mutations sequentially in array order', async () => {
    const { port, getOrder } = createFakePort()
    await applyMutations(port, [appendMutation, frontmatterMutation, statusChangeMutation])
    expect(getOrder()).toEqual(['appendText', 'writeFrontmatter', 'changeQueueItemStatus'])
  })

  test('stops dispatch after the first failure and resolves with a failure result', async () => {
    const cause = new Error('vault write failed')
    const { port, getOrder } = createFakePort({ reorderQueueItem: cause })

    const mutations = [frontmatterMutation, reorderMutation, appendMutation]
    const result = await applyMutations(port, mutations)

    expect(result.success).toBe(false)
    expect(result.success === false && result.mutation).toBe(reorderMutation)
    expect(result.success === false && result.cause).toBe(cause)
    expect(result.success === false && result.appliedCount).toBe(1)
    expect(getOrder()).toEqual(['writeFrontmatter', 'reorderQueueItem'])
    expect(port.appendText).not.toHaveBeenCalled()
  })

  test('appliedCount is positional, not identity-based -- correct even when the same mutation object appears twice', async () => {
    const cause = new Error('vault write failed')
    let callCount = 0
    const port: FileMutationPort = {
      writeFrontmatter: mock(async () => {}),
      appendText: mock(async () => {
        callCount += 1
        if (callCount === 2) {
          throw cause
        }
      }),
      reorderQueueItem: async () => {},
      changeQueueItemStatus: async () => {},
    }

    // appendMutation appears twice, by reference -- the second occurrence is the one that fails.
    const result = await applyMutations(port, [appendMutation, appendMutation, frontmatterMutation])

    expect(result.success).toBe(false)
    expect(result.success === false && result.mutation).toBe(appendMutation)
    expect(result.success === false && result.appliedCount).toBe(1)
    expect(port.writeFrontmatter).not.toHaveBeenCalled()
  })

  test('resolves with a success result and touches nothing for an empty mutation list', async () => {
    const { port } = createFakePort()
    const result = await applyMutations(port, [])

    expect(result.success).toBe(true)
    expect(port.writeFrontmatter).not.toHaveBeenCalled()
    expect(port.appendText).not.toHaveBeenCalled()
    expect(port.reorderQueueItem).not.toHaveBeenCalled()
    expect(port.changeQueueItemStatus).not.toHaveBeenCalled()
  })

  test('coalesces same-file frontmatter mutations into writeFrontmatterBatch when supported, preserving append boundaries', async () => {
    let calls: readonly string[] = []
    let batches: readonly { filePath: string, count: number }[] = []
    const { port } = createFakePort()
    const batchPort: FileMutationPort = {
      ...port,
      writeFrontmatter: mock(async (m) => {
        calls = [...calls, `single:${m.filePath}:${m.property}`]
      }),
      appendText: mock(async (m) => {
        calls = [...calls, `append:${m.filePath}`]
      }),
      writeFrontmatterBatch: mock(async (filePath, group) => {
        calls = [...calls, `batch:${filePath}:${group.length}`]
        batches = [...batches, { filePath, count: group.length }]
      }),
    }

    const sameFileStatus: FileMutation = { kind: 'queueStatusChange', itemId: TaskQueueItemIdSchema.parse('notes/task.md'), status: 'deferred' }
    const sameFileDue: FileMutation = { kind: 'frontmatter', filePath: 'notes/task.md', property: 'routine-due', value: '2026-11-19' }
    const otherFileFm: FileMutation = { kind: 'frontmatter', filePath: 'notes/other.md', property: 'box', value: 2 }
    const afterAppendFm: FileMutation = { kind: 'frontmatter', filePath: 'notes/task.md', property: 'after', value: true }

    const result = await applyMutations(batchPort, [
      sameFileStatus,
      otherFileFm,
      sameFileDue,
      appendMutation,
      afterAppendFm,
    ])

    expect(result).toEqual({ success: true })
    expect(batches).toEqual([{ filePath: 'notes/task.md', count: 2 }])
    expect(calls).toEqual([
      'batch:notes/task.md:2',
      'single:notes/other.md:box',
      'append:daily-note.md',
      'single:notes/task.md:after',
    ])
  })

  test('reports accurate appliedCount when writeFrontmatterBatch fails after earlier steps', async () => {
    const cause = new Error('batch failed')
    const { port } = createFakePort()
    const batchPort: FileMutationPort = {
      ...port,
      writeFrontmatterBatch: mock(async () => {
        throw cause
      }),
    }

    const fm1: FileMutation = { kind: 'frontmatter', filePath: 'notes/a.md', property: 'p1', value: 1 }
    const fm2: FileMutation = { kind: 'frontmatter', filePath: 'notes/b.md', property: 'p1', value: 1 }
    const fm3: FileMutation = { kind: 'frontmatter', filePath: 'notes/b.md', property: 'p2', value: 2 }

    const result = await applyMutations(batchPort, [fm1, fm2, fm3])

    expect(result.success).toBe(false)
    expect(result.success === false && result.mutation).toBe(fm2)
    expect(result.success === false && result.cause).toBe(cause)
    expect(result.success === false && result.appliedCount).toBe(1)
  })
})
