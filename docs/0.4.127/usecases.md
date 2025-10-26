# Use cases

### Cluster logging
The original idea behind Kwirth was to deliver real-time logs out of your Kubernetes, but Kwirth is now a whole and complete observability tool. Anyway, with Kwirth you can consolidate real-time (not Loki, nor Elasti, nor Alloy, nor Azure monitor nor any other logging stuff like that). Logging informaiton is received via streaming channels (implemented through websockets) directly from the container to your browser.

You can, for example, receive one unique log stream consolidating all the logs from one specific application. In addition, teh reconncet feature allows keeping the strem alive even if you lose your communications.

### Cluster alerting
The ability of Kwirth to manage channels in an independent way of how objects are managed makes Kwirth extremely usefult to implement a simple but powerful alerting system. That is, the relation between your object set and the channel features is orthogonal.

Similar to how you configure your logging channel, the alert channel is useful for monitoring, for example, an appliction, just by...:

  1. Adding all application containers as source objects in your channel.
  2. Configure regex to match exceptional conditions on log lines.
  3. Receive alerts related to your application. 

Another interesting use case is to consolidate all log from all Kubernetes namespaces, so you can detect any exceptional condition that may arise in your workload.

### Corporate alerting
*Pending*

### Development teams
*Pending*

### Log proxying
Although Kwirth includes a front application for accessing the logs, you can deploy Kwirth just as a log proxy, that is:

- Deploy Kwirth to your Kubernetes cluster
- Configure API keys for log access
- Use your own log consumer for accessing logs

One example for this is our [Backstage](https://backstage.io) plugin [Kubelog](https://github.com/jfvilas/kubelog). Kubelog allows viewing cluster logs inside a Backstage deployment by accessing log streams via Kwirth.

Refer to [Kubelog](https://github.com/jfvilas/kubelog) for detailed info on the project and how to install the plugin.
