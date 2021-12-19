# Changelog

This may skip some little bug fixes.

## 1.0.0

### Breaking changes:

- When using `ipc.register`, the message is now the actual message, not an object with the message as "msg"
- Fetching members now returns only cached members. Use Eris' `client.getRESTGuildMember` to fetch a member which is not cached
- `options.guildsPerShard` now includes an `"auto"` option which is the default. This just uses whatever shard count Discord recommends.

### Other changes:

- Added a central request handler. Disabled by default and may be enabled with the `useCentralRequestHandler` option being set to true.
- Added ability to change resharding parameters
- Improved logging
- Renamed key for shards array to `shards` from `shardStats` in stats
- Allows for the creation of services after the initial launch of the sharding manager
- Added cluster commands
- Added ability to send all clusters a command
- Added cluster eval
- Added ability to send all clusters an eval
- Added services eval
- Added timeout for all command and eval functions
- Added concurrency
- Added option to allow services to start simultaneously
- Added option to load code immediately
- Added option to disable the default function of replacing the console methods in workers
- Added some new stuff to stats (ipc latency, request handler latencyRef, members, and timestamp for when stats were collected)
- Ability to force eris-fleet to collect fresh stats
- Ability to get worker collections
- Added IPC class to Admiral
- Renamed `ipc.admiralBroadcast` to `ipc.sendToAdmiral`
- Added more events to Admiral (e.g. clusters and shards becoming ready)
- Added broadcasting of Admiral events (and option to disable)
- Added maximum sequential restarts (default: 5)
- IPC commands (e.g. restarting clusters) now returns a promise which resolves when complete
- The bot and service classes can now be used without a path by passing the class in `options.BotWorker` and `ServiceWorker` in your array of services (examples in `/test`)
- Added a central storage map

## 0.3.9
- Added support for extended eris class

## 0.3.8
- Cluster and service control are now accessible via the "Admiral" class

## 0.3.7
- Fix error on ipc service command when a non-object is the return value

## 0.3.6
- Updated ipc.fetchMember to use Eris's guild.fetchMembers function. This should fix it only returning cached members
- Updated Eris from 0.14.0 to 0.15.0

## 0.3.4
Fixed [issue 60](https://github.com/danclay/eris-fleet/issues/60) where Discord snowflake IDs were being treated as numbers. They are now treated as strings.

## 0.3.0
- Added resharding
- Fixed some issues with the IPC
- Added an optional starting status
- Added some documentation in README.md
- Fetch now returns null if there is no value found
- Fetch now only checks clusters which are connected and will get the data from clusters when they launch unless the timeout has passed
- Now uses eslint to make code look sharp

## 0.2.3
- Fixed issue where logging "prefix" would not show up during a soft restart

## 0.2.2
- Added fetch ipc commands to services
- Added more detailed stats
- Added object logging (with the source, timestamp, and the message in an object)

## 0.2.1

- Fixed bug where workers would never connect due to the connect command being sent before they were launched.
- Fixed stats not starting as soon as all the clusters are ready
- Fixed Stats.shardCount always being 0
- Fixed stats RAM not being in MB

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
- Added error reporting for an error occurring while starting a service `this.serviceStartingError(Error)`
- Moved `this.restartCluster(Number)` to the IPC, so it is now `this.ipc.restartCluster(Number)`
- Added fetch functionality to services