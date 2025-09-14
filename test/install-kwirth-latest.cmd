kubectl config use-context k3d-kwirth
kubectl apply -f .\kwirth-users-secret.yaml
kubectl apply -f .\kwirth-latest.yaml
kubectl apply -f .\service-and-ingress.yaml
