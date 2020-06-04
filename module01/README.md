# k8s volumes and configuration

## simple volume

```bash
# create StatefulSet
cat <<EOF | kubectl create -f -
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ubuntu
spec:
  serviceName: ubuntu
  replicas: 1
  updateStrategy: 
    type: RollingUpdate
  selector:
    matchLabels:
      app: ubuntu
  template:
    metadata:
      labels:
        app: ubuntu
    spec:
      containers:
        - name: ubuntu
          image: tutum/curl
          command: ["tail"]
          args: ["-f", "/dev/null"]
          resources:
            limits: 
              cpu: 250m
              memory: 256Mi
            requests:
              cpu: 250m
              memory: 256Mi
          volumeMounts:
          - name: ubuntu-data
            mountPath: /opt/data
  volumeClaimTemplates:
  - metadata:
      name: ubuntu-data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      storageClassName: "managed-premium"
      resources:
        requests:
          storage: 8Gi
EOF

# exec to pod and validate mounts
kubectl exec -ti ubuntu-0 -- /bin/bash
```
## config map

Create config map with values for env variables and config map with files (to be able to mount it to Pod like files).

```bash
# create configmap from literal
kubectl create configmap special-config --from-literal=special.how=very --from-literal=special.type=charm

# create configmap from file

```