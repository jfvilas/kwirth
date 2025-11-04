# Change log
Although not too exhaustive, this page contains some detail on what we have been done on each version.

## 0.4.127
  - Added Fileman channel
  - Added configurable endpoint for channel use
  - Added homepage including:
    - Cluster details
    - CLustur usage data
    - Last & Fav tabs and boards
  - Added notifier for sending messages to user from front channels.
  - Added react-file-manager as customizable filemanager for kwirth.
  - Added parse listener for parsing 'ls' commands in fileman channel.
  - Added Helm chart installation

## 0.4.20
  - Strong architecture changes have been introduced inside Kwirth, specially for being able to suport different kinds of connections consuming ifferent kinds of information (not only logs)
  - Added channels to Kwirth. A Channel represents a specific kind of information that Kwirth takes from kubernetes and send to clients. First implemented channels (included in base Kwirth) are: log, metrics, alert.
  - Kwirth can now be extended creating new channels that can be loaded on runtime, so increasing Kwirth capacbilities does not imply modifying its core. Capabilities can be added by creating channels and loading them at run time.
  - For consumers being able to mix different content (information that comes from different resources) Kwirth has introduced the concept of 'intances' ortogonally with channels. That is, when a client opens a WebSocket to receive information from a spsecific channel type, it can create instances for reciving same kind of information in relation to different sets or origin resources.
  - Since increasing capabilities can produce the effect of a lot of workload and data being sent from an instance of Kwirth, we have introduced a specific kind of tokens (bearer tokens) which simplify drastically the way the workload is managed when there are more than one instance of Kwirth (kubernetes replicas in fact) running on the backend.
  - The base front application included with Kwirth core now support selecting multi-resource objects. For example, if you want to know the CPU usage of three different pods (that can even belong to different namespaces or different groups) you can select the items you want to include in the front application no matter its origin or its belonging.
  - Kwirth front metrics section enables to aggregate and/or merge data form different objects.
  - Mectrics channel at Kwirth core implement several custom metrics that simplify observability by aggregating and calculating hi level data like:
    - **kwirth_container_memory_percentage** Percentage of memory used by object from the whole cluster
    - **kwirth_container_cpu_percentage** Percentage of cpu used from the whole cluster
    - **kwirth_container_random_counter** Accumulated conatiner random values
    - **kwirth_container_random_gauge** Instant container random values
    - **kwirth_container_transmit_percentage** Percentage of data sent in relation to the whole cluster
    - **kwirth_container_receive_percentage** Percentage of data received in relation to the whole cluster
    - **kwirth_container_transmit_mbps** Mbps of data sent over the last period
    - **kwirth_container_receive_mbps** Mbps of data received over the last period
    - **kwirth_container_write_mbps** Mbps of data written to disk during the last period
    - **kwirth_container_read_mbps** Mbps of data read from disk during the last period
  - Documentation is now versioned according to Kwirth versioning, you can select what Kwirth version documenttion on the side bar.

## 0.3.160
  - Created '@jfvilas/kwirth-common', for sharing data structures used by clients and by Kwirth server.
  - Added new Kwirth version detector on user login (detecting backend version when connecting to Kwirth backend).
  - Added multi-streaming channels to websockets (required for streaming other data than logs).
  - Added new security system based on differentiating services (log, streaming, operation...) and scopes (similar to old ones). By adding 'service' entity we can now add different data streams, like logging info, metrics info (snapshot or stream), signaling info (errors, warnings...). New streaming services will be added in future versions.
  - Added streaming metric service with two scopes: snaptshot (an instant metrics set) and streaming (metrics streaming), always relative to a Kubernetes artifact, that is, metrics for a container, metrics for a pod, metrics for a deployment or even metrics for a whole namespace. When obtaining data for an agreggated artifact (pod, deployment...) metrics will be aggregated according to its semantic (average, sum, etc...).
  - This very first version of streaming metrics requieres establishing a log service (for opening the websocket from client side), but we plan to allow creating independent websockets for different streaming services or even use one only websocket for all services (up to the client implementation).

## 0.2.8
  - Redefined the API Key / Access Key world, adding a more flexible way to manage security (check the documentation).
  - Add Status information. Now, using the same socket where the log stream is sent to clients, Kwirth sends status data (like pods added, pods stoped, Kubernetes errors...).
  - Added version info via API, so clients can know which version of Kwirth they are connected with (in order to know the featuras implemented).
  - Added /find endpoint to perform searchs on Kubernetes artifacts.
  - Added Kubernetes operations (with permissions) to enable restarting deployments and pods via Kwirth.
  - Several front improvements and a simpler resource selector.

## 0.1
Initial version including:
  - Access to several clusters.
  - One only admin user.
  - API key security for accessing distributed Kwirths.
  - ReactTS front.
  