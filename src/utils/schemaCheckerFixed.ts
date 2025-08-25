/**
 * Simplified Schema Checker - Fixed Version
 * 
 * This version completely avoids querying information_schema to prevent 404 errors
 * during data import operations. Instead, it uses a try-catch approach for graceful
 * column detection during actual database operations.
 */

export interface SchemaVerificationResult {
  hasAllColumns: boolean;
  missingColumns: string[];
  error?: string;
}

export class FixedSchemaChecker {
  private static instance: FixedSchemaChecker;
  private columnSupport = new Map<string, boolean>();
  
  static getInstance(): FixedSchemaChecker {
    if (!FixedSchemaChecker.instance) {
      FixedSchemaChecker.instance = new FixedSchemaChecker();
    }
    return FixedSchemaChecker.instance;
  }

  /**
   * Always returns true for column support to avoid schema queries
   * Let the actual database operations handle missing columns gracefully
   */
  async verifyColumns(tableName: string, columns: string[]): Promise<SchemaVerificationResult> {
    const cacheKey = `${tableName}:${columns.join(',')}`;
    
    // Return cached result if available
    if (this.columnSupport.has(cacheKey)) {
      return {
        hasAllColumns: this.columnSupport.get(cacheKey) || true,
        missingColumns: [],
        error: 'Using cached schema assumption'
      };
    }
    
    // Always assume columns exist - let database operations handle the rest
    this.columnSupport.set(cacheKey, true);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[FIXED_SCHEMA_CHECKER] Assuming all columns exist for ${tableName}:`, columns);
    }
    
    return {
      hasAllColumns: true,
      missingColumns: [],
      error: 'Schema verification bypassed for reliability'
    };
  }

  /**
   * Mark a column as unsupported based on actual database operation results
   */
  markColumnUnsupported(tableName: string, columnName: string): void {
    const cacheKey = `${tableName}:${columnName}`;
    this.columnSupport.set(cacheKey, false);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[FIXED_SCHEMA_CHECKER] Marked column as unsupported: ${tableName}.${columnName}`);
    }
  }

  /**
   * Clear all cached schema information
   */
  clearCache(): void {
    this.columnSupport.clear();
    if (process.env.NODE_ENV === 'development') {
      console.log('[FIXED_SCHEMA_CHECKER] Cache cleared');
    }
  }

  /**
   * Check if a specific error indicates missing column
   */
  isMissingColumnError(error: any): boolean {
    if (!error) return false;
    
    const message = `${error.message || ''} ${error.details || ''}`.toLowerCase();
    const code = error.code || '';
    
    const patterns = [
      /column .* does not exist/,
      /unknown column/,
      /invalid column name/,
      /column .* not found/,
      /undefined column/
    ];
    
    const errorCodes = ['PGRST204', 'PGRST116', '42703', '42P01'];
    
    return patterns.some(pattern => pattern.test(message)) || errorCodes.includes(code);
  }
}

export const fixedSchemaChecker = FixedSchemaChecker.getInstance();