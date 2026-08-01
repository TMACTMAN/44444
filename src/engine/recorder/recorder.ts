import { dbManager } from '../persistence/database';
import { WorldRepository } from '../world/worldRepository';
import { globalWorld } from '../worldState';
import {
  StateChangeProposal,
  StateChangeProposalSchema,
  ValidationResult,
  CommitResult,
  ProposalExecutionResult,
} from './changeSchemas';
import { PreconditionEvaluator, ObservedHistoryValidator } from './validators';
import { InvariantValidator } from './invariantValidator';
import {
  Event,
  StateChangeLogEntry,
  CharacterStatus,
  Seed,
  EventType,
  EventEffect,
  Character,
  Location,
  Organization,
  HiddenTruth,
  WorldSnapshot,
} from '../../types';
import { RecorderWorkingSet } from './workingSet';
import { RecorderError } from './recorderErrors';
import { BatchInvariantValidator } from './batchInvariantValidator';
import { CachePublisher, PreparedCommit } from './cachePublisher';
import { WorldCacheLoader } from '../world/worldCacheLoader';

function deepClone<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj;
  return JSON.parse(JSON.stringify(obj));
}

export class Recorder {
  private static instance: Recorder;

  private constructor() {}

  public static getInstance(): Recorder {
    if (!Recorder.instance) {
      Recorder.instance = new Recorder();
    }
    return Recorder.instance;
  }

  /**
   * Validate a set of proposed state changes before committing.
   */
  public async validate(
    worldId: string,
    proposals: StateChangeProposal[]
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validatedProposals: StateChangeProposal[] = [];

    for (let i = 0; i < proposals.length; i++) {
      const prop = proposals[i];

      // 1. Zod Schema Validation
      const parseResult = StateChangeProposalSchema.safeParse(prop);
      if (!parseResult.success) {
        errors.push(`Proposal [${i}] Zod parse error: ${parseResult.error.message}`);
        continue;
      }

      const validProposal = parseResult.data;

      // 2. Preconditions Check
      if (validProposal.preconditions && validProposal.preconditions.length > 0) {
        const preCheck = await PreconditionEvaluator.evaluatePreconditions(worldId, validProposal.preconditions);
        if (!preCheck.passed) {
          errors.push(`Proposal [${validProposal.id}] precondition failed: ${preCheck.failedConditions.join('; ')}`);
          continue;
        }
      }

      // 3. Observed History Lock Check
      const historyCheck = await ObservedHistoryValidator.validateProposalAgainstObservedHistory(worldId, validProposal);
      if (!historyCheck.valid) {
        errors.push(`Proposal [${validProposal.id}] observed history error: ${historyCheck.reason}`);
        continue;
      }

      // 4. Invariant Validation
      const invCheck = await InvariantValidator.validateProposalInvariants(worldId, validProposal);
      if (!invCheck.passed) {
        errors.push(`Proposal [${validProposal.id}] invariant error: ${invCheck.error}`);
        continue;
      }

      validatedProposals.push(validProposal);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      proposals: validatedProposals,
    };
  }

  /**
   * Three-stage commit: Prepare -> Persist -> Publish.
   */
  public async commit(
    worldId: string,
    proposals: StateChangeProposal[]
  ): Promise<CommitResult> {
    const valResult = await this.validate(worldId, proposals);
    if (!valResult.valid) {
      return {
        success: false,
        committedCount: 0,
        appliedProposalIds: [],
        proposalResults: proposals.map((p) => ({
          proposalId: p.id,
          operation: p.operation,
          status: 'REJECTED' as const,
          errorMessage: valResult.errors.join('; '),
        })),
        errors: valResult.errors,
        eventsGenerated: [],
        epoch: globalWorld.snapshot.epoch,
      };
    }

    let prepared: PreparedCommit;

    // === STAGE A: PREPARE ===
    try {
      prepared = await this.prepare(worldId, valResult.proposals);
    } catch (err: any) {
      const errorMsg = err.message || 'Prepare phase failed';
      const errorCode = err instanceof RecorderError ? err.code : 'INVARIANT_FAILED';
      return {
        success: false,
        committedCount: 0,
        appliedProposalIds: [],
        proposalResults: valResult.proposals.map((p) => ({
          proposalId: p.id,
          operation: p.operation,
          status: 'REJECTED' as const,
          errorCode,
          errorMessage: errorMsg,
        })),
        errors: [errorMsg],
        eventsGenerated: [],
        epoch: globalWorld.snapshot.epoch,
      };
    }

    // === STAGE B: PERSIST ===
    try {
      await dbManager.transaction(async () => {
        // 1. Entity Writes
        for (const char of prepared.characterWrites) {
          await WorldRepository.saveCharacter(worldId, char);
        }
        for (const loc of prepared.locationWrites) {
          await WorldRepository.saveLocation(worldId, loc);
        }
        for (const org of prepared.organizationWrites) {
          await WorldRepository.saveOrganization(worldId, org);
        }
        for (const seed of prepared.seedWrites) {
          await WorldRepository.saveSeed(worldId, seed);
        }
        for (const truth of prepared.truthWrites) {
          await WorldRepository.saveHiddenTruth(worldId, truth);
        }

        // 2. Events
        for (const evt of prepared.eventWrites) {
          await WorldRepository.saveEvent(worldId, evt);
        }

        // 3. State Change Logs
        for (const log of prepared.changeLogs) {
          await WorldRepository.logStateChange(log);
        }

        // 4. World Snapshot
        if (prepared.worldSnapshotAfter) {
          await WorldRepository.saveWorldSnapshot(prepared.worldSnapshotAfter);
        }
      });
    } catch (err: any) {
      console.error('[Recorder] DB Transaction failed during commit:', err);
      return {
        success: false,
        committedCount: 0,
        appliedProposalIds: [],
        proposalResults: valResult.proposals.map((p) => ({
          proposalId: p.id,
          operation: p.operation,
          status: 'REJECTED' as const,
          errorCode: 'DATABASE_TRANSACTION_FAILED',
          errorMessage: err.message || 'Database transaction error during commit.',
        })),
        errors: [err.message || 'Database transaction error during commit.'],
        eventsGenerated: [],
        epoch: globalWorld.snapshot.epoch,
      };
    }

    // === STAGE C: PUBLISH ===
    const currentEpoch = prepared.worldSnapshotAfter ? prepared.worldSnapshotAfter.epoch : globalWorld.snapshot.epoch;
    try {
      CachePublisher.publish(prepared);
    } catch (publishErr: any) {
      console.error('[Recorder] Cache Publish failed! Triggering automatic database recovery...', publishErr);
      try {
        await WorldCacheLoader.reload(worldId);
        return {
          success: true,
          committedCount: valResult.proposals.length,
          appliedProposalIds: valResult.proposals.map((p) => p.id),
          proposalResults: valResult.proposals.map((p) => ({
            proposalId: p.id,
            operation: p.operation,
            status: 'APPLIED' as const,
          })),
          errors: [],
          warnings: [`Cache publish failed and cache was reloaded from database: ${publishErr.message || publishErr}`],
          eventsGenerated: prepared.eventWrites,
          epoch: currentEpoch,
          cacheRecovered: true,
        };
      } catch (reloadErr: any) {
        console.error('[Recorder] WorldCacheLoader reload failed after cache publish error:', reloadErr);
        return {
          success: true,
          committedCount: valResult.proposals.length,
          appliedProposalIds: valResult.proposals.map((p) => p.id),
          proposalResults: valResult.proposals.map((p) => ({
            proposalId: p.id,
            operation: p.operation,
            status: 'APPLIED' as const,
          })),
          errors: [],
          warnings: [`Cache publish failed (${publishErr.message}) and cache reload failed (${reloadErr.message})`],
          eventsGenerated: prepared.eventWrites,
          epoch: currentEpoch,
          cacheRecovered: false,
          cacheOutOfSync: true,
        };
      }
    }

    return {
      success: true,
      committedCount: valResult.proposals.length,
      appliedProposalIds: valResult.proposals.map((p) => p.id),
      proposalResults: valResult.proposals.map((p) => ({
        proposalId: p.id,
        operation: p.operation,
        status: 'APPLIED' as const,
      })),
      errors: [],
      eventsGenerated: prepared.eventWrites,
      epoch: currentEpoch,
    };
  }

  private async prepare(
    worldId: string,
    proposals: StateChangeProposal[]
  ): Promise<PreparedCommit & { changeLogs: StateChangeLogEntry[] }> {
    const workingSet = new RecorderWorkingSet(worldId);
    const eventWrites: Event[] = [];
    const changeLogs: StateChangeLogEntry[] = [];
    const beforeEpoch = globalWorld.snapshot.epoch;

    let worldSnapshotAfter: WorldSnapshot | undefined;

    for (const prop of proposals) {
      const { operation, entityId, payload, source, effectiveEpoch } = prop;

      let beforeState: any = null;
      let afterState: any = null;

      switch (operation) {
        case 'CREATE_CHARACTER': {
          if (!payload.character) {
            throw new RecorderError('INVARIANT_FAILED', 'CREATE_CHARACTER missing payload.character', prop.id);
          }
          const newChar = payload.character as Character;
          await workingSet.assertCharacterDoesNotExist(newChar.id, prop.id);
          afterState = deepClone(newChar);
          workingSet.addCharacter(newChar);
          break;
        }

        case 'UPDATE_CHARACTER': {
          const charId = (entityId || payload.id || payload.characterId) as string;
          const char = await workingSet.getCharacter(charId);
          beforeState = deepClone(char);

          if (payload.name) char.name = String(payload.name);
          if (payload.title) char.title = String(payload.title);
          if (payload.status) char.status = payload.status as CharacterStatus;
          if (payload.location_id) char.location_id = String(payload.location_id);
          if (payload.skills && typeof payload.skills === 'object') char.skills = { ...char.skills, ...payload.skills };
          if (payload.attributes && typeof payload.attributes === 'object') char.attributes = { ...char.attributes, ...payload.attributes };
          if (payload.resources && typeof payload.resources === 'object') char.resources = { ...char.resources, ...payload.resources };
          if (payload.goal && typeof payload.goal === 'object') char.goal = { ...char.goal, ...payload.goal };
          if (Array.isArray(payload.inventory)) char.inventory = payload.inventory as any;
          if (payload.current_action && typeof payload.current_action === 'object') char.current_action = payload.current_action as any;
          char.updated_at_epoch = effectiveEpoch;

          workingSet.markCharacterDirty(char.id);
          afterState = deepClone(char);
          break;
        }

        case 'UPDATE_CHARACTER_ATTRIBUTES': {
          const charId = (entityId || payload.characterId) as string;
          const char = await workingSet.getCharacter(charId);
          beforeState = deepClone(char.attributes);

          if (typeof payload.hpDelta === 'number') {
            char.attributes.hp = Math.max(0, Math.min(char.attributes.max_hp, char.attributes.hp + payload.hpDelta));
          }
          if (typeof payload.mpDelta === 'number') {
            char.attributes.mp = Math.max(0, Math.min(char.attributes.max_mp, char.attributes.mp + payload.mpDelta));
          }
          if (typeof payload.setHp === 'number') {
            char.attributes.hp = Math.max(0, Math.min(char.attributes.max_hp, payload.setHp));
          }
          if (typeof payload.setMp === 'number') {
            char.attributes.mp = Math.max(0, Math.min(char.attributes.max_mp, payload.setMp));
          }
          char.updated_at_epoch = effectiveEpoch;
          workingSet.markCharacterDirty(char.id);
          afterState = deepClone(char.attributes);
          break;
        }

        case 'MOVE_CHARACTER': {
          const charId = (entityId || payload.characterId) as string;
          const targetLocId = (payload.targetLocationId || payload.locationId) as string;

          const char = await workingSet.getCharacter(charId);
          const loc = await workingSet.getLocation(targetLocId);

          beforeState = { location_id: char.location_id, current_action: char.current_action };
          char.location_id = loc.id;
          char.current_action = {
            type: 'TRAVEL',
            description: String(payload.description || `移动至地点 [${loc.name || loc.id}]`),
            started_at_epoch: effectiveEpoch,
            estimated_end_epoch: effectiveEpoch + 1,
          };
          char.updated_at_epoch = effectiveEpoch;
          workingSet.markCharacterDirty(char.id);
          afterState = { location_id: char.location_id, current_action: char.current_action };

          const evt: Event = {
            id: `evt-move-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'SOCIAL',
            description: `${char.name} 移动到了【${loc.name || targetLocId}】`,
            location_id: loc.id,
            involved_entity_ids: [char.id],
            cause: { type: source.type, source_id: source.id },
            effects: [],
            epoch: effectiveEpoch,
            resolved: true,
            resolution_epoch: effectiveEpoch,
            created_at_epoch: effectiveEpoch,
          };
          eventWrites.push(evt);
          break;
        }

        case 'CHANGE_RESOURCE': {
          const charId = (entityId || payload.characterId) as string;
          const char = await workingSet.getCharacter(charId);
          beforeState = { resources: deepClone(char.resources) };

          const goldDelta = Number(payload.goldDelta || 0);
          const repDelta = Number(payload.reputationDelta || 0);

          if (goldDelta) {
            const nextGold = char.resources.gold + goldDelta;
            if (nextGold < 0) {
              throw new RecorderError(
                'INVARIANT_FAILED',
                `Gold cannot become negative (${char.resources.gold} + ${goldDelta} = ${nextGold})`,
                prop.id
              );
            }
            char.resources.gold = nextGold;
          }

          if (repDelta) {
            char.resources.reputation += repDelta;
          }

          workingSet.markCharacterDirty(char.id);
          afterState = { resources: deepClone(char.resources) };
          break;
        }

        case 'CHANGE_RELATIONSHIP': {
          const sourceId = (entityId || payload.sourceCharacterId) as string;
          const targetId = payload.targetCharacterId as string;

          const char = await workingSet.getCharacter(sourceId);

          beforeState = deepClone(char.relationships);
          let rel = char.relationships.find((r) => r.target_id === targetId);
          if (!rel) {
            let targetName = targetId;
            try {
              const targetChar = await workingSet.getCharacter(targetId);
              targetName = targetChar.name;
            } catch {
              // Ignore if target is not a full character record
            }
            rel = {
              target_id: targetId,
              target_name: targetName,
              type: 'NEUTRAL',
              trust: 50,
              fear: 0,
              favor: 50,
              last_interaction_epoch: effectiveEpoch,
            };
            char.relationships.push(rel);
          }

          if (typeof payload.trustDelta === 'number') {
            rel.trust = Math.max(0, Math.min(100, rel.trust + payload.trustDelta));
          }
          if (typeof payload.fearDelta === 'number') {
            rel.fear = Math.max(0, Math.min(100, rel.fear + payload.fearDelta));
          }
          if (typeof payload.favorDelta === 'number') {
            rel.favor = Math.max(0, Math.min(100, rel.favor + payload.favorDelta));
          }
          rel.last_interaction_epoch = effectiveEpoch;
          workingSet.markCharacterDirty(char.id);
          afterState = deepClone(char.relationships);
          break;
        }

        case 'UPDATE_CHARACTER_KNOWLEDGE': {
          const charId = (entityId || payload.characterId) as string;
          const char = await workingSet.getCharacter(charId);
          beforeState = { knowledge: deepClone(char.knowledge) };

          if (payload.knownLocation && !char.knowledge.known_locations.includes(payload.knownLocation)) {
            char.knowledge.known_locations.push(payload.knownLocation);
          }
          if (payload.knownCharacter && !char.knowledge.known_characters.includes(payload.knownCharacter)) {
            char.knowledge.known_characters.push(payload.knownCharacter);
          }
          if (payload.knownFact && !char.knowledge.known_facts.includes(payload.knownFact)) {
            char.knowledge.known_facts.push(payload.knownFact);
          }
          workingSet.markCharacterDirty(char.id);
          afterState = { knowledge: deepClone(char.knowledge) };
          break;
        }

        case 'UPDATE_CHARACTER_MEMORY': {
          const charId = (entityId || payload.characterId) as string;
          const char = await workingSet.getCharacter(charId);
          if (!payload.memoryItem) {
            throw new RecorderError('INVARIANT_FAILED', 'UPDATE_CHARACTER_MEMORY missing payload.memoryItem', prop.id);
          }
          beforeState = { memoryCount: char.memory.short_term.length };
          char.memory.short_term.push({
            text: String(payload.memoryItem.text),
            importance: Number(payload.memoryItem.importance || 1),
            epoch: Number(payload.memoryItem.epoch || effectiveEpoch),
          });
          workingSet.markCharacterDirty(char.id);
          afterState = { memoryCount: char.memory.short_term.length };
          break;
        }

        case 'SET_CHARACTER_ACTION': {
          const charId = (entityId || payload.characterId) as string;
          const char = await workingSet.getCharacter(charId);
          if (!payload.action) {
            throw new RecorderError('INVARIANT_FAILED', 'SET_CHARACTER_ACTION missing payload.action', prop.id);
          }
          beforeState = { current_action: char.current_action };
          char.current_action = payload.action;
          workingSet.markCharacterDirty(char.id);
          afterState = { current_action: char.current_action };
          break;
        }

        case 'CREATE_LOCATION': {
          if (!payload.location) {
            throw new RecorderError('INVARIANT_FAILED', 'CREATE_LOCATION missing payload.location', prop.id);
          }
          const loc = payload.location as Location;
          await workingSet.assertLocationDoesNotExist(loc.id, prop.id);
          afterState = deepClone(loc);
          workingSet.addLocation(loc);

          for (const connId of loc.connected_to) {
            try {
              const connLoc = await workingSet.getLocation(connId);
              if (!connLoc.connected_to.includes(loc.id)) {
                connLoc.connected_to.push(loc.id);
                workingSet.markLocationDirty(connLoc.id);
              }
            } catch {
              // Ignore missing targets here; BatchInvariantValidator will catch non-existent target locations
            }
          }
          break;
        }

        case 'UPDATE_LOCATION': {
          const locId = (entityId || payload.locationId) as string;
          const loc = await workingSet.getLocation(locId);
          beforeState = deepClone(loc);

          if (payload.name) loc.name = String(payload.name);
          if (payload.description) loc.description = String(payload.description);
          if (payload.security && typeof payload.security === 'object') loc.security = { ...loc.security, ...payload.security };
          if (payload.population_trend) loc.population_trend = payload.population_trend;
          loc.updated_at_epoch = effectiveEpoch;

          workingSet.markLocationDirty(loc.id);
          afterState = deepClone(loc);
          break;
        }

        case 'CONNECT_LOCATIONS': {
          const locAId = payload.locationIdA as string;
          const locBId = payload.locationIdB as string;

          const locA = await workingSet.getLocation(locAId);
          const locB = await workingSet.getLocation(locBId);

          if (!locA.connected_to.includes(locBId)) locA.connected_to.push(locBId);
          if (!locB.connected_to.includes(locAId)) locB.connected_to.push(locAId);
          workingSet.markLocationDirty(locA.id);
          workingSet.markLocationDirty(locB.id);
          break;
        }

        case 'UPDATE_ORGANIZATION': {
          const orgId = (entityId || payload.organizationId) as string;
          const org = await workingSet.getOrganization(orgId);
          beforeState = deepClone(org);

          if (payload.name) org.name = String(payload.name);
          if (payload.description) org.description = String(payload.description);
          workingSet.markOrganizationDirty(org.id);
          afterState = deepClone(org);
          break;
        }

        case 'CREATE_SEED': {
          if (!payload.seed) {
            throw new RecorderError('INVARIANT_FAILED', 'CREATE_SEED missing payload.seed', prop.id);
          }
          const newSeed = payload.seed as Seed;
          await workingSet.assertSeedDoesNotExist(newSeed.id, prop.id);
          afterState = deepClone(newSeed);
          workingSet.addSeed(newSeed);
          break;
        }

        case 'UPDATE_SEED': {
          const seedId = (entityId || payload.seedId) as string;
          const seed = await workingSet.getSeed(seedId);
          beforeState = deepClone(seed);

          if (payload.status) seed.status = payload.status as any;
          if (typeof payload.progress === 'number') seed.progress = payload.progress;
          seed.updated_at_epoch = effectiveEpoch;

          workingSet.markSeedDirty(seed.id);
          afterState = deepClone(seed);
          break;
        }

        case 'SET_ENTITY_SIMULATION_STATE': {
          const eType = payload.entityType || prop.entityType;
          const eId = (entityId || payload.entityId) as string;
          if (eType === 'CHARACTER') {
            const char = await workingSet.getCharacter(eId);
            beforeState = { frozen: char.frozen, last_simulated_epoch: char.last_simulated_epoch };
            if (typeof payload.frozen === 'boolean') char.frozen = payload.frozen;
            if (typeof payload.lastSimulatedEpoch === 'number') char.last_simulated_epoch = payload.lastSimulatedEpoch;
            workingSet.markCharacterDirty(char.id);
            afterState = { frozen: char.frozen, last_simulated_epoch: char.last_simulated_epoch };
          }
          break;
        }

        case 'ADVANCE_WORLD_EPOCH': {
          beforeState = { epoch: beforeEpoch };
          const advanceBy = Number(payload.advanceBy || 1);

          if (!worldSnapshotAfter) {
            worldSnapshotAfter = deepClone(globalWorld.snapshot);
          }
          worldSnapshotAfter.epoch += advanceBy;
          worldSnapshotAfter.completed_epochs = worldSnapshotAfter.epoch;

          afterState = { epoch: worldSnapshotAfter.epoch };
          break;
        }

        case 'REVEAL_TRUTH': {
          const truthId = (entityId || payload.truthId) as string;
          const truth = await workingSet.getTruth(truthId);
          beforeState = { revealed: truth.revealed, revealed_to_ids: [...truth.revealed_to_ids] };

          if (truth.never_changes) {
            if (
              payload.modifyTrueNature ||
              (payload.true_nature && payload.true_nature !== truth.true_nature) ||
              (payload.exists_flag !== undefined && payload.exists_flag !== truth.exists)
            ) {
              throw new RecorderError('INVARIANT_FAILED', `HiddenTruth [${truthId}] is immutable (never_changes = true)`, prop.id);
            }
          }

          truth.revealed = true;
          const revealerId = String(payload.revealerId || 'pc-player');
          if (!truth.revealed_to_ids.includes(revealerId)) {
            truth.revealed_to_ids.push(revealerId);
          }
          workingSet.markTruthDirty(truth.id);
          afterState = { revealed: truth.revealed, revealed_to_ids: [...truth.revealed_to_ids] };

          const evt: Event = {
            id: `evt-truth-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: 'TRUTH_REVEALED',
            description: `揭开真相：【${truth.title}】— ${truth.true_nature}`,
            location_id: payload.locationId ? String(payload.locationId) : undefined,
            involved_entity_ids: [revealerId],
            cause: { type: source.type, source_id: source.id },
            effects: [],
            epoch: effectiveEpoch,
            resolved: true,
            resolution_epoch: effectiveEpoch,
            created_at_epoch: effectiveEpoch,
          };
          eventWrites.push(evt);
          break;
        }

        case 'COLLECT_EVIDENCE': {
          const truthId = (entityId || payload.truthId) as string;
          const evidence = String(payload.evidenceName || '');
          const truth = await workingSet.getTruth(truthId);
          beforeState = { evidence_collected: [...truth.evidence_collected] };
          if (evidence && !truth.evidence_collected.includes(evidence)) {
            truth.evidence_collected.push(evidence);
          }
          workingSet.markTruthDirty(truth.id);
          afterState = { evidence_collected: [...truth.evidence_collected] };
          break;
        }

        case 'CREATE_EVENT': {
          const evt: Event = {
            id: prop.id || `evt-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
            type: (payload.type || 'SOCIAL') as EventType,
            description: String(payload.description || ''),
            location_id: payload.location_id ? String(payload.location_id) : undefined,
            involved_entity_ids: Array.isArray(payload.involved_entity_ids) ? payload.involved_entity_ids : [],
            cause: { type: source.type, source_id: source.id },
            effects: Array.isArray(payload.effects) ? (payload.effects as EventEffect[]) : [],
            epoch: effectiveEpoch,
            resolved: true,
            resolution_epoch: effectiveEpoch,
            created_at_epoch: effectiveEpoch,
          };
          afterState = evt;
          eventWrites.push(evt);
          break;
        }

        default:
          afterState = payload;
          break;
      }

      const logEntry: StateChangeLogEntry = {
        id: `sclog-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        world_id: worldId,
        epoch: effectiveEpoch,
        operation,
        entity_type: prop.entityType,
        entity_id: entityId || prop.id,
        before_state: beforeState,
        after_state: afterState,
        source_type: source.type,
        source_id: source.id,
        committed_at: new Date().toISOString(),
      };
      changeLogs.push(logEntry);
    }

    // Batch Invariant Check on the final working set
    const finalSnapshot = worldSnapshotAfter || deepClone(globalWorld.snapshot);
    await BatchInvariantValidator.validateBatch(workingSet, finalSnapshot, beforeEpoch);

    return {
      worldId,
      proposals,
      characterWrites: workingSet.getDirtyCharacters(),
      locationWrites: workingSet.getDirtyLocations(),
      organizationWrites: workingSet.getDirtyOrganizations(),
      seedWrites: workingSet.getDirtySeeds(),
      truthWrites: workingSet.getDirtyTruths(),
      eventWrites,
      changeLogs,
      worldSnapshotAfter,
    };
  }
}

export const recorder = Recorder.getInstance();
