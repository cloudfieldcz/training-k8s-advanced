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

# cleanup
kubectl delete statefulset ubuntu
```
## config map

Create config map with values for env variables and config map with files (to be able to mount it to Pod like files).

```bash
# create configmap from literal
kubectl create configmap special-config --from-literal=special.how=very --from-literal=special.type=charm

# create configmap from file
kubectl create configmap game-config --from-file=config1.txt --from-file=config2.txt --from-file=config3.txt

# describe configmaps
kubectl describe configmap

# create simple POD with ENV variable from configmap
cat <<EOF | kubectl create -f -
kind: Pod
apiVersion: v1
metadata:
  name: ubuntu
spec:
  containers:
    - name: ubuntu
      image: tutum/curl
      command: ["tail"]
      args: ["-f", "/dev/null"]
      env:
        # Define the environment variable
        - name: SPECIAL_LEVEL_KEY
          valueFrom:
            configMapKeyRef:
              # The ConfigMap containing the value you want to assign to SPECIAL_LEVEL_KEY
              name: special-config
              # Specify the key associated with the value
              key: special.how
EOF

# chack the env variable in POD
kubectl exec -it ubuntu bash

# delete pod
kubectl delete pod ubuntu

# create simple POD volumes from configmap
cat <<EOF | kubectl create -f -
kind: Pod
apiVersion: v1
metadata:
  name: ubuntu
spec:
  containers:
    - name: ubuntu
      image: tutum/curl
      command: ["tail"]
      args: ["-f", "/dev/null"]
      env:
        # Define the environment variable
        - name: SPECIAL_LEVEL_KEY
          valueFrom:
            configMapKeyRef:
              # The ConfigMap containing the value you want to assign to SPECIAL_LEVEL_KEY
              name: special-config
              # Specify the key associated with the value
              key: special.how
      volumeMounts:
      - name: config-volume
        mountPath: /myapp/config
  volumes:
    - name: config-volume
      configMap:
        # Provide the name of the ConfigMap containing the files you want
        # to add to the container
        name: special-config
EOF

# check the mounted files in POD
kubectl exec -it ubuntu bash

# delete pod
kubectl delete pod ubuntu

# create simple POD with volumes from configmap
cat <<EOF | kubectl create -f -
kind: Pod
apiVersion: v1
metadata:
  name: ubuntu
spec:
  containers:
    - name: ubuntu
      image: tutum/curl
      command: ["tail"]
      args: ["-f", "/dev/null"]
      env:
        # Define the environment variable
        - name: SPECIAL_LEVEL_KEY
          valueFrom:
            configMapKeyRef:
              # The ConfigMap containing the value you want to assign to SPECIAL_LEVEL_KEY
              name: special-config
              # Specify the key associated with the value
              key: special.how
      volumeMounts:
      - name: config-volume
        mountPath: /myapp/config
      - name: config-volume-2
        mountPath: /myapp/config-2
  volumes:
    - name: config-volume
      configMap:
        # Provide the name of the ConfigMap containing the files you want
        # to add to the container
        name: special-config
    - name: config-volume-2
      configMap:
        # Provide the name of the ConfigMap containing the files you want
        # to add to the container
        name: game-config
EOF

# check the mounted files in POD
kubectl exec -it ubuntu bash

# delete pod
kubectl delete pod ubuntu

# create simple POD with volumes from configmap (only one specific file)
cat <<EOF | kubectl create -f -
kind: Pod
apiVersion: v1
metadata:
  name: ubuntu
spec:
  containers:
    - name: ubuntu
      image: tutum/curl
      command: ["tail"]
      args: ["-f", "/dev/null"]
      env:
        # Define the environment variable
        - name: SPECIAL_LEVEL_KEY
          valueFrom:
            configMapKeyRef:
              # The ConfigMap containing the value you want to assign to SPECIAL_LEVEL_KEY
              name: special-config
              # Specify the key associated with the value
              key: special.how
      volumeMounts:
      - name: config-volume
        mountPath: /myapp/config
      - name: config-volume-2
        mountPath: /myapp/config-2
      - name: config-volume-3
        mountPath: /etc/config1.txt
        subPath: config1.txt
  volumes:
    - name: config-volume
      configMap:
        # Provide the name of the ConfigMap containing the files you want
        # to add to the container
        name: special-config
    - name: config-volume-2
      configMap:
        # Provide the name of the ConfigMap containing the files you want
        # to add to the container
        name: game-config
    - name: config-volume-3
      configMap:
        # Provide the name of the ConfigMap containing the files you want
        # to add to the container
        name: game-config
EOF

# check the mounted files in POD
kubectl exec -it ubuntu bash

# try to change configmap and check file content

# delete pod
kubectl delete pod ubuntu


```