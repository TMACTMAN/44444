import { WorldTransaction } from '../../types';
import { TimelineError } from './timelineErrors';

export type TransactionStatus =
  | 'PLANNED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED'
  | 'INVALIDATED';

const VALID_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  PLANNED: ['IN_PROGRESS', 'CANCELLED', 'INVALIDATED'],
  IN_PROGRESS: ['COMPLETED', 'FAILED', 'CANCELLED', 'INVALIDATED'],
  COMPLETED: [],
  FAILED: [],
  CANCELLED: [],
  INVALIDATED: [],
};

export class TransactionStateMachine {
  public static canTransition(current: TransactionStatus, target: TransactionStatus): boolean {
    const allowed = VALID_TRANSITIONS[current] || [];
    return allowed.includes(target);
  }

  public static assertCanTransition(transaction: WorldTransaction, target: TransactionStatus): void {
    const current = transaction.status as TransactionStatus;
    if (!this.canTransition(current, target)) {
      throw new TimelineError(
        'TRANSACTION_ALREADY_TERMINATED',
        `Transaction [${transaction.id}] cannot transition from [${current}] to [${target}]`
      );
    }
  }

  public static isTerminal(status: string): boolean {
    return ['COMPLETED', 'FAILED', 'CANCELLED', 'INVALIDATED'].includes(status);
  }
}
