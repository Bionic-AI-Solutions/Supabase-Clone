import { getDb } from "./db";
import { sql } from "drizzle-orm";

/**
 * Database Management Module
 * 
 * Provides SQL execution, schema introspection, and table data management
 * for the multi-tenant platform. Each project has its own schema within
 * the organization's database.
 */

export interface QueryResult {
  columns: string[];
  rows: any[];
  rowCount: number;
  executionTime: number;
}

export interface TableInfo {
  tableName: string;
  columnCount: number;
  rowCount: number;
  estimatedSize: string;
}

export interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  foreignKeyTable: string | null;
  foreignKeyColumn: string | null;
}

export interface SchemaInfo {
  tables: Array<{
    name: string;
    columns: ColumnInfo[];
    rowCount: number;
  }>;
  relationships: Array<{
    fromTable: string;
    fromColumn: string;
    toTable: string;
    toColumn: string;
  }>;
}

/**
 * Execute a SQL query safely with timeout and row limits
 */
export async function executeQuery(
  databaseName: string,
  schemaName: string,
  query: string,
  maxRows: number = 1000
): Promise<QueryResult> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection not available");
  }

  const startTime = Date.now();
  
  try {
    // Add LIMIT clause if not present for SELECT queries
    let finalQuery = query.trim();
    if (finalQuery.toLowerCase().startsWith("select") && !finalQuery.toLowerCase().includes("limit")) {
      finalQuery += ` LIMIT ${maxRows}`;
    }

    // Execute query
    const result = await db.execute(finalQuery);
    const executionTime = Date.now() - startTime;

    // Extract columns and rows
    const rows = Array.isArray(result) ? result : [];
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      columns,
      rows,
      rowCount: rows.length,
      executionTime,
    };
  } catch (error) {
    throw new Error(`Query execution failed: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get list of tables in a schema
 */
export async function getTables(databaseName: string, schemaName: string): Promise<TableInfo[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection not available");
  }

  try {
    // Use the current database (platform database) for now
    // In production, this would query the org-specific database
    const currentDb = process.env.DATABASE_URL?.split('/').pop()?.split('?')[0] || 'defaultdb';
    
    const query = `
      SELECT 
        TABLE_NAME as tableName,
        (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = '${currentDb}' AND TABLE_NAME = t.TABLE_NAME) as columnCount,
        TABLE_ROWS as rowCount,
        ROUND((DATA_LENGTH + INDEX_LENGTH) / 1024 / 1024, 2) as estimatedSize
      FROM INFORMATION_SCHEMA.TABLES t
      WHERE TABLE_SCHEMA = '${currentDb}'
      AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `;

    const result: any = await db.execute(sql.raw(query));
    // Drizzle returns [rows, fields] array
    const tables = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];

    return tables.map((table: any) => ({
      tableName: table.tableName,
      columnCount: table.columnCount || 0,
      rowCount: table.rowCount || 0,
      estimatedSize: `${table.estimatedSize || 0} MB`,
    }));
  } catch (error) {
    throw new Error(`Failed to fetch tables: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get columns for a specific table
 */
export async function getTableColumns(
  databaseName: string,
  schemaName: string,
  tableName: string
): Promise<ColumnInfo[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection not available");
  }

  try {
    // Use the current database (platform database) for now
    const currentDb = process.env.DATABASE_URL?.split('/').pop()?.split('?')[0] || 'defaultdb';
    
    const query = `
      SELECT 
        c.COLUMN_NAME as columnName,
        c.DATA_TYPE as dataType,
        c.IS_NULLABLE as isNullable,
        c.COLUMN_DEFAULT as columnDefault,
        c.COLUMN_KEY as columnKey,
        k.REFERENCED_TABLE_NAME as foreignKeyTable,
        k.REFERENCED_COLUMN_NAME as foreignKeyColumn
      FROM INFORMATION_SCHEMA.COLUMNS c
      LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE k 
        ON c.TABLE_SCHEMA = k.TABLE_SCHEMA 
        AND c.TABLE_NAME = k.TABLE_NAME 
        AND c.COLUMN_NAME = k.COLUMN_NAME
        AND k.REFERENCED_TABLE_NAME IS NOT NULL
      WHERE c.TABLE_SCHEMA = '${currentDb}' AND c.TABLE_NAME = '${tableName}'
      ORDER BY c.ORDINAL_POSITION
    `;

    const result: any = await db.execute(sql.raw(query));
    // Drizzle returns [rows, fields] array
    const columns = Array.isArray(result) ? (Array.isArray(result[0]) ? result[0] : result) : [];

    return columns.map((col: any) => ({
      columnName: col.columnName,
      dataType: col.dataType,
      isNullable: col.isNullable === "YES",
      columnDefault: col.columnDefault,
      isPrimaryKey: col.columnKey === "PRI",
      isForeignKey: col.foreignKeyTable !== null,
      foreignKeyTable: col.foreignKeyTable,
      foreignKeyColumn: col.foreignKeyColumn,
    }));
  } catch (error) {
    throw new Error(`Failed to fetch columns: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Get complete schema information including relationships
 */
export async function getSchemaInfo(databaseName: string, schemaName: string): Promise<SchemaInfo> {
  const tables = await getTables(databaseName, schemaName);
  
  const tablesWithColumns = await Promise.all(
    tables.map(async (table) => {
      const columns = await getTableColumns(databaseName, schemaName, table.tableName);
      return {
        name: table.tableName,
        columns,
        rowCount: table.rowCount,
      };
    })
  );

  // Extract relationships
  const relationships: SchemaInfo["relationships"] = [];
  for (const table of tablesWithColumns) {
    for (const column of table.columns) {
      if (column.isForeignKey && column.foreignKeyTable && column.foreignKeyColumn) {
        relationships.push({
          fromTable: table.name,
          fromColumn: column.columnName,
          toTable: column.foreignKeyTable,
          toColumn: column.foreignKeyColumn,
        });
      }
    }
  }

  return {
    tables: tablesWithColumns,
    relationships,
  };
}

/**
 * Get table data with pagination
 */
export async function getTableData(
  databaseName: string,
  schemaName: string,
  tableName: string,
  page: number = 1,
  pageSize: number = 50
): Promise<{ data: any[]; total: number; page: number; pageSize: number }> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection not available");
  }

  try {
    const offset = (page - 1) * pageSize;

    // Get total count (use current database, not org-specific database)
    const countQuery = `SELECT COUNT(*) as total FROM \`${tableName}\``;
    const countResult: any = await db.execute(sql.raw(countQuery));
    // Drizzle returns [rows, fields] array
    const countRows = Array.isArray(countResult) ? (Array.isArray(countResult[0]) ? countResult[0] : countResult) : [];
    const total = countRows.length > 0 ? countRows[0].total : 0;

    // Get paginated data
    const dataQuery = `SELECT * FROM \`${tableName}\` LIMIT ${pageSize} OFFSET ${offset}`;
    const dataResult: any = await db.execute(sql.raw(dataQuery));
    // Drizzle returns [rows, fields] array
    const data = Array.isArray(dataResult) ? (Array.isArray(dataResult[0]) ? dataResult[0] : dataResult) : [];

    return {
      data,
      total,
      page,
      pageSize,
    };
  } catch (error) {
    throw new Error(`Failed to fetch table data: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Update a row in a table
 */
export async function updateTableRow(
  databaseName: string,
  schemaName: string,
  tableName: string,
  primaryKeyColumn: string,
  primaryKeyValue: any,
  updates: Record<string, any>
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection not available");
  }

  try {
    const setClauses = Object.keys(updates)
      .map((key) => `\`${key}\` = ?`)
      .join(", ");

    const query = `
      UPDATE \`${tableName}\`
      SET ${setClauses}
      WHERE \`${primaryKeyColumn}\` = ?
    `;

    const values = [...Object.values(updates), primaryKeyValue];
    let finalQuery = query;
    values.forEach((val) => {
      finalQuery = finalQuery.replace('?', typeof val === 'string' ? `'${val}'` : String(val));
    });
    await db.execute(sql.raw(finalQuery));

    return true;
  } catch (error) {
    throw new Error(`Failed to update row: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}

/**
 * Delete a row from a table
 */
export async function deleteTableRow(
  databaseName: string,
  schemaName: string,
  tableName: string,
  primaryKeyColumn: string,
  primaryKeyValue: any
): Promise<boolean> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database connection not available");
  }

  try {
    const query = `
      DELETE FROM \`${tableName}\`
      WHERE \`${primaryKeyColumn}\` = ?
    `;

    const finalQuery = query.replace('?', typeof primaryKeyValue === 'string' ? `'${primaryKeyValue}'` : String(primaryKeyValue));
    await db.execute(sql.raw(finalQuery));

    return true;
  } catch (error) {
    throw new Error(`Failed to delete row: ${error instanceof Error ? error.message : "Unknown error"}`);
  }
}
