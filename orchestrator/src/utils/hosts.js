import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';

const execAsync = promisify(exec);

const HOSTS_FILE = '/etc/hosts';
const HOSTS_MARKER_START = '# Store Orchestrator - Managed Entries';
const HOSTS_MARKER_END = '# End Store Orchestrator';

/**
 * Add a store URL to /etc/hosts
 * @param {string} storeName - Name of the store
 * @param {string} domain - Domain (e.g., 'local.test')
 */
export async function addHostEntry(storeName, domain) {
    const hostname = `${storeName}.${domain}`;
    const entry = `127.0.0.1 ${hostname}`;

    try {
        // Check if entry already exists
        const hostsContent = await fs.readFile(HOSTS_FILE, 'utf-8');
        if (hostsContent.includes(hostname)) {
            console.log(`⚠️  Host entry already exists: ${hostname}`);
            return;
        }

        // Add entry to hosts file
        const command = `echo "${entry}" | sudo tee -a ${HOSTS_FILE} > /dev/null`;
        await execAsync(command);
        console.log(`✅ Added host entry: ${hostname}`);
    } catch (error) {
        console.error(`❌ Failed to add host entry for ${hostname}:`, error.message);
        console.error('   You may need to add it manually or configure sudo permissions');
    }
}

/**
 * Remove a store URL from /etc/hosts
 * @param {string} storeName - Name of the store
 * @param {string} domain - Domain (e.g., 'local.test')
 */
export async function removeHostEntry(storeName, domain) {
    const hostname = `${storeName}.${domain}`;

    try {
        // Read current hosts file
        const hostsContent = await fs.readFile(HOSTS_FILE, 'utf-8');

        // Check if entry exists
        if (!hostsContent.includes(hostname)) {
            console.log(`⚠️  Host entry not found: ${hostname}`);
            return;
        }

        // Remove all lines containing the hostname
        const lines = hostsContent.split('\n');
        const filteredLines = lines.filter(line => !line.includes(hostname));
        const newContent = filteredLines.join('\n');

        // Write back to hosts file using sudo
        const tempFile = `/tmp/hosts-${Date.now()}`;
        await fs.writeFile(tempFile, newContent);
        await execAsync(`sudo cp ${tempFile} ${HOSTS_FILE}`);
        await fs.unlink(tempFile);

        console.log(`✅ Removed host entry: ${hostname}`);
    } catch (error) {
        console.error(`❌ Failed to remove host entry for ${hostname}:`, error.message);
        console.error('   You may need to remove it manually');
    }
}

/**
 * Initialize managed section in /etc/hosts
 * This creates a marked section for easier management
 */
export async function initializeManagedSection() {
    try {
        const hostsContent = await fs.readFile(HOSTS_FILE, 'utf-8');

        if (!hostsContent.includes(HOSTS_MARKER_START)) {
            const entry = `\n${HOSTS_MARKER_START}\n${HOSTS_MARKER_END}\n`;
            const command = `echo "${entry}" | sudo tee -a ${HOSTS_FILE} > /dev/null`;
            await execAsync(command);
            console.log('✅ Initialized managed section in /etc/hosts');
        }
    } catch (error) {
        console.warn('⚠️  Could not initialize managed section in /etc/hosts:', error.message);
    }
}
