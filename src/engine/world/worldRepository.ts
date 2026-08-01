import { dbManager } from '../persistence/database';
import {
  WorldSnapshot,
  Character,
  Location,
  Organization,
  WorldFact,
  HiddenTruth,
  Seed,
  Event,
  LocationEdge,
  WorldTransaction,
  ScheduledCheckpoint,
  DependencyEdge,
  ObservedInterval,
  StateChangeLogEntry,
} from '../../types';

export class WorldRepository {
  // === WORLD SNAPSHOT ===
  public static async getWorldSnapshot(worldId: string): Promise<WorldSnapshot | null> {
    const row = await dbManager.get<any>('SELECT * FROM worlds WHERE id = ?', [worldId]);
    if (!row) return null;
    return {
      id: row.id,
      world_name: row.name,
      world_description: row.description,
      epoch: row.current_epoch,
      seed: row.random_seed,
      created_at: row.created_at,
      world_facts_count: 0,
      characters_count: 0,
      organizations_count: 0,
      locations_count: 0,
      active_seeds_count: 0,
      frozen_objects_count: 0,
      completed_epochs: row.current_epoch - 1,
    };
  }

  public static async saveWorldSnapshot(snapshot: WorldSnapshot, presetType = 'default'): Promise<void> {
    const now = new Date().toISOString();
    await dbManager.run(
      `INSERT INTO worlds (id, name, description, preset_type, current_epoch, random_seed, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         description = excluded.description,
         preset_type = excluded.preset_type,
         current_epoch = excluded.current_epoch,
         random_seed = excluded.random_seed,
         updated_at = excluded.updated_at`,
      [snapshot.id, snapshot.world_name, snapshot.world_description, presetType, snapshot.epoch, snapshot.seed, snapshot.created_at || now, now]
    );
  }

  // === CHARACTERS ===
  public static async getAllCharacters(worldId: string): Promise<Character[]> {
    const rows = await dbManager.all<any>('SELECT * FROM characters WHERE world_id = ?', [worldId]);
    return rows.map(this.mapRowToCharacter);
  }

  public static async getCharacter(worldId: string, charId: string): Promise<Character | null> {
    const row = await dbManager.get<any>('SELECT * FROM characters WHERE world_id = ? AND id = ?', [worldId, charId]);
    if (!row) return null;
    return this.mapRowToCharacter(row);
  }

  public static async saveCharacter(worldId: string, char: Character): Promise<void> {
    const presenceState = char.presence_state || (char.status === 'DEAD' ? 'DEAD' : (char.status === 'MISSING' ? 'MISSING' : (char.location_id ? 'AT_LOCATION' : 'IN_TRANSIT')));
    await dbManager.run(
      `INSERT INTO characters (
        id, world_id, type, name, title, species, age, status, presence_state, current_transaction_id, location_id,
        goal_json, personality_json, fear_json, attributes_json, skills_json,
        resources_json, inventory_json, knowledge_json, memory_json, relationships_json,
        current_action_json, frozen, simulation_level, last_simulated_epoch, created_at_epoch, updated_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        world_id = excluded.world_id,
        type = excluded.type,
        name = excluded.name,
        title = excluded.title,
        species = excluded.species,
        age = excluded.age,
        status = excluded.status,
        presence_state = excluded.presence_state,
        current_transaction_id = excluded.current_transaction_id,
        location_id = excluded.location_id,
        goal_json = excluded.goal_json,
        personality_json = excluded.personality_json,
        fear_json = excluded.fear_json,
        attributes_json = excluded.attributes_json,
        skills_json = excluded.skills_json,
        resources_json = excluded.resources_json,
        inventory_json = excluded.inventory_json,
        knowledge_json = excluded.knowledge_json,
        memory_json = excluded.memory_json,
        relationships_json = excluded.relationships_json,
        current_action_json = excluded.current_action_json,
        frozen = excluded.frozen,
        simulation_level = excluded.simulation_level,
        last_simulated_epoch = excluded.last_simulated_epoch,
        updated_at_epoch = excluded.updated_at_epoch`,
      [
        char.id,
        worldId,
        char.type,
        char.name,
        char.title || '',
        char.species || 'Human',
        char.age || 25,
        char.status,
        presenceState,
        char.current_transaction_id || null,
        char.location_id,
        JSON.stringify(char.goal || {}),
        JSON.stringify(char.personality || []),
        JSON.stringify(char.fear || ''),
        JSON.stringify(char.attributes || {}),
        JSON.stringify(char.skills || {}),
        JSON.stringify(char.resources || {}),
        JSON.stringify(char.inventory || []),
        JSON.stringify(char.knowledge || {}),
        JSON.stringify(char.memory || {}),
        JSON.stringify(char.relationships || []),
        JSON.stringify(char.current_action || {}),
        char.frozen ? 1 : 0,
        char.simulation_level ?? 1,
        char.last_simulated_epoch ?? 1,
        char.created_at_epoch ?? 1,
        char.updated_at_epoch ?? 1,
      ]
    );
  }

  private static mapRowToCharacter(row: any): Character {
    const presenceState = row.presence_state || (row.status === 'DEAD' ? 'DEAD' : (row.status === 'MISSING' ? 'MISSING' : (row.location_id ? 'AT_LOCATION' : 'IN_TRANSIT')));
    return {
      id: row.id,
      type: row.type,
      name: row.name,
      title: row.title,
      species: row.species,
      age: row.age,
      status: row.status,
      presence_state: presenceState as any,
      current_transaction_id: row.current_transaction_id || null,
      location_id: row.location_id,
      goal: JSON.parse(row.goal_json || '{}'),
      personality: JSON.parse(row.personality_json || '[]'),
      fear: JSON.parse(row.fear_json || '""'),
      attributes: JSON.parse(row.attributes_json || '{}'),
      skills: JSON.parse(row.skills_json || '{}'),
      resources: JSON.parse(row.resources_json || '{}'),
      inventory: JSON.parse(row.inventory_json || '[]'),
      knowledge: JSON.parse(row.knowledge_json || '{}'),
      memory: JSON.parse(row.memory_json || '{}'),
      relationships: JSON.parse(row.relationships_json || '[]'),
      current_action: JSON.parse(row.current_action_json || '{}'),
      frozen: !!row.frozen,
      simulation_level: row.simulation_level,
      last_simulated_epoch: row.last_simulated_epoch,
      created_at_epoch: row.created_at_epoch,
      updated_at_epoch: row.updated_at_epoch,
    };
  }

  // === LOCATIONS ===
  public static async getAllLocations(worldId: string): Promise<Location[]> {
    const rows = await dbManager.all<any>('SELECT * FROM locations WHERE world_id = ?', [worldId]);
    return rows.map(this.mapRowToLocation);
  }

  public static async getLocation(worldId: string, locId: string): Promise<Location | null> {
    const row = await dbManager.get<any>('SELECT * FROM locations WHERE world_id = ? AND id = ?', [worldId, locId]);
    if (!row) return null;
    return this.mapRowToLocation(row);
  }

  public static async saveLocation(worldId: string, loc: Location): Promise<void> {
    await dbManager.run(
      `INSERT INTO locations (
        id, world_id, name, type, description, parent_id, child_ids_json, connected_to_json,
        owner_id, owner_type, population, population_trend, economy_json, security_json,
        active_events_json, features_json, frozen, simulation_level, last_simulated_epoch, created_at_epoch, updated_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        world_id = excluded.world_id,
        name = excluded.name,
        type = excluded.type,
        description = excluded.description,
        parent_id = excluded.parent_id,
        child_ids_json = excluded.child_ids_json,
        connected_to_json = excluded.connected_to_json,
        owner_id = excluded.owner_id,
        owner_type = excluded.owner_type,
        population = excluded.population,
        population_trend = excluded.population_trend,
        economy_json = excluded.economy_json,
        security_json = excluded.security_json,
        active_events_json = excluded.active_events_json,
        features_json = excluded.features_json,
        frozen = excluded.frozen,
        simulation_level = excluded.simulation_level,
        last_simulated_epoch = excluded.last_simulated_epoch,
        updated_at_epoch = excluded.updated_at_epoch`,
      [
        loc.id,
        worldId,
        loc.name,
        loc.type,
        loc.description,
        loc.parent_id || null,
        JSON.stringify(loc.child_ids || []),
        JSON.stringify(loc.connected_to || []),
        loc.owner_id || null,
        loc.owner_type || null,
        loc.population || 0,
        loc.population_trend || 'STABLE',
        JSON.stringify(loc.economy || {}),
        JSON.stringify(loc.security || {}),
        JSON.stringify(loc.active_events || []),
        JSON.stringify(loc.features || []),
        loc.frozen ? 1 : 0,
        loc.simulation_level ?? 1,
        loc.last_simulated_epoch ?? 1,
        loc.created_at_epoch ?? 1,
        loc.updated_at_epoch ?? 1,
      ]
    );
  }

  private static mapRowToLocation(row: any): Location {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      parent_id: row.parent_id,
      child_ids: JSON.parse(row.child_ids_json || '[]'),
      connected_to: JSON.parse(row.connected_to_json || '[]'),
      owner_id: row.owner_id,
      owner_type: row.owner_type,
      population: row.population,
      population_trend: row.population_trend,
      economy: JSON.parse(row.economy_json || '{}'),
      security: JSON.parse(row.security_json || '{}'),
      active_events: JSON.parse(row.active_events_json || '[]'),
      features: JSON.parse(row.features_json || '[]'),
      frozen: !!row.frozen,
      simulation_level: row.simulation_level,
      last_simulated_epoch: row.last_simulated_epoch,
      created_at_epoch: row.created_at_epoch,
      updated_at_epoch: row.updated_at_epoch,
    };
  }

  // === ORGANIZATIONS ===
  public static async getAllOrganizations(worldId: string): Promise<Organization[]> {
    const rows = await dbManager.all<any>('SELECT * FROM organizations WHERE world_id = ?', [worldId]);
    return rows.map(this.mapRowToOrganization);
  }

  public static async getOrganization(worldId: string, orgId: string): Promise<Organization | null> {
    const row = await dbManager.get<any>('SELECT * FROM organizations WHERE world_id = ? AND id = ?', [worldId, orgId]);
    if (!row) return null;
    return this.mapRowToOrganization(row);
  }

  public static async saveOrganization(worldId: string, org: Organization): Promise<void> {
    await dbManager.run(
      `INSERT INTO organizations (
        id, world_id, name, type, description, headquarters_id, territory_ids_json, leader_id, member_ids_json,
        resources_json, goals_json, projects_json, relationships_json, reputation_json, frozen, simulation_level,
        last_simulated_epoch, created_at_epoch, updated_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        world_id = excluded.world_id,
        name = excluded.name,
        type = excluded.type,
        description = excluded.description,
        headquarters_id = excluded.headquarters_id,
        territory_ids_json = excluded.territory_ids_json,
        leader_id = excluded.leader_id,
        member_ids_json = excluded.member_ids_json,
        resources_json = excluded.resources_json,
        goals_json = excluded.goals_json,
        projects_json = excluded.projects_json,
        relationships_json = excluded.relationships_json,
        reputation_json = excluded.reputation_json,
        frozen = excluded.frozen,
        simulation_level = excluded.simulation_level,
        last_simulated_epoch = excluded.last_simulated_epoch,
        updated_at_epoch = excluded.updated_at_epoch`,
      [
        org.id,
        worldId,
        org.name,
        org.type,
        org.description,
        org.headquarters_id || null,
        JSON.stringify(org.territory_ids || []),
        org.leader_id || null,
        JSON.stringify(org.member_ids || []),
        JSON.stringify(org.resources || {}),
        JSON.stringify(org.goals || []),
        JSON.stringify(org.projects || []),
        JSON.stringify(org.relationships || []),
        JSON.stringify(org.reputation || {}),
        org.frozen ? 1 : 0,
        org.simulation_level ?? 1,
        org.last_simulated_epoch ?? 1,
        org.created_at_epoch ?? 1,
        org.updated_at_epoch ?? 1,
      ]
    );
  }

  private static mapRowToOrganization(row: any): Organization {
    return {
      id: row.id,
      name: row.name,
      type: row.type,
      description: row.description,
      headquarters_id: row.headquarters_id,
      territory_ids: JSON.parse(row.territory_ids_json || '[]'),
      leader_id: row.leader_id,
      member_ids: JSON.parse(row.member_ids_json || '[]'),
      resources: JSON.parse(row.resources_json || '{}'),
      goals: JSON.parse(row.goals_json || '[]'),
      projects: JSON.parse(row.projects_json || '[]'),
      relationships: JSON.parse(row.relationships_json || '[]'),
      reputation: JSON.parse(row.reputation_json || '{}'),
      frozen: !!row.frozen,
      simulation_level: row.simulation_level,
      last_simulated_epoch: row.last_simulated_epoch,
      created_at_epoch: row.created_at_epoch,
      updated_at_epoch: row.updated_at_epoch,
    };
  }

  // === HIDDEN TRUTHS ===
  public static async getAllHiddenTruths(worldId: string): Promise<HiddenTruth[]> {
    const rows = await dbManager.all<any>('SELECT * FROM hidden_truths WHERE world_id = ?', [worldId]);
    return rows.map(this.mapRowToHiddenTruth);
  }

  public static async getHiddenTruth(worldId: string, truthId: string): Promise<HiddenTruth | null> {
    const row = await dbManager.get<any>('SELECT * FROM hidden_truths WHERE world_id = ? AND id = ?', [worldId, truthId]);
    if (!row) return null;
    return this.mapRowToHiddenTruth(row);
  }

  public static async saveHiddenTruth(worldId: string, truth: HiddenTruth): Promise<void> {
    await dbManager.run(
      `INSERT INTO hidden_truths (
        id, world_id, title, layer, layer_name, exists_flag, true_nature, true_owner_id, true_goal,
        revealed, revealed_to_ids_json, locked_at_epoch, immutable_flag, evidence_required_json, evidence_collected_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        world_id = excluded.world_id,
        title = excluded.title,
        layer = excluded.layer,
        layer_name = excluded.layer_name,
        exists_flag = excluded.exists_flag,
        true_nature = excluded.true_nature,
        true_owner_id = excluded.true_owner_id,
        true_goal = excluded.true_goal,
        revealed = excluded.revealed,
        revealed_to_ids_json = excluded.revealed_to_ids_json,
        locked_at_epoch = excluded.locked_at_epoch,
        immutable_flag = excluded.immutable_flag,
        evidence_required_json = excluded.evidence_required_json,
        evidence_collected_json = excluded.evidence_collected_json`,
      [
        truth.id,
        worldId,
        truth.title,
        truth.layer,
        truth.layer_name,
        truth.exists ? 1 : 0,
        truth.true_nature,
        truth.true_owner_id || null,
        truth.true_goal || null,
        truth.revealed ? 1 : 0,
        JSON.stringify(truth.revealed_to_ids || []),
        truth.locked_at_epoch ?? 1,
        truth.never_changes ? 1 : 0,
        JSON.stringify(truth.evidence_required || []),
        JSON.stringify(truth.evidence_collected || []),
      ]
    );
  }

  private static mapRowToHiddenTruth(row: any): HiddenTruth {
    return {
      id: row.id,
      title: row.title,
      layer: row.layer,
      layer_name: row.layer_name,
      exists: !!row.exists_flag,
      true_nature: row.true_nature,
      true_owner_id: row.true_owner_id,
      true_goal: row.true_goal,
      revealed: !!row.revealed,
      revealed_to_ids: JSON.parse(row.revealed_to_ids_json || '[]'),
      locked_at_epoch: row.locked_at_epoch,
      never_changes: !!row.immutable_flag,
      evidence_required: JSON.parse(row.evidence_required_json || '[]'),
      evidence_collected: JSON.parse(row.evidence_collected_json || '[]'),
    };
  }

  // === SEEDS ===
  public static async getAllSeeds(worldId: string): Promise<Seed[]> {
    const rows = await dbManager.all<any>('SELECT * FROM seeds WHERE world_id = ?', [worldId]);
    return rows.map(this.mapRowToSeed);
  }

  public static async getSeed(worldId: string, seedId: string): Promise<Seed | null> {
    const row = await dbManager.get<any>('SELECT * FROM seeds WHERE world_id = ? AND id = ?', [worldId, seedId]);
    if (!row) return null;
    return this.mapRowToSeed(row);
  }

  public static async saveSeed(worldId: string, seed: Seed): Promise<void> {
    await dbManager.run(
      `INSERT INTO seeds (
        id, world_id, type, status, visible_layer_json, hidden_truth_json, hidden_truth_id,
        causality_chain_id, importance, player_opportunity_json, progress, created_at_epoch, updated_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        world_id = excluded.world_id,
        type = excluded.type,
        status = excluded.status,
        visible_layer_json = excluded.visible_layer_json,
        hidden_truth_json = excluded.hidden_truth_json,
        hidden_truth_id = excluded.hidden_truth_id,
        causality_chain_id = excluded.causality_chain_id,
        importance = excluded.importance,
        player_opportunity_json = excluded.player_opportunity_json,
        progress = excluded.progress,
        updated_at_epoch = excluded.updated_at_epoch`,
      [
        seed.id,
        worldId,
        seed.type,
        seed.status,
        JSON.stringify(seed.visible_layer || {}),
        JSON.stringify(seed.hidden_truth || {}),
        seed.hidden_truth?.id || null,
        seed.causality_chain_id || null,
        seed.importance || 1,
        JSON.stringify(seed.player_opportunity || {}),
        seed.progress || 0.0,
        seed.created_at_epoch ?? 1,
        seed.updated_at_epoch ?? 1,
      ]
    );
  }

  private static mapRowToSeed(row: any): Seed {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      visible_layer: JSON.parse(row.visible_layer_json || '{}'),
      hidden_truth: JSON.parse(row.hidden_truth_json || '{}'),
      causality_chain_id: row.causality_chain_id,
      importance: row.importance,
      player_opportunity: JSON.parse(row.player_opportunity_json || '{}'),
      progress: row.progress,
      created_at_epoch: row.created_at_epoch,
      updated_at_epoch: row.updated_at_epoch,
    };
  }

  // === WORLD FACTS ===
  public static async getAllFacts(worldId: string): Promise<WorldFact[]> {
    const rows = await dbManager.all<any>('SELECT * FROM world_facts WHERE world_id = ?', [worldId]);
    return rows.map(this.mapRowToFact);
  }

  public static async saveFact(worldId: string, fact: WorldFact): Promise<void> {
    await dbManager.run(
      `INSERT INTO world_facts (
        id, world_id, statement, category, confidence, subject_type, subject_id,
        source_json, related_entity_ids_json, is_active, superseded_by, valid_from_epoch, valid_to_epoch,
        created_at_epoch, updated_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        statement = excluded.statement,
        category = excluded.category,
        confidence = excluded.confidence,
        is_active = excluded.is_active,
        superseded_by = excluded.superseded_by,
        valid_to_epoch = excluded.valid_to_epoch,
        updated_at_epoch = excluded.updated_at_epoch`,
      [
        fact.id,
        worldId,
        fact.statement,
        fact.category,
        fact.confidence,
        fact.source?.type || null,
        fact.source?.source_id || null,
        JSON.stringify(fact.source || {}),
        JSON.stringify(fact.related_entity_ids || []),
        fact.is_active ? 1 : 0,
        fact.superseded_by || null,
        fact.created_at_epoch ?? 1,
        null,
        fact.created_at_epoch ?? 1,
        fact.updated_at_epoch ?? 1,
      ]
    );
  }

  private static mapRowToFact(row: any): WorldFact {
    return {
      id: row.id,
      statement: row.statement,
      category: row.category,
      confidence: row.confidence,
      source: JSON.parse(row.source_json || '{}'),
      related_entity_ids: JSON.parse(row.related_entity_ids_json || '[]'),
      is_active: !!row.is_active,
      superseded_by: row.superseded_by,
      created_at_epoch: row.created_at_epoch,
      updated_at_epoch: row.updated_at_epoch,
    };
  }

  // === EVENTS ===
  public static async getRecentEvents(worldId: string, limit = 50): Promise<Event[]> {
    const rows = await dbManager.all<any>(
      'SELECT * FROM events WHERE world_id = ? ORDER BY epoch DESC, created_at_epoch DESC LIMIT ?',
      [worldId, limit]
    );
    return rows.map(this.mapRowToEvent);
  }

  public static async saveEvent(worldId: string, evt: Event): Promise<void> {
    await dbManager.run(
      `INSERT INTO events (
        id, world_id, type, description, location_id, involved_entity_ids_json, cause_json, effects_json,
        epoch, resolved, resolution_epoch, created_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        description = excluded.description,
        effects_json = excluded.effects_json,
        resolved = excluded.resolved`,
      [
        evt.id,
        worldId,
        evt.type,
        evt.description,
        evt.location_id || null,
        JSON.stringify(evt.involved_entity_ids || []),
        JSON.stringify(evt.cause || {}),
        JSON.stringify(evt.effects || []),
        evt.epoch,
        evt.resolved ? 1 : 0,
        evt.resolution_epoch || evt.epoch,
        evt.created_at_epoch || evt.epoch,
      ]
    );
  }

  private static mapRowToEvent(row: any): Event {
    return {
      id: row.id,
      type: row.type,
      description: row.description,
      location_id: row.location_id,
      involved_entity_ids: JSON.parse(row.involved_entity_ids_json || '[]'),
      cause: JSON.parse(row.cause_json || '{}'),
      effects: JSON.parse(row.effects_json || '[]'),
      epoch: row.epoch,
      resolved: !!row.resolved,
      resolution_epoch: row.resolution_epoch,
      created_at_epoch: row.created_at_epoch,
    };
  }

  // === STATE CHANGE LOG ===
  public static async logStateChange(log: StateChangeLogEntry): Promise<void> {
    await dbManager.run(
      `INSERT INTO state_change_log (
        id, world_id, epoch, operation, entity_type, entity_id, before_json, after_json, source_type, source_id, committed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        log.id,
        log.world_id,
        log.epoch,
        log.operation,
        log.entity_type,
        log.entity_id || null,
        log.before_state ? JSON.stringify(log.before_state) : null,
        log.after_state ? JSON.stringify(log.after_state) : null,
        log.source_type,
        log.source_id || null,
        log.committed_at,
      ]
    );
  }

  public static async getChangeLogs(worldId: string, limit = 100): Promise<StateChangeLogEntry[]> {
    const rows = await dbManager.all<any>(
      'SELECT * FROM state_change_log WHERE world_id = ? ORDER BY epoch DESC, committed_at DESC LIMIT ?',
      [worldId, limit]
    );
    return rows.map((r) => ({
      id: r.id,
      world_id: r.world_id,
      epoch: r.epoch,
      operation: r.operation,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      before_state: r.before_json ? JSON.parse(r.before_json) : undefined,
      after_state: r.after_json ? JSON.parse(r.after_json) : undefined,
      source_type: r.source_type,
      source_id: r.source_id,
      committed_at: r.committed_at,
    }));
  }

  // === OBSERVED INTERVALS ===
  public static async addObservedInterval(interval: ObservedInterval): Promise<void> {
    await dbManager.run(
      `INSERT INTO observed_intervals (
        id, world_id, player_character_id, location_id, from_epoch, to_epoch, observation_level, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        interval.id,
        interval.world_id,
        interval.player_character_id,
        interval.location_id,
        interval.from_epoch,
        interval.to_epoch || null,
        interval.observation_level,
        JSON.stringify(interval.metadata || {}),
      ]
    );
  }

  public static async getObservedIntervals(worldId: string, locationId?: string): Promise<ObservedInterval[]> {
    let sql = 'SELECT * FROM observed_intervals WHERE world_id = ?';
    const params: any[] = [worldId];
    if (locationId) {
      sql += ' AND location_id = ?';
      params.push(locationId);
    }
    const rows = await dbManager.all<any>(sql, params);
    return rows.map((r) => ({
      id: r.id,
      world_id: r.world_id,
      player_character_id: r.player_character_id,
      location_id: r.location_id,
      from_epoch: r.from_epoch,
      to_epoch: r.to_epoch,
      observation_level: r.observation_level,
      metadata: JSON.parse(r.metadata_json || '{}'),
    }));
  }

  // === LOCATION EDGES ===
  public static async getAllLocationEdges(worldId: string): Promise<LocationEdge[]> {
    const rows = await dbManager.all<any>('SELECT * FROM location_edges WHERE world_id = ?', [worldId]);
    return rows.map(this.mapRowToLocationEdge);
  }

  public static async getLocationEdge(worldId: string, edgeId: string): Promise<LocationEdge | null> {
    const row = await dbManager.get<any>('SELECT * FROM location_edges WHERE world_id = ? AND id = ?', [worldId, edgeId]);
    if (!row) return null;
    return this.mapRowToLocationEdge(row);
  }

  public static async getLocationEdgesFrom(worldId: string, fromLocationId: string): Promise<LocationEdge[]> {
    const rows = await dbManager.all<any>('SELECT * FROM location_edges WHERE world_id = ? AND from_location_id = ?', [worldId, fromLocationId]);
    return rows.map(this.mapRowToLocationEdge);
  }

  public static async saveLocationEdge(worldId: string, edge: LocationEdge): Promise<void> {
    await dbManager.run(
      `INSERT INTO location_edges (
        id, world_id, from_location_id, to_location_id, distance, travel_cost, travel_time_epochs, status, metadata_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        world_id = excluded.world_id,
        from_location_id = excluded.from_location_id,
        to_location_id = excluded.to_location_id,
        distance = excluded.distance,
        travel_cost = excluded.travel_cost,
        travel_time_epochs = excluded.travel_time_epochs,
        status = excluded.status,
        metadata_json = excluded.metadata_json`,
      [
        edge.id,
        worldId,
        edge.from_location_id,
        edge.to_location_id,
        edge.distance ?? 1.0,
        edge.travel_cost ?? 1.0,
        edge.travel_time_epochs ?? 1,
        edge.status || 'OPEN',
        JSON.stringify(edge.metadata || {}),
      ]
    );
  }

  private static mapRowToLocationEdge(r: any): LocationEdge {
    return {
      id: r.id,
      world_id: r.world_id,
      from_location_id: r.from_location_id,
      to_location_id: r.to_location_id,
      distance: r.distance,
      travel_cost: r.travel_cost,
      travel_time_epochs: r.travel_time_epochs,
      status: r.status,
      metadata: r.metadata_json ? JSON.parse(r.metadata_json) : undefined,
    };
  }

  // === WORLD TRANSACTIONS ===
  public static async getAllTransactions(worldId: string): Promise<WorldTransaction[]> {
    const rows = await dbManager.all<any>('SELECT * FROM world_transactions WHERE world_id = ?', [worldId]);
    return rows.map(this.mapRowToTransaction);
  }

  public static async getWorldTransaction(worldId: string, transactionId: string): Promise<WorldTransaction | null> {
    const row = await dbManager.get<any>('SELECT * FROM world_transactions WHERE world_id = ? AND id = ?', [worldId, transactionId]);
    if (!row) return null;
    return this.mapRowToTransaction(row);
  }

  public static async getTransactionsByStatus(worldId: string, statuses: string[]): Promise<WorldTransaction[]> {
    if (statuses.length === 0) return [];
    const placeholders = statuses.map(() => '?').join(',');
    const rows = await dbManager.all<any>(
      `SELECT * FROM world_transactions WHERE world_id = ? AND status IN (${placeholders})`,
      [worldId, ...statuses]
    );
    return rows.map(this.mapRowToTransaction);
  }

  public static async getTransactionsForActor(worldId: string, actorId: string): Promise<WorldTransaction[]> {
    const all = await this.getAllTransactions(worldId);
    return all.filter((tx) => tx.actor_ids.includes(actorId));
  }

  public static async getTransactionsByDestination(worldId: string, locationId: string): Promise<WorldTransaction[]> {
    const rows = await dbManager.all<any>(
      'SELECT * FROM world_transactions WHERE world_id = ? AND destination_location_id = ?',
      [worldId, locationId]
    );
    return rows.map(this.mapRowToTransaction);
  }

  public static async saveWorldTransaction(worldId: string, transaction: WorldTransaction): Promise<void> {
    await this.saveTransaction(transaction);
  }

  public static async saveTransaction(tx: WorldTransaction): Promise<void> {
    await dbManager.run(
      `INSERT INTO world_transactions (
        id, world_id, type, status, actor_ids_json, origin_location_id, destination_location_id,
        route_location_ids_json, start_epoch, expected_end_epoch, completed_epoch, current_checkpoint_index,
        last_valid_location_id, checkpoints_json, preconditions_json, dependency_ids_json, parent_seed_id, parent_organization_id,
        result_json, invalidation_reason, created_at_epoch, updated_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        status = excluded.status,
        expected_end_epoch = excluded.expected_end_epoch,
        completed_epoch = excluded.completed_epoch,
        current_checkpoint_index = excluded.current_checkpoint_index,
        last_valid_location_id = excluded.last_valid_location_id,
        checkpoints_json = excluded.checkpoints_json,
        result_json = excluded.result_json,
        invalidation_reason = excluded.invalidation_reason,
        updated_at_epoch = excluded.updated_at_epoch`,
      [
        tx.id,
        tx.world_id,
        tx.type,
        tx.status,
        JSON.stringify(tx.actor_ids || []),
        tx.origin_location_id || null,
        tx.destination_location_id || null,
        JSON.stringify(tx.route_location_ids || []),
        tx.start_epoch,
        tx.expected_end_epoch,
        tx.completed_epoch ?? null,
        tx.current_checkpoint_index || 0,
        tx.last_valid_location_id || null,
        JSON.stringify(tx.checkpoints || []),
        JSON.stringify(tx.preconditions || []),
        JSON.stringify(tx.dependency_ids || []),
        tx.parent_seed_id || null,
        tx.parent_organization_id || null,
        tx.result ? JSON.stringify(tx.result) : null,
        tx.invalidation_reason || null,
        tx.created_at_epoch,
        tx.updated_at_epoch,
      ]
    );
  }

  private static mapRowToTransaction(r: any): WorldTransaction {
    return {
      id: r.id,
      world_id: r.world_id,
      type: r.type,
      status: r.status,
      actor_ids: JSON.parse(r.actor_ids_json || '[]'),
      origin_location_id: r.origin_location_id,
      destination_location_id: r.destination_location_id,
      route_location_ids: JSON.parse(r.route_location_ids_json || '[]'),
      start_epoch: r.start_epoch,
      expected_end_epoch: r.expected_end_epoch,
      completed_epoch: r.completed_epoch ?? null,
      current_checkpoint_index: r.current_checkpoint_index,
      last_valid_location_id: r.last_valid_location_id || undefined,
      checkpoints: JSON.parse(r.checkpoints_json || '[]'),
      preconditions: JSON.parse(r.preconditions_json || '[]'),
      dependency_ids: JSON.parse(r.dependency_ids_json || '[]'),
      parent_seed_id: r.parent_seed_id,
      parent_organization_id: r.parent_organization_id,
      result: r.result_json ? JSON.parse(r.result_json) : undefined,
      invalidation_reason: r.invalidation_reason,
      created_at_epoch: r.created_at_epoch,
      updated_at_epoch: r.updated_at_epoch,
    };
  }

  // === SCHEDULED CHECKPOINTS ===
  public static async claimCheckpointForProcessing(worldId: string, checkpointId: string): Promise<boolean> {
    const res = await dbManager.run(
      `UPDATE scheduled_checkpoints SET status = 'PROCESSING' WHERE id = ? AND world_id = ? AND status = 'PENDING'`,
      [checkpointId, worldId]
    );
    return (res.changes ?? 0) > 0;
  }

  public static async saveScheduledCheckpoint(worldId: string, checkpoint: ScheduledCheckpoint): Promise<void> {
    await dbManager.run(
      `INSERT INTO scheduled_checkpoints (
        id, world_id, transaction_id, epoch, type, status, sequence, payload_json, created_at_epoch, processed_at_epoch
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        epoch = excluded.epoch,
        status = excluded.status,
        sequence = excluded.sequence,
        payload_json = excluded.payload_json,
        processed_at_epoch = excluded.processed_at_epoch`,
      [
        checkpoint.id,
        worldId,
        checkpoint.transaction_id,
        checkpoint.epoch,
        checkpoint.type,
        checkpoint.status || 'PENDING',
        checkpoint.sequence ?? 0,
        JSON.stringify(checkpoint.payload || {}),
        checkpoint.created_at_epoch,
        checkpoint.processed_at_epoch ?? null,
      ]
    );
  }

  public static async getScheduledCheckpoint(worldId: string, checkpointId: string): Promise<ScheduledCheckpoint | null> {
    const row = await dbManager.get<any>(
      'SELECT * FROM scheduled_checkpoints WHERE world_id = ? AND id = ?',
      [worldId, checkpointId]
    );
    if (!row) return null;
    return this.mapRowToCheckpoint(row);
  }

  public static async getDueCheckpoints(worldId: string, targetEpoch: number): Promise<ScheduledCheckpoint[]> {
    const rows = await dbManager.all<any>(
      'SELECT * FROM scheduled_checkpoints WHERE world_id = ? AND epoch <= ? AND status = ? ORDER BY epoch ASC, sequence ASC, id ASC',
      [worldId, targetEpoch, 'PENDING']
    );
    return rows.map(this.mapRowToCheckpoint);
  }

  public static async getCheckpointsForTransaction(worldId: string, transactionId: string): Promise<ScheduledCheckpoint[]> {
    const rows = await dbManager.all<any>(
      'SELECT * FROM scheduled_checkpoints WHERE world_id = ? AND transaction_id = ? ORDER BY sequence ASC, epoch ASC',
      [worldId, transactionId]
    );
    return rows.map(this.mapRowToCheckpoint);
  }

  public static async updateCheckpointStatus(worldId: string, checkpointId: string, status: string, processedAtEpoch?: number): Promise<void> {
    await dbManager.run(
      'UPDATE scheduled_checkpoints SET status = ?, processed_at_epoch = ? WHERE world_id = ? AND id = ?',
      [status, processedAtEpoch ?? null, worldId, checkpointId]
    );
  }

  private static mapRowToCheckpoint(r: any): ScheduledCheckpoint {
    return {
      id: r.id,
      world_id: r.world_id,
      transaction_id: r.transaction_id,
      epoch: r.epoch,
      type: r.type,
      status: r.status,
      sequence: r.sequence ?? 0,
      payload: r.payload_json ? JSON.parse(r.payload_json) : undefined,
      created_at_epoch: r.created_at_epoch,
      processed_at_epoch: r.processed_at_epoch ?? null,
    };
  }
}
