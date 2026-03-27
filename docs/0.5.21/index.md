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

#### Other ways to deploy Kwirth
As of Kwirth 0.5.1 Kwirth can be installed/deployed in several different ways:

  - Kubernetes (explained above)
  - Docker
  - External (standalone)
  - Desktop Application

##### Docker
+++

##### External
Kwirth external es a standalone version taht can be installed in your Linux/Windows/Mac as an indepdendent process (the same as you would do with an NGINX or a database, just a daemon).
+++

##### Desktop
There currently exist two flavours of Kwirth Desktop:

  - Windows version
  - Linux version (FUSE-compatible)

Kwirth Desktop is an Electron application whose login page is spscifically designed for local work (the same you would do with Lens, K9s or Headlamp), so Kwirth Desktop do not connect to a spscific Kuebernetes cluster, it would show the user all the contexts the user have on his 'kubeconfig' file (cluster status and availability will be refreshed automatically), as we show in following image:

![cluster selection](+++)

For installing a Linux "AppImage" or the Windows MSI please [follow this link](https://github.com/jfvilas/kwirth/releases) to GitHub releses page of the project. Kwirth Dekstop just needs to be installed as a regular application, no special permissions or actions are needed.

Please [follow this link](+++) to understand how Kwirth Desktop is architected and built and [how to work with it](+++).


## Access Kwirth (Kubernetes)
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

## Access Kwirth (External)
Kwirth External is a standalone deployment of Kwirth taht you can start locally inside your Linux/Windows/Mac.

Once installed, you can access kwirth directly and easily from a browser at: http://localhost:3883

Depending on the options you used when starting Kwirth External you may need to change the port or access a specifica path, for example: http://localhost:3885/kwirth.

Please review start options [here](+++).

## Access Kwirth (Docker)
+++
