import { describe, it } from 'node:test'
import assert from 'node:assert'
import { CloningRepositoriesStore } from '../../src/lib/stores/cloning-repositories-store'
import { CloningRepository } from '../../src/models/cloning-repository'

describe('CloningRepositoriesStore', () => {
  it('starts with no repositories', () => {
    const store = new CloningRepositoriesStore()
    assert.equal(store.repositories.length, 0)
  })

  describe('remove', () => {
    it('removes a repository that was added', () => {
      const store = new CloningRepositoriesStore()
      const repo = new CloningRepository(
        '/tmp/test',
        'https://github.com/owner/repo.git'
      )

      // Manually push to simulate the clone starting
      ;(store as any)._repositories.push(repo)
      assert.equal(store.repositories.length, 1)

      store.remove(repo)
      assert.equal(store.repositories.length, 0)
    })

    it('handles removing a repository that does not exist', () => {
      const store = new CloningRepositoriesStore()
      const repo = new CloningRepository(
        '/tmp/test',
        'https://github.com/owner/repo.git'
      )

      // Should not throw
      store.remove(repo)
      assert.equal(store.repositories.length, 0)
    })
  })

  describe('getRepositoryState', () => {
    it('returns null for unknown repository', () => {
      const store = new CloningRepositoriesStore()
      const repo = new CloningRepository(
        '/tmp/test',
        'https://github.com/owner/repo.git'
      )
      assert.equal(store.getRepositoryState(repo), null)
    })
  })

  describe('emitUpdate', () => {
    it('notifies listeners when state changes', () => {
      const store = new CloningRepositoriesStore()
      let updateCount = 0
      store.onDidUpdate(() => {
        updateCount++
      })

      const repo = new CloningRepository(
        '/tmp/test',
        'https://github.com/owner/repo.git'
      )
      store.remove(repo) // triggers emitUpdate

      assert.ok(updateCount > 0, 'Expected at least one update notification')
    })
  })
})

describe('CloningRepository', () => {
  it('derives name from URL', () => {
    const repo = new CloningRepository(
      '/tmp/test',
      'https://github.com/owner/my-repo.git'
    )
    assert.equal(repo.name, 'my-repo')
  })

  it('generates unique IDs', () => {
    const a = new CloningRepository('/tmp/a', 'https://github.com/owner/a.git')
    const b = new CloningRepository('/tmp/b', 'https://github.com/owner/b.git')
    assert.notEqual(a.id, b.id)
  })

  it('generates a hash', () => {
    const repo = new CloningRepository(
      '/tmp/test',
      'https://github.com/owner/repo.git'
    )
    assert.ok(repo.hash.length > 0)
    assert.ok(repo.hash.includes(repo.path))
  })
})
