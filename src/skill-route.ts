import { articlesForMode, articlesForSkills } from './craft-map.ts'
import { scanIpRisk } from './ip-lexicon.ts'

export type SkillRouteMode =
  | 'generate'
  | 'edit'
  | 'canvas'
  | 'character'
  | 'script'
  | 'qa'
  | 'onboard'
  | 'research'
  | 'style'

export interface SkillRoute {
  mode: SkillRouteMode
  reason: string
  skills: string[]
  knowledge: string[]
  articles: string[]
  tools: string[]
  next: string[]
  avoid: string[]
}

const SKILL_TOOLS: Record<string, string[]> = {
  'montagex-chengpian': ['mont_chengpian', 'mont_ask', 'mont_confirm', 'mont_stage', 'mont_prompt_plan', 'mont_skill_capture'],
  'montagex-production-lead': ['mont_brief', 'mont_prompt_plan', 'mont_propose', 'mont_canvas_shotlist', 'mont_confirm', 'mont_skill_capture', 'mont_bible'],
  'montagex-skill-capture': ['mont_skill_capture', 'mont_note', 'mont_ask', 'mont_stage'],
  'montagex-series-craft': ['mont_series', 'mont_revise', 'mont_character_list', 'mont_style_get', 'mont_style_lock', 'mont_note'],
  'montagex-blocking-craft': ['mont_blocking', 'mont_ask', 'mont_character_list', 'mont_prompt_plan', 'mont_prompt_craft'],
  'shot-recipes': ['mont_shot_vocab', 'mont_storyboard', 'mont_knowledge_read'],
  'montagex-methodology': ['mont_knowledge_search', 'mont_knowledge_read', 'mont_qa'],
  'montagex-playbook': ['mont_preflight', 'mont_generate_ready', 'mont_ip_scan', 'mont_ip_rewrite'],
  'montagex-provider-onboard': [
    'mont_provider_ingest', 'mont_provider_classify', 'mont_provider_draft',
    'mont_ask', 'mont_provider_smoke', 'mont_provider_commit',
  ],
  'novel-characters': ['mont_character_register', 'mont_character_list', 'mont_generate_ready', 'mont_bible'],
  'novel-outline': ['mont_bible', 'mont_ask', 'mont_confirm'],
  'novel-script': ['mont_speech_duration', 'mont_bible'],
  'novel-storyboard': ['mont_shot_vocab', 'mont_storyboard', 'mont_bible'],
  'novel-art': ['mont_bible', 'mont_style'],
  'storyboard-craft': ['mont_storyboard', 'mont_shot', 'mont_shot_sequence', 'mont_canvas_plan', 'mont_canvas_script', 'mont_canvas_autolink', 'mont_canvas_parse', 'mont_canvas_pack', 'mont_canvas_sheet', 'mont_canvas_split', 'mont_canvas_join', 'mont_canvas_stack', 'mont_canvas_desub', 'mont_canvas_extend', 'mont_canvas_gif'],
  'editing-workflow': ['mont_edit_plan', 'mont_edit', 'mont_video_process', 'mont_timeline', 'mont_canvas_reshoot', 'mont_canvas_pack'],
  'trailer-craft': ['mont_canvas_pack', 'mont_canvas_sheet', 'mont_canvas_shotlist', 'mont_prompt_plan', 'mont_character_register', 'mont_storyboard'],
  'frame-qa': ['mont_extract_frames', 'mont_view_image', 'mont_qa', 'mont_qa_report', 'mont_canvas_frames', 'mont_canvas_parse'],
  'video-prompt-builder': ['mont_prompt_plan', 'mont_prompt_craft', 'mont_style', 'mont_shot', 'mont_ip_scan', 'mont_ip_rewrite'],
  'video-prompt-reverse': ['mont_video_analyze', 'mont_extract_frames', 'mont_view_image'],
  'kling-prompt-copilot': ['mont_prompt_craft', 'mont_generate_video'],
  'seedance-2-prompt-copilot': ['mont_prompt_craft', 'mont_generate_video'],
  'seedance-2-5-prompt-copilot': ['mont_prompt_craft', 'mont_generate_video'],
  'minimax-h3-prompt-copilot': ['mont_prompt_craft', 'mont_generate_video'],
  'banana-prompt-copilot': ['mont_prompt_craft', 'mont_generate_image'],
  'cinematic-style': ['mont_style', 'mont_knowledge_search'],
  'continuous-video': ['mont_generate_ready', 'mont_extract_frames', 'mont_canvas_connect'],
  'caption-localization': ['mont_transcribe_audio', 'mont_srt_lint', 'mont_video_subtitle'],
  'ai-audio': ['mont_generate_audio', 'mont_audio_sync'],
  'audio-sound': ['mont_audio_mix', 'mont_audio_beat', 'mont_audio_sync'],
  'platform-specs': ['mont_qa', 'mont_video_process'],
  'thumbnail-cover': ['mont_generate_image', 'mont_view_image'],
  'script-writing': ['mont_storyboard', 'mont_brief'],
  'short-video': ['mont_chengpian', 'mont_brief', 'mont_qa'],
  'cinematic-title-sequence': ['mont_ask', 'mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready', 'mont_confirm', 'mont_generate_video', 'mont_extract_frames', 'mont_view_image'],
  'anime-game-pv': ['mont_ask', 'mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready', 'mont_confirm', 'mont_generate_image', 'mont_generate_video', 'mont_extract_frames', 'mont_view_image'],
  '3d-director-stage': ['mont_blocking', 'mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready', 'mont_extract_frames', 'mont_view_image', 'mont_qa'],
  'video-deconstruct': ['mont_probe_media', 'mont_video_analyze', 'mont_extract_frames', 'mont_view_image', 'mont_storyboard'],
  'visual-design': ['mont_style', 'mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready', 'mont_generate_image', 'mont_generate_video', 'mont_qa'],
  'brand-ad': ['mont_brief', 'mont_style', 'mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready', 'mont_generate_image', 'mont_generate_video', 'mont_qa'],
  'cool-music-video': ['mont_brief', 'mont_audio_analyze_music', 'mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready', 'mont_generate_video', 'mont_audio_sync', 'mont_qa'],
  'education-studio': ['mont_brief', 'mont_storyboard', 'mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready', 'mont_generate_video', 'mont_transcribe_audio', 'mont_qa'],
  'koc-video': ['mont_brief', 'mont_storyboard', 'mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready', 'mont_generate_video', 'mont_qa'],
  'ui-motion': ['mont_brief', 'mont_style', 'mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready', 'mont_generate_video', 'mont_qa'],
}

interface Rule {
  id: string
  match: RegExp
  mode: SkillRouteMode
  reason: string
  skills: string[]
  knowledge: string[]
  extraTools?: string[]
}

const RULES: Rule[] = [
  {
    id: 'cinematic-title-sequence',
    match: /片头|片名|卡司|演员姓名|opening\s*(title|credits)|title\s*sequence|film\s+teaser/i,
    mode: 'generate',
    reason: '影视片头/单条概念预告：先确认范围、视觉载体、准确文字与参考用途，再编译一条完整成片。',
    skills: ['cinematic-title-sequence', 'montagex-production-lead', 'montagex-chengpian'],
    knowledge: ['片头 字体 转场', '视频提示词 镜头语言'],
    extraTools: ['mont_ask', 'mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready', 'mont_confirm'],
  },
  {
    id: 'anime-game-pv',
    match: /二次元|动漫|漫画|游戏角色|角色PV|anime\s*(pv|trailer)|manga\s*pv|game\s*pv/i,
    mode: 'generate',
    reason: '二次元/游戏 PV：先锁身份与唯一视觉权威，确认分镜和完整 Prompt 后只交付一条成片。',
    skills: ['anime-game-pv', 'montagex-production-lead', 'montagex-chengpian'],
    knowledge: ['二次元 角色一致性', '分镜 角色设定', '视频提示词'],
    extraTools: ['mont_ask', 'mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready', 'mont_confirm'],
  },
  {
    id: '3d-stage',
    match: /3d\s*(stage|director)|三维舞台|3D场景|campath|motion\s*dsl|空间阻挡/i,
    mode: 'generate',
    reason: '3D 舞台工艺：先确认兼容能力，再做阻挡、镜头与视觉验证；没有真实 3D 能力不得假装交付。',
    skills: ['3d-director-stage', 'montagex-blocking-craft', 'montagex-production-lead'],
    knowledge: ['场面调度 空间', '镜头语言 运镜', '角色动作 控制'],
    extraTools: ['mont_blocking', 'mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready', 'mont_qa'],
  },
  {
    id: 'video-deconstruct',
    match: /拉片|逐镜拆解|拆解参考视频|复刻参考视频|video\s*deconstruct|shot-by-shot/i,
    mode: 'research',
    reason: '参考视频拆解：先探测、抽帧并看实际画面，再产出可执行镜头表；不把拆解结果当作生成结果。',
    skills: ['video-deconstruct', 'frame-qa', 'montagex-methodology'],
    knowledge: ['拉片 镜头拆解', '成片质检'],
    extraTools: ['mont_probe_media', 'mont_video_analyze', 'mont_extract_frames', 'mont_view_image'],
  },
  {
    id: 'blocking',
    match: /场面控制|场面锁|作战板|完全控制|多人连续|单镜长拍|世界状态|空间台账|控球权|状态机/i,
    mode: 'generate',
    reason: '场面控制表：先 harvest/schema，你写台账和物件状态机，pin 后再 craft。不要直接拿事件顺序去 generate。',
    skills: ['montagex-blocking-craft', 'continuous-video', 'montagex-production-lead', 'montagex-chengpian'],
    knowledge: ['连续性 空间 镜头'],
    extraTools: ['mont_blocking', 'mont_ask', 'mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready'],
  },
  {
    id: 'series',
    match: /同一系列|系列包|沿用设定|保存这次设定|保存本系列|下一集|续作|调用系列|套用系列/i,
    mode: 'research',
    reason: '系列包：角色锚、风格锁、镜头规则一次收成，下次 apply，不要重设计人设。',
    skills: ['montagex-series-craft', 'montagex-production-lead', 'montagex-chengpian'],
    knowledge: ['角色 一致性 风格锁'],
    extraTools: ['mont_series', 'mont_character_list', 'mont_style_get'],
  },
  {
    id: 'revise',
    match: /再生动|改这一镜|只改这|重新生成|这个表情|这张脸|这里眼神|节点重做|局部改(?!窗)/i,
    mode: 'generate',
    reason: '重新生成：先 mont_revise 带上节点上下文，再走 craft/ready。不要重输整片设定。',
    skills: ['montagex-series-craft', 'montagex-production-lead', 'montagex-chengpian'],
    knowledge: ['角色 一致性'],
    extraTools: ['mont_revise', 'mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready'],
  },
  {
    id: 'capture',
    match: /保存为技能|存成 skill|收成技能|skill_capture|保存本次为/i,
    mode: 'research',
    reason: '交片后收成：用 DSH 标准提问是否保存为技能，再把流程和修改意见写成 SKILL.md。',
    skills: ['montagex-skill-capture', 'montagex-chengpian'],
    knowledge: ['成片 流程'],
    extraTools: ['mont_skill_capture', 'mont_note', 'mont_ask'],
  },
  {
    id: 'onboard',
    match: /接入模型|新模型|apidoc|api.?doc|provider.?onboard|自配置模型/i,
    mode: 'onboard',
    reason: '新模型入驻：只走 ingest→classify→draft→ask→smoke→commit，禁止写代码。',
    skills: ['montagex-provider-onboard'],
    knowledge: ['生成协议 create poll'],
    extraTools: ['mont_provider_list'],
  },
  {
    id: 'edit',
    match: /剪辑|精剪|裁剪|裁切|调色|旋转|翻转|变速|倒放|拼接|编辑台|cut list|timeline/i,
    mode: 'edit',
    reason: '确定性编辑：先 edit_plan，再本地工具回写节点，不重绘。',
    skills: ['editing-workflow', 'montagex-methodology'],
    knowledge: ['剪辑节奏 转场'],
    extraTools: ['mont_edit_plan', 'mont_studio', 'mont_image_edit'],
  },
  {
    id: 'character',
    match: /设定图|三视图|角色卡|定妆|turnaround|character sheet|人物设定|角色设定/i,
    mode: 'character',
    reason: '人物先出 16:9 三视图设定表，再注册角色锚点。',
    skills: ['novel-characters', 'montagex-production-lead', 'montagex-methodology'],
    knowledge: ['角色 三视图 一致性'],
    extraTools: ['mont_character_register', 'mont_generate_ready'],
  },
  {
    id: 'script',
    match: /改编小说|小说改编|改编.{0,16}(小说|短剧)|写大纲|写剧本|分集|长剧|短剧大纲/i,
    mode: 'script',
    reason: '改编：大纲先收敛结构；角色/美术/剧本可并行；分镜只映射不发明。评审钉画布，不要 HTML。',
    skills: ['novel-outline', 'novel-characters', 'novel-script', 'novel-storyboard', 'montagex-production-lead'],
    knowledge: ['改编 叙事结构'],
    extraTools: ['mont_brief', 'mont_bible', 'mont_confirm'],
  },
  {
    id: 'vocab',
    match: /镜头语汇|正反打|怎么切|运镜词|shot vocab|这一刀/i,
    mode: 'canvas',
    reason: '先查配方/技法卡：怎么切、什么时候别用，再写这一格。',
    skills: ['shot-recipes', 'storyboard-craft'],
    knowledge: ['镜头语言 景别 运镜'],
    extraTools: ['mont_shot_vocab', 'mont_storyboard'],
  },
  {
    id: 'canvas-craft',
    match: /铺成分镜|生成分镜|分镜行|抽帧上板|提取帧|按引用连|自动连线|一键解析|智能解析|解析成片|片段重做|局部重绘|局部重拍|重做这段|拼成片|合成视频|接触表|九宫格|宫格切开|拆分宫格|宫格拼回|合并宫格|分镜组|分屏对照|分屏|去硬字|去字幕|续写位|视频延长|导出动图|导出\s*GIF|拼成一条/i,
    mode: 'canvas',
    reason: '画布工具：生成分镜、提取帧、智能解析、局部重绘、合成视频、九宫格、拆分宫格、自动连线。解析/切窗/拼接/切开不生成；重做中段才走生成闸。',
    skills: ['storyboard-craft', 'frame-qa', 'editing-workflow'],
    knowledge: ['分镜 景别 运镜'],
    extraTools: ['mont_canvas_script', 'mont_canvas_frames', 'mont_canvas_parse', 'mont_canvas_reshoot', 'mont_canvas_pack', 'mont_canvas_sheet', 'mont_canvas_split', 'mont_canvas_join', 'mont_canvas_stack', 'mont_canvas_desub', 'mont_canvas_extend', 'mont_canvas_gif', 'mont_canvas_autolink'],
  },
  {
    id: 'trailer',
    match: /预告片|电影预告|片花|热血漫|日漫.{0,12}(预告|热血)|shonen/i,
    mode: 'generate',
    reason: '预告片：钩子→世界→升级→片名，硬切组装。日漫热血先锁原创角色锚，专名不进生成。',
    skills: ['trailer-craft', 'minimax-h3-prompt-copilot', 'cinematic-style', 'montagex-production-lead', 'montagex-chengpian'],
    knowledge: ['预告片 钩子 硬切', '日漫 热血 镜头'],
    extraTools: ['mont_canvas_pack', 'mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready'],
  },
  {
    id: 'storyboard',
    match: /分镜|落到画布|storyboard|镜号|排片/i,
    mode: 'canvas',
    reason: '分镜先签字再 canvas_plan；UI 不得写 generating。',
    skills: ['storyboard-craft', 'montagex-production-lead', 'montagex-chengpian'],
    knowledge: ['分镜 景别 运镜'],
    extraTools: ['mont_storyboard', 'mont_canvas_shotlist', 'mont_confirm', 'mont_canvas_plan', 'mont_canvas_script'],
  },
  {
    id: 'qa',
    match: /质检|抽帧看|看看成片|对照提示词|\bqa\b/i,
    mode: 'qa',
    reason: '先抽帧再看图像素，结论引用 methodology 规则号。',
    skills: ['frame-qa', 'montagex-methodology'],
    knowledge: ['成片质检 黑场 响度'],
    extraTools: ['mont_extract_frames', 'mont_view_image', 'mont_qa'],
  },
  {
    id: 'style',
    match: /王家卫|韦斯|安德森|赛博朋克|黑色电影|吉卜力|风格致敬|像.+的(片子|风格)/i,
    mode: 'style',
    reason: '风格用 corpus + mont_style 注入，不臆造。',
    skills: ['cinematic-style', 'montagex-methodology', 'video-prompt-builder'],
    knowledge: ['镜头语言 风格 光影'],
    extraTools: ['mont_style', 'mont_knowledge_search'],
  },
  {
    id: 'kling',
    match: /可灵|kling/i,
    mode: 'generate',
    reason: '可灵提示词先读对应 copilot，再 craft + ready。',
    skills: ['kling-prompt-copilot', 'montagex-production-lead', 'montagex-chengpian'],
    knowledge: ['可灵 提示词'],
    extraTools: ['mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready'],
  },
  {
    id: 'seedance',
    match: /即梦|seedance/i,
    mode: 'generate',
    reason: 'Seedance 提示词先读 copilot。',
    skills: ['seedance-2-prompt-copilot', 'montagex-production-lead', 'montagex-chengpian'],
    knowledge: ['即梦 提示词'],
    extraTools: ['mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready'],
  },
  {
    id: 'minimax',
    match: /minimax|海螺|\bh3\b|t2va|i2va|fl2va|l2va|ref2va|极简产品广告|苹果味广告|歌词贴字|纸艺定格|手绘实拍/i,
    mode: 'generate',
    reason: 'H3 先读官方五种模式和片种方法，再按字段写成稿。有首尾帧不要再塞 reference。',
    skills: ['minimax-h3-prompt-copilot', 'montagex-production-lead', 'montagex-chengpian'],
    knowledge: ['minimax 提示词 时间线'],
    extraTools: ['mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready'],
  },
  {
    id: 'i2v',
    match: /图生视频|i2v|首尾帧|image.to.video/i,
    mode: 'generate',
    reason: '图生/首尾帧必须 generate_ready，缺帧先补。',
    skills: ['continuous-video', 'montagex-playbook', 'montagex-production-lead'],
    knowledge: ['图生视频 首尾帧'],
    extraTools: ['mont_generate_ready', 'mont_extract_frames'],
  },
  {
    id: 'generate',
    match: /生成|出图|出视频|出片|文生|做一条|做一张|拍摄|开拍/i,
    mode: 'generate',
    reason: '生成前必须 skill_read + knowledge_read + craft + ready。',
    skills: ['montagex-production-lead', 'montagex-chengpian', 'montagex-methodology', 'video-prompt-builder'],
    knowledge: ['提示词 镜头语言'],
    extraTools: ['mont_chengpian', 'mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready'],
  },
]

const DEFAULT_ROUTE: SkillRoute = {
  mode: 'research',
  reason: '未命中专项：先 production-lead + 知识/技能检索，再决定生成还是编辑。',
  skills: ['montagex-production-lead', 'montagex-chengpian', 'montagex-methodology'],
  knowledge: ['成片 导演'],
  articles: articlesForMode('research'),
  tools: ['mont_skill_search', 'mont_knowledge_search', 'mont_brief'],
  next: [
    'mont_skill_read montagex-production-lead',
    'mont_skill_read montagex-chengpian',
    ...articlesForMode('research').map(id => `mont_knowledge_read ${id}`),
  ],
  avoid: ['不要跳过 skill_read 直接 generate', '不要在正文写编号菜单'],
}

export function toolsForSkill(name: string): string[] {
  return SKILL_TOOLS[name] ?? []
}

function unique(items: string[]): string[] {
  return [...new Set(items.filter(item => item !== ''))]
}

function withIpRoute(intent: string, route: SkillRoute): SkillRoute {
  if (scanIpRisk(intent).length === 0) return route
  return {
    ...route,
    articles: unique(['213', ...route.articles]),
    knowledge: unique(['版权安全 泛化 213', ...route.knowledge]),
    tools: unique(['mont_ip_scan', 'mont_ip_rewrite', ...route.tools]),
    next: unique(['mont_ip_scan', 'mont_knowledge_read 213', ...route.next]),
    avoid: unique([
      ...route.avoid,
      '不要把 IP 专名送进 generate；不要套固定替换句。先 ip_scan，按方法结合项目记忆写细，ip_rewrite 验收并记入记忆',
    ]),
  }
}

export function routeSkills(intent: string): SkillRoute {
  const text = intent.trim()
  if (text === '') {
    return {
      ...DEFAULT_ROUTE,
      reason: '没有意图。先问用户要生成、剪辑还是整理画布。',
      next: ['mont_ask'],
    }
  }
  const rule = RULES.find(item => item.match.test(text))
  if (rule === undefined) {
    return withIpRoute(text, { ...DEFAULT_ROUTE, knowledge: unique([text, ...DEFAULT_ROUTE.knowledge]) })
  }

  const tools = unique([
    ...rule.skills.flatMap(name => toolsForSkill(name)),
    ...(rule.extraTools ?? []),
  ])
  const articles = unique([...articlesForSkills(rule.skills), ...articlesForMode(rule.mode)])
  const next = [
    ...rule.skills.map(name => `mont_skill_read ${name}`),
    ...articles.slice(0, 4).map(id => `mont_knowledge_read ${id}`),
    ...tools.slice(0, 4),
  ]
  const avoid = [
    '不要只看 skill 目录摘要，必须 skill_read 正文',
    '知识库用返回的文章 id 直接 knowledge_read，不要另起一套检索词',
    rule.mode === 'generate' ? '没有 craftId+readyId 不许 generate/propose' : '',
    rule.mode === 'edit' ? '不要用生成模型完成裁切/旋转/调色/变速' : '',
    rule.mode === 'canvas' ? '未 confirm 不要 canvas_plan / 批量占位' : '',
    rule.mode === 'onboard' ? '不要生成代码或回显 API Key' : '',
  ].filter(Boolean)
  return withIpRoute(text, {
    mode: rule.mode,
    reason: rule.reason,
    skills: rule.skills,
    knowledge: rule.knowledge,
    articles,
    tools,
    next,
    avoid,
  })
}
