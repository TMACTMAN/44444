/**
 * AI Native Persistent World RPG - Types & Interfaces
 * Specification based on CODEX.md
 */

export type CharacterType = 'PC' | 'NPC' | 'BEAST';
export type CharacterStatus = 'ALIVE' | 'DEAD' | 'MISSING' | 'INCAPACITATED';
export type PresenceState = 'AT_LOCATION' | 'IN_TRANSIT' | 'MISSING' | 'DEAD';
export type OrgType = 'GUILD' | 'RELIGION' | 'KINGDOM' | 'MILITIA' | 'CULT' | 'CORPORATION';
export type LocationType = 'TOWN' | 'CITY' | 'VILLAGE' | 'FOREST' | 'DUNGEON' | 'RUIN' | 'MOUNTAIN' | 'ROAD' | 'RIVER' | 'CAVE' | 'TEMPLE' | 'FORT';

export type FactCategory = 'GEOGRAPHY' | 'HISTORY' | 'ECONOMY' | 'POLITICS' | 'SOCIAL' | 'MAGIC' | 'DISASTER';
export type FactConfidence = 'CONFIRMED' | 'RUMOR' | 'SUSPECTED' | 'FALSE';

export type SeedType = 'CARAVAN' | 'AMBUSH' | 'FESTIVAL' | 'CONSTRUCTION' | 'RAID' | 'INVESTIGATION' | 'RITUAL' | 'MIGRATION' | 'DIPLOMACY' | 'ESPIONAGE';
export type SeedStatus = 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'INTERRUPTED';
export type EventType =
  | 'BATTLE'
  | 'DISASTER'
  | 'DISCOVERY'
  | 'CEREMONY'
  | 'CRIME'
  | 'POLITICAL'
  | 'ECONOMIC'
  | 'SOCIAL'
  | 'NATURAL'
  | 'TRUTH_REVEALED'
  | 'TRAVEL_STARTED'
  | 'TRAVEL_PROGRESS'
  | 'TRAVEL_DELAYED'
  | 'TRAVEL_COMPLETED'
  | 'TRAVEL_FAILED'
  | 'TRANSACTION_CANCELLED';

export type RelationType = 'ALLY' | 'ENEMY' | 'NEUTRAL' | 'FAMILY' | 'BUSINESS';
export type SimulationLevel = 0 | 1 | 2 | 3 | 4;

export type WakeReason = 'PLAYER_APPROACH' | 'PLAYER_INVESTIGATE' | 'DEADLINE' | 'DEPENDENCY_WAKE' | 'ORGANIZATION_REQUIRES' | 'REGIONAL_SIMULATION' | 'CAUSALITY_PRESSURE' | 'PERIODIC_REFRESH';

export interface WorldSnapshot {
  id: string;
  epoch: number;
  created_at: string;
  world_name: string;
  world_description: string;
  seed: number;
  world_facts_count: number;
  characters_count: number;
  organizations_count: number;
  locations_count: number;
  active_seeds_count: number;
  frozen_objects_count: number;
  completed_epochs: number;
}

export interface CharacterGoal {
  primary: string;
  secondary: string[];
  current_focus?: string;
}

export interface CharacterAttributes {
  hp: number;
  max_hp: number;
  mp: number;
  max_mp: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  charisma: number;
}

export interface Relationship {
  target_id: string;
  target_name?: string;
  type: RelationType;
  trust: number;
  fear: number;
  favor: number;
  last_interaction_epoch: number;
}

export interface CharacterMemoryItem {
  text: string;
  importance: number;
  epoch: number;
}

export interface CharacterMemory {
  short_term: CharacterMemoryItem[];
  compressed: string;
  important_events: string[];
}

export interface CurrentAction {
  type: string;
  description: string;
  started_at_epoch: number;
  estimated_end_epoch: number;
  seed_id?: string;
}

export interface InventoryItem {
  item_id: string;
  name: string;
  quantity: number;
  type: string;
  properties?: Record<string, any>;
}

export interface CharacterKnowledge {
  known_facts: string[];
  known_characters: string[];
  known_locations: string[];
}

export interface Character {
  id: string;
  type: CharacterType;
  name: string;
  title: string;
  species: string;
  age: number;
  location_id: string | null;
  status: CharacterStatus;
  presence_state?: PresenceState;
  current_transaction_id?: string | null;
  goal: CharacterGoal;
  fear: string;
  personality: string[];
  attributes: CharacterAttributes;
  skills: Record<string, number>;
  resources: { gold: number; reputation: number };
  inventory: InventoryItem[];
  knowledge: CharacterKnowledge;
  relationships: Relationship[];
  memory: CharacterMemory;
  current_action: CurrentAction;
  frozen: boolean;
  simulation_level: SimulationLevel;
  last_simulated_epoch: number;
  created_at_epoch: number;
  updated_at_epoch: number;
}

export interface OrgGoal {
  id: string;
  description: string;
  type: string;
  priority: number;
  status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'SUPERSEDED';
  created_at_epoch: number;
  completed_at_epoch?: number;
  progress: number;
}

export interface OrgProject {
  id: string;
  name: string;
  description: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  goal_id?: string;
  assigned_member_ids: string[];
  current_seed_id?: string;
  progress: number;
  epoch_started: number;
  epoch_deadline: number;
}

export interface Organization {
  id: string;
  name: string;
  type: OrgType;
  description: string;
  headquarters_id: string;
  territory_ids: string[];
  leader_id?: string;
  member_ids: string[];
  resources: { wealth: number; influence: number; military_power: number; secret_knowledge: number };
  goals: OrgGoal[];
  projects: OrgProject[];
  relationships: { target_id: string; type: string; standing: number }[];
  reputation: { public: number; nobility: number; underworld: number };
  frozen: boolean;
  simulation_level: SimulationLevel;
  last_simulated_epoch: number;
  created_at_epoch: number;
  updated_at_epoch: number;
}

export interface LocationFeature {
  name: string;
  description: string;
  state: string;
  hidden_truth_id?: string;
}

export interface Location {
  id: string;
  name: string;
  type: LocationType;
  description: string;
  parent_id?: string;
  child_ids: string[];
  connected_to: string[];
  owner_id?: string;
  owner_type?: string;
  population: number;
  population_trend: string;
  economy: {
    primary_industry: string;
    wealth_level: number;
    trade_goods: string[];
    trade_routes: string[];
  };
  security: {
    guard_presence: number;
    crime_rate: number;
    last_incident_epoch?: number;
  };
  active_events: string[];
  features: LocationFeature[];
  frozen: boolean;
  simulation_level: SimulationLevel;
  last_simulated_epoch: number;
  created_at_epoch: number;
  updated_at_epoch: number;
}

export interface WorldFact {
  id: string;
  statement: string;
  category: FactCategory;
  confidence: FactConfidence;
  source: {
    type: string;
    source_id?: string;
    epoch_discovered: number;
  };
  related_entity_ids: string[];
  is_active: boolean;
  superseded_by?: string;
  created_at_epoch: number;
  updated_at_epoch: number;
}

export interface HiddenTruth {
  id: string;
  title: string;
  layer: 'layer_1_personal_secrets' | 'layer_2_organization_conspiracies' | 'layer_3_world_lies' | 'layer_4_cosmic_illusions';
  layer_name: string;
  exists: boolean;
  true_nature: string;
  true_owner_id?: string;
  true_goal?: string;
  revealed: boolean;
  revealed_to_ids: string[];
  locked_at_epoch: number;
  never_changes: boolean;
  evidence_required: string[];
  evidence_collected: string[];
}

export interface PlayerOpportunity {
  exists: boolean;
  description: string;
  discovery_condition: string;
  type: string;
  target_seed_id?: string;
}

export interface SeedVisibleLayer {
  description: string;
  actor_ids: string[];
  location_id: string;
  start_epoch: number;
  estimated_end_epoch: number;
}

export interface Seed {
  id: string;
  type: SeedType;
  visible_layer: SeedVisibleLayer;
  hidden_truth: HiddenTruth;
  status: SeedStatus;
  causality_chain_id?: string;
  importance: number;
  player_opportunity: PlayerOpportunity;
  progress: number;
  created_at_epoch: number;
  updated_at_epoch: number;
}

export interface EventEffect {
  type: string;
  description: string;
  target_type: string;
  target_id?: string;
  changes: Record<string, any>;
}

export interface Event {
  id: string;
  type: EventType;
  description: string;
  location_id?: string;
  involved_entity_ids: string[];
  cause: {
    type: string;
    source_id?: string;
  };
  effects: EventEffect[];
  epoch: number;
  resolved: boolean;
  resolution_epoch: number;
  created_at_epoch: number;
}

export interface CausalityPressure {
  source: string;
  entity_id: string;
  description: string;
  pressure: number;
  deadline_epoch?: number;
}

export interface WakeSignal {
  entity_id: string;
  entity_type: 'CHARACTER' | 'ORGANIZATION' | 'LOCATION';
  reason: WakeReason;
  triggered_by?: string;
  epoch: number;
  weight: number;
}

export interface SimulationStats {
  epoch: number;
  active_entities: number;
  wake_queue_size: number;
  llm_calls_this_epoch: number;
  total_llm_calls: number;
  budget_allocated: number;
  total_facts: number;
  active_seeds: number;
  invariant_checks_passed: boolean;
  invariant_warnings: string[];
}

export interface AdventureArtCard {
  id: string;
  title: string;
  locationName: string;
  narrationSummary: string;
  imageUrl: string;
  prompt: string;
  epoch: number;
  timestamp: string;
}

export interface UserCommercialState {
  isVIP: boolean;
  vipExpiresAt?: string;
  artQuotas: number;
  turnsSinceLastAd: number;
  lastAdEpoch: number;
  totalAdsWatched: number;
}

export interface LocationEdge {
  id: string;
  world_id: string;
  from_location_id: string;
  to_location_id: string;
  distance: number;
  travel_cost: number;
  travel_time_epochs: number;
  status: string;
  metadata?: Record<string, any>;
}

export interface WorldTransaction {
  id: string;
  world_id: string;
  type: string;
  status: string;
  actor_ids: string[];
  origin_location_id?: string | null;
  destination_location_id?: string | null;
  last_valid_location_id?: string | null;
  route_location_ids: string[];
  start_epoch: number;
  expected_end_epoch: number;
  completed_epoch?: number | null;
  current_checkpoint_index: number;
  checkpoints: any[];
  preconditions: any[];
  dependency_ids: string[];
  parent_seed_id?: string | null;
  parent_organization_id?: string | null;
  result?: any;
  invalidation_reason?: string | null;
  created_at_epoch: number;
  updated_at_epoch: number;
}

export interface ScheduledCheckpoint {
  id: string;
  world_id: string;
  transaction_id: string;
  epoch: number;
  type: string;
  status: string;
  sequence?: number;
  payload?: any;
  created_at_epoch: number;
  processed_at_epoch?: number | null;
}

export interface DependencyEdge {
  id: string;
  world_id: string;
  source_type: string;
  source_id: string;
  target_type: string;
  target_id: string;
  dependency_type: string;
  condition?: any;
}

export interface ObservedInterval {
  id: string;
  world_id: string;
  player_character_id: string;
  location_id: string;
  from_epoch: number;
  to_epoch?: number;
  observation_level: string;
  metadata?: Record<string, any>;
}

export interface StateChangeLogEntry {
  id: string;
  world_id: string;
  epoch: number;
  operation: string;
  entity_type: string;
  entity_id?: string;
  before_state?: any;
  after_state?: any;
  source_type: string;
  source_id?: string;
  committed_at: string;
}
