import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert'
import * as React from 'react'
import { queryOrThrow, renderComponent } from '../../helpers/component-test-utils'
import { Avatar } from '../../../src/ui/lib/avatar'
import { IAvatarUser } from '../../../src/models/avatar'

let unmount: (() => void) | undefined

afterEach(() => {
  unmount?.()
  unmount = undefined
})

function createUser(overrides: Partial<IAvatarUser> = {}): IAvatarUser {
  return {
    name: 'Mona Lisa',
    email: 'mona@example.com',
    avatarURL: 'https://avatars.githubusercontent.com/u/1',
    endpoint: null,
    ...overrides,
  }
}

describe('Avatar', () => {
  it('renders the fallback octicon when no user is provided', () => {
    const { container, unmount: u } = renderComponent(
      <Avatar accounts={[]} tooltip={false} />
    )
    unmount = u

    assert.ok(container.querySelector('.avatar-container'))
    assert.ok(container.querySelector('svg.octicon.avatar'))
    assert.equal(container.querySelector('img.avatar'), null)
  })

  it('renders an avatar image with a sized url and alt text', () => {
    const { container, unmount: u } = renderComponent(
      <Avatar accounts={[]} tooltip={false} user={createUser()} size={32} />
    )
    unmount = u

    const image = queryOrThrow<HTMLImageElement>(container, 'img.avatar')
    assert.equal(
      image.src,
      'https://avatars.githubusercontent.com/u/1?s=32'
    )
    assert.equal(image.alt, 'Avatar for Mona Lisa')
  })

  it('forwards aria-hidden to the avatar image', () => {
    const { container, unmount: u } = renderComponent(
      <Avatar
        accounts={[]}
        tooltip={false}
        user={createUser()}
        aria-hidden="true"
      />
    )
    unmount = u

    const image = queryOrThrow<HTMLImageElement>(container, 'img.avatar')
    assert.equal(image.getAttribute('aria-hidden'), 'true')
  })

  it('uses the email address in alt text when the name is empty', () => {
    const { container, unmount: u } = renderComponent(
      <Avatar
        accounts={[]}
        tooltip={false}
        user={createUser({ name: '', email: 'octocat@example.com' })}
      />
    )
    unmount = u

    const image = queryOrThrow<HTMLImageElement>(container, 'img.avatar')
    assert.equal(image.alt, 'Avatar for octocat@example.com')
  })
})