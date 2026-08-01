/**
 * Aetheria Persistence Schema Definitions
 */

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS worlds (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  preset_type TEXT NOT NULL DEFAULT 'default',
  current_epoch INTEGER NOT NULL DEFAULT 1,
  random_seed INTEGER NOT NULL DEFAULT 12345,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  title TEXT NOT NULL,
  species TEXT NOT NULL,
  age INTEGER NOT NULL,
  status TEXT NOT NULL,
  location_id TEXT,
  goal_json TEXT,
  personality_json TEXT,
  fear_json TEXT,
  attributes_json TEXT,
  skills_json TEXT,
  resources_json TEXT,
  inventory_json TEXT,
  knowledge_json TEXT,
  memory_json TEXT,
  relationships_json TEXT,
  current_action_json TEXT,
  frozen INTEGER NOT NULL DEFAULT 0,
  simulation_level INTEGER NOT NULL DEFAULT 1,
  last_simulated_epoch INTEGER NOT NULL DEFAULT 1,
  created_at_epoch INTEGER NOT NULL DEFAULT 1,
  updated_at_epoch INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  headquarters_id TEXT,
  territory_ids_json TEXT,
  leader_id TEXT,
  member_ids_json TEXT,
  resources_json TEXT,
  goals_json TEXT,
  projects_json TEXT,
  relationships_json TEXT,
  reputation_json TEXT,
  frozen INTEGER NOT NULL DEFAULT 0,
  simulation_level INTEGER NOT NULL DEFAULT 1,
  last_simulated_epoch INTEGER NOT NULL DEFAULT 1,
  created_at_epoch INTEGER NOT NULL DEFAULT 1,
  updated_at_epoch INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  parent_id TEXT,
  child_ids_json TEXT,
  connected_to_json TEXT,
  owner_id TEXT,
  owner_type TEXT,
  population INTEGER NOT NULL DEFAULT 0,
  population_trend TEXT NOT NULL DEFAULT 'STABLE',
  economy_json TEXT,
  security_json TEXT,
  active_events_json TEXT,
  features_json TEXT,
  frozen INTEGER NOT NULL DEFAULT 0,
  simulation_level INTEGER NOT NULL DEFAULT 1,
  last_simulated_epoch INTEGER NOT NULL DEFAULT 1,
  created_at_epoch INTEGER NOT NULL DEFAULT 1,
  updated_at_epoch INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS location_edges (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  from_location_id TEXT NOT NULL,
  to_location_id TEXT NOT NULL,
  distance REAL NOT NULL DEFAULT 1.0,
  travel_cost REAL NOT NULL DEFAULT 1.0,
  travel_time_epochs INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'OPEN',
  metadata_json TEXT,
  FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS world_facts (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  statement TEXT NOT NULL,
  category TEXT NOT NULL,
  confidence TEXT NOT NULL,
  subject_type TEXT,
  subject_id TEXT,
  source_json TEXT,
  related_entity_ids_json TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  superseded_by TEXT,
  valid_from_epoch INTEGER NOT NULL DEFAULT 1,
  valid_to_epoch INTEGER,
  created_at_epoch INTEGER NOT NULL DEFAULT 1,
  updated_at_epoch INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS hidden_truths (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  title TEXT NOT NULL,
  layer TEXT NOT NULL,
  layer_name TEXT NOT NULL,
  exists_flag INTEGER NOT NULL DEFAULT 1,
  true_nature TEXT NOT NULL,
  true_owner_id TEXT,
  true_goal TEXT,
  revealed INTEGER NOT NULL DEFAULT 0,
  revealed_to_ids_json TEXT,
  locked_at_epoch INTEGER NOT NULL DEFAULT 1,
  immutable_flag INTEGER NOT NULL DEFAULT 1,
  evidence_required_json TEXT,
  evidence_collected_json TEXT,
  FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS seeds (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  visible_layer_json TEXT,
  hidden_truth_json TEXT,
  hidden_truth_id TEXT,
  causality_chain_id TEXT,
  importance INTEGER NOT NULL DEFAULT 1,
  player_opportunity_json TEXT,
  progress REAL NOT NULL DEFAULT 0.0,
  created_at_epoch INTEGER NOT NULL DEFAULT 1,
  updated_at_epoch INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS world_transactions (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  actor_ids_json TEXT,
  origin_location_id TEXT,
  destination_location_id TEXT,
  route_location_ids_json TEXT,
  start_epoch INTEGER NOT NULL,
  expected_end_epoch INTEGER NOT NULL,
  current_checkpoint_index INTEGER NOT NULL DEFAULT 0,
  checkpoints_json TEXT,
  preconditions_json TEXT,
  dependency_ids_json TEXT,
  parent_seed_id TEXT,
  parent_organization_id TEXT,
  result_json TEXT,
  invalidation_reason TEXT,
  created_at_epoch INTEGER NOT NULL DEFAULT 1,
  updated_at_epoch INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS scheduled_checkpoints (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  transaction_id TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  payload_json TEXT,
  created_at_epoch INTEGER NOT NULL DEFAULT 1,
  processed_at_epoch INTEGER,
  FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE,
  FOREIGN KEY(transaction_id) REFERENCES world_transactions(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS dependency_edges (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  dependency_type TEXT NOT NULL,
  condition_json TEXT,
  FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS observed_intervals (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  player_character_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  from_epoch INTEGER NOT NULL,
  to_epoch INTEGER,
  observation_level TEXT NOT NULL DEFAULT 'DIRECT',
  metadata_json TEXT,
  FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS state_change_log (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  epoch INTEGER NOT NULL,
  operation TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  source_type TEXT NOT NULL,
  source_id TEXT,
  committed_at TEXT NOT NULL,
  FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  world_id TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  location_id TEXT,
  involved_entity_ids_json TEXT,
  cause_json TEXT,
  effects_json TEXT,
  epoch INTEGER NOT NULL,
  resolved INTEGER NOT NULL DEFAULT 1,
  resolution_epoch INTEGER NOT NULL,
  created_at_epoch INTEGER NOT NULL,
  FOREIGN KEY(world_id) REFERENCES worlds(id) ON DELETE CASCADE
);
`;
