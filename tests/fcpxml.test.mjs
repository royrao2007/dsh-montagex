import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  FcpxmlError, buildFcpxml, exportFcpxml, fcpxmlTime, resolveTimebase, secondsToFrames, xmlEscape,
} from '../lib/testing.js'

/** Minimal tag-balance check: catches the mistakes string assertions miss. */
function wellFormed(xml) {
  const stack = []
  const pattern = /<(\/?)([A-Za-z][\w:-]*)(?:"[^"]*"|[^>"])*>/g
  for (const match of xml.matchAll(pattern)) {
    const [, closing, name] = match
    if (match[0].endsWith('/>')) continue
    if (closing === '/') {
      if (stack.pop() !== name) return false
    } else {
      stack.push(name)
    }
  }
  return stack.length === 0
}

test('timebase math maps frames to FCPXML rational times', () => {
  const pal = resolveTimebase(25)
  assert.equal(pal.fps, 25)
  assert.equal(fcpxmlTime(0, pal), '0s')
  assert.equal(fcpxmlTime(25, pal), '1s')
  assert.equal(fcpxmlTime(3, pal), '3/25s')
  assert.equal(secondsToFrames(2.48, pal), 62)

  const ntsc = resolveTimebase(29.97)
  // 30 frames on 29.97 is exactly 1001/1000 s — the classic NTSC drift.
  assert.equal(secondsToFrames(1, ntsc), 30)
  assert.equal(fcpxmlTime(30, ntsc), '1001/1000s')
  assert.equal(fcpxmlTime(1, ntsc), '1001/30000s')
  assert.throws(() => resolveTimebase(17), /不支持的帧率/)
})

test('xmlEscape keeps hostile clip names inert', () => {
  assert.equal(xmlEscape('a&b<c>"d\'e'), 'a&amp;b&lt;c&gt;&quot;d&apos;e')
})

test('buildFcpxml lays clips on the spine with trims, audio lanes and per-asset formats', () => {
  const xml = buildFcpxml({
    name: 'Demo Cut',
    eventName: 'MontageX',
    width: 1920,
    height: 1080,
    frameRate: 25,
    assets: [
      { key: '/tmp/a.mp4', name: 'a', src: 'file:///tmp/a.mp4', durationSec: 10, width: 1920, height: 1080, hasVideo: true, hasAudio: true },
      { key: '/tmp/b b.mp4', name: 'b', src: 'file:///tmp/b%20b.mp4', durationSec: 8, width: 1080, height: 1920, hasVideo: true, hasAudio: false },
      { key: '/tmp/music.mp3', name: 'music', src: 'file:///tmp/music.mp3', durationSec: 12, hasVideo: false, hasAudio: true },
    ],
    clips: [
      { assetKey: '/tmp/a.mp4', name: 'S01 <wide>', sourceInSec: 2, durationSec: 3 },
      { assetKey: '/tmp/b b.mp4', name: 'S02', sourceInSec: 0, durationSec: 8 },
    ],
    audio: [
      { assetKey: '/tmp/music.mp3', name: 'BGM', offsetSec: 1, sourceInSec: 0, durationSec: 10, volume: 0.5, lane: -1 },
    ],
  })

  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.10">'))
  assert.equal(wellFormed(xml), true, 'tags must balance')
  // Spine: 3s + 8s, trims become start=, offsets accumulate.
  assert.match(xml, /<sequence format="r1" duration="11s" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">/)
  assert.match(xml, /<asset-clip ref="r2" name="S01 &lt;wide&gt;" offset="0s" duration="3s" start="2s"[^>]*audioRole="dialogue"\/>/)
  assert.match(xml, /<asset-clip ref="r4" name="S02" offset="3s" duration="8s" start="0s"/)
  // Portrait asset gets its own format resource; project format stays r1.
  assert.match(xml, /<format id="r1"[^>]*width="1920" height="1080"\/>/)
  assert.match(xml, /<format id="r3"[^>]*width="1080" height="1920"\/>/)
  // Audio: connected lane, dB conversion, escaped file URL.
  assert.match(xml, /<asset-clip ref="r5" name="BGM" lane="-1" offset="1s" duration="10s" start="0s"[^>]*audioRole="music">/)
  assert.match(xml, /<adjust-volume amount="-6\.0dB"\/>/)
  assert.match(xml, /src="file:\/\/\/tmp\/b%20b\.mp4"/)
})

test('exportFcpxml writes the project, clips referenced trims and a subtitle sidecar', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fcpxml-'))
  const first = join(dir, 'first clip.mp4')
  const second = join(dir, 'second.mp4')
  await writeFile(first, 'first-bytes')
  await writeFile(second, 'second-bytes')
  await writeFile(join(dir, 'timeline.srt'), '1\n00:00:00,000 --> 00:00:01,000\n你好\n')

  const output = await exportFcpxml({
    name: 'Trailer Cut',
    scenes: [
      { source: first, name: '开场', trim: [0.5, 2.5] },
      { source: second },
    ],
    subtitle: 'timeline.srt',
    width: 1080,
    height: 1920,
    frameRate: 25,
    outputDir: dir,
  }, {
    inspect: source => source === first ? { durationSec: 4, width: 1080, height: 1920, hasVideo: true, hasAudio: true } : { durationSec: 3, width: 1080, height: 1920, hasVideo: true, hasAudio: true },
  })

  const xml = await readFile(output.path, 'utf8')
  assert.equal(output.clips, 2)
  assert.equal(output.assets, 2)
  assert.equal(output.frameRate, 25)
  assert.equal(output.sequenceDurationSec, 5)
  assert.ok(output.subtitlePath.endsWith('trailer-cut.srt'))
  assert.equal(wellFormed(xml), true)
  assert.match(xml, /duration="5s"/)
  assert.match(xml, /offset="0s" duration="2s" start="13\/25s"/)
  assert.match(xml, /offset="2s" duration="3s"/)
  assert.deepEqual(output.missing, [])
})

test('exportFcpxml refuses missing media unless skipMissing is explicit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'fcpxml-missing-'))
  const good = join(dir, 'good.mp4')
  await writeFile(good, 'bytes')
  const inspect = () => ({ durationSec: 2, width: 1920, height: 1080, hasVideo: true, hasAudio: false })

  await assert.rejects(
    exportFcpxml({ scenes: [{ source: join(dir, 'ghost.mp4') }], outputDir: dir }, { inspect }),
    error => error instanceof FcpxmlError && error.code === 'notFound' && error.message.includes('ghost.mp4'),
  )

  const skipped = await exportFcpxml({
    scenes: [{ source: join(dir, 'ghost.mp4') }, { source: good }],
    skipMissing: true,
    frameRate: 25,
    outputDir: dir,
  }, { inspect })
  assert.equal(skipped.clips, 1)
  assert.equal(skipped.missing.length, 1)
  assert.ok(skipped.warnings.some(line => line.includes('跳过')))

  await assert.rejects(
    exportFcpxml({ scenes: [{ source: good, trim: [5, 6] }], outputDir: dir }, { inspect }),
    error => error instanceof FcpxmlError && error.code === 'outOfRange',
  )
})