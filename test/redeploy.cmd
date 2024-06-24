kubectl delete -f .\kwirth-local-k3d.yaml
timeout 3
kubectl apply -f .\kwirth-local-k3d.yaml
