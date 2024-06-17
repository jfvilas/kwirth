# Kwirth
Kwirth is the final implementation of the  idea of having a simple way to manage logging inside a Kubernetes cluster. Maybe you feel comfortable with your DataDog or your Grafana and the Loki and the Promtrail. But maybe these (and other tools) are too complex for you.

**Kwirth is the answer to your need**. Just *one pod to access all the logs you need* from your main cluster or even **consolidate logging from different clusters**.

## Installation
Yes, **one only command**, just a simple 'kubectl' is enough for deploying Kwirth to your cluster.

```bash
kubectl apply -f http://github/jfvilaspersonal/kwirth
```

If everithing is ok, in no more than 8 to 10 seconds Kwirth should be up and running. So next step is accessing the front application of your fresh new logging system.

Several options here...

1. You can just access via port forwarding:
```bash
kubectl port-forward svc/kwirth-svc 3883
```

2. Using the port forwarding options of your favourite Kubernetes management tool, like Lens, Headlamp, K9S, etc... (etc was not a Kubernetes tool when I wrote this article ;) ).

+++Add some captures

3. Using an Ingress. It is the best option if you plan to access your Kwirth from Internet and if you also plan to share Kwirth with the development team in your corporate private network. For publishing Kwirth to be accesible from outside the cluster create an Ingress. It is a pending job to enable Kwirth to listen in a non-root path, so you could share the Ingress objecto with other applications, but for the moment Kwirth only works at root. Next sample is for publishing external acces like this (of course, you can rewrite the target URL's in yur reverso-proxy or in the Ingress, stripping part of the local path).

```yaml
Pending
```
