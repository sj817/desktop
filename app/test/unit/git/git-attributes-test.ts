import * as FSE from 'fs-extra'
import assert from 'node:assert'
import { describe, it } from 'node:test'
import * as Path from 'path'

import { writeGitAttributes } from '../../../src/ui/add-repository/git-attributes'
import { setupEmptyRepository } from '../../helpers/repositories'

describe('git/git-attributes', () => {
  describe('writeGitAttributes', () => {
    it('initializes a .gitattributes file', async t => {
      const repo = await setupEmptyRepository(t)
      await writeGitAttributes(repo.path)
      const expectedPath = Path.join(repo.path, '.gitattributes')
      const contents = await FSE.readFile(expectedPath, 'utf8')
      assert(contents.includes('* text=auto'))
    })
  })
})
