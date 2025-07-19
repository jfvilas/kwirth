# Change log
Although not too exhaustive, this page contains some detail on what we have been done on each version.

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
  