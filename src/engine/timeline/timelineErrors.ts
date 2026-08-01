export type TimelineErrorCode =
  | 'INVALID_ROUTE'
  | 'SAME_ORIGIN_AND_DESTINATION'
  | 'ACTOR_BUSY'
  | 'ACTOR_DEAD'
  | 'ORIGIN_MISMATCH'
  | 'DESTINATION_BLOCKED'
  | 'TRANSACTION_NOT_FOUND'
  | 'CHECKPOINT_MISMATCH'
  | 'PRECONDITION_FAILED'
  | 'TRANSACTION_ALREADY_TERMINATED'
  | 'RECORDER_COMMIT_FAILED';

export class TimelineError extends Error {
  constructor(
    public readonly code: TimelineErrorCode,
    message: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'TimelineError';
    Object.setPrototypeOf(this, TimelineError.prototype);
  }
}
