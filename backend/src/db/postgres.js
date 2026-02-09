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
        status VARCHAR(50) NOT NULL CHECK (status IN ('provisioning', 'ready', 'failed', 'deleting', 'upgrading')),
        namespace VARCHAR(255) UNIQUE NOT NULL,
        url VARCHAR(255),
        helm_release VARCHAR(255),
        version VARCHAR(50) DEFAULT '1.0.0',
        helm_revision INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        error_message TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);
      CREATE INDEX IF NOT EXISTS idx_stores_namespace ON stores(namespace);

      CREATE TABLE IF NOT EXISTS audit_log (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
        user_id UUID,
        action VARCHAR(50) NOT NULL,
        details JSONB,
        ip_address VARCHAR(45),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_audit_log_store_id ON audit_log(store_id);
      CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

      CREATE TABLE IF NOT EXISTS store_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        store_id UUID REFERENCES stores(id) ON DELETE CASCADE,
        event_type VARCHAR(50) NOT NULL,
        message TEXT NOT NULL,
        details JSONB,
        severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'success')),
        created_at TIMESTAMP DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_store_events_store_id ON store_events(store_id);
      CREATE INDEX IF NOT EXISTS idx_store_events_created_at ON store_events(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_store_events_type ON store_events(event_type);
    `);
    console.log('✅ Database schema initialized');
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
}

export { pool };
export default pool;
