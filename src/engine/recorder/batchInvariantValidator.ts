import { RecorderWorkingSet } from './workingSet';
import { WorldSnapshot } from '../../types';
import { RecorderError } from './recorderErrors';

function deepEqual(a: any, b: any): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export class BatchInvariantValidator {
  public static async validateBatch(
    workingSet: RecorderWorkingSet,
    worldSnapshotAfter: WorldSnapshot,
    beforeSnapshotEpoch: number
  ): Promise<void> {
    // 10. World Epoch 不倒退
    if (worldSnapshotAfter.epoch < beforeSnapshotEpoch) {
      throw new RecorderError(
        'INVARIANT_FAILED',
        `World epoch cannot regress from ${beforeSnapshotEpoch} to ${worldSnapshotAfter.epoch}`
      );
    }

    // Check Dirty Characters
    const dirtyChars = workingSet.getDirtyCharacters();
    for (const char of dirtyChars) {
      // 1. HP / MP 范围校验 (0 <= hp <= max_hp, 0 <= mp <= max_mp)
      if (typeof char.attributes?.hp === 'number') {
        if (char.attributes.hp < 0 || char.attributes.hp > char.attributes.max_hp) {
          throw new RecorderError(
            'INVARIANT_FAILED',
            `Character [${char.id}] HP (${char.attributes.hp}) out of bounds [0, ${char.attributes.max_hp}]`
          );
        }
      }
      if (typeof char.attributes?.mp === 'number') {
        if (char.attributes.mp < 0 || char.attributes.mp > char.attributes.max_mp) {
          throw new RecorderError(
            'INVARIANT_FAILED',
            `Character [${char.id}] MP (${char.attributes.mp}) out of bounds [0, ${char.attributes.max_mp}]`
          );
        }
      }

      // 6. Character 金币资源非负
      if (typeof char.resources?.gold === 'number' && char.resources.gold < 0) {
        throw new RecorderError('INVARIANT_FAILED', `Character [${char.id}] Gold cannot be negative (${char.resources.gold})`);
      }

      // 2. Character 所在地点存在
      if (char.location_id) {
        const locExists = await workingSet.hasLocation(char.location_id);
        if (!locExists) {
          throw new RecorderError(
            'INVARIANT_FAILED',
            `Character [${char.id}] located in non-existent location [${char.location_id}]`
          );
        }
      }

      // 9. 死亡角色不可获得新行动
      if (char.status === 'DEAD' && char.current_action && char.current_action.type !== 'IDLE' && char.current_action.type !== 'NONE') {
        throw new RecorderError(
          'INVARIANT_FAILED',
          `Dead character [${char.id}] cannot execute action [${char.current_action.type}]`
        );
      }
    }

    // Check Dirty Locations
    const dirtyLocs = workingSet.getDirtyLocations();
    for (const loc of dirtyLocs) {
      // 重复连接检查
      const uniqueConns = new Set(loc.connected_to);
      if (uniqueConns.size !== loc.connected_to.length) {
        throw new RecorderError('INVARIANT_FAILED', `Location [${loc.id}] has duplicate connections`);
      }

      for (const connId of loc.connected_to) {
        // 自连接检查
        if (connId === loc.id) {
          throw new RecorderError('INVARIANT_FAILED', `Location [${loc.id}] cannot connect to itself`);
        }

        // 目标地点存在检查
        const connExists = await workingSet.hasLocation(connId);
        if (!connExists) {
          throw new RecorderError(
            'INVARIANT_FAILED',
            `Location [${loc.id}] connected to non-existent location [${connId}]`
          );
        }

        // 双向连接性检查
        const targetLoc = await workingSet.getLocation(connId);
        if (!targetLoc.connected_to.includes(loc.id)) {
          throw new RecorderError(
            'INVARIANT_FAILED',
            `Location connection must be bi-directional: [${loc.id}] -> [${connId}] exists but reverse does not`
          );
        }
      }
    }

    // Check Dirty Seeds
    const dirtySeeds = workingSet.getDirtySeeds();
    for (const seed of dirtySeeds) {
      // Seed progress 范围校验 0 <= progress <= 1
      if (typeof seed.progress === 'number' && (seed.progress < 0 || seed.progress > 1)) {
        throw new RecorderError(
          'INVARIANT_FAILED',
          `Seed [${seed.id}] progress must be between 0 and 1, got ${seed.progress}`
        );
      }
    }

    // Check Dirty Hidden Truths (Immutable fields protection)
    const dirtyTruths = workingSet.getDirtyTruths();
    for (const truth of dirtyTruths) {
      if (truth.never_changes) {
        // If immutable, verify immutable fields against repository version
        try {
          const original = await workingSet.getTruth(truth.id);
          const immutableFields = ['exists', 'true_nature', 'true_owner_id', 'true_goal', 'locked_at_epoch', 'never_changes'] as const;
          for (const field of immutableFields) {
            if (!deepEqual(original[field], truth[field])) {
              throw new RecorderError('INVARIANT_FAILED', `Immutable Hidden Truth field changed: ${field}`);
            }
          }
        } catch (err: any) {
          if (err instanceof RecorderError) throw err;
        }
      }
    }
  }
}

