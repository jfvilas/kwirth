kubectl config use-context k3d-kwirth
kubectl apply -f .\kwirth-local-k3d.yaml
kubectl apply -f .\service-and-ingress.yaml

