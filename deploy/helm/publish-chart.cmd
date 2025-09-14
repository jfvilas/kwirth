helm package ./0.1.0
helm package ./0.1.1

helm repo index . --url https://github.com/jfvilas/kwirth/deploy/helm

move /Y *.tgz ..\..\docs\helm-charts
move /Y index.yaml ..\..\docs\helm-charts