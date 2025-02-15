kubectl config set-context k3d-kwirth
cd ..\back
call image-import-current.cmd
cd ..\test
kubectl delete -f .\kwirth-local-k3d.yaml
timeout 3
kubectl apply -f .\kwirth-local-k3d.yaml
