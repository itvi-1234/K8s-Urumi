import k8s from '@kubernetes/client-node';

const kc = new k8s.KubeConfig();

// Load config from cluster (when running in K8s) or local kubeconfig
if (process.env.KUBERNETES_SERVICE_HOST) {
    kc.loadFromCluster();
} else {
    kc.loadFromDefault();
}

export const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
export const k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
export const k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
export const k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);

export default kc;
