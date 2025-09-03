import {Request, Response} from 'express';
import * as fs from 'fs';
import * as path from 'path';

// Health check endpoint
export const healthCheck = (req: Request, res: Response) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0',
    memory: {
      used:
        Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) / 100,
      total:
        Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) / 100,
      external:
        Math.round((process.memoryUsage().external / 1024 / 1024) * 100) / 100,
    },
    cpu: {
      usage: process.cpuUsage(),
    },
  };

  res.status(200).json(healthData);
};

// Detailed system status
export const systemStatus = async (req: Request, res: Response) => {
  try {
    const {pool} = require('../server');

    // Test database connection
    let dbStatus = 'disconnected';
    let dbLatency = null;

    try {
      const start = Date.now();
      await pool.query('SELECT 1');
      dbLatency = Date.now() - start;
      dbStatus = 'connected';
    } catch (error) {
      dbStatus = 'error';
    }

    const statusData = {
      status: 'operational',
      timestamp: new Date().toISOString(),
      services: {
        api: {
          status: 'healthy',
          uptime: process.uptime(),
          version: process.env.npm_package_version || '1.0.0',
        },
        database: {
          status: dbStatus,
          latency: dbLatency ? `${dbLatency}ms` : null,
          type: 'PostgreSQL',
        },
        pubsub: {
          status: process.env.PUBSUB_EMULATOR_HOST ? 'emulator' : 'cloud',
          configured: !!process.env.GOOGLE_CLOUD_PROJECT_ID,
        },
        websocket: {
          status: 'active',
          connections: (global as any).wsConnections || 0,
        },
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        architecture: process.arch,
        memory: {
          used:
            Math.round((process.memoryUsage().heapUsed / 1024 / 1024) * 100) /
            100,
          total:
            Math.round((process.memoryUsage().heapTotal / 1024 / 1024) * 100) /
            100,
          rss:
            Math.round((process.memoryUsage().rss / 1024 / 1024) * 100) / 100,
        },
        loadAverage: require('os').loadavg(),
      },
    };

    res.status(200).json(statusData);
  } catch (error) {
    res.status(500).json({
      status: 'error',
      message: 'Failed to get system status',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};

// Database initialization endpoint (development only)
export const initializeDatabaseSchema = async (req: Request, res: Response) => {
  // Security check - only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      error: 'Database initialization is not allowed in production',
      message: 'This endpoint is only available in development environment',
    });
  }

  try {
    const {pool} = require('../server');

    // Read the init.sql file
    const initSqlPath = path.join(__dirname, '..', 'db', 'init.sql');

    if (!fs.existsSync(initSqlPath)) {
      return res.status(404).json({
        error: 'init.sql file not found',
        path: initSqlPath,
      });
    }

    const initSql = fs.readFileSync(initSqlPath, 'utf8');

    // Split SQL into individual statements
    const statements = initSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(
        stmt =>
          stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('/*'),
      );

    const results = [];
    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await pool.query(statement);
          results.push({
            statement: i + 1,
            status: 'success',
            preview: statement.substring(0, 50) + '...',
          });
          successCount++;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : 'Unknown error';

          // Some statements might fail if they already exist
          if (
            errorMessage.includes('already exists') ||
            (errorMessage.includes('relation') &&
              errorMessage.includes('exists'))
          ) {
            results.push({
              statement: i + 1,
              status: 'skipped',
              preview: statement.substring(0, 50) + '...',
              reason: 'Already exists',
            });
            skipCount++;
          } else {
            results.push({
              statement: i + 1,
              status: 'error',
              preview: statement.substring(0, 50) + '...',
              error: errorMessage,
            });
            errorCount++;
          }
        }
      }
    }

    // Verify tables were created
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    const tables = tablesResult.rows.map((row: any) => row.table_name);

    res.status(200).json({
      message: 'Database initialization completed',
      summary: {
        totalStatements: statements.length,
        successful: successCount,
        skipped: skipCount,
        errors: errorCount,
        tablesCreated: tables.length,
      },
      tables: tables,
      details: results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database initialization error:', error);
    res.status(500).json({
      error: 'Database initialization failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
};

// Database schema info endpoint
export const databaseSchema = async (req: Request, res: Response) => {
  try {
    const {pool} = require('../server');

    // Get tables
    const tablesResult = await pool.query(`
      SELECT table_name, table_type
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    // Get columns for each table
    const columnsResult = await pool.query(`
      SELECT 
        table_name,
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      ORDER BY table_name, ordinal_position
    `);

    // Get indexes
    const indexesResult = await pool.query(`
      SELECT 
        schemaname,
        tablename,
        indexname,
        indexdef
      FROM pg_indexes 
      WHERE schemaname = 'public'
      ORDER BY tablename, indexname
    `);

    // Organize data
    const tables = tablesResult.rows.map((table: any) => {
      const tableColumns = columnsResult.rows.filter(
        (col: any) => col.table_name === table.table_name,
      );
      const tableIndexes = indexesResult.rows.filter(
        (idx: any) => idx.tablename === table.table_name,
      );

      return {
        name: table.table_name,
        type: table.table_type,
        columns: tableColumns.map((col: any) => ({
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          default: col.column_default,
        })),
        indexes: tableIndexes.map((idx: any) => ({
          name: idx.indexname,
          definition: idx.indexdef,
        })),
      };
    });

    res.status(200).json({
      message: 'Database schema information',
      tableCount: tables.length,
      tables: tables,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database schema error:', error);
    res.status(500).json({
      error: 'Failed to get database schema',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
};
