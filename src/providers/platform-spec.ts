/**
 * Platform delivery specs for the packaging step.
 *
 * Every number here is a delivery target, not a creative choice: the platform
 * crops, letterboxes or re-encodes anything else, so shipping the spec'd size
 * keeps the cut intact. Values are the common published guidance for these
 * platforms and are intentionally conservative.
 *
 * This module is pure: it maps a platform to a size/aspect/max-duration triple
 * plus the human-facing note the deliverable should carry.
 */

export type DeliveryPlatform = 'douyin' | 'kuaishou' | 'wechat' | 'bilibili' | 'xiaohongshu'

export interface PlatformSpec {
  platform: DeliveryPlatform
  label: string
  /** ffmpeg scale target, `w:h` for videoProcess. */
  size: string
  aspect: '9:16' | '16:9' | '3:4' | '1:1'
  /** Recommended maximum duration in seconds for the primary feed format. */
  maxDurationSec: number
  /** Safe-area note for burned subtitles. */
  safeArea: string
  /** One-line delivery note the agent should surface. */
  note: string
}

export const PLATFORM_SPECS: Record<DeliveryPlatform, PlatformSpec> = {
  douyin: {
    platform: 'douyin',
    label: '抖音',
    size: '1080:1920',
    aspect: '9:16',
    maxDurationSec: 180,
    safeArea: '上下各留 15% 给 UI 与标题区',
    note: '竖版 1080×1920；信息流首帧即封面，核心信息居中',
  },
  kuaishou: {
    platform: 'kuaishou',
    label: '快手',
    size: '1080:1920',
    aspect: '9:16',
    maxDurationSec: 180,
    safeArea: '上下各留 15% 给 UI 区',
    note: '竖版 1080×1920；封面与首帧一致更稳',
  },
  wechat: {
    platform: 'wechat',
    label: '视频号',
    size: '1080:1260',
    aspect: '3:4',
    maxDurationSec: 300,
    safeArea: '底部留 18% 给标题与互动条',
    note: '视频号 3:4 更适配聊天卡片；竖版内容底部留白',
  },
  bilibili: {
    platform: 'bilibili',
    label: 'B 站',
    size: '1920:1080',
    aspect: '16:9',
    maxDurationSec: 3600,
    safeArea: '底部留 12% 给字幕与进度条',
    note: '横版 1920×1080；封面 16:10，标题不超过 30 字',
  },
  xiaohongshu: {
    platform: 'xiaohongshu',
    label: '小红书',
    size: '1080:1440',
    aspect: '3:4',
    maxDurationSec: 300,
    safeArea: '底部留 20% 给标题与标签',
    note: '3:4 竖版；首帧带一句话标题更易点击',
  },
}

export function platformSpec(platform: string | undefined): PlatformSpec | undefined {
  if (platform === undefined) return undefined
  const key = platform.trim().toLowerCase()
  return (PLATFORM_SPECS as Record<string, PlatformSpec | undefined>)[key]
}

export function allPlatformSpecs(): PlatformSpec[] {
  return Object.values(PLATFORM_SPECS)
}

/**
 * Pick the platform for a request from its wording, or undefined when the
 * request names none (the caller then asks instead of guessing).
 */
export function detectPlatform(text: string): DeliveryPlatform | undefined {
  const probes: Array<[DeliveryPlatform, string[]]> = [
    ['douyin', ['抖音', 'douyin', 'tiktok']],
    ['kuaishou', ['快手', 'kuaishou']],
    ['wechat', ['视频号', '微信', 'wechat']],
    ['bilibili', ['bilibili', 'b站', 'B站']],
    ['xiaohongshu', ['小红书', 'xiaohongshu', 'rednote']],
  ]
  for (const [platform, keywords] of probes) {
    if (keywords.some(keyword => text.includes(keyword))) return platform
  }
  return undefined
}