k3d cluster delete kwirth
k3d cluster create kwirth -p "80:80@loadbalancer" -p "443:443@loadbalancer" -p "8080:8080@loadbalancer" --k3s-arg "--disable=traefik@server:*"
kubectl config use-context k3d-kwirth
timeout 5 > NUL
kubectl apply -f kwirth-locla-k3d.yaml