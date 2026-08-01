import { WorldRepository } from '../world/worldRepository';
import { CheckpointProcessor, CheckpointProcessResult } from './checkpointProcessor';

export interface TimelineProcessSummary {
  worldId: string;
  startEpoch: number;
  targetEpoch: number;
  processedCheckpoints: number;
  completedTransactions: string[];
  failedTransactions: string[];
  eventsGeneratedCount: number;
}

export class GlobalTimeline {
  /**
   * Sequentially process all due timeline checkpoints from current epoch up to targetEpoch.
   * Guarantees strict ordering by epoch and checkpoint sequence.
   */
  public static async processUntil(
    worldId: string,
    targetEpoch: number
  ): Promise<TimelineProcessSummary> {
    const snapshot = await WorldRepository.getWorldSnapshot(worldId);
    const startEpoch = snapshot ? snapshot.epoch : 1;

    let totalProcessed = 0;
    const completedTransactions: string[] = [];
    const failedTransactions: string[] = [];
    let eventsGeneratedCount = 0;

    // Advance epoch step-by-step from startEpoch to targetEpoch
    for (let ep = Math.min(startEpoch, targetEpoch); ep <= targetEpoch; ep++) {
      const res: CheckpointProcessResult = await CheckpointProcessor.processDueCheckpoints(worldId, ep);
      totalProcessed += res.processedCount;
      completedTransactions.push(...res.completedTransactions);
      failedTransactions.push(...res.failedTransactions);
      eventsGeneratedCount += res.eventsGenerated.length;
    }

    return {
      worldId,
      startEpoch,
      targetEpoch,
      processedCheckpoints: totalProcessed,
      completedTransactions,
      failedTransactions,
      eventsGeneratedCount,
    };
  }
}
