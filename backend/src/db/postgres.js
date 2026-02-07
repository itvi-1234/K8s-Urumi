import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'orchestrator',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize database schema
export async function initDatabase() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS stores (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL CHECK (type IN ('woocommerce', 'medusa')),
        status VARCHAR(50) NOT NULL CHECK (status IN ('provisioning', 'ready', 'failed', 'deleting')),
        namespace VARCHAR(255) UNIQUE NOT NULL,
        url VARCHAR(255),
        helm_release VARCHAR(255),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);
      CREATE INDEX IF NOT EXISTS idx_stores_namespace ON stores(namespace);

      CREATE TABLE IF NOT EXISTS audit_logs (
        id SERIAL PRIMARY KEY,
        user_id VARCHAR(255),
        action VARCHAR(50) NOT NULL,
        store_id UUID,
        timestamp TIMESTAMP DEFAULT NOW(),
        ip_address VARCHAR(45),
        details JSONB
      );
    `);
    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

export default pool;
