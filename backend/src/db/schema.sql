-- Database Schema for Store Orchestrator
-- This file contains all table definitions

-- Main stores table
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'provisioning',
    namespace VARCHAR(255),
    helm_release VARCHAR(255),
    url VARCHAR(255),
    error_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Audit log table for tracking all operations
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    user_id UUID,  -- For future use when user auth is added
    action VARCHAR(50) NOT NULL,  -- 'create', 'delete', 'update', 'provision', 'deprovision'
    details JSONB,  -- Additional details about the action
    ip_address VARCHAR(45),  -- IPv4 or IPv6
    created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_stores_status ON stores(status);
CREATE INDEX IF NOT EXISTS idx_stores_created_at ON stores(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_store_id ON audit_log(store_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);

-- Optional: Users table (for future use)
-- Uncomment when implementing user authentication
/*
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    max_stores INTEGER DEFAULT 5,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Add foreign key to stores table
ALTER TABLE stores ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);
CREATE INDEX IF NOT EXISTS idx_stores_user_id ON stores(user_id);
*/
