# Use cases
Explain how to perform common tasks.

### Cluster logging
*Pending*

### Cluster alerting
*Pending*

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
