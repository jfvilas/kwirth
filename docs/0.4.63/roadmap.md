# Roadmap
We cite here some interesting capabilities that are missing today:

  - ~~**Non-root path**. In order to be able to share an ingress with other kubernetes services, it is desirable to have the abiity to configure Kwirth (front and API) for receiving requests in a non-root path, that is, something like 'http://your.dns.name/kwirth'.~~ DONE!
  - **Deployment**. ~~As well as the root path should be administrator's decision, the namespace where to deploy Kwirth should be selectable by the Kubernetes administrator.~~ DONE!
  - ~~**Update self**, add an option to restart kwirth (if image is latest this will update kwirth to the lastest available version).~~ DONE!
  ~~- **Starting logs**. When a user starts a log object, he should be able to decide how much logging info to receive from the started log: since pod started, previous pod log, only from now on...~~ DONE!
  - **Secure log text**, we plan to add an option to protect log lines that contain a specific sensible text, like 'password', 'pw', 'email', etc..., so lines including these words are treated in a special way by asterisking sensible content.
  ~~- **API Key expire**, we need to add something useful for humans in the API management at front application when setting expire.~~ DONE!
  - **Log Content**. In the LogContent component (the real viewer) need to add a socket error management component, for the user to know if there has ocurred an error when receiving data. Severl type of information can be received: socket errors, pod creation/deletion, etc...
  - **Ephimeral log**. When you use Kwirth for alerting, you don't need in fact to store all the messages, you just want to receive them, process them and show alerts if something happens, but you don't really want to store all the messages that you are not interested in.
  - **Consolidated log object**. In addition to the ability to have config boards with content that comes from more than one source cluster, it is desirable to create a log object (a tab, not a full config) in which you can consolidate logging from different source clusters in one only log stream.
  - **Import/Export**, for the imp/exp process to be really useful, it should be desirable that the user could select what config boards to export or import.
  ~~- **Metrics**, we plan to add basic Kubernetes metrics monitoring in the future by checking pod/node status. The metrics will be propagated to customers (Kwirth users, Kubelog users or whatever) through the websocket (the same used for the log stream), so users can view real time metrics and statuses~~ DONE!
  - ~~**Helm**. Although Kwirth installation is simple and straightforward, we should create a helm chart for installing Kwirth.~~ DONE!
  - **Event streaming**, it seems interesting to have an event streaming service (like logging or metrics) for monitoring all events that take place inside the kubernetes cluster (object lifecycle (create, delete, modify), admin commands...)
  - **IAM**, add integraion with common IAM systems, that is, implemente SSO with Google, Azure, Github...
  - ~~**Websocket multi-service**. Currently we support exchanging information on a websocket that belongs to different services, like logging or metrics. But we need to add something like a 'service instance id' in order to allow several instances of the same service coexist in the same websocket, for example, two or more logging services running on the same websocket, or receiving different metrics on the same websocket.~~ DONE!
  - **Alerting metrics**. We wish Kwirth to be able to alert you based on metrics thrsholds, not just log messages. 
  - **Session**, we need to manage frontend sessions and store access key into browser's localStorage.
  - **Helm**. Add Ingress support to Helm Charts.
