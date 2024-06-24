# Installation
Add here detailed installation instructions

### Deploy Kwirth to your cluster
kubectl....

### Access Kwirth
The default installation of Kwirth publishes Kwirth access via 'http://your.dns.name/kwirth'. But you can change this behaviour publishing Kwirth at eny other path. Let's see a sample deployeing creating (if needed) and creating an Ingress controller.

#### 1. Deploy an Ingress controller (not needed if you already have one)
>> Refer to Oberkorn Ingress installation

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
For Kwirth to run properly in the path you selected (/quirz), the Kwirth pod must be aware of this situation, so you need to modify the Kwirth installation to indicate qhich is the path. The way you can do this is by modifying an environment varibales at pod deployment.

#### 4. Access Kwirth
Access Kwirth
