# Changelog

## 0.2.0

- Added shutdowns and restarts. They are as follows:

| Function | Description |
|-|-|
| `ipc.shutdownCluster(Number, Boolean)` | Shuts down a cluster down based on the cluster's ID |
| `ipc.shutdownService(String, Boolean)` | Shuts a service down based on the service's name |
| `ipc.restartCluster(Number, Boolean)` | Restarts a cluster based on the cluster's ID |
| `ipc.restartService(String, Boolean)` | Restarts a cluster based on the service's name |
| `ipc.restartAllClusters(Boolean)` | Restarts all clusters |
| `ipc.restartAllServices(Boolean)` | Restarts all services |
| `ipc.totalShutdown(Boolean)` | Shuts down all clusters and services gracefully and exits the process when complete |

- Added graceful and hard shutdowns of clusters and services (Boolean above should be true for a hard shutdown)
- Added soft restarts of clusters and services which limits downtime by only killing the old worker after the new one is ready (Boolean above should be true for a hard restart with downtime)
- Added warn option to logging
- Added logging customization (see README for more details)
- Added less logging option (see README for more details)
- Added shard disconnection errors being logged
- Added error reporting for an error occuring while starting a service `this.serviceStartingError(Error)`
- Moved `this.restartCluster(Number)` to the IPC, so it is now `this.ipc.restartCluster(Number)`
- Added fetch functionality to services