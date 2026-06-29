import Database from 'better-sqlite3';
export declare function getGarageBuildDir(): string;
export declare function getDataDir(): string;
export declare function getDatabasePath(): string;
/**
 * Initialises the GarageBuild database.
 * Creates ~/.garagebuild/data/ if it doesn't exist.
 * Runs schema migrations if needed.
 * Returns an open database connection.
 */
export declare function initDatabase(dbPath?: string): Database.Database;
//# sourceMappingURL=database.d.ts.map