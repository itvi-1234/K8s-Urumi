import { exec } from 'child_process';
import { promisify } from 'util';
import { k8sApi } from '../k8s/client.js';
import { addHostEntry, removeHostEntry } from '../utils/hosts.js';

const execAsync = promisify(exec);

export class MedusaProvisioner {
    constructor(domain = 'local.test') {
        this.domain = domain;
        this.chartPath = process.env.MEDUSA_CHART_PATH || '/charts/medusa';
    }

    async provision(store) {
        console.log(`📦 Provisioning Medusa store: ${store.name}`);

        try {
            await this.createNamespace(store.namespace);
            await this.createResourceQuota(store.namespace);
            await this.installHelmChart(store);
            await this.waitForReady(store.namespace);

            // Add host entry to /etc/hosts
            await addHostEntry(store.name, this.domain);

            const url = `http://${store.name}.${this.domain}`;
            return { success: true, url };
        } catch (error) {
            console.error(`❌ Provisioning failed:`, error.message);
            return { success: false, error: error.message };
        }
    }

    async createNamespace(namespace) {
        try {
            await k8sApi.createNamespace({
                metadata: {
                    name: namespace,
                    labels: { 'app': 'store-orchestrator', 'managed-by': 'orchestrator' }
                }
            });
        } catch (error) {
            if (error.response?.statusCode !== 409) throw error;
        }
    }

    async createResourceQuota(namespace) {
        const quota = {
            metadata: { name: 'store-quota', namespace },
            spec: {
                hard: {
                    'requests.cpu': '2',
                    'requests.memory': '4Gi',
                    'limits.cpu': '4',
                    'limits.memory': '8Gi',
                    'persistentvolumeclaims': '5'
                }
            }
        };

        try {
            await k8sApi.createNamespacedResourceQuota(namespace, quota);
        } catch (error) {
            if (error.response?.statusCode !== 409) throw error;
        }
    }

    async installHelmChart(store) {
        const helmCommand = `helm upgrade --install ${store.helm_release} ${this.chartPath} \
      --namespace ${store.namespace} \
      --set storeName=${store.name} \
      --set domain=${this.domain} \
      --create-namespace \
      --atomic \
      --timeout 10m \
      --wait`;

        const { stdout } = await execAsync(helmCommand);
        return stdout;
    }

    async waitForReady(namespace, timeoutSeconds = 600) {
        const startTime = Date.now();
        while (Date.now() - startTime < timeoutSeconds * 1000) {
            const pods = await k8sApi.listNamespacedPod(namespace);
            const allReady = pods.body.items.every(pod =>
                pod.status.phase === 'Running' &&
                pod.status.conditions?.some(c => c.type === 'Ready' && c.status === 'True')
            );

            if (allReady && pods.body.items.length > 0) return true;
            await new Promise(resolve => setTimeout(resolve, 5000));
        }

        throw new Error(`Timeout waiting for pods`);
    }

    async deprovision(store) {
        await execAsync(`helm uninstall ${store.helm_release} --namespace ${store.namespace}`);
        await k8sApi.deleteNamespace(store.namespace);

        // Remove host entry from /etc/hosts
        await removeHostEntry(store.name, this.domain);

        return { success: true };
    }
}
