export type ComposeKind = 'promo' | 'literary' | 'remake' | 'narrative' | 'talk' | 'montage' | 'trailer' | 'spoken-avatar' | 'dub' | 'podcast' | 'screen-demo'

export type ComposePhase = 'plan' | 'create' | 'refine'

export interface ComposeStage {
  name: string
  purpose: string
  tools: string[]
  /** Google Flow Plan / Create / Refine — compose existing tools, not one generate button. */
  phase: ComposePhase
}

export interface ComposeFlow {
  kind: ComposeKind
  recipe: string
  recipeName: string
  stages: ComposeStage[]
  nextActions: string[]
  researchQueries: string[]
}

const RECIPES: Record<ComposeKind, { file: string; name: string }> = {
  promo: { file: 'recipes/promo-video.md', name: '宣传片' },
  literary: { file: 'recipes/novel-adaptation.md', name: '小说改编' },
  remake: { file: 'recipes/remake-subject.md', name: '拉片复刻' },
  narrative: { file: 'recipes/unit-production.md', name: '单元化制作' },
  talk: { file: 'recipes/tutorial-video.md', name: '教程/口播' },
  montage: { file: 'recipes/clip-recut.md', name: '混剪' },
  trailer: { file: 'recipes/trailer.md', name: '预告片' },
  'spoken-avatar': { file: 'recipes/spoken-avatar.md', name: '数字人口播' },
  dub: { file: 'recipes/localization-dub.md', name: '译制配音' },
  podcast: { file: 'recipes/podcast-repurpose.md', name: '播客改造' },
  'screen-demo': { file: 'recipes/screen-demo.md', name: '屏幕演示' },
}

export function composeKindFromBriefType(type: string): ComposeKind {
  if (type === '广告/宣传') return 'promo'
  if (type === '改编/长剧') return 'literary'
  if (type === '拉片/复刻') return 'remake'
  if (type === '口播/讲解') return 'talk'
  if (type === '混剪/卡点') return 'montage'
  if (type === '预告/片花') return 'trailer'
  if (type === '数字人/口播人像') return 'spoken-avatar'
  if (type === '译制/配音翻译') return 'dub'
  if (type === '播客/访谈改造') return 'podcast'
  if (type === '屏幕演示/录屏') return 'screen-demo'
  return 'narrative'
}

function routeStage(): ComposeStage {
  return {
    name: '路',
    purpose: '先 skill_route，按返回的 skills/articles/next 精读，不要另起检索词',
    tools: ['mont_skill_route'],
    phase: 'plan',
  }
}

function craftStage(): ComposeStage {
  return {
    name: '稿',
    purpose: '每镜先 prompt_plan 再写成稿；参考齐了才 ready；IP 专名走改写记忆。原句不是提示词。',
    tools: ['mont_prompt_plan', 'mont_prompt_craft', 'mont_generate_ready'],
    phase: 'create',
  }
}

function commonSignoff(): ComposeStage {
  return {
    name: '位',
    purpose: '每个生成单元排队完整占位（craftId + readyId + 推荐模型 + 规格），导出分镜表给用户签字；确认前不生成',
    tools: ['mont_propose', 'mont_canvas_shotlist', 'mont_confirm', 'mont_stage'],
    phase: 'refine',
  }
}

function stagesFor(kind: ComposeKind, hasMaterials: boolean): ComposeStage[] {
  const inventory: ComposeStage = {
    name: '析',
    purpose: hasMaterials
      ? '读请求与素材，说明理解与缺口'
      : '读请求，列出未知项（品牌事实 / 原作 / 源片）',
    tools: hasMaterials
      ? ['mont_video_analyze', 'mont_probe_media', 'mont_canvas_get']
      : ['mont_brief'],
    phase: 'plan',
  }
  const research: ComposeStage = {
    name: '研',
    purpose: '工艺文献 + 外部事实；检索不到就问用户，不编造品牌/原作/源片',
    tools: ['mont_knowledge_search', 'mont_knowledge_read'],
    phase: 'plan',
  }
  const ask: ComposeStage = {
    name: '问',
    purpose: '一次澄清真正的分叉（时长/画幅/改编幅度/替换范围），每项带推荐默认。必须 mont_ask（DSH 标准提问），禁止正文菜单。',
    tools: ['mont_ask'],
    phase: 'plan',
  }
  if (kind === 'promo') {
    return [
      inventory,
      routeStage(),
      { ...research, purpose: '好宣传片基准（结构/视觉/平台）+ 委托方公开定位，写入主题句' },
      ask,
      { name: '案', purpose: '主题句 + 三幕 + 出镜契约 + 分镜表（含连续性）', tools: ['mont_storyboard', 'mont_character_register'], phase: 'create' },
      craftStage(),
      commonSignoff(),
    ]
  }
  if (kind === 'literary') {
    return [
      inventory,
      routeStage(),
      { ...research, purpose: '读原作（用户材料或公开文本），判断题材/体量/改编风险' },
      { ...ask, purpose: '一次问清集数×单集时长、改编幅度、平台、画风' },
      { name: '纲', purpose: '大纲先收敛结构：砍线/合人/大爆点拍板。门不过不进下一层。角色、美术、剧本可以后并行，但结构只认大纲。', tools: ['mont_ask', 'mont_bible'], phase: 'create' },
      { name: '角', purpose: 'cast.json 门禁；与美术/剧本可并行，不改大纲已经拍板的结构', tools: ['mont_character_register', 'mont_bible'], phase: 'create' },
      { name: '美', purpose: '场景锚 + 光照变体，画风与角色同档；可与角色/剧本并行', tools: ['mont_bible'], phase: 'create' },
      { name: '本', purpose: '场次/节拍/台词，时长按语速折算 ±15%；可与角色/美术并行', tools: ['mont_speech_duration', 'mont_bible'], phase: 'create' },
      { name: '镜', purpose: '分镜只映射剧本节拍，不发明情节。先查镜头语汇再切。', tools: ['mont_shot_vocab', 'mont_storyboard'], phase: 'create' },
      { name: '评', purpose: '把评审 Markdown 钉到画布，DSH 会话里展示同一份。不要另出 HTML。', tools: ['mont_bible'], phase: 'refine' },
      craftStage(),
      commonSignoff(),
    ]
  }
  if (kind === 'remake') {
    return [
      { ...inventory, purpose: '这是复刻不是新拍。列出源片与替换主体' },
      routeStage(),
      { ...research, purpose: '拉片字段与主体替换纪律（锁摄影、换身份、禁源商标）' },
      {
        name: '拉片',
        purpose: '有源文件则逐镜拆；没有则按该类型发布片骨架占位并标待对帧',
        tools: hasMaterials
          ? ['mont_video_analyze', 'mont_extract_frames', 'mont_view_image']
          : ['mont_knowledge_search'],
        phase: 'create',
      },
      { ...ask, purpose: '源片版本、替换范围（人/产品/endcard）、占位批次' },
      craftStage(),
      commonSignoff(),
    ]
  }
  if (kind === 'talk') {
    return [
      inventory,
      routeStage(),
      research,
      ask,
      { name: '案', purpose: '脚本 → 配音规格 → 画面占位', tools: ['mont_speech_duration'], phase: 'create' },
      craftStage(),
      commonSignoff(),
    ]
  }
  if (kind === 'montage') {
    return [
      inventory,
      routeStage(),
      research,
      ask,
      { name: '案', purpose: '节拍检测 + 卡点裁剪计划，能剪就不生成', tools: ['mont_audio_beat', 'mont_video_analyze'], phase: 'create' },
      { name: '剪', purpose: '先 mont_edit_plan，再 video_process / edit / concat 回写画布', tools: ['mont_edit_plan', 'mont_video_process', 'mont_edit', 'mont_video_concat'], phase: 'create' },
      craftStage(),
      commonSignoff(),
    ]
  }
  if (kind === 'trailer') {
    return [
      inventory,
      routeStage(),
      { ...research, purpose: '预告片语法：钩子→世界→升级→片名。硬切，不讲完整故事。日漫热血先锁原创角色锚，专名不进生成。' },
      { ...ask, purpose: '一次问清时长（默认 35s）、画幅、是否要片名卡、风格分期（复古赛璐璐 / 剧场版数字光）' },
      { name: '案', purpose: '片花节拍表 + 角色 16:9 设定表 + 每镜冲击帧。每镜 4–6 秒一个动作弧。', tools: ['mont_storyboard', 'mont_character_register'], phase: 'create' },
      craftStage(),
      { name: '切', purpose: '成片后 mont_canvas_pack transition=cut 硬切拼条；接触表 mont_canvas_sheet 给评审。禁止 fade。', tools: ['mont_canvas_pack', 'mont_canvas_sheet'], phase: 'refine' },
      commonSignoff(),
    ]
  }
  if (kind === 'spoken-avatar') {
    return [
      inventory,
      routeStage(),
      { ...research, purpose: '数字人口播的商用基准：正脸固定机位、口型清晰、字幕安全区、平台竖版规格' },
      { ...ask, purpose: '一次问清口播稿（或先写稿）、人像来源（真人拍摄 / 生成形象）、画幅、语言与时长' },
      { name: '稿', purpose: '口播稿按语速折算预算，切句落点作为字幕与画面切换锚', tools: ['mont_speech_duration', 'mont_terms_set'], phase: 'create' },
      { name: '锚', purpose: '形象锚：有真人素材先做角色设定表；生成形象必须先落设定图再生成口播镜头', tools: ['mont_character_register', 'mont_series'], phase: 'create' },
      craftStage(),
      { name: '声', purpose: '先出配音（确定性时间轴），再让口型/镜头对齐语音区间', tools: ['mont_generate_audio', 'mont_audio_sync'], phase: 'create' },
      commonSignoff(),
    ]
  }
  if (kind === 'dub') {
    return [
      inventory,
      routeStage(),
      { ...research, purpose: '译制基准：原声分离、字幕与配音对齐、语气本地化而不是逐字直译' },
      {
        name: '析',
        purpose: hasMaterials ? '拆源片：分镜与语音区间，拿时间轴当译文落点' : '无源片时先向用户要原片；译制不能凭稿生成',
        tools: hasMaterials ? ['mont_video_analyze', 'mont_transcribe_audio'] : ['mont_ask'],
        phase: 'plan',
      },
      { ...ask, purpose: '一次问清目标语言、配音风格、是否保留原声底噪、字幕是否烧入' },
      { name: '译', purpose: '按字/秒折算每条字幕，超窗先缩句再配音', tools: ['mont_terms_set', 'mont_speech_duration', 'mont_srt_lint'], phase: 'create' },
      { name: '声', purpose: '分轨生成译文配音，按语音区间对齐，不整条硬铺', tools: ['mont_generate_audio', 'mont_audio_sync'], phase: 'create' },
      { name: '配', purpose: '字幕走 subtitle_format + video_subtitle；混音走 audio_mix 压原声', tools: ['mont_subtitle_format', 'mont_video_subtitle', 'mont_audio_mix'], phase: 'refine' },
      commonSignoff(),
    ]
  }
  if (kind === 'podcast') {
    return [
      inventory,
      routeStage(),
      { ...research, purpose: '播客改造基准：长音频切成短视频，靠一句钩子 + 一个观点切片' },
      {
        name: '析',
        purpose: '转写长音频 → 按语义切候选片段，先排名再挑',
        tools: ['mont_transcribe_audio', 'mont_clip_rank'],
        phase: 'plan',
      },
      { ...ask, purpose: '一次问清出几条片、单条时长、是否加字幕/波形动画、平台画幅' },
      { name: '选', purpose: '从候选里定 N 条，每条一句钩子 + 一句话观点，写成字幕稿', tools: ['mont_srt_lint', 'mont_speech_duration'], phase: 'create' },
      { name: '剪', purpose: '按字幕时间窗确定性切段，不生成新画面', tools: ['mont_subtitle_cut', 'mont_video_process'], phase: 'create' },
      { name: '包', purpose: '字幕烧入 + 封面 + 多条交付', tools: ['mont_video_subtitle', 'mont_media_package'], phase: 'refine' },
      commonSignoff(),
    ]
  }
  if (kind === 'screen-demo') {
    return [
      inventory,
      routeStage(),
      { ...research, purpose: '录屏演示基准：可读性优先（字号/缩放/光标引导），节奏比镜头语言重要' },
      {
        name: '析',
        purpose: hasMaterials ? '拆录屏：按操作步骤切段，标出关键点击时刻' : '无录屏时先确认是否重录，不用生成画面假装演示',
        tools: hasMaterials ? ['mont_video_analyze', 'mont_extract_frames'] : ['mont_ask'],
        phase: 'plan',
      },
      { ...ask, purpose: '一次问清步骤清单、是否配音讲解、画幅（横屏教程 / 竖屏短视频）、是否加放大镜效果' },
      { name: '案', purpose: '每步一镜：步骤标题 + 操作画面 + 讲解要点；标题落在安全区', tools: ['mont_storyboard'], phase: 'create' },
      { name: '剪', purpose: '按步骤切段、去掉空白等待、关键点击处可 zoom', tools: ['mont_video_process', 'mont_video_zoom'], phase: 'create' },
      { name: '包', purpose: '字幕 + 封面 + 交付；步骤标题可作为烧入字幕', tools: ['mont_video_subtitle', 'mont_media_package'], phase: 'refine' },
      commonSignoff(),
    ]
  }
  return [
    inventory,
    routeStage(),
    research,
    ask,
    { name: '案', purpose: '故事/角色契约/逐镜分镜表（含 continuity_in/out）', tools: ['mont_storyboard', 'mont_character_register'], phase: 'create' },
    craftStage(),
    commonSignoff(),
  ]
}

export function composeProductionFlow(input: {
  type: string
  request: string
  materials?: string[]
}): ComposeFlow {
  const kind = composeKindFromBriefType(input.type)
  const recipe = RECIPES[kind]
  const hasMaterials = (input.materials ?? []).length > 0
  const stages = stagesFor(kind, hasMaterials)
  const nextActions = [
    `读 ${recipe.file}（skill montagex-recipes / ${recipe.name}）当先例，按素材改，不是目录`,
    ...stages.flatMap(stage => {
      if (stage.tools.length === 0) return [`${stage.name}：${stage.purpose}`]
      return [`${stage.name}：${stage.purpose} — ${stage.tools.join(' / ')}`]
    }),
    '用户用 /montagex 看制片板，或 mont_confirm 走 DSH 提问签字；确认前不生成。mont_orchestrate 是可选加速，不是必经入口',
    '交片后 mont_skill_capture present:true：用 DSH 标准提问是否保存为技能，把流程和用户改意见写成新技能',
  ]
  const researchQueries = researchFor(kind, input.request)
  return {
    kind,
    recipe: recipe.file,
    recipeName: recipe.name,
    stages,
    nextActions,
    researchQueries,
  }
}

function researchFor(kind: ComposeKind, request: string): string[] {
  const topic = request.replace(/\s+/g, ' ').slice(0, 40)
  if (kind === 'promo') return [`${topic} 品牌定位`, '宣传片 开场结构', '品牌 视觉一致性']
  if (kind === 'literary') return [`${topic} 原作`, '小说改编 幅度', '角色一致性 外观契约']
  if (kind === 'remake') return [`${topic} 源片结构`, '拉片 景别运镜剪点', '主体替换 商标隔离']
  if (kind === 'talk') return ['口播 语速', '讲解 字幕节奏']
  if (kind === 'montage') return ['卡点 节拍', '混剪 素材盘点']
  if (kind === 'trailer') return ['预告片 钩子 硬切', '日漫 热血 冲击帧']
  if (kind === 'spoken-avatar') return [`${topic} 口播稿结构`, '数字人 口型 机位', '竖版短视频 字幕安全区']
  if (kind === 'dub') return [`${topic} 目标语言 语气`, '译制配音 对齐', '字幕 每秒字数']
  if (kind === 'podcast') return [`${topic} 播客切片`, '金句 钩子 前3秒', '长音频 转写 切段']
  if (kind === 'screen-demo') return [`${topic} 录屏演示 结构`, '教程 步骤 标题', '可读性 字号 缩放']
  return ['分镜 连续性', '叙事 节奏']
}
