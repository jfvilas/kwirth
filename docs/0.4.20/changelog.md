# Change log
Although not too exhaustive, this page contains some detail on what we have been done on each version.

## 0.4.20
  - Front (React SPA web appliction) has been rearchitected to implement a channel subsystem similar to the one we have just implementd in backend. This way we are now prepared to implement a plugin subsystem where front and back can be extended without the need for modifying the core system.
  - We have been working on several channels in order to be sure the cahnnel subsystem is coherent. Som of them (asaide from those existing in the previous versions) are:
    - Ops (operations on Kubernetes objects)
    - Trivy (cybersecurity operations on Kubernetes objects)
    - Echo (a reference channel implementation for helping channel developers)
  - We have created a new documentation set that can evolve with the versions of the software.
  - We have finally implemented the reconnect feature, so, a Kwirth client that loses its web sockec connections can reconnect the session automatically, just doing nothing but waiting some seconds.
  - We have improved the API/Access key system, so an Access Key owner can own more than one scope and set of resources for performing different actions over different objects.
  - We have created an interface for cluster request management, so we have now a **decoupled** connection to Kubernetes clusters. This is the starting point for adding different sources of real-time data (we have in fact already tested it with Docker and Docker compose). Review the architecture explanations on this.

## 0.3.160
  - Strong architecture changes have been introduced inside Kwirth, specially for being able to suport different kinds of connections consuming different kinds of information (not only logs).
  - Added channels to Kwirth. A **channel** represents a specific kind of information that Kwirth takes from kubernetes and send to clients. First implemented channels (included in Kwirth core) are: **log**, **metrics**, **alert**.
  - Kwirth can now be extended creating new channels that can be loaded on runtime, so increasing Kwirth capabilities does not imply modifying Kwirth core. Channels can be added by creating channels and loading them at run time.
  - For consumers being able to mix different content (information that comes from different resources) Kwirth has introduced the concept of 'intances' ortogonally with channels. That is, when a client opens a WebSocket to receive information from a spsecific channel type, it can create instances for reciving same kind of information in relation to different sets or origin resources.
  - Since increasing capabilities can produce the effect of a lot of workload and data being sent from an instance of Kwirth, we have introduced a specific kind of keys (bearer keys) which simplify drastically the way the workload is managed when there are more than one instance of Kwirth (kubernetes replicas in fact) running on the backend.
  - The base front application included with Kwirth core now **supports selecting multi-resource objects**. For example, if you want to know the CPU usage of three different pods (that can even belong to different namespaces or different groups) you can select the items you want to include no matter its origin or its belonging.
  - Kwirth front metrics section enables aggregating and/or merging data form different objects.
  - Mectrics channel at Kwirth core implement several custom metrics that simplify observability by aggregating and calculating high level data like:
    - **kwirth_cluster_container_memory_percentage** Percentage of memory used by object from the whole cluster
    - **kwirth_cluster_container_cpu_percentage** Percentage of cpu used from the whole cluster
    - **kwirth_cluster_container_random_counter** Accumulated container random values
    - **kwirth_cluster_container_random_gauge** Instant container random values
    - **kwirth_cluster_container_transmit_percentage** Percentage of data sent in relation to the whole cluster
    - **kwirth_cluster_container_receive_percentage** Percentage of data received in relation to the whole cluster
    - **kwirth_cluster_container_transmit_mbps** Mbps of data sent over the last period
    - **kwirth_cluster_container_receive_mbps** Mbps of data received over the last period
  - Added a limit of log information to retrieve when starting a log channel, that is, it is no longer necessary to recieve all log information since a container started.

## 0.3

  - Created '@jfvilas/kwirth-common', for sharing data structures used by clients and by Kwirth server.
  - Added new Kwirth version detector on user login (detecting backend version when connecting to Kwirth backend).
  - Added multi-streaming channels to websockets (required for streaming other data than logs).
  - Added new security system based on differentiating services (log, streaming, operation...) and scopes (similar to old ones). By adding 'service' entity we can now add different data streams, like logging info, metrics info (snapshot or stream), signaling info (errors, warnings...). New streaming services will be added in future versions.
  - Added streaming metric service with two scopes: snaptshot (an instant metrics set) and streaming (metrics streaming), always relative to a Kubernetes artifact, that is, metrics for a container, metrics for a pod, metrics for a deployment or even metrics for a whole namespace. When obtaining data for an agreggated artifact (pod, deployment...) metrics will be aggregated according to its semantic (average, sum, etc...).
  - This very first version of streaming metrics requieres establishing a log service (for opening the websocket from client side), but we plan to allow creating independent websockets for different streaming services or even use one only websocket for all services (up to the client implementation).

## 0.2

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
  