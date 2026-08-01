import { z } from 'zod';
import { Event } from '../../types';

export const StateChangeOperationEnum = z.enum([
  'CREATE_CHARACTER',
  'UPDATE_CHARACTER',
  'UPDATE_CHARACTER_ATTRIBUTES',
  'MOVE_CHARACTER',
  'CHANGE_RESOURCE',
  'CHANGE_RELATIONSHIP',
  'UPDATE_CHARACTER_KNOWLEDGE',
  'UPDATE_CHARACTER_MEMORY',
  'SET_CHARACTER_ACTION',
  'CREATE_LOCATION',
  'UPDATE_LOCATION',
  'CONNECT_LOCATIONS',
  'UPDATE_ORGANIZATION',
  'CREATE_SEED',
  'UPDATE_SEED',
  'SET_ENTITY_SIMULATION_STATE',
  'ADVANCE_WORLD_EPOCH',
  'CREATE_EVENT',
  'COLLECT_EVIDENCE',
  'REVEAL_TRUTH',
  'CREATE_ENTITY',
  'UPDATE_TRANSACTION',
  'CREATE_TRANSACTION',
  'ADD_FACT',
]);

export type StateChangeOperation = z.infer<typeof StateChangeOperationEnum>;

export const WorldConditionSchema = z.object({
  subjectType: z.enum(['CHARACTER', 'LOCATION', 'ORGANIZATION', 'SEED', 'TRANSACTION', 'FACT', 'TRUTH']),
  subjectId: z.string(),
  field: z.string(),
  operator: z.enum(['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'IN', 'EXISTS']),
  value: z.any(),
});

export type WorldCondition = z.infer<typeof WorldConditionSchema>;

// Payload schemas for operations
export const UpdateCharacterAttributesPayloadSchema = z.object({
  characterId: z.string().optional(),
  hpDelta: z.number().optional(),
  mpDelta: z.number().optional(),
  setHp: z.number().optional(),
  setMp: z.number().optional(),
});

export const ChangeRelationshipPayloadSchema = z.object({
  sourceCharacterId: z.string(),
  targetCharacterId: z.string(),
  trustDelta: z.number().optional(),
  fearDelta: z.number().optional(),
  favorDelta: z.number().optional(),
  relationshipType: z.string().optional(),
});

export const ConnectLocationsPayloadSchema = z.object({
  locationIdA: z.string(),
  locationIdB: z.string(),
});

export const AdvanceWorldEpochPayloadSchema = z.object({
  advanceBy: z.number().int().min(1).optional().default(1),
});

export const SetEntitySimulationStatePayloadSchema = z.object({
  entityType: z.enum(['CHARACTER', 'LOCATION', 'ORGANIZATION']),
  entityId: z.string(),
  frozen: z.boolean().optional(),
  simulationLevel: z.number().optional(),
  lastSimulatedEpoch: z.number().optional(),
});

export const UpdateCharacterKnowledgePayloadSchema = z.object({
  characterId: z.string(),
  knownFact: z.string().optional(),
  knownCharacter: z.string().optional(),
  knownLocation: z.string().optional(),
});

export const UpdateCharacterMemoryPayloadSchema = z.object({
  characterId: z.string(),
  memoryItem: z.object({
    text: z.string(),
    importance: z.number().optional().default(1),
    epoch: z.number().optional(),
  }),
});

export const StateChangeProposalSchema = z.object({
  id: z.string(),
  operation: StateChangeOperationEnum,
  entityType: z.string(),
  entityId: z.string().optional(),
  payload: z.record(z.string(), z.any()),
  effectiveEpoch: z.number().int().min(1),
  preconditions: z.array(WorldConditionSchema).optional().default([]),
  source: z.object({
    type: z.enum(['PLAYER_ACTION', 'DM_ACTION', 'LLM', 'SCHEDULER', 'SIMULATION', 'SYSTEM', 'WORLD_BOOTSTRAP']),
    id: z.string().optional(),
  }),
});

export type StateChangeProposal = z.infer<typeof StateChangeProposalSchema>;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  proposals: StateChangeProposal[];
}

export interface ProposalExecutionResult {
  proposalId: string;
  operation: StateChangeOperation;
  status: 'APPLIED' | 'REJECTED';
  errorCode?: string;
  errorMessage?: string;
}

export interface CommitResult {
  success: boolean;
  committedCount: number;
  appliedProposalIds: string[];
  proposalResults: ProposalExecutionResult[];
  errors: string[];
  warnings?: string[];
  eventsGenerated: Event[];
  epoch: number;
  cacheRecovered?: boolean;
  cacheOutOfSync?: boolean;
}
