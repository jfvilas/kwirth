helm package ./0.1.0
helm package ./0.1.1
helm package ./0.1.2
helm package ./0.1.3
helm package ./0.1.4

helm repo index . --url https://jfvilas.github.io/kwirth/helm-charts

move /Y *.tgz ..\..\docs\helm-charts
move /Y index.yaml ..\..\docs\helm-charts