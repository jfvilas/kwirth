# Test folder
This project folder contains some testing artifacts:

  - **kwrith.yaml**, a yaml for deploying Kwirth to any cluster:
    - Uses 'default' namespace
    - Access to application is located at '/kwirth'
    - Does not provide Service nor Ingress.
  - **kwirth-local-k3d.yaml**, deploys Kwirth in a local K3S cluster, for developing purposes.
  - **service-and-ingress.yaml**, provides a Service and a Ingress for accessing Kwirth in 'default' namespace.
