import {
  WorldSnapshot,
  Character,
  Organization,
  Location,
  WorldFact,
  Seed,
  Event,
  HiddenTruth,
  SimulationStats,
  WakeSignal,
} from '../types';

let isRecorderWriteContextState = false;

export function setRecorderWriteContext(active: boolean) {
  isRecorderWriteContextState = active;
}

export function isRecorderWriteContext(): boolean {
  return isRecorderWriteContextState;
}

let isRuntimeLockedGlobal = false;

export function setRuntimeWriteLocked(locked: boolean) {
  isRuntimeLockedGlobal = locked;
}

export function assertRecorderWriteContext() {
  if (isRuntimeLockedGlobal && !isRecorderWriteContextState) {
    throw new Error('[Write Guard Violation] Direct mutation on globalWorld is forbidden! All mutations must go through Recorder.commit().');
  }
}

const proxyCache = new WeakMap<object, object>();

function createGuardedObject<T extends object>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj;
  if (proxyCache.has(obj)) {
    return proxyCache.get(obj) as T;
  }
  const proxy = new Proxy(obj, {
    get(target, prop, receiver) {
      const val = Reflect.get(target, prop, receiver);
      if (val !== null && typeof val === 'object') {
        if (Array.isArray(val)) {
          return createGuardedArray(val);
        }
        return createGuardedObject(val);
      }
      return val;
    },
    set(target, prop, value, receiver) {
      assertRecorderWriteContext();
      return Reflect.set(target, prop, value, receiver);
    },
    deleteProperty(target, prop) {
      assertRecorderWriteContext();
      return Reflect.deleteProperty(target, prop);
    },
  });
  proxyCache.set(obj, proxy);
  return proxy;
}

function createGuardedMap<K, V>(map: Map<K, V>): Map<K, V> {
  if (proxyCache.has(map as any)) {
    return proxyCache.get(map as any) as any;
  }
  const proxy = new Proxy(map, {
    get(target, prop) {
      if (prop === 'set' || prop === 'delete' || prop === 'clear') {
        assertRecorderWriteContext();
      }
      if (prop === 'get') {
        return (key: K) => {
          const item = target.get(key);
          if (item && typeof item === 'object') {
            return Array.isArray(item) ? createGuardedArray(item) : createGuardedObject(item as any);
          }
          return item;
        };
      }
      const val = Reflect.get(target, prop, target);
      if (typeof val === 'function') {
        return val.bind(target);
      }
      return val;
    },
  });
  proxyCache.set(map as any, proxy);
  return proxy as any;
}

function createGuardedArray<T>(arr: T[]): T[] {
  if (proxyCache.has(arr as any)) {
    return proxyCache.get(arr as any) as any;
  }
  const proxy = new Proxy(arr, {
    get(target, prop, receiver) {
      if (
        prop === 'push' ||
        prop === 'unshift' ||
        prop === 'splice' ||
        prop === 'pop' ||
        prop === 'shift' ||
        prop === 'reverse' ||
        prop === 'sort'
      ) {
        assertRecorderWriteContext();
      }
      const val = Reflect.get(target, prop, receiver);
      if (typeof val === 'function') {
        return val.bind(target);
      }
      if (val !== null && typeof val === 'object') {
        return Array.isArray(val) ? createGuardedArray(val) : createGuardedObject(val);
      }
      return val;
    },
    set(target, prop, value, receiver) {
      assertRecorderWriteContext();
      return Reflect.set(target, prop, value, receiver);
    },
    deleteProperty(target, prop) {
      assertRecorderWriteContext();
      return Reflect.deleteProperty(target, prop);
    },
  });
  proxyCache.set(arr as any, proxy);
  return proxy as any;
}

export class WorldDataStore {
  private _runtimeWriteLocked: boolean = false;

  public get runtimeWriteLocked(): boolean {
    return this._runtimeWriteLocked;
  }

  public set runtimeWriteLocked(val: boolean) {
    this._runtimeWriteLocked = val;
    setRuntimeWriteLocked(val);
  }

  public snapshot: WorldSnapshot;
  public characters: Map<string, Character> = createGuardedMap(new Map());
  public organizations: Map<string, Organization> = createGuardedMap(new Map());
  public locations: Map<string, Location> = createGuardedMap(new Map());
  public facts: Map<string, WorldFact> = createGuardedMap(new Map());
  public seeds: Map<string, Seed> = createGuardedMap(new Map());
  public events: Event[] = createGuardedArray([]);
  public hiddenTruths: Map<string, HiddenTruth> = createGuardedMap(new Map());
  public wakeQueue: WakeSignal[] = [];
  public totalLLMCalls: number = 0;
  public llmCallsThisEpoch: number = 0;

  constructor() {
    this.snapshot = createGuardedObject({
      id: 'world-snapshot-001',
      epoch: 1,
      created_at: new Date().toISOString(),
      world_name: '艾尔德兰 (Eldlan)',
      world_description: '一个处于蒸汽与魔导工业革命交界处的古老大陆。铁冠城掌握王国命脉，而暗流在阴影中汹涌。',
      seed: 42,
      world_facts_count: 0,
      characters_count: 0,
      organizations_count: 0,
      locations_count: 0,
      active_seeds_count: 0,
      frozen_objects_count: 0,
      completed_epochs: 1,
    });
    this.initDefaultWorld();
    this.runtimeWriteLocked = true;
  }

  public initDefaultWorld() {
    const prevLock = this.runtimeWriteLocked;
    this.runtimeWriteLocked = false;

    this.snapshot = createGuardedObject({
      id: 'world-snapshot-001',
      epoch: 1,
      created_at: new Date().toISOString(),
      world_name: '艾尔德兰 (Eldlan)',
      world_description: '一个处于蒸汽与魔导工业革命交界处的古老大陆。铁冠城掌握王国命脉，而暗流在阴影中汹涌。',
      seed: 42,
      world_facts_count: 0,
      characters_count: 0,
      organizations_count: 0,
      locations_count: 0,
      active_seeds_count: 0,
      frozen_objects_count: 0,
      completed_epochs: 1,
    });

    this.characters.clear();
    this.organizations.clear();
    this.locations.clear();
    this.facts.clear();
    this.seeds.clear();
    this.events = [];
    this.hiddenTruths.clear();
    this.wakeQueue = [];
    this.totalLLMCalls = 0;
    this.llmCallsThisEpoch = 0;

    // 1. Locations (Open World Starter Hub)
    const locTavern: Location = {
      id: 'loc-tavern',
      name: '红叶雇佣兵酒馆 (Redleaf Tavern)',
      type: 'TOWN',
      description: '拂晓荒村最热闹的憩息之地。橡木吧台散发着麦芽酒与烤肉的香气，喧嚷的雇佣兵、流浪商人与老村长常在此小酌，墙上挂着满满的公会委托悬赏板。',
      child_ids: [],
      connected_to: ['loc-dawnfall', 'loc-wilds'],
      population: 45,
      population_trend: 'STABLE',
      economy: {
        primary_industry: 'TRADE',
        wealth_level: 2,
        trade_goods: ['黑麦啤酒', '风干烤肉', '雇佣情报'],
        trade_routes: ['边境小径'],
      },
      security: {
        guard_presence: 30,
        crime_rate: 15,
        last_incident_epoch: 0,
      },
      active_events: [],
      features: [
        { name: '酒馆橡木吧台', description: '热气腾腾的黑麦啤酒与香浓炖汤，是打听情报与接取委托的绝佳场所。', state: 'INTACT' },
        { name: '公会雇佣兵悬赏板', description: '张贴着附近打杂、清剿魔物或搜寻遗迹失物的悬赏告示。', state: 'INTACT' },
        { name: '靠窗的温暖木桌', description: '旅人与冒险者歇脚的地方，十分适合静下心整理装备与规划行程。', state: 'INTACT' },
      ],
      frozen: false,
      simulation_level: 3,
      last_simulated_epoch: 1,
      created_at_epoch: 1,
      updated_at_epoch: 1,
    };

    const locDawnfall: Location = {
      id: 'loc-dawnfall',
      name: '拂晓荒村广场 (Dawnfall Square)',
      type: 'TOWN',
      description: '边境荒野边缘的微型聚落广场，露天篝火与旧驿站提供着庇护。',
      child_ids: [],
      connected_to: ['loc-tavern', 'loc-wilds', 'loc-ruins'],
      population: 150,
      population_trend: 'STABLE',
      economy: {
        primary_industry: 'TRADE',
        wealth_level: 2,
        trade_goods: ['风干猎肉', '草药', '旧兵刃'],
        trade_routes: ['边境小径'],
      },
      security: {
        guard_presence: 20,
        crime_rate: 30,
        last_incident_epoch: 0,
      },
      active_events: [],
      features: [
        { name: '露天营地篝火', description: '冒险者与流浪者交换情报的中央火堆。', state: 'INTACT' },
        { name: '旧驿站委托板', description: '张贴着附近打杂、清剿匪徒或搜寻失物的悬赏告示。', state: 'INTACT' },
      ],
      frozen: false,
      simulation_level: 3,
      last_simulated_epoch: 1,
      created_at_epoch: 1,
      updated_at_epoch: 1,
    };

    const locWilds: Location = {
      id: 'loc-wilds',
      name: '风蚀荒野 (Windswept Wilds)',
      type: 'FOREST',
      description: '拂晓村外的无垠荒野，灌木丛与乱石交错。常有流劫匪徒与野兽出没。',
      child_ids: [],
      connected_to: ['loc-tavern', 'loc-dawnfall', 'loc-ruins'],
      population: 40,
      population_trend: 'DECREASING',
      economy: { primary_industry: 'AGRICULTURE', wealth_level: 1, trade_goods: ['兽皮'], trade_routes: [] },
      security: { guard_presence: 5, crime_rate: 75 },
      active_events: [],
      features: [{ name: '废弃哨塔', description: '高耸但半坍塌的石塔，视角开阔。', state: 'DAMAGED' }],
      frozen: false,
      simulation_level: 3,
      last_simulated_epoch: 1,
      created_at_epoch: 1,
      updated_at_epoch: 1,
    };

    const locRuins: Location = {
      id: 'loc-ruins',
      name: '低语遗迹入口 (Whispering Ruins)',
      type: 'DUNGEON',
      description: '埋没在荒野深处的古老地下建筑入口，微弱的符文幽光在拱门间闪烁。',
      child_ids: [],
      connected_to: ['loc-dawnfall', 'loc-wilds'],
      population: 0,
      population_trend: 'STABLE',
      economy: { primary_industry: 'MINING', wealth_level: 1, trade_goods: [], trade_routes: [] },
      security: { guard_presence: 0, crime_rate: 90 },
      active_events: [],
      features: [{ name: '古老符文石门', description: '刻满未知文字的沉重石门。', state: 'INTACT' }],
      frozen: false,
      simulation_level: 3,
      last_simulated_epoch: 1,
      created_at_epoch: 1,
      updated_at_epoch: 1,
    };

    [locTavern, locDawnfall, locWilds, locRuins].forEach((l) => this.locations.set(l.id, l));

    // 2. Organizations
    const orgCrow: Organization = {
      id: 'org-crow',
      name: '黑鸦商会 (Black Crow Guild)',
      type: 'GUILD',
      description: '控制铁冠城地下黑市与走私网络的秘密帮会。',
      headquarters_id: 'loc-alley',
      territory_ids: ['loc-alley'],
      leader_id: 'npc-lilith',
      member_ids: ['npc-lilith', 'npc-old-lo'],
      resources: { wealth: 5200, influence: 65, military_power: 45, secret_knowledge: 40 },
      goals: [
        {
          id: 'goal-crow-1',
          description: '秘密向军阀走私精金武器并扩大资金池',
          type: 'EXPANSION',
          priority: 1,
          status: 'ACTIVE',
          created_at_epoch: 1,
          progress: 0.35,
        },
      ],
      projects: [
        {
          id: 'proj-crow-1',
          name: '迷雾矿道走私专线',
          description: '绕过城门卫兵，通过古矿坑将武器运出铁冠城。',
          status: 'IN_PROGRESS',
          goal_id: 'goal-crow-1',
          assigned_member_ids: ['npc-lilith'],
          progress: 0.4,
          epoch_started: 1,
          epoch_deadline: 12,
        },
      ],
      relationships: [{ target_id: 'org-knights', type: 'WAR', standing: -70 }],
      reputation: { public: 35, nobility: 20, underworld: 85 },
      frozen: false,
      simulation_level: 3,
      last_simulated_epoch: 1,
      created_at_epoch: 1,
      updated_at_epoch: 1,
    };

    const orgKnights: Organization = {
      id: 'org-knights',
      name: '圣光守卫团 (Order of Light Knights)',
      type: 'MILITIA',
      description: '负责铁冠城治安与王室警卫的秩序守护者。',
      headquarters_id: 'loc-capital',
      territory_ids: ['loc-capital', 'loc-forge'],
      leader_id: 'npc-elwin',
      member_ids: ['npc-elwin'],
      resources: { wealth: 8000, influence: 80, military_power: 75, secret_knowledge: 20 },
      goals: [
        {
          id: 'goal-knights-1',
          description: '查清黑市军火走私源头并铲除黑鸦商会',
          type: 'PROTECTION',
          priority: 1,
          status: 'ACTIVE',
          created_at_epoch: 1,
          progress: 0.2,
        },
      ],
      projects: [],
      relationships: [{ target_id: 'org-crow', type: 'WAR', standing: -70 }],
      reputation: { public: 80, nobility: 75, underworld: 15 },
      frozen: false,
      simulation_level: 3,
      last_simulated_epoch: 1,
      created_at_epoch: 1,
      updated_at_epoch: 1,
    };

    [orgCrow, orgKnights].forEach((o) => this.organizations.set(o.id, o));

    // 3. Characters
    const pcPlayer: Character = {
      id: 'pc-player',
      type: 'PC',
      name: '未知旅人',
      title: '未定职业',
      species: '人类',
      age: 23,
      location_id: 'loc-tavern',
      status: 'ALIVE',
      goal: { primary: '踏上艾尔德兰大陆，寻找属于自己的宿命与委托', secondary: [] },
      fear: '未知',
      personality: ['待塑造'],
      attributes: { hp: 100, max_hp: 100, mp: 60, max_mp: 60, strength: 10, dexterity: 10, intelligence: 10, charisma: 10 },
      skills: {},
      resources: { gold: 100, reputation: 10 },
      inventory: [
        { item_id: 'item-sword', name: '旧钢长剑', quantity: 1, type: 'WEAPON', properties: { atk: 12 } },
        { item_id: 'item-potion', name: '草药治疗剂', quantity: 3, type: 'CONSUMABLE', properties: { heal: 30 } },
        { item_id: 'item-pouch', name: '冒险者行囊', quantity: 1, type: 'MISC', properties: { desc: '装有打火石与干粮' } },
      ],
      knowledge: {
        known_facts: [],
        known_characters: ['npc-elder', 'npc-innkeeper'],
        known_locations: ['loc-tavern', 'loc-dawnfall', 'loc-wilds', 'loc-ruins'],
      },
      relationships: [
        { target_id: 'npc-elder', target_name: '老村长埃尔顿', type: 'NEUTRAL', trust: 55, fear: 0, favor: 50, last_interaction_epoch: 1 },
        { target_id: 'npc-innkeeper', target_name: '酒馆老板娘玛丽亚', type: 'NEUTRAL', trust: 60, fear: 0, favor: 55, last_interaction_epoch: 1 },
      ],
      memory: {
        short_term: [
          { text: '你在拂晓荒村『红叶雇佣兵酒馆』温暖喧闹的靠窗木桌前醒来，桌上放着热腾腾的黑麦啤酒，眼前是酒馆公会的悬赏告示板。', importance: 3, epoch: 1 },
        ],
        compressed: '来到拂晓荒村红叶酒馆，无拘无束，随时准备向老板娘或老村长打听委托，或探索周边荒野。',
        important_events: ['evt-init'],
      },
      current_action: { type: 'WAIT', description: '在红叶雇佣兵酒馆靠窗木桌旁休息小酌', started_at_epoch: 1, estimated_end_epoch: 1 },
      frozen: false,
      simulation_level: 4,
      last_simulated_epoch: 1,
      created_at_epoch: 1,
      updated_at_epoch: 1,
    };

    const npcElder: Character = {
      id: 'npc-elder',
      type: 'NPC',
      name: '老村长埃尔顿',
      title: '拂晓荒村德高望重的长者',
      species: '人类',
      age: 68,
      location_id: 'loc-dawnfall',
      status: 'ALIVE',
      goal: { primary: '守护拂晓荒村不被暴徒与魔物侵扰', secondary: ['厘清周边荒野匪患与遗迹异象的由来'] },
      fear: '村庄彻底毁灭于荒野浩劫',
      personality: ['睿智', '温和', '忧国忧民'],
      attributes: { hp: 70, max_hp: 70, mp: 50, max_mp: 50, strength: 8, dexterity: 9, intelligence: 15, charisma: 14 },
      skills: { 博学: 80, 交涉: 75, 历史: 85 },
      resources: { gold: 180, reputation: 60 },
      inventory: [{ item_id: 'item-staff', name: '胡桃木拐杖', quantity: 1, type: 'MISC' }],
      knowledge: {
        known_facts: [],
        known_characters: ['pc-player', 'npc-innkeeper'],
        known_locations: ['loc-dawnfall', 'loc-wilds', 'loc-ruins'],
      },
      relationships: [{ target_id: 'pc-player', target_name: '罗兰', type: 'NEUTRAL', trust: 60, fear: 0, favor: 55, last_interaction_epoch: 1 }],
      memory: {
        short_term: [{ text: '村外荒野的匪徒似乎越来越猖獗，听说连叛军溃兵也混入其中。', importance: 4, epoch: 1 }],
        compressed: '忧心荒野匪患与遗迹变故，乐意为有能力的冒险者指引方向。',
        important_events: [],
      },
      current_action: { type: 'WORK', description: '在篝火旁整理记载遗迹的古旧竹简', started_at_epoch: 1, estimated_end_epoch: 3 },
      frozen: false,
      simulation_level: 3,
      last_simulated_epoch: 1,
      created_at_epoch: 1,
      updated_at_epoch: 1,
    };

    const npcInnkeeper: Character = {
      id: 'npc-innkeeper',
      type: 'NPC',
      name: '酒馆老板娘玛丽亚',
      title: '荒野黑犬酒馆经营者',
      species: '人类',
      age: 34,
      location_id: 'loc-dawnfall',
      status: 'ALIVE',
      goal: { primary: '收集来往佣兵的情报并张贴告示发布悬赏', secondary: ['保障酒馆安宁'] },
      fear: '酒馆被匪帮砸毁',
      personality: ['豪爽', '精明', '消息灵通'],
      attributes: { hp: 90, max_hp: 90, mp: 40, max_mp: 40, strength: 12, dexterity: 13, intelligence: 14, charisma: 16 },
      skills: { 打听: 85, 交涉: 80, 酒艺: 90 },
      resources: { gold: 350, reputation: 50 },
      inventory: [{ item_id: 'item-ale', name: '特调黑麦啤酒', quantity: 10, type: 'CONSUMABLE' }],
      knowledge: {
        known_facts: [],
        known_characters: ['pc-player', 'npc-elder'],
        known_locations: ['loc-dawnfall', 'loc-wilds'],
      },
      relationships: [{ target_id: 'pc-player', target_name: '罗兰', type: 'NEUTRAL', trust: 60, fear: 0, favor: 60, last_interaction_epoch: 1 }],
      memory: {
        short_term: [{ text: '告示板上刚张贴了几份商队的悬赏委托，正缺胆大的好手去接。', importance: 3, epoch: 1 }],
        compressed: '掌管村里唯一的黑犬酒馆，掌握大量关于雇佣任务与商队线索。',
        important_events: [],
      },
      current_action: { type: 'WORK', description: '在酒馆前整理雇佣兵悬赏板', started_at_epoch: 1, estimated_end_epoch: 3 },
      frozen: false,
      simulation_level: 3,
      last_simulated_epoch: 1,
      created_at_epoch: 1,
      updated_at_epoch: 1,
    };

    [pcPlayer, npcElder, npcInnkeeper].forEach((c) => this.characters.set(c.id, c));

    // 4. World Facts
    const fact1: WorldFact = {
      id: 'fact-1',
      statement: '铁冠城的高炉所需的原矿绝大部分来自迷雾矿道与古矿坑。',
      category: 'ECONOMY',
      confidence: 'CONFIRMED',
      source: { type: 'OBSERVATION', epoch_discovered: 1 },
      related_entity_ids: ['loc-capital', 'loc-mine'],
      is_active: true,
      created_at_epoch: 1,
      updated_at_epoch: 1,
    };
    const fact2: WorldFact = {
      id: 'fact-2',
      statement: '圣光守卫团近期加强了对铁冠城各出口城门商队的抽查。',
      category: 'POLITICS',
      confidence: 'CONFIRMED',
      source: { type: 'OBSERVATION', epoch_discovered: 1 },
      related_entity_ids: ['loc-capital', 'org-knights'],
      is_active: true,
      created_at_epoch: 1,
      updated_at_epoch: 1,
    };
    const fact3: WorldFact = {
      id: 'fact-3',
      statement: '传闻黑鸦商会通过古矿坑隐秘暗道往城外秘密运送武器。',
      category: 'SOCIAL',
      confidence: 'RUMOR',
      source: { type: 'RUMOR', epoch_discovered: 1 },
      related_entity_ids: ['org-crow', 'loc-mine'],
      is_active: true,
      created_at_epoch: 1,
      updated_at_epoch: 1,
    };

    [fact1, fact2, fact3].forEach((f) => this.facts.set(f.id, f));

    // 5. Hidden Truths (4 Layers)
    const truth1: HiddenTruth = {
      id: 'truth-old-lo',
      title: '矮人老洛的把柄',
      layer: 'layer_1_personal_secrets',
      layer_name: '个人秘密',
      exists: true,
      true_nature: '老洛唯一的孙女被黑鸦商会扣为人质，老洛被迫为其打造违禁构装战锤。',
      true_owner_id: 'npc-old-lo',
      revealed: false,
      revealed_to_ids: [],
      locked_at_epoch: 1,
      never_changes: true,
      evidence_required: ['黑鸦勒索信笺', '老洛锻造秘本'],
      evidence_collected: [],
    };

    const truth2: HiddenTruth = {
      id: 'truth-crow-conspiracy',
      title: '黑鸦商会的真实阴谋',
      layer: 'layer_2_organization_conspiracies',
      layer_name: '组织阴谋',
      exists: true,
      true_nature: '黑鸦商会不仅走私武器，更是在古矿坑底部利用精金与暗黑仪式唤醒遗术魔导兵器。',
      true_owner_id: 'org-crow',
      revealed: false,
      revealed_to_ids: [],
      locked_at_epoch: 1,
      never_changes: true,
      evidence_required: ['暗黑祭坛残页', '走私账本底册', '精金构装符文'],
      evidence_collected: [],
    };

    const truth3: HiddenTruth = {
      id: 'truth-world-lie',
      title: '迷雾森林的古老谎言',
      layer: 'layer_3_world_lies',
      layer_name: '世界谎言',
      exists: true,
      true_nature: '世人皆以为迷雾森林的毒雾是自然气候，实际上是沉睡在高炉地下的远古巨兽吐出的封印魔气。',
      revealed: false,
      revealed_to_ids: [],
      locked_at_epoch: 1,
      never_changes: true,
      evidence_required: ['远古高炉设计图', '祭坛破译碑文'],
      evidence_collected: [],
    };

    const truth4: HiddenTruth = {
      id: 'truth-cosmic-illusion',
      title: '创世纪元的因果环',
      layer: 'layer_4_cosmic_illusions',
      layer_name: '宇宙假象',
      exists: true,
      true_nature: '艾尔德兰大陆的时间并非线性流逝，每当文明达到工业巅峰，天灾因果树便会重启这个世界。',
      revealed: false,
      revealed_to_ids: [],
      locked_at_epoch: 1,
      never_changes: true,
      evidence_required: ['因果罗盘遗物', '时空坍缩核'],
      evidence_collected: [],
    };

    [truth1, truth2, truth3, truth4].forEach((t) => this.hiddenTruths.set(t.id, t));

    // 6. Seeds
    const seed1: Seed = {
      id: 'seed-caravan-01',
      type: 'CARAVAN',
      visible_layer: {
        description: '黑鸦走私队计划通过古矿坑暗道向城外送出一批精炼军火。',
        actor_ids: ['npc-lilith', 'npc-old-lo'],
        location_id: 'loc-mine',
        start_epoch: 1,
        estimated_end_epoch: 8,
      },
      hidden_truth: truth1,
      status: 'IN_PROGRESS',
      importance: 75,
      player_opportunity: {
        exists: true,
        description: '截获黑鸦走私车队，或者调查车队货箱中的神秘勒索信。',
        discovery_condition: '前往古矿坑或向老洛打听黑市细节',
        type: 'INVESTIGATE',
        target_seed_id: 'seed-caravan-01',
      },
      progress: 0.25,
      created_at_epoch: 1,
      updated_at_epoch: 1,
    };

    const seed2: Seed = {
      id: 'seed-investigation-02',
      type: 'INVESTIGATION',
      visible_layer: {
        description: '圣光守卫团在阴影巷附近设立临时检查站，气氛剑拔弩张。',
        actor_ids: ['npc-elwin'],
        location_id: 'loc-alley',
        start_epoch: 1,
        estimated_end_epoch: 6,
      },
      hidden_truth: truth2,
      status: 'IN_PROGRESS',
      importance: 60,
      player_opportunity: {
        exists: true,
        description: '协助骑士团搜查阴影巷，或帮黑鸦商会传递警报。',
        discovery_condition: '来到阴影巷与骑士队长艾尔文对话',
        type: 'NEGOTIATE',
        target_seed_id: 'seed-investigation-02',
      },
      progress: 0.1,
      created_at_epoch: 1,
      updated_at_epoch: 1,
    };

    [seed1, seed2].forEach((s) => this.seeds.set(s.id, s));

    // 7. Initial Events
    this.events.push({
      id: 'evt-init',
      type: 'DISCOVERY',
      description: '【世界纪元开启】艾尔德兰世界 Epoch 1 启动。铁冠城高炉轰鸣，古矿坑深处异动频发。',
      location_id: 'loc-capital',
      involved_entity_ids: ['pc-player', 'npc-old-lo', 'npc-lilith', 'npc-elwin'],
      cause: { type: 'WORLD_INIT' },
      effects: [],
      epoch: 1,
      resolved: true,
      resolution_epoch: 1,
      created_at_epoch: 1,
    });

    this.updateStats();
    this.runtimeWriteLocked = true;
  }

  public setPresetWorld(presetKey: string) {
    this.runtimeWriteLocked = false;
    const isCyber = presetKey.includes('赛博朋克') || presetKey.includes('cyberpunk') || presetKey === 'preset-cyberpunk';
    const isXianxia = presetKey.includes('东方修仙') || presetKey.includes('xianxia') || presetKey === 'preset-xianxia';
    const isWasteland = presetKey.includes('废土') || presetKey.includes('wasteland') || presetKey === 'preset-wasteland';

    const tav = this.locations.get('loc-tavern');
    const df = this.locations.get('loc-dawnfall');
    const wild = this.locations.get('loc-wilds');
    const ruin = this.locations.get('loc-ruins');

    const elder = this.characters.get('npc-elder');
    const innkeeper = this.characters.get('npc-innkeeper');
    const pc = this.characters.get('pc-player');

    const orgCrow = this.organizations.get('org-crow');
    const orgKnights = this.organizations.get('org-knights');

    const fact1 = this.facts.get('fact-1');
    const fact2 = this.facts.get('fact-2');

    if (isCyber) {
      this.snapshot.world_name = '霓虹深渊 (Neon Abyss)';
      this.snapshot.world_description = '高天巨企垄断一切、义体改造与黑客潜行并存的暗黑近未来都市。';

      if (tav) {
        tav.name = '地下黑客冷风酒吧 (Chillwind Hacker Bar)';
        tav.description = '下层区最繁华的暗网据点，霓虹灯管闪烁，全息广告牌与赛博机箱散发着热气，黑客与交易员在此交接数据软盘。';
        tav.economy.trade_goods = ['合成能量饮', '破解芯片', '义体配件'];
        tav.features = [
          { name: '暗网吧台与全息屏', description: '提供黑客专属解码接口与能量饮。', state: 'INTACT' },
          { name: '数据交接暗箱', description: '匿名张贴与交接悬赏数据任务的端点。', state: 'INTACT' },
        ];
      }
      if (df) {
        df.name = '2077暗网下层黑市广场 (Sub-grid Cyber Market)';
        df.description = '黑客与流浪义体狂热者的集散地，全息广告与高压电缆在破败楼宇间交错。';
        df.economy.trade_goods = ['黑客软盘', '次级电池', '二手义体'];
        df.features = [{ name: '黑市义体诊所', description: '改装与维护义体部件的地下工坊。', state: 'INTACT' }];
      }
      if (wild) {
        wild.name = '工业酸雨废矿荒区 (Acid Rain Industrial Zone)';
        wild.description = '巨企废弃的酸雨污染工厂区，巡逻机械犬与流浪赛博暴徒在废墟间出没。';
        wild.economy.trade_goods = ['废旧电路板', '高压电缆'];
        wild.features = [{ name: '废弃高压电塔', description: '视野开阔但带电危险的监控据点。', state: 'DAMAGED' }];
      }
      if (ruin) {
        ruin.name = '荒废超算中心数据遗址 (Abandoned Mainframe Ruins)';
        ruin.description = '旧时代中央超算机房，幽蓝的数据节点与防空警报在失落的地下室中闪烁。';
        ruin.features = [{ name: '超级AI量子核心', description: '封印着旧时代黑科技数据的沉重机柜。', state: 'INTACT' }];
      }

      if (elder) {
        elder.name = '下层区黑客组长 · 零式';
        elder.title = '暗网旧时代技术导师';
        elder.personality = ['冷静', '精明', '警惕'];
      }
      if (innkeeper) {
        innkeeper.name = '义体调酒师 · 玛丽亚';
        innkeeper.title = '冷风酒吧老板娘兼情报掮客';
        innkeeper.personality = ['豪爽', '火爆', '消息灵通'];
      }
      if (orgCrow) {
        orgCrow.name = '黑客反抗阵线 (Netrunner Resistance)';
        orgCrow.description = '对抗高天巨企独裁、掌控下层暗网的黑客组织。';
      }
      if (orgKnights) {
        orgKnights.name = '巨企治安执法军 (Megacorp Security Division)';
        orgKnights.description = '荒坂级巨企雇佣的高科技武装执法部队。';
      }
      if (fact1) fact1.statement = '巨企治安军正在下层区大规模搜查黑客反抗阵线的无线数据节点。';
      if (fact2) fact2.statement = '下层黑市流传着关于旧时代超级AI离线数据库保存在荒废超算中心的传闻。';

      if (pc) {
        pc.location_id = 'loc-tavern';
        pc.resources.gold = 500;
        pc.memory.short_term = [
          { text: '你在下层区『地下黑客冷风酒吧』闪烁的霓虹灯下醒来，全息屏幕上正在滚动暗网悬赏任务。', importance: 3, epoch: 1 },
        ];
      }
    } else if (isXianxia) {
      this.snapshot.world_name = '苍穹道界 (Cangqiong Dao)';
      this.snapshot.world_description = '天地灵气复苏、宗门林立、古老仙魔遗迹与功法大道争锋的玄幻修真大千世界。';

      if (tav) {
        tav.name = '边隘修仙集市 • 云来客栈 (Yunlai Inn)';
        tav.description = '凡人聚落与修仙界交界处的灵石交易集市，檀香袅袅，挂着悬赏魔物与灵药任务的悬赏木牌。';
        tav.economy.trade_goods = ['灵茶', '下品灵石', '辟谷丹'];
        tav.features = [
          { name: '灵茶木案与竹简', description: '品尝高山云雾灵茶，打听各路修士传闻。', state: 'INTACT' },
          { name: '悬赏告示木牌', description: '悬挂着清剿妖兽与采摘灵草的悬赏。', state: 'INTACT' },
        ];
      }
      if (df) {
        df.name = '坊市广场 • 灵石坊 (Lingstone Market Square)';
        df.description = '修仙者与采药人交换灵药丹药、功法残页的露天坊市广场。';
        df.economy.trade_goods = ['灵草', '洗髓丹', '下品符箓'];
        df.features = [{ name: '露天炼丹炉', description: '散发着药香的古朴炼丹大炉。', state: 'INTACT' }];
      }
      if (wild) {
        wild.name = '万寿仙山 • 雾隐丛林 (Foggy Immortal Forest)';
        wild.description = '灵气充沛却潜伏妖兽的云雾山林，古木参天，不时有剑光掠过。';
        wild.economy.trade_goods = ['妖兽皮革', '百年灵芝'];
        wild.features = [{ name: '断壁石碑', description: '刻有上古剑痕的残破石碑。', state: 'DAMAGED' }];
      }
      if (ruin) {
        ruin.name = '太古上仙破碎洞府 (Ancient Immortal Cave)';
        ruin.description = '埋没在山峡深处的古仙洞府遗址，残存的上古护山大阵符文隐隐发亮。';
        ruin.features = [{ name: '封印禁制石门', description: '刻满古老玄奥阵纹的沉重洞府大门。', state: 'INTACT' }];
      }

      if (elder) {
        elder.name = '莫老掌柜 (莫长老)';
        elder.title = '集市德高望重的修仙引路人';
        elder.personality = ['仙风道骨', '和蔼', '博学'];
      }
      if (innkeeper) {
        innkeeper.name = '云来客栈老板娘 · 莫娘子';
        innkeeper.title = '集市消息最灵通的灵茶掌柜';
        innkeeper.personality = ['八面玲珑', '精明', '热情'];
      }
      if (orgCrow) {
        orgCrow.name = '九幽魔盟 (Jiuyou Alliance)';
        orgCrow.description = '潜伏在暗处搜刮灵石与邪道功法魔道势力。';
      }
      if (orgKnights) {
        orgKnights.name = '太虚圣宗 (Taixu Sect)';
        orgKnights.description = '名门正派，维护仙界秩序与降妖伏魔的正道领袖。';
      }
      if (fact1) fact1.statement = '太虚圣宗正悬赏天下修士，征集雾隐丛林深处的古仙洞府图录。';
      if (fact2) fact2.statement = '坊市间流传九幽魔盟已派探子潜入云来客栈打探灵石矿脉消息。';

      if (pc) {
        pc.location_id = 'loc-tavern';
        pc.resources.gold = 50;
        pc.memory.short_term = [
          { text: '你在修仙集市『云来客栈』袅袅檀香中醒来，案上置有一盏热气腾腾的灵茶与悬赏告示。', importance: 3, epoch: 1 },
        ];
      }
    } else if (isWasteland) {
      this.snapshot.world_name = '末日余晖 (Wasteland)';
      this.snapshot.world_description = '经历核辐射与异变风暴后的崩坏废土，旧时代遗迹与变异异种横行，流民与拾荒者在此挣扎生存。';

      if (tav) {
        tav.name = '废墟庇护所 • 拾荒者驿站 (Scavenger Outpost)';
        tav.description = '由旧时代铁皮与集装箱焊接而成的围栏营地，流民与拾荒者在此用瓶盖交易净水与弹药。';
        tav.economy.trade_goods = ['瓶盖', '辐射净化水', '旧时代罐头'];
        tav.features = [
          { name: '铁皮吧台', description: '提供粗制烧酒与净水，是拾荒者交流路线的场所。', state: 'INTACT' },
          { name: '废土悬赏铁板', description: '挂着猎杀变异怪与搜寻电池的悬赏。', state: 'INTACT' },
        ];
      }
      if (df) {
        df.name = '废铁集镇中心 (Junkyard Central Hub)';
        df.description = '废土流民的物资集散广场，大聚光灯与锈迹斑斑的防御铁网耸立。';
        df.economy.trade_goods = ['废铜烂铁', '土制弹药', '抗辐射药剂'];
        df.features = [{ name: '防空聚光灯', description: '用于夜间警示变异夜袭生物的高功率大灯。', state: 'INTACT' }];
      }
      if (wild) {
        wild.name = '辐射恶狼荒原 (Irradiated Wasteland)';
        wild.description = '被核辐射风暴肆虐的焦土荒原，变异恶狼与狂暴变种人四处流浪。';
        wild.economy.trade_goods = ['变异兽皮', '废弃弹壳'];
        wild.features = [{ name: '锈蚀装甲车废墟', description: '半埋在沙土里的战前卡车。', state: 'DAMAGED' }];
      }
      if (ruin) {
        ruin.name = '战前核反应堆防空洞 (Pre-war Nuclear Shelter)';
        ruin.description = '旧文明保留下来的深层地下避难所入口，气密重门散发着沉重气息。';
        ruin.features = [{ name: '防核气密闸门', description: '需要高阶解码卡或强行撬开的合金大门。', state: 'INTACT' }];
      }

      if (elder) {
        elder.name = '驿站站长 · 独眼老乔';
        elder.title = '废土经验丰富的生存老兵';
        elder.personality = ['沧桑', '警惕', '仗义'];
      }
      if (innkeeper) {
        innkeeper.name = '驿站经营者 · 粗犷萨拉';
        innkeeper.title = '掌管净水与雇佣枪手委托的老板娘';
        innkeeper.personality = ['强悍', '直爽', '消息灵通'];
      }
      if (orgCrow) {
        orgCrow.name = '荒野拾荒者掠夺者帮 (Wasteland Raiders)';
        orgCrow.description = '横行于废土荒原、靠抢劫流民与搜刮遗迹维生的匪帮。';
      }
      if (orgKnights) {
        orgKnights.name = '废土钢铁军阀 (Steel Warlords)';
        orgKnights.description = '掌控战前重武器与净水设备的武装军事势力。';
      }
      if (fact1) fact1.statement = '钢铁军阀正高价收购战前核反应堆防空洞中的完整能源核心。';
      if (fact2) fact2.statement = '掠夺者匪帮近期在辐射荒原出没，频繁拦截前往废铁集镇的物资车队。';

      if (pc) {
        pc.location_id = 'loc-tavern';
        pc.resources.gold = 120;
        pc.memory.short_term = [
          { text: '你在拾荒者驿站粗糙的集装箱木桌旁醒来，空气中飘着烤变异肉的咸香与柴油味。', importance: 3, epoch: 1 },
        ];
      }
    } else {
      this.snapshot.world_name = '艾尔德兰 (Eldlan)';
      this.snapshot.world_description = '一个处于蒸汽与魔导工业革命交界处的古老大陆。铁冠城掌握王国命脉，而暗流在阴影中汹涌。';

      if (tav) {
        tav.name = '红叶雇佣兵酒馆 (Redleaf Tavern)';
        tav.description = '拂晓荒村最热闹的憩息之地。橡木吧台散发着麦芽酒与烤肉的香气，喧嚷的雇佣兵、流浪商人与老村长常在此小酌，墙上挂着满满的公会委托悬赏板。';
        tav.economy.trade_goods = ['黑麦啤酒', '风干烤肉', '雇佣情报'];
        tav.features = [
          { name: '酒馆橡木吧台', description: '热气腾腾的黑麦啤酒与香浓炖汤，是打听情报与接取委托的绝佳场所。', state: 'INTACT' },
          { name: '公会雇佣兵悬赏板', description: '张贴着附近打杂、清剿魔物或搜寻遗迹失物的悬赏告示。', state: 'INTACT' },
          { name: '靠窗的温暖木桌', description: '旅人与冒险者歇脚的地方，十分适合静下心整理装备与规划行程。', state: 'INTACT' },
        ];
      }
      if (df) {
        df.name = '拂晓荒村广场 (Dawnfall Square)';
        df.description = '边境荒野边缘的微型聚落广场，露天篝火与旧驿站提供着庇护。';
        df.economy.trade_goods = ['风干猎肉', '草药', '旧兵刃'];
        df.features = [
          { name: '露天营地篝火', description: '冒险者与流浪者交换情报的中央火堆。', state: 'INTACT' },
          { name: '旧驿站委托板', description: '张贴着附近打杂、清剿匪徒或搜寻失物的悬赏告示。', state: 'INTACT' },
        ];
      }
      if (wild) {
        wild.name = '风蚀荒野 (Windswept Wilds)';
        wild.description = '拂晓村外的无垠荒野，灌木丛与乱石交错。常有流劫匪徒与野兽出没。';
        wild.economy.trade_goods = ['兽皮'];
        wild.features = [{ name: '废弃哨塔', description: '高耸但半坍塌的石塔，视角开阔。', state: 'DAMAGED' }];
      }
      if (ruin) {
        ruin.name = '低语遗迹入口 (Whispering Ruins)';
        ruin.description = '埋没在荒野深处的古老地下建筑入口，微弱的符文幽光在拱门间闪烁。';
        ruin.features = [{ name: '古老符文石门', description: '刻满未知文字的沉重石门。', state: 'INTACT' }];
      }

      if (elder) {
        elder.name = '老村长埃尔顿';
        elder.title = '拂晓荒村德高望重的长者';
        elder.personality = ['睿智', '温和', '忧国忧民'];
      }
      if (innkeeper) {
        innkeeper.name = '酒馆老板娘玛丽亚';
        innkeeper.title = '荒野黑犬酒馆经营者';
        innkeeper.personality = ['豪爽', '精明', '消息灵通'];
      }
      if (orgCrow) {
        orgCrow.name = '黑鸦商会 (Black Crow Guild)';
        orgCrow.description = '控制铁冠城地下黑市与走私网络的秘密帮会。';
      }
      if (orgKnights) {
        orgKnights.name = '圣光守卫团 (Order of Light Knights)';
        orgKnights.description = '负责铁冠城治安与王室警卫的秩序守护者。';
      }
      if (fact1) fact1.statement = '铁冠城的高炉所需的原矿绝大部分来自迷雾矿道与古矿坑。';
      if (fact2) fact2.statement = '圣光守卫团近期加强了对铁冠城各出口城门商队的抽查。';

      if (pc) {
        pc.location_id = 'loc-tavern';
        pc.resources.gold = 100;
        pc.memory.short_term = [
          { text: '你在拂晓荒村『红叶雇佣兵酒馆』温暖喧闹的靠窗木桌前醒来，桌上放着热腾腾的黑麦啤酒，眼前是酒馆公会的悬赏告示板。', importance: 3, epoch: 1 },
        ];
      }
    }
    this.updateStats();
    this.runtimeWriteLocked = true;
  }

  public updateStats() {
    const prevContext = isRecorderWriteContext();
    setRecorderWriteContext(true);
    try {
      this.snapshot.characters_count = this.characters.size;
      this.snapshot.organizations_count = this.organizations.size;
      this.snapshot.locations_count = this.locations.size;
      this.snapshot.world_facts_count = this.facts.size;
      let activeS = 0;
      this.seeds.forEach((s) => {
        if (s.status === 'IN_PROGRESS') activeS++;
      });
      this.snapshot.active_seeds_count = activeS;
      let frozenC = 0;
      this.characters.forEach((c) => {
        if (c.frozen) frozenC++;
      });
      this.snapshot.frozen_objects_count = frozenC;
    } finally {
      setRecorderWriteContext(prevContext);
    }
  }

  public getStats(): SimulationStats {
    this.updateStats();
    return {
      epoch: this.snapshot.epoch,
      active_entities: this.characters.size - this.snapshot.frozen_objects_count,
      wake_queue_size: this.wakeQueue.length,
      llm_calls_this_epoch: this.llmCallsThisEpoch,
      total_llm_calls: this.totalLLMCalls,
      budget_allocated: 1000 - this.wakeQueue.length * 20,
      total_facts: this.facts.size,
      active_seeds: this.snapshot.active_seeds_count,
      invariant_checks_passed: true,
      invariant_warnings: [],
    };
  }
}

export const globalWorld = new WorldDataStore();
