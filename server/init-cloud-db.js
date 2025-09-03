#!/usr/bin/env node

/**
 * Cloud Database Initialization Script
 * 
 * This script connects to the cloud database using Google Cloud SQL Proxy
 * and initializes it with the full schema from init.sql
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Database connection configuration
const connectionConfig = {
  // You'll need to update these with your actual cloud database details
  host: '/cloudsql/traffic-assist-1756794779:us-central1:traffic-assist-db', // Cloud SQL socket
  user: 'postgres', // or your database user
  database: 'traffic_assist',
  password: process.env.DB_PASSWORD, // Set this environment variable
};

// Alternative direct connection (if not using Cloud SQL Proxy)
const directConnectionConfig = {
  host: 'your-cloud-sql-ip', // External IP of your Cloud SQL instance
  port: 5432,
  user: 'postgres',
  database: 'traffic_assist',
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
};

async function initializeCloudDatabase() {
  console.log('🗄️  Initializing Cloud Database...');

  // Read the init.sql file
  const initSqlPath = path.join(__dirname, 'src', 'db', 'init.sql');
  const initSql = fs.readFileSync(initSqlPath, 'utf8');

  let pool;

  try {
    // Try Cloud SQL socket connection first
    console.log('Attempting Cloud SQL socket connection...');
    pool = new Pool(connectionConfig);

    // Test connection
    await pool.query('SELECT NOW()');
    console.log('✅ Connected via Cloud SQL socket');

  } catch (error) {
    console.log('Cloud SQL socket failed, trying direct connection...');

    try {
      pool = new Pool(directConnectionConfig);
      await pool.query('SELECT NOW()');
      console.log('✅ Connected via direct connection');
    } catch (directError) {
      console.error('❌ Both connection methods failed:');
      console.error('Socket error:', error.message);
      console.error('Direct error:', directError.message);
      console.log('\n💡 Solutions:');
      console.log('1. Set up Cloud SQL Proxy: https://cloud.google.com/sql/docs/postgres/sql-proxy');
      console.log('2. Update connection details in this script');
      console.log('3. Use the database management console to run init.sql manually');
      process.exit(1);
    }
  }

  try {
    console.log('📋 Executing database schema...');

    // Split the SQL file into individual statements
    const statements = initSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await pool.query(statement);
          console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
        } catch (error) {
          // Some statements might fail if they already exist, that's okay
          if (error.message.includes('already exists')) {
            console.log(`⚠️  Statement ${i + 1} skipped (already exists)`);
          } else {
            console.error(`❌ Statement ${i + 1} failed:`, error.message);
            throw error;
          }
        }
      }
    }

    console.log('🎉 Database initialization complete!');

    // Verify tables were created
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    console.log('\n📋 Tables created:');
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Command line usage
if (require.main === module) {
  initializeCloudDatabase()
    .then(() => {
      console.log('\n✅ Cloud database initialization successful!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Cloud database initialization failed:', error);
      process.exit(1);
    });
}

module.exports = { initializeCloudDatabase };
