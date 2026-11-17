import { existsSync, statSync } from 'node:fs'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { basename, extname, isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { resolveOutputDir, slugify } from '../support.ts'
import { probeMedia } from './ffmpeg.ts'

/**
 * FCPXML 1.10 export: turn a MontageX timeline into an editable NLE project
 * that Premiere Pro, DaVinci Resolve and Final Cut Pro can open. This is the
 * missing hand-off between "AI produced an MP4" and "an editor keeps working":
 * the cut lands as clips on a spine, each still pointing at its own source,
 * so a human can re-trim, re-order, grade or replace any shot.
 *
 * Deliberately small, like the OTIO-subset timeline: one video spine with
 * hard cuts, optional connected audio lanes with per-track volume. Speed ramps,
 * reverse and cross dissolves are not representable without effects FCPXML
 * resources that differ per NLE, so they are reported as warnings instead of
 * being silently dropped.
 */

export type FcpxmlErrorCode = 'invalidArg' | 'notFound' | 'probe' | 'writeFailed' | 'outOfRange'

export class FcpxmlError extends Error {
  constructor(public readonly code: FcpxmlErrorCode, message: string) {
    super(message)
    this.name = 'FcpxmlError'
  }
}

export interface FcpxmlSceneInput {
  /** Absolute local path, or a path relative to the output dir. */
  source: string
  /** Clip name shown in the NLE; defaults to S01, S02… */
  name?: string
  /** Source in/out in seconds; omitted = whole asset. */
  trim?: [number, number]
}

export interface FcpxmlAudioInput {
  /** Absolute local path, or a path relative to the output dir. */
  path: string
  name?: string
  /** Linear gain (1 = unity); converted to dB in the document. */
  volume?: number
  /** Timeline placement of the track in seconds (default 0). */
  start?: number
  /** Source in/out in seconds; omitted = from `start` to the asset end. */
  trim?: [number, number]
  /** Connected lane: -1 is directly above the spine, -2 above that… */
  lane?: number
}

export interface FcpxmlExportInput {
  name?: string
  eventName?: string
  scenes: FcpxmlSceneInput[]
  audio?: FcpxmlAudioInput[]
  /** Sidecar SRT copied next to the .fcpxml (captions are not embedded). */
  subtitle?: string
  width?: number
  height?: number
  /** 23.976 / 24 / 25 / 29.97 / 30 / 50 / 59.94 / 60. Default: probed, else 25. */
  frameRate?: number
  /** Output file stem; defaults to slugified project name. */
  fileName?: string
  /** Drop unreadable scenes instead of failing the whole export. */
  skipMissing?: boolean
  outputDir?: string
}

export interface FcpxmlAssetInfo {
  durationSec: number
  width?: number
  height?: number
  fps?: number
  hasVideo?: boolean
  hasAudio?: boolean
}

export interface FcpxmlExportDeps {
  /** Probe override for tests; defaults to ffprobe via probeMedia. */
  inspect?: (source: string) => FcpxmlAssetInfo
}

export interface FcpxmlExportOutput {
  path: string
  fileName: string
  bytes: number
  width: number
  height: number
  frameRate: number
  frameDuration: string
  sequenceDurationSec: number
  clips: number
  assets: number
  audioTracks: number
  subtitlePath?: string
  missing: string[]
  warnings: string[]
  steps: string[]
}

export interface FcpxmlAssetSpec {
  key: string
  name: string
  /** file:// URL, already escaped. */
  src: string
  durationSec: number
  width?: number
  height?: number
  hasVideo: boolean
  hasAudio: boolean
}

export interface FcpxmlClipSpec {
  assetKey: string
  name: string
  sourceInSec: number
  durationSec: number
}

export interface FcpxmlAudioSpec {
  assetKey: string
  name: string
  offsetSec: number
  sourceInSec: number
  durationSec: number
  volume?: number
  lane: number
}

export interface FcpxmlDocumentSpec {
  name: string
  eventName: string
  width: number
  height: number
  frameRate: number
  assets: FcpxmlAssetSpec[]
  clips: FcpxmlClipSpec[]
  audio?: FcpxmlAudioSpec[]
}

interface Timebase {
  num: number
  den: number
  fps: number
}

/** Frame rates an NLE actually understands, expressed exactly (1001/30000 etc). */
const TIMEBASES: Record<string, Timebase> = {
  '23.976': { num: 1001, den: 24000, fps: 24000 / 1001 },
  '24': { num: 1, den: 24, fps: 24 },
  '25': { num: 1, den: 25, fps: 25 },
  '29.97': { num: 1001, den: 30000, fps: 30000 / 1001 },
  '30': { num: 1, den: 30, fps: 30 },
  '50': { num: 1, den: 50, fps: 50 },
  '59.94': { num: 1001, den: 60000, fps: 60000 / 1001 },
  '60': { num: 1, den: 60, fps: 60 },
}

export function resolveTimebase(frameRate: number | undefined): Timebase {
  const rate = frameRate ?? 25
  if (!Number.isFinite(rate) || rate <= 0) throw new FcpxmlError('invalidArg', `帧率非法：${String(frameRate)}`)
  const nearest = Object.values(TIMEBASES).find(base => Math.abs(base.fps - rate) < 0.01)
  if (nearest === undefined) {
    throw new FcpxmlError('invalidArg', `不支持的帧率 ${rate}；可用 23.976 / 24 / 25 / 29.97 / 30 / 50 / 59.94 / 60`)
  }
  return nearest
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y !== 0) {
    const next = x % y
    x = y
    y = next
  }
  return x === 0 ? 1 : x
}

/** Seconds → frame count on this timebase (half-up, deterministic). */
export function secondsToFrames(seconds: number, timebase: Timebase): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0
  return Math.round(seconds * timebase.fps)
}

/** Frame count → FCPXML rational time ("N/Ds", reduced; "0s" for zero). */
export function fcpxmlTime(frames: number, timebase: Timebase): string {
  if (frames === 0) return '0s'
  const numerator = frames * timebase.num
  const divisor = gcd(numerator, timebase.den)
  const num = numerator / divisor
  const den = timebase.den / divisor
  return den === 1 ? `${num}s` : `${num}/${den}s`
}

export function xmlEscape(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

function formatName(height: number, frameRate: number): string {
  const tag = String(frameRate).replace('.', '')
  return `FFVideoFormat${height}p${tag}`
}

function volumeDb(volume: number | undefined): string | undefined {
  if (volume === undefined || !Number.isFinite(volume) || volume <= 0 || Math.abs(volume - 1) < 0.001) return undefined
  const db = Math.max(-96, Math.min(12, 20 * Math.log10(volume)))
  return `${db.toFixed(1)}dB`
}

/**
 * Build the FCPXML document. Pure: every asset already carries its resolved
 * file URL and duration, so this can be tested without ffprobe or a filesystem.
 */
export function buildFcpxml(spec: FcpxmlDocumentSpec): string {
  if (spec.clips.length === 0) throw new FcpxmlError('invalidArg', 'FCPXML 至少需要一个镜头')
  const timebase = resolveTimebase(spec.frameRate)
  const frameDuration = fcpxmlTime(1, timebase)

  // Formats: project format first, then one per distinct asset dimension. IDs
// share one counter with the assets so a format added later can never collide
// with an already-issued asset id.
  interface FormatRow { id: string; width: number; height: number }
  let nextResource = 1
  const formats: FormatRow[] = []
  const formatIdByKey = new Map<string, string>()
  const formatIdFor = (width: number, height: number): string => {
    const key = `${width}x${height}`
    const existing = formatIdByKey.get(key)
    if (existing !== undefined) return existing
    const id = `r${nextResource}`
    nextResource += 1
    formats.push({ id, width, height })
    formatIdByKey.set(key, id)
    return id
  }
  formatIdFor(spec.width, spec.height)

  const assetIdByKey = new Map<string, string>()
  const assetRows: Array<{ id: string; asset: FcpxmlAssetSpec; format: string }> = []
  const ensureAsset = (asset: FcpxmlAssetSpec): string => {
    const existing = assetIdByKey.get(asset.key)
    if (existing !== undefined) return existing
    const width = asset.width ?? spec.width
    const height = asset.height ?? spec.height
    const format = asset.hasVideo ? formatIdFor(width, height) : ''
    const id = `r${nextResource}`
    nextResource += 1
    assetIdByKey.set(asset.key, id)
    assetRows.push({ id, asset, format })
    return id
  }

  const spineLines: string[] = []
  let playlistFrames = 0
  spec.clips.forEach((clip, index) => {
    const assetId = ensureAsset(assetOf(spec.assets, clip.assetKey))
    const durationFrames = Math.max(1, secondsToFrames(clip.durationSec, timebase))
    const startFrames = Math.max(0, secondsToFrames(clip.sourceInSec, timebase))
    const offsetFrames = playlistFrames
    playlistFrames += durationFrames
    const name = xmlEscape(clip.name !== '' ? clip.name : `S${String(index + 1).padStart(2, '0')}`)
    spineLines.push(`        <asset-clip ref="${assetId}" name="${name}" offset="${fcpxmlTime(offsetFrames, timebase)}" duration="${fcpxmlTime(durationFrames, timebase)}" start="${fcpxmlTime(startFrames, timebase)}" tcFormat="NDF" audioRole="dialogue"/>`)
  })

  let sequenceFrames = playlistFrames
  for (const track of spec.audio ?? []) {
    const assetId = ensureAsset(assetOf(spec.assets, track.assetKey))
    const durationFrames = Math.max(1, secondsToFrames(track.durationSec, timebase))
    const offsetFrames = Math.max(0, secondsToFrames(track.offsetSec, timebase))
    const startFrames = Math.max(0, secondsToFrames(track.sourceInSec, timebase))
    sequenceFrames = Math.max(sequenceFrames, offsetFrames + durationFrames)
    const lane = track.lane <= -1 ? track.lane : -1
    const name = xmlEscape(track.name !== '' ? track.name : basename(track.assetKey))
    const db = volumeDb(track.volume)
    const volumeLine = db === undefined ? '' : `\n          <adjust-volume amount="${db}"/>`
    spineLines.push(`        <asset-clip ref="${assetId}" name="${name}" lane="${lane}" offset="${fcpxmlTime(offsetFrames, timebase)}" duration="${fcpxmlTime(durationFrames, timebase)}" start="${fcpxmlTime(startFrames, timebase)}" tcFormat="NDF" audioRole="music">${volumeLine}\n        </asset-clip>`)
  }

  const resourceLines: string[] = []
  for (const format of formats) {
    resourceLines.push(`    <format id="${format.id}" name="${formatName(format.height, timebase.fps)}" frameDuration="${frameDuration}" width="${format.width}" height="${format.height}"/>`)
  }
  for (const row of assetRows) {
    const attrs = [
      `id="${row.id}"`,
      `name="${xmlEscape(row.asset.name)}"`,
      'start="0s"',
      `duration="${fcpxmlTime(Math.max(1, secondsToFrames(row.asset.durationSec, timebase)), timebase)}"`,
      `hasVideo="${row.asset.hasVideo ? 1 : 0}"`,
      `hasAudio="${row.asset.hasAudio ? 1 : 0}"`,
      ...(row.format === '' ? [] : [`format="${row.format}"`]),
      `src="${xmlEscape(row.asset.src)}"`,
    ]
    resourceLines.push(`    <asset ${attrs.join(' ')}/>`)
  }

  const sequenceDuration = fcpxmlTime(sequenceFrames, timebase)
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!DOCTYPE fcpxml>',
    '<fcpxml version="1.10">',
    '  <resources>',
    ...resourceLines,
    '  </resources>',
    '  <library>',
    `    <event name="${xmlEscape(spec.eventName)}">`,
    `      <project name="${xmlEscape(spec.name)}">`,
    `        <sequence format="r1" duration="${sequenceDuration}" tcStart="0s" tcFormat="NDF" audioLayout="stereo" audioRate="48k">`,
    '          <spine>',
    ...spineLines,
    '          </spine>',
    '        </sequence>',
    '      </project>',
    '    </event>',
    '  </library>',
    '</fcpxml>',
    '',
  ].join('\n')
}

function assetOf(assets: FcpxmlAssetSpec[], key: string): FcpxmlAssetSpec {
  const asset = assets.find(item => item.key === key)
  if (asset === undefined) throw new FcpxmlError('invalidArg', `引用了不存在的素材：${key}`)
  return asset
}

function extensionKind(source: string): { hasVideo: boolean; hasAudio: boolean } {
  const ext = extname(source).toLowerCase()
  if (['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg', '.wma'].includes(ext)) return { hasVideo: false, hasAudio: true }
  return { hasVideo: true, hasAudio: true }
}

function inspectSource(source: string, inspect?: FcpxmlExportDeps['inspect']): FcpxmlAssetInfo {
  if (inspect !== undefined) return inspect(source)
  const probe = probeMedia(source)
  const video = probe.streams.find(stream => stream.type === 'video')
  const audio = probe.streams.find(stream => stream.type === 'audio')
  return {
    durationSec: probe.durationSec,
    ...(typeof video?.width === 'number' ? { width: video.width } : {}),
    ...(typeof video?.height === 'number' ? { height: video.height } : {}),
    ...(typeof video?.fps === 'number' ? { fps: video.fps } : {}),
    hasVideo: video !== undefined,
    hasAudio: audio !== undefined,
  }
}

function resolveSource(source: string, outputDir: string): string {
  return isAbsolute(source) ? resolve(source) : resolve(resolveOutputDir(outputDir), source)
}

function cleanName(value: string): string {
  return value.replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120)
}

/**
 * Resolve, probe, and write the FCPXML (plus an SRT sidecar when given).
 * Missing media fails the export by default with the full list, because a
 * silently de-fanged NLE project is worse than a loud failure.
 */
export async function exportFcpxml(input: FcpxmlExportInput, deps: FcpxmlExportDeps = {}): Promise<FcpxmlExportOutput> {
  if (!Array.isArray(input.scenes) || input.scenes.length === 0) {
    throw new FcpxmlError('invalidArg', 'scenes 不能为空：FCPXML 导出至少需要一个镜头')
  }
  const outputDir = input.outputDir ?? ''
  const warnings: string[] = []
  const steps: string[] = []
  const missing: string[] = []
  const infos = new Map<string, FcpxmlAssetInfo>()
  const assetSpecs = new Map<string, FcpxmlAssetSpec>()

  const ensure = (source: string): { key: string; info: FcpxmlAssetInfo } | undefined => {
    const absolute = resolveSource(source, outputDir)
    const cached = infos.get(absolute)
    if (cached !== undefined) return { key: absolute, info: cached }
    if (!existsSync(absolute)) {
      missing.push(absolute)
      return undefined
    }
    let info: FcpxmlAssetInfo
    try {
      info = inspectSource(absolute, deps.inspect)
    } catch (error) {
      throw new FcpxmlError('probe', `ffprobe 读取失败：${absolute} — ${error instanceof Error ? error.message : String(error)}`)
    }
    if (!Number.isFinite(info.durationSec) || info.durationSec <= 0) {
      throw new FcpxmlError('probe', `素材时长为 0 或不可读：${absolute}`)
    }
    if (statSync(absolute).size === 0) throw new FcpxmlError('probe', `素材是空文件：${absolute}`)
    infos.set(absolute, info)
    const kind = extensionKind(absolute)
    const key = absolute
    if (!assetSpecs.has(key)) {
      assetSpecs.set(key, {
        key,
        name: cleanName(basename(absolute, extname(absolute))) || 'asset',
        src: pathToFileURL(absolute).href,
        durationSec: info.durationSec,
        ...(info.width !== undefined ? { width: info.width } : {}),
        ...(info.height !== undefined ? { height: info.height } : {}),
        hasVideo: info.hasVideo ?? kind.hasVideo,
        hasAudio: info.hasAudio ?? kind.hasAudio,
      })
    }
    return { key, info }
  }

  const clips: FcpxmlClipSpec[] = []
  for (const [index, scene] of input.scenes.entries()) {
    const resolved = ensure(scene.source)
    if (resolved === undefined) {
      if (input.skipMissing === true) continue
      continue
    }
    const asset = assetSpecs.get(resolved.key) as FcpxmlAssetSpec
    const defaultName = `S${String(index + 1).padStart(2, '0')}`
    if (scene.trim === undefined) {
      clips.push({ assetKey: asset.key, name: scene.name ?? defaultName, sourceInSec: 0, durationSec: resolved.info.durationSec })
      continue
    }
    const [start, end] = scene.trim
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) {
      throw new FcpxmlError('invalidArg', `第 ${index + 1} 个镜头 trim 非法：${JSON.stringify(scene.trim)}（要求 0 <= start < end）`)
    }
    if (start >= resolved.info.durationSec) {
      throw new FcpxmlError('outOfRange', `第 ${index + 1} 个镜头 trim 起点超出素材时长：${start}s >= ${resolved.info.durationSec.toFixed(2)}s`)
    }
    const clampedEnd = Math.min(end, resolved.info.durationSec)
    if (end > resolved.info.durationSec + 0.001) {
      warnings.push(`第 ${index + 1} 个镜头 trim 超出素材时长：${end}s > ${resolved.info.durationSec.toFixed(2)}s，已截到素材末尾`)
    }
    clips.push({ assetKey: asset.key, name: scene.name ?? defaultName, sourceInSec: start, durationSec: Math.max(0.001, clampedEnd - start) })
  }

  if (clips.length === 0) {
    throw new FcpxmlError('notFound', `所有镜头素材都不存在：${missing.join(', ') || '(空)'}`)
  }
  if (missing.length > 0) {
    if (input.skipMissing !== true) {
      throw new FcpxmlError('notFound', `${missing.length} 个镜头素材不存在（可用 skipMissing 跳过）：${missing.join(', ')}`)
    }
    warnings.push(`跳过 ${missing.length} 个不存在的素材：${missing.join(', ')}`)
  }

  const audio: FcpxmlAudioSpec[] = []
  for (const [index, track] of (input.audio ?? []).entries()) {
    const resolved = ensure(track.path)
    if (resolved === undefined) {
      if (input.skipMissing !== true) {
        throw new FcpxmlError('notFound', `音轨 ${index + 1} 素材不存在：${resolveSource(track.path, outputDir)}`)
      }
      warnings.push(`跳过不存在的音轨 ${index + 1}：${track.path}`)
      continue
    }
    const start = Math.max(0, track.start ?? 0)
    const sourceIn = track.trim?.[0] ?? 0
    const sourceOut = track.trim?.[1] ?? resolved.info.durationSec
    if (sourceOut <= sourceIn) throw new FcpxmlError('invalidArg', `音轨 ${index + 1} 的区间非法：${sourceIn}s → ${sourceOut}s`)
    audio.push({
      assetKey: resolved.key,
      name: track.name ?? basename(track.path, extname(track.path)),
      offsetSec: start,
      sourceInSec: sourceIn,
      durationSec: Math.min(sourceOut, resolved.info.durationSec) - sourceIn,
      ...(track.volume !== undefined ? { volume: track.volume } : {}),
      lane: track.lane ?? -(index + 1),
    })
  }

  const firstVideo = [...assetSpecs.values()].find(asset => asset.hasVideo)
  const width = input.width ?? firstVideo?.width ?? 1920
  const height = input.height ?? firstVideo?.height ?? 1080
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw new FcpxmlError('invalidArg', `画幅非法：${width}x${height}`)
  }
  const probedRate = firstVideo !== undefined ? infos.get(firstVideo.key)?.fps : undefined
  const frameRate = input.frameRate ?? nearestKnownRate(probedRate) ?? 25
  const timebase = resolveTimebase(frameRate)

  const projectName = cleanName(input.name ?? 'MontageX Cut') || 'MontageX Cut'
  const xml = buildFcpxml({
    name: projectName,
    eventName: cleanName(input.eventName ?? 'MontageX'),
    width,
    height,
    frameRate,
    assets: [...assetSpecs.values()],
    clips,
    ...(audio.length > 0 ? { audio } : {}),
  })

  const dir = await mkdir(resolveOutputDir(outputDir), { recursive: true }).then(() => resolveOutputDir(outputDir))
  const stem = slugify(input.fileName ?? projectName, 60)
  const fileName = `${stem}.fcpxml`
  const path = join(dir, fileName)
  try {
    await writeFile(path, xml, 'utf8')
  } catch (error) {
    throw new FcpxmlError('writeFailed', `写入 FCPXML 失败：${error instanceof Error ? error.message : String(error)}`)
  }
  steps.push(`probe: ${assetSpecs.size} assets, ${clips.length} clips`)

  let subtitlePath: string | undefined
  if (input.subtitle !== undefined && input.subtitle !== '') {
    const srt = resolveSource(input.subtitle, outputDir)
    if (existsSync(srt)) {
      subtitlePath = join(dir, `${stem}.srt`)
      await copyFile(srt, subtitlePath)
      warnings.push('字幕以 SRT 旁挂导出（FCPXML 1.10 的 caption 资源在 Premiere/Resolve/FCP 三家支持不一致）；导入后拖到时间线即可')
    } else {
      warnings.push(`字幕文件不存在，未导出：${srt}`)
    }
  }

  const spineDuration = clips.reduce((sum, clip) => sum + clip.durationSec, 0)
  const sequenceDurationSec = audio.reduce((max, track) => Math.max(max, track.offsetSec + track.durationSec), spineDuration)

  return {
    path,
    fileName,
    bytes: Buffer.byteLength(xml, 'utf8'),
    width,
    height,
    frameRate: timebase.fps,
    frameDuration: fcpxmlTime(1, timebase),
    sequenceDurationSec: Number(sequenceDurationSec.toFixed(3)),
    clips: clips.length,
    assets: assetSpecs.size,
    audioTracks: audio.length,
    ...(subtitlePath !== undefined ? { subtitlePath } : {}),
    missing,
    warnings,
    steps,
  }
}

function nearestKnownRate(rate: number | undefined): number | undefined {
  if (rate === undefined || !Number.isFinite(rate) || rate <= 0) return undefined
  const known = Object.values(TIMEBASES).find(base => Math.abs(base.fps - rate) < 0.5)
  return known === undefined ? undefined : Number(known.fps.toFixed(3))
}