import { globalWorld, setRecorderWriteContext } from '../worldState';
import { Character, Location, Organization, Seed, HiddenTruth, Event, WorldSnapshot, StateChangeLogEntry, WorldTransaction, ScheduledCheckpoint } from '../../types';
import { StateChangeProposal } from './changeSchemas';

export interface PreparedCommit {
  worldId: string;
  proposals?: StateChangeProposal[];
  characterWrites: Character[];
  locationWrites: Location[];
  organizationWrites: Organization[];
  seedWrites: Seed[];
  truthWrites: HiddenTruth[];
  transactionWrites: WorldTransaction[];
  checkpointWrites: ScheduledCheckpoint[];
  eventWrites: Event[];
  changeLogs: StateChangeLogEntry[];
  worldSnapshotAfter?: WorldSnapshot;
}

function deepClone<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj;
  return JSON.parse(JSON.stringify(obj));
}

export class CachePublisher {
  public static publish(prepared: PreparedCommit): void {
    setRecorderWriteContext(true);
    try {
      // 1. Snapshot
      if (prepared.worldSnapshotAfter) {
        globalWorld.snapshot.epoch = prepared.worldSnapshotAfter.epoch;
        globalWorld.snapshot.completed_epochs = prepared.worldSnapshotAfter.completed_epochs;
        globalWorld.snapshot.world_name = prepared.worldSnapshotAfter.world_name;
        globalWorld.snapshot.world_description = prepared.worldSnapshotAfter.world_description;
      }

      // 2. Characters
      for (const char of prepared.characterWrites) {
        globalWorld.characters.set(char.id, deepClone(char));
      }

      // 3. Locations
      for (const loc of prepared.locationWrites) {
        globalWorld.locations.set(loc.id, deepClone(loc));
      }

      // 4. Organizations
      for (const org of prepared.organizationWrites) {
        globalWorld.organizations.set(org.id, deepClone(org));
      }

      // 5. Seeds
      for (const seed of prepared.seedWrites) {
        globalWorld.seeds.set(seed.id, deepClone(seed));
      }

      // 6. Hidden Truths
      for (const truth of prepared.truthWrites) {
        globalWorld.hiddenTruths.set(truth.id, deepClone(truth));
      }

      // 7. Events
      for (const evt of prepared.eventWrites) {
        // Prevent duplicate push if already exists
        const exists = globalWorld.events.some((e) => e.id === evt.id);
        if (!exists) {
          globalWorld.events.unshift(deepClone(evt));
        }
      }

      globalWorld.updateStats();
    } finally {
      setRecorderWriteContext(false);
    }
  }
}
