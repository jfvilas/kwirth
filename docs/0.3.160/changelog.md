# Change log
Although not too exhaustive, this page contains some detail on what we have been done on each version.

## 0.3.160
  - Created '@jfvilas/kwirth-common', for sharing data structures used by clients and by Kwirth server
  - Added new Kwirth version detector on user login (detecting backend version when connecting to Kwirth backend).
  - Added multi-streaming channels to websockets (required for streming other data than logs).
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
  