# Kwirth
Kwirth is the final implementation of the idea of having a simple way to manage logging, metrics, and other observability information inside a Kubernetes cluster. Maybe you feel comfortable with your DataDog or your Grafana and the Loki and the Promtrail, or the Prometheus stack, or a full ELK stack. But maybe these (and other tools) are too complex for you, or maybe you just need a **simple realtime observability tool**.

If this is the case, **Kwirth is the answer to your needs**. Just *one pod to access all the observability you need* from your main Kubernetes cluster, or even **consolidate observability information from different clusters**. When we say 'observability' we mean 'logging', 'metrics', 'alerts', 'signals', etc.

You can access the source code [**HERE**](https://github.com/jfvilas/kwirth).

## Get started
Kwirth can be easily deployed using Kubernetes manifests or a Helm chart.

#### Manifests
Yes, **one only command**, just a simple 'kubectl' is enough for deploying Kwirth to your cluster.

```bash
kubectl apply -f https://raw.githubusercontent.com/jfvilas/kwirth/master/test/kwirth.yaml
```

#### Helm chart
Helm is even more simple:

```bash
helm repo add kwirth https://github.com/jfvilas/kwirth/tree/master/deploy/helm
helm install kwirth kwirth/kwirth -n kwirth --create-namespace
```

## Access Kwirth
If everything is ok, in no more than 8 to 10 seconds Kwirth should be **up and running**. So next step is to access the front application of your fresh new Kubernetes observability system. Several options exist here...

1. You can access just using **command line port forwarding**:
    ```bash
    kubectl port-forward svc/kwirth-svc 3883
    ```

2. **Using the port forwarding** option of your favourite Kubernetes management tool, like Lens, Headlamp, K9S, etc... (etc was not a Kubernetes tool when I wrote this article ;) ).

    - With Headlamp...
      
      ![Headlamp](./_media/pf-headlamp.png ':class=imageclass80')

    - With Lens...

      ![Lens](./_media/pf-lens.png ':class=imageclass80')

    - With K9S. Just select the Kwirth pod and press **Caps+F**, then just accept (or change) the port sugegstions from K9s and navigate...

      ![Lens](./_media/pf-k9s.png ':class=imageclass80')


3. **Using an Ingress**. It is the best option if you plan to access your Kwirth from Internet and if you also plan to share Kwirth with the development team in your corporate private network. For publishing Kwirth to be accesible from outside the cluster, you must create an Ingress (be sure, you need to deploy an ingress controller before, you have info on how to perform a simple ingress installation [**HERE**](https://jfvilas.github.io/oberkorn/#/ingins)).

    It is a pending job to enable Kwirth to listen in a non-root path, so you could share the Ingress object with other applications, but for the momment Kwirth only works at root path. Next sample is for publishing external access like this (of course, you can rewrite the target URL's in your reverse-proxy or in the Ingress, stripping part of the local path).

    ```yaml
    apiVersion: networking.k8s.io/v1
    kind: Ingress
    metadata:
      name: ingress-kwirth
      namespace: default
    spec:
      ingressClassName: nginx
      # if you want to publish Kwirth securely you would need to add something like this:
      # tls:
      # - hosts:
      #   - www.kwirth-dns.com
      #     secretName: www.kwirth-dns.com.tls
      rules:
      - host: localhost
        http:
          paths:
            - path: /kwirth
              pathType: Prefix
              backend:
                service:
                  name: kwirth-svc
                  port:
                    number: 3883
    ```
    NOTE: You can **change the path** where to publish Kwirth, it is explained in [installation section](installation?id=installation).
