# Installation
Add here detailed installation instructions

### Deploy Kwirth to your cluster
If you want an express setup of Kwirth, do not loose your time, just type-in this kubectl in your console:

```yaml
kubectl apply -f https://raw.githubusercontent.com/jfvilasPersonal/kwirth/master/test/kwirth.yaml
```

If you need to change default Kwirth configuration you may need to edit the YAML files in order to customize de deployment.

### Access Kwirth
The default installation of Kwirth publishes Kwirth access via 'http://your.dns.name/kwirth'. But you can change this behaviour publishing Kwirth at eny other path. Let's see a sample deployeing creating (if needed) and creating an Ingress controller.

#### 1. Deploy an Ingress controller (not needed if you already have one)
>> Refer to Oberkorn IngressNginx installation

#### 2. Create an Ingress
Once you have deployed an Ingress controller (Ingress Nginx or whatever you like), next step is to create a simple Ingress resource. This YAML code shows how to create an ingress for accessing your Kwirth in this path: '/quirz'.

```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ingress-jfvilas
  namespace: default
spec:
  ingressClassName: nginx
  rules:
  - host: localhost
    http:
      paths:
        - path: /quirz
          pathType: Prefix
          backend:
            service:
              name: kwirth-svc
              port:
                number: 3883
```

Now Kwirth would be accessible at http://localhost/quirz (the ingress redirects requests to the Kwirth service at port 3883).

#### 3. Configure Kwirth to be accesible
For Kwirth to run properly in the path you selected (/quirz), the Kwirth pod must be aware of this situation, so you need to modify the Kwirth installation to indicate qhich is the path. The way you can do this is by modifying an environment variables at pod deployment.

The deployment should look like this:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kwirth
  namespace: default
spec:
  replicas: 1
  selector:
    matchLabels:
      app: kwirth
  template:
    metadata:
      name: kwirth
      labels:
        app: kwirth
    spec:
      serviceAccount: kwirth-sa
      containers:
        - name: kwirth
          image: jfvilasoutlook/kwirth:latest
          env:
            - name: KWIRTH_ROOTPATH
              value: '/quirz'
          ports:
            - name: kwirth
              containerPort: 3883
              protocol: TCP
          resources:
            limits:
              cpu: '1'
              memory: 2Gi
            requests:
              cpu: 500m
              memory: 1Gi
```

Pay attention to the 'env' var names **KWIRTH_ROOTPATH**. This is the only thing you need to do.

#### 4. Access Kwirth
So, finally, you should be able to access Kwirth at: http://your.dns.name/quirz. For example, if your are working with Minikube, microK8s, k3s or any kind of local Kubernetes, you would access Kwirth at:

```bash
http://localhost/quirz
```
