export type RecorderErrorCode =
  | 'ENTITY_NOT_FOUND'
  | 'WORLD_NOT_FOUND'
  | 'CHARACTER_NOT_FOUND'
  | 'LOCATION_NOT_FOUND'
  | 'ORGANIZATION_NOT_FOUND'
  | 'SEED_NOT_FOUND'
  | 'TRUTH_NOT_FOUND'
  | 'TRANSACTION_NOT_FOUND'
  | 'CHECKPOINT_NOT_FOUND'
  | 'DUPLICATE_ENTITY_ID'
  | 'PRECONDITION_FAILED'
  | 'INVARIANT_FAILED'
  | 'OBSERVED_HISTORY_CONFLICT'
  | 'DATABASE_TRANSACTION_FAILED'
  | 'CACHE_PUBLISH_FAILED';

export class RecorderError extends Error {
  constructor(
    public code: RecorderErrorCode,
    message: string,
    public proposalId?: string
  ) {
    super(message);
    this.name = 'RecorderError';
  }
}
