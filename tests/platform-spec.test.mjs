import test from 'node:test'
import assert from 'node:assert/strict'
import { PLATFORM_SPECS, allPlatformSpecs, detectPlatform, platformSpec } from '../lib/testing.js'

test('every spec has a deterministic scale target and a safe-area note', () => {
  const specs = allPlatformSpecs()
  assert.equal(specs.length, 5)
  for (const spec of specs) {
    assert.match(spec.size, /^\d+:\d+$/, spec.platform)
    const [width, height] = spec.size.split(':').map(Number)
    assert.ok(width > 0 && height > 0, spec.platform)
    assert.ok(spec.maxDurationSec > 0, spec.platform)
    assert.ok(spec.safeArea.length > 0, spec.platform)
    assert.ok(spec.note.length > 0, spec.platform)
  }
})

test('verticals are 9:16 or 3:4, only B站 is 16:9', () => {
  assert.equal(PLATFORM_SPECS.douyin.aspect, '9:16')
  assert.equal(PLATFORM_SPECS.kuaishou.aspect, '9:16')
  assert.equal(PLATFORM_SPECS.wechat.aspect, '3:4')
  assert.equal(PLATFORM_SPECS.xiaohongshu.aspect, '3:4')
  assert.equal(PLATFORM_SPECS.bilibili.aspect, '16:9')
})

test('platform lookup is case and space tolerant, unknown returns undefined', () => {
  assert.equal(platformSpec('  DOUYIN ')?.platform, 'douyin')
  assert.equal(platformSpec('weibo'), undefined)
  assert.equal(platformSpec(undefined), undefined)
})

test('platform detection reads the request wording, including B 站', () => {
  assert.equal(detectPlatform('做一条抖音竖版短视频'), 'douyin')
  assert.equal(detectPlatform('发到B站的横版'), 'bilibili')
  assert.equal(detectPlatform('这条上视频号'), 'wechat')
  assert.equal(detectPlatform('小红书笔记视频'), 'xiaohongshu')
  assert.equal(detectPlatform('随便做一条'), undefined)
})