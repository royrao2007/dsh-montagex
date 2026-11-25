import test from 'node:test'
import assert from 'node:assert/strict'
import { SETTINGS_NAMESPACE, SETTINGS_NAMESPACE_CANDIDATES, resolveSettingsForm } from '../lib/testing.js'

function fakeForm(id) {
  return { id, getSnapshot: () => ({ status: 'ready' }), subscribe: () => () => {} }
}

function fakeForms(available) {
  const calls = []
  return {
    calls,
    get(entryId) {
      calls.push(entryId)
      if (!available.includes(entryId)) throw new Error(`unknown entry ${entryId}`)
      return fakeForm(entryId)
    },
  }
}

test('direct row id resolves first', () => {
  const forms = fakeForms(['montagex', 'include:montagex'])
  assert.equal(resolveSettingsForm(forms).id, 'montagex')
  assert.deepEqual(forms.calls, ['montagex'])
})

test('include-mounted row id resolves when the direct id is absent', () => {
  const forms = fakeForms(['include:montagex'])
  assert.equal(resolveSettingsForm(forms).id, 'include:montagex')
  assert.deepEqual(forms.calls, ['montagex', 'include:montagex'])
})

test('a rejecting get() while probing does not abort the search', () => {
  const forms = fakeForms(['include:montagex'])
  assert.doesNotThrow(() => resolveSettingsForm(forms))
  assert.ok(SETTINGS_NAMESPACE_CANDIDATES.includes('include:montagex'))
})

test('listing fallback finds a renamed row by package name', () => {
  const entries = [{ id: 'include:renamed', name: 'dsh-montagex' }]
  const forms = {
    entries,
    get(entryId) {
      if (entryId === 'include:renamed') return fakeForm(entryId)
      throw new Error('unknown')
    },
  }
  assert.equal(resolveSettingsForm(forms).id, 'include:renamed')
})

test('no usable form returns undefined instead of throwing', () => {
  assert.equal(resolveSettingsForm(undefined), undefined)
  assert.equal(resolveSettingsForm(fakeForms([])), undefined)
})

test('namespace constant stays the plugin id', () => {
  assert.equal(SETTINGS_NAMESPACE, 'montagex')
})