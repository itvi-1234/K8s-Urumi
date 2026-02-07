import pg from 'pg';
import dotenv from 'dotenv';
import { WooCommerceProvisioner } from './provisioners/woocommerce.js';
import { MedusaProvisioner } from './provisioners/medusa.js';
import { logAndSanitizeError } from './utils/errors.js';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'orchestrator',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

const DOMAIN = process.env.DOMAIN || 'local.test';
const RECONCILE_INTERVAL = parseInt(process.env.RECONCILE_INTERVAL || '10000');

const provisioners = {
    woocommerce: new WooCommerceProvisioner(DOMAIN),
    medusa: new MedusaProvisioner(DOMAIN)
};

class Orchestrator {
    constructor() {
        this.isReconciling = false;
    }

    async reconcile() {
        if (this.isReconciling) {
            console.log('⏭️  Skipping reconcile (already running)');
            return;
        }

        this.isReconciling = true;
        console.log(`🔄 Starting reconciliation at ${new Date().toISOString()}`);

        try {
            // Handle provisioning stores
            await this.handleProvisioning();

            // Handle deleting stores
            await this.handleDeletion();

        } catch (error) {
            console.error('❌ Reconciliation error:', error);
        } finally {
            this.isReconciling = false;
        }
    }

    async handleProvisioning() {
        const result = await pool.query(
            "SELECT * FROM stores WHERE status = 'provisioning' ORDER BY created_at ASC"
        );

        const stores = result.rows;
        if (stores.length === 0) {
            return;
        }

        console.log(`📋 Found ${stores.length} store(s) to provision`);

        for (const store of stores) {
            try {
                console.log(`\n🚀 Provisioning ${store.type} store: ${store.name}`);

                const provisioner = provisioners[store.type];
                if (!provisioner) {
                    throw new Error(`Unknown store type: ${store.type}`);
                }

                const result = await provisioner.provision(store);

                if (result.success) {
                    await pool.query(
                        `UPDATE stores SET status = $1, url = $2, updated_at = NOW() WHERE id = $3`,
                        ['ready', result.url, store.id]
                    );
                    console.log(`✅ Store ${store.name} is now READY at ${result.url}`);
                } else {
                    const sanitizedError = logAndSanitizeError(store.name, 'provision', result.error);
                    await pool.query(
                        `UPDATE stores SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3`,
                        ['failed', sanitizedError, store.id]
                    );
                }
            } catch (error) {
                const sanitizedError = logAndSanitizeError(store.name, 'provision', error.message);
                await pool.query(
                    `UPDATE stores SET status = $1, error_message = $2, updated_at = NOW() WHERE id = $3`,
                    ['failed', sanitizedError, store.id]
                );
            }
        }
    }

    async handleDeletion() {
        const result = await pool.query(
            "SELECT * FROM stores WHERE status = 'deleting' ORDER BY created_at ASC"
        );

        const stores = result.rows;
        if (stores.length === 0) {
            return;
        }

        console.log(`🗑️  Found ${stores.length} store(s) to delete`);

        for (const store of stores) {
            try {
                console.log(`\n🗑️  Deleting ${store.type} store: ${store.name}`);

                const provisioner = provisioners[store.type];
                if (!provisioner) {
                    throw new Error(`Unknown store type: ${store.type}`);
                }

                const result = await provisioner.deprovision(store);

                if (result.success) {
                    await pool.query('DELETE FROM stores WHERE id = $1', [store.id]);
                    console.log(`✅ Store ${store.name} deleted successfully`);
                } else {
                    const sanitizedError = logAndSanitizeError(store.name, 'deprovision', result.error);
                    await pool.query(
                        `UPDATE stores SET error_message = $1, updated_at = NOW() WHERE id = $2`,
                        [sanitizedError, store.id]
                    );
                }
            } catch (error) {
                const sanitizedError = logAndSanitizeError(store.name, 'deprovision', error.message);
                await pool.query(
                    `UPDATE stores SET error_message = $1, updated_at = NOW() WHERE id = $2`,
                    [sanitizedError, store.id]
                );
            }
        }
    }

    start() {
        console.log('🧠 Orchestrator starting...');
        console.log(`📡 Domain: ${DOMAIN}`);
        console.log(`⏱️  Reconcile interval: ${RECONCILE_INTERVAL}ms`);

        // Run reconciliation loop
        setInterval(() => this.reconcile(), RECONCILE_INTERVAL);

        // Run immediately on start
        this.reconcile();
    }
}

// Start orchestrator
const orchestrator = new Orchestrator();
orchestrator.start();

// Graceful shutdown
process.on('SIGTERM', async () => {
    console.log('👋 Shutting down orchestrator...');
    await pool.end();
    process.exit(0);
});
