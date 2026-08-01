import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import path from 'path';
import fs from 'fs';
import { CREATE_TABLES_SQL } from './schema';

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), 'aetheria.db');

export class DatabaseManager {
  private static instance: DatabaseManager;
  private db: SqlJsDatabase | null = null;
  private initialized = false;
  private inTransaction = false;

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public async initialize(): Promise<void> {
    if (this.initialized && this.db) return;

    const SQL = await initSqlJs();

    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(DB_PATH)) {
      const filebuffer = fs.readFileSync(DB_PATH);
      this.db = new SQL.Database(filebuffer);
    } else {
      this.db = new SQL.Database();
    }

    this.db.exec(CREATE_TABLES_SQL);
    this.saveToDisk();
    this.initialized = true;
    console.log(`[DatabaseManager] WASM SQLite database initialized at ${DB_PATH}`);
  }

  private saveToDisk(): void {
    if (!this.db || this.inTransaction) return;
    try {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(DB_PATH, buffer);
    } catch (err) {
      console.error('[DatabaseManager] Failed to persist WASM database to disk:', err);
    }
  }

  public async run(sql: string, params: any[] = []): Promise<{ lastID?: number; changes?: number }> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    this.db.run(sql, params);
    this.saveToDisk();
    return { changes: 1 };
  }

  public async get<T = any>(sql: string, params: any[] = []): Promise<T | undefined> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    let result: T | undefined = undefined;
    if (stmt.step()) {
      result = stmt.getAsObject() as T;
    }
    stmt.free();
    return result;
  }

  public async all<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    const results: T[] = [];
    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    while (stmt.step()) {
      results.push(stmt.getAsObject() as T);
    }
    stmt.free();
    return results;
  }

  public async transaction<T>(callback: () => Promise<T>): Promise<T> {
    await this.initialize();
    if (!this.db) throw new Error('Database not initialized');

    this.db.exec('BEGIN TRANSACTION;');
    this.inTransaction = true;
    try {
      const result = await callback();
      this.db.exec('COMMIT;');
      this.inTransaction = false;
      this.saveToDisk();
      return result;
    } catch (err) {
      if (this.inTransaction) {
        try {
          this.db.exec('ROLLBACK;');
        } catch (_) {}
        this.inTransaction = false;
      }
      throw err;
    }
  }
}

export const dbManager = DatabaseManager.getInstance();
