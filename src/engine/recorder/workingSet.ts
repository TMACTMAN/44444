import { Character, Location, Organization, Seed, HiddenTruth, WorldSnapshot } from '../../types';
import { WorldRepository } from '../world/worldRepository';
import { RecorderError } from './recorderErrors';
import { globalWorld } from '../worldState';

function deepClone<T>(obj: T): T {
  if (obj === undefined || obj === null) return obj;
  return JSON.parse(JSON.stringify(obj));
}

export class RecorderWorkingSet {
  private characters = new Map<string, Character>();
  private locations = new Map<string, Location>();
  private organizations = new Map<string, Organization>();
  private seeds = new Map<string, Seed>();
  private truths = new Map<string, HiddenTruth>();

  private originalCharacters = new Map<string, Character>();
  private originalLocations = new Map<string, Location>();
  private originalOrganizations = new Map<string, Organization>();
  private originalSeeds = new Map<string, Seed>();
  private originalTruths = new Map<string, HiddenTruth>();

  private originalSnapshot?: WorldSnapshot;
  private workingSnapshot?: WorldSnapshot;

  private dirtyCharacterIds = new Set<string>();
  private dirtyLocationIds = new Set<string>();
  private dirtyOrganizationIds = new Set<string>();
  private dirtySeedIds = new Set<string>();
  private dirtyTruthIds = new Set<string>();

  constructor(public readonly worldId: string) {}

  public async getWorldSnapshot(): Promise<WorldSnapshot> {
    if (this.workingSnapshot) {
      return this.workingSnapshot;
    }
    const fromRepo = await WorldRepository.getWorldSnapshot(this.worldId);
    if (!fromRepo) {
      throw new RecorderError('WORLD_NOT_FOUND', `World snapshot [${this.worldId}] not found in database Repository`);
    }
    const snapshot = deepClone(fromRepo);
    this.originalSnapshot = deepClone(snapshot);
    this.workingSnapshot = deepClone(snapshot);
    return this.workingSnapshot;
  }

  public getOriginalWorldSnapshot(): WorldSnapshot | undefined {
    return this.originalSnapshot;
  }

  public async getCharacter(id: string): Promise<Character> {
    if (this.characters.has(id)) {
      return this.characters.get(id)!;
    }
    const fromRepo = await WorldRepository.getCharacter(this.worldId, id);
    if (!fromRepo) {
      throw new RecorderError('CHARACTER_NOT_FOUND', `Character [${id}] not found in world [${this.worldId}]`);
    }
    const origCopy = deepClone(fromRepo);
    const workCopy = deepClone(fromRepo);
    this.originalCharacters.set(id, origCopy);
    this.characters.set(id, workCopy);
    return workCopy;
  }

  public getOriginalCharacter(id: string): Character | undefined {
    return this.originalCharacters.get(id);
  }

  public markCharacterDirty(id: string): void {
    this.dirtyCharacterIds.add(id);
  }

  public addCharacter(char: Character): Character {
    const copy = deepClone(char);
    this.characters.set(copy.id, copy);
    this.dirtyCharacterIds.add(copy.id);
    return copy;
  }

  public async assertCharacterDoesNotExist(id: string, proposalId?: string): Promise<void> {
    if (this.characters.has(id)) {
      throw new RecorderError('DUPLICATE_ENTITY_ID', `Character [${id}] already exists`, proposalId);
    }
    const fromRepo = await WorldRepository.getCharacter(this.worldId, id);
    if (fromRepo) {
      throw new RecorderError('DUPLICATE_ENTITY_ID', `Character [${id}] already exists`, proposalId);
    }
  }

  public async getLocation(id: string): Promise<Location> {
    if (this.locations.has(id)) {
      return this.locations.get(id)!;
    }
    const fromRepo = await WorldRepository.getLocation(this.worldId, id);
    if (!fromRepo) {
      throw new RecorderError('LOCATION_NOT_FOUND', `Location [${id}] not found in world [${this.worldId}]`);
    }
    const origCopy = deepClone(fromRepo);
    const workCopy = deepClone(fromRepo);
    this.originalLocations.set(id, origCopy);
    this.locations.set(id, workCopy);
    return workCopy;
  }

  public getOriginalLocation(id: string): Location | undefined {
    return this.originalLocations.get(id);
  }

  public markLocationDirty(id: string): void {
    this.dirtyLocationIds.add(id);
  }

  public addLocation(loc: Location): Location {
    const copy = deepClone(loc);
    this.locations.set(copy.id, copy);
    this.dirtyLocationIds.add(copy.id);
    return copy;
  }

  public async assertLocationDoesNotExist(id: string, proposalId?: string): Promise<void> {
    if (this.locations.has(id)) {
      throw new RecorderError('DUPLICATE_ENTITY_ID', `Location [${id}] already exists`, proposalId);
    }
    const fromRepo = await WorldRepository.getLocation(this.worldId, id);
    if (fromRepo) {
      throw new RecorderError('DUPLICATE_ENTITY_ID', `Location [${id}] already exists`, proposalId);
    }
  }

  public async getOrganization(id: string): Promise<Organization> {
    if (this.organizations.has(id)) {
      return this.organizations.get(id)!;
    }
    const fromRepo = await WorldRepository.getOrganization(this.worldId, id);
    if (!fromRepo) {
      throw new RecorderError('ORGANIZATION_NOT_FOUND', `Organization [${id}] not found in world [${this.worldId}]`);
    }
    const origCopy = deepClone(fromRepo);
    const workCopy = deepClone(fromRepo);
    this.originalOrganizations.set(id, origCopy);
    this.organizations.set(id, workCopy);
    return workCopy;
  }

  public getOriginalOrganization(id: string): Organization | undefined {
    return this.originalOrganizations.get(id);
  }

  public markOrganizationDirty(id: string): void {
    this.dirtyOrganizationIds.add(id);
  }

  public addOrganization(org: Organization): Organization {
    const copy = deepClone(org);
    this.organizations.set(copy.id, copy);
    this.dirtyOrganizationIds.add(copy.id);
    return copy;
  }

  public async assertOrganizationDoesNotExist(id: string, proposalId?: string): Promise<void> {
    if (this.organizations.has(id)) {
      throw new RecorderError('DUPLICATE_ENTITY_ID', `Organization [${id}] already exists`, proposalId);
    }
    const fromRepo = await WorldRepository.getOrganization(this.worldId, id);
    if (fromRepo) {
      throw new RecorderError('DUPLICATE_ENTITY_ID', `Organization [${id}] already exists`, proposalId);
    }
  }

  public async getSeed(id: string): Promise<Seed> {
    if (this.seeds.has(id)) {
      return this.seeds.get(id)!;
    }
    const fromRepo = await WorldRepository.getSeed(this.worldId, id);
    if (!fromRepo) {
      throw new RecorderError('SEED_NOT_FOUND', `Seed [${id}] not found in world [${this.worldId}]`);
    }
    const origCopy = deepClone(fromRepo);
    const workCopy = deepClone(fromRepo);
    this.originalSeeds.set(id, origCopy);
    this.seeds.set(id, workCopy);
    return workCopy;
  }

  public getOriginalSeed(id: string): Seed | undefined {
    return this.originalSeeds.get(id);
  }

  public markSeedDirty(id: string): void {
    this.dirtySeedIds.add(id);
  }

  public addSeed(seed: Seed): Seed {
    const copy = deepClone(seed);
    this.seeds.set(copy.id, copy);
    this.dirtySeedIds.add(copy.id);
    return copy;
  }

  public async assertSeedDoesNotExist(id: string, proposalId?: string): Promise<void> {
    if (this.seeds.has(id)) {
      throw new RecorderError('DUPLICATE_ENTITY_ID', `Seed [${id}] already exists`, proposalId);
    }
    const fromRepo = await WorldRepository.getSeed(this.worldId, id);
    if (fromRepo) {
      throw new RecorderError('DUPLICATE_ENTITY_ID', `Seed [${id}] already exists`, proposalId);
    }
  }

  public async getTruth(id: string): Promise<HiddenTruth> {
    if (this.truths.has(id)) {
      return this.truths.get(id)!;
    }
    const fromRepo = await WorldRepository.getHiddenTruth(this.worldId, id);
    if (!fromRepo) {
      throw new RecorderError('TRUTH_NOT_FOUND', `HiddenTruth [${id}] not found in world [${this.worldId}]`);
    }
    const origCopy = deepClone(fromRepo);
    const workCopy = deepClone(fromRepo);
    this.originalTruths.set(id, origCopy);
    this.truths.set(id, workCopy);
    return workCopy;
  }

  public getOriginalTruth(id: string): HiddenTruth | undefined {
    return this.originalTruths.get(id);
  }

  public markTruthDirty(id: string): void {
    this.dirtyTruthIds.add(id);
  }

  public addTruth(truth: HiddenTruth): HiddenTruth {
    const copy = deepClone(truth);
    this.truths.set(copy.id, copy);
    this.dirtyTruthIds.add(copy.id);
    return copy;
  }

  public async assertTruthDoesNotExist(id: string, proposalId?: string): Promise<void> {
    if (this.truths.has(id)) {
      throw new RecorderError('DUPLICATE_ENTITY_ID', `HiddenTruth [${id}] already exists`, proposalId);
    }
    const fromRepo = await WorldRepository.getHiddenTruth(this.worldId, id);
    if (fromRepo) {
      throw new RecorderError('DUPLICATE_ENTITY_ID', `HiddenTruth [${id}] already exists`, proposalId);
    }
  }

  public getDirtyCharacters(): Character[] {
    return Array.from(this.dirtyCharacterIds).map((id) => this.characters.get(id)!);
  }

  public getDirtyLocations(): Location[] {
    return Array.from(this.dirtyLocationIds).map((id) => this.locations.get(id)!);
  }

  public getDirtyOrganizations(): Organization[] {
    return Array.from(this.dirtyOrganizationIds).map((id) => this.organizations.get(id)!);
  }

  public getDirtySeeds(): Seed[] {
    return Array.from(this.dirtySeedIds).map((id) => this.seeds.get(id)!);
  }

  public getDirtyTruths(): HiddenTruth[] {
    return Array.from(this.dirtyTruthIds).map((id) => this.truths.get(id)!);
  }

  public async hasLocation(id: string): Promise<boolean> {
    if (this.locations.has(id)) return true;
    const loc = await WorldRepository.getLocation(this.worldId, id);
    return loc !== null;
  }

  public async hasCharacter(id: string): Promise<boolean> {
    if (this.characters.has(id)) return true;
    const char = await WorldRepository.getCharacter(this.worldId, id);
    return char !== null;
  }
}
