import { exec } from 'child_process';
import { promisify } from 'util';
import { k8sApi } from '../k8s/client.js';
import { addHostEntry, removeHostEntry } from '../utils/hosts.js';

const execAsync = promisify(exec);

export class WooCommerceProvisioner {
    constructor(domain = 'local.test') {
        this.domain = domain;
        this.chartPath = process.env.WOOCOMMERCE_CHART_PATH || '/charts/woocommerce';
    }

    async provision(store) {
        console.log(`📦 Provisioning WooCommerce store: ${store.name}`);

        try {
            // Check if namespace exists (idempotency check)
            const namespaceExists = await this.checkNamespaceExists(store.namespace);

            if (namespaceExists) {
                console.log(`⚠️  Namespace ${store.namespace} already exists - checking provisioning status`);

                // Check if Helm release exists
                const helmExists = await this.checkHelmReleaseExists(store.helm_release, store.namespace);

                if (helmExists) {
                    console.log(`✅ Store already fully provisioned - verifying readiness`);

                    // Verify pods are ready
                    const podsReady = await this.checkPodsReady(store.namespace);

                    if (podsReady) {
                        // Ensure host entry exists
                        await addHostEntry(store.name, this.domain);
                        const url = `http://${store.name}.${this.domain}`;
                        console.log(`✅ Store is ready at ${url}`);
                        return { success: true, url };
                    } else {
                        console.log(`⚠️  Pods not ready - waiting for completion`);
                        await this.waitForReady(store.namespace);
                        await addHostEntry(store.name, this.domain);
                        const url = `http://${store.name}.${this.domain}`;
                        return { success: true, url };
                    }
                } else {
                    console.log(`⚠️  Partial provisioning detected - resuming from Helm installation`);
                    // Namespace exists but Helm not installed - resume provisioning
                    await this.installHelmChart(store);
                    console.log(`✅ Helm chart installed: ${store.helm_release}`);

                    await this.waitForReady(store.namespace);
                    console.log(`✅ Pods are ready`);

                    await addHostEntry(store.name, this.domain);
                    const url = `http://${store.name}.${this.domain}`;
                    console.log(`✅ Store URL: ${url}`);
                    return { success: true, url };
                }
            }

            // Fresh provisioning - namespace doesn't exist
            console.log(`🆕 Fresh provisioning - creating all resources`);

            // Step 1: Create namespace
            await this.createNamespace(store.namespace);
            console.log(`✅ Namespace created: ${store.namespace}`);

            // Step 2: Create ResourceQuota
            await this.createResourceQuota(store.namespace);
            console.log(`✅ ResourceQuota created`);

            // Step 3: Install Helm chart
            await this.installHelmChart(store);
            console.log(`✅ Helm chart installed: ${store.helm_release}`);

            // Step 4: Wait for pods to be ready
            await this.waitForReady(store.namespace);
            console.log(`✅ Pods are ready`);

            // Step 5: Add host entry to /etc/hosts
            await addHostEntry(store.name, this.domain);

            // Step 6: Get store URL
            const url = `http://${store.name}.${this.domain}`;
            console.log(`✅ Store URL: ${url}`);

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
                    labels: {
                        'app': 'store-orchestrator',
                        'managed-by': 'orchestrator'
                    }
                }
            });
        } catch (error) {
            if (error.response?.statusCode === 409) {
                console.log(`⚠️  Namespace ${namespace} already exists (idempotent)`);
            } else {
                throw error;
            }
        }
    }

    async createResourceQuota(namespace) {
        const quota = {
            metadata: {
                name: 'store-quota',
                namespace: namespace
            },
            spec: {
                hard: {
                    'requests.cpu': '2',
                    'requests.memory': '4Gi',
                    'limits.cpu': '4',
                    'limits.memory': '8Gi',
                    'persistentvolumeclaims': '3'
                }
            }
        };

        try {
            await k8sApi.createNamespacedResourceQuota(namespace, quota);
        } catch (error) {
            if (error.response?.statusCode === 409) {
                console.log(`⚠️  ResourceQuota already exists (idempotent)`);
            } else {
                throw error;
            }
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

        try {
            const { stdout, stderr } = await execAsync(helmCommand);
            if (stderr && !stderr.includes('WARNING')) {
                console.warn('Helm stderr:', stderr);
            }
            return stdout;
        } catch (error) {
            throw new Error(`Helm install failed: ${error.message}`);
        }
    }

    // Idempotency helper methods
    async checkNamespaceExists(namespace) {
        try {
            await k8sApi.readNamespace(namespace);
            return true;
        } catch (error) {
            if (error.response?.statusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    async checkHelmReleaseExists(releaseName, namespace) {
        try {
            const { stdout } = await execAsync(`helm list -n ${namespace} -o json`);
            const releases = JSON.parse(stdout || '[]');
            return releases.some(r => r.name === releaseName);
        } catch (error) {
            console.warn(`Error checking Helm release: ${error.message}`);
            return false;
        }
    }

    async checkPodsReady(namespace) {
        try {
            const pods = await k8sApi.listNamespacedPod(namespace);

            if (pods.body.items.length === 0) {
                return false;
            }

            const allReady = pods.body.items.every(pod => {
                return pod.status.phase === 'Running' &&
                    pod.status.conditions?.some(c => c.type === 'Ready' && c.status === 'True');
            });

            return allReady;
        } catch (error) {
            console.warn(`Error checking pod status: ${error.message}`);
            return false;
        }
    }

    async waitForReady(namespace, timeoutSeconds = 600) {
        const startTime = Date.now();
        const timeout = timeoutSeconds * 1000;

        while (Date.now() - startTime < timeout) {
            try {
                const pods = await k8sApi.listNamespacedPod(namespace);
                const allReady = pods.body.items.every(pod => {
                    return pod.status.phase === 'Running' &&
                        pod.status.conditions?.some(c => c.type === 'Ready' && c.status === 'True');
                });

                if (allReady && pods.body.items.length > 0) {
                    return true;
                }

                await new Promise(resolve => setTimeout(resolve, 5000));
            } catch (error) {
                console.error('Error checking pod status:', error.message);
            }
        }

        throw new Error(`Timeout waiting for pods to be ready after ${timeoutSeconds}s`);
    }

    async deprovision(store) {
        console.log(`🗑️  Deprovisioning WooCommerce store: ${store.name}`);

        try {
            // Step 1: Uninstall Helm release
            const helmCommand = `helm uninstall ${store.helm_release} --namespace ${store.namespace}`;
            await execAsync(helmCommand);
            console.log(`✅ Helm release uninstalled`);

            // Step 2: Delete namespace (cascades to all resources)
            await k8sApi.deleteNamespace(store.namespace);
            console.log(`✅ Namespace deleted: ${store.namespace}`);

            // Step 3: Remove host entry from /etc/hosts
            await removeHostEntry(store.name, this.domain);

            return { success: true };
        } catch (error) {
            console.error(`❌ Deprovision failed:`, error.message);
            return { success: false, error: error.message };
        }
    }
}
