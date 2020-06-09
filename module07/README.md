# AKS with AAD authentication

## RBAC / authentication / Roles definition

For RBAC and authentication we will use kubernetes RBAC and direct connection for AKS to ADD where we can define users/groups and connect them with RBAC definitions for AKS. These rules are targeted like example for one DevOps team working with AKS cluster, you can use more independent DevOps teams and define different rules (more rules with specific rights or rules with integrated responsibility). These DevOps rules are managed by cluster admin or cluster admin rules.

* **AKS administrator** (the one who is able configure all AKS assets, setup rules for all namespaces)
* **Solution level** (namespace level)
    * **Security** (setting up credentials for DB and security rules)
    * **Service** (define ingress/egress rules, routing and services)
    * **Deployment** (deploy solution)
    * **Operation** (see logs and component health - read permission to objects)

## Deploy AKS cluster

Deploy cluster with RBAC and AAD enabled.

https://docs.microsoft.com/en-us/azure/aks/azure-ad-integration

```bash
export AKS_RESOURCE_GROUP=AKSSEC
export LOCATION="northeurope"
export AKS_CLUSTER_NAME=akssec

# create resource group
az group create --location ${LOCATION} --name ${AKS_RESOURCE_GROUP}

# create cluster
az aks create --resource-group ${AKS_RESOURCE_GROUP} --name ${AKS_CLUSTER_NAME} \
  --no-ssh-key --kubernetes-version 1.16.9 --node-count 2 --node-vm-size Standard_DS2_v2 \
  --aad-server-app-id XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXX   \
  --aad-server-app-secret '#############################'  \
  --aad-client-app-id XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXX \
  --aad-tenant-id XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXX  \
  --location ${LOCATION}
```

After successful deployment we will download kubernetes config file with "admin" credentials to finalize deployment and configuration. For day-to-day work will be used kubernetes config without admin private key and cluster will be authenticated via AAD authentication.

```bash
# user credentials
az aks get-credentials --name ${AKS_CLUSTER_NAME} --resource-group ${AKS_RESOURCE_GROUP} --admin

# admin credentials
az aks get-credentials --name ${AKS_CLUSTER_NAME} --resource-group ${AKS_RESOURCE_GROUP}

kubectl config get-contexts
```

## Setup namespace and roles for RBAC

### Create namespace for our experiment

```bash
# create namespace
kubectl create namespace test
```

### Create roles

Roles are created by user with admin rights in AKS cluster.
Role bindings are configured with user accounts, in real case wecan use bindings to security groups from AAD.

```bash
# create reader group for test
cat <<EOF | kubectl apply -f -
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  namespace: test
  name: reader-test
rules:
- apiGroups:
  - ""
  - "extensions"
  resources:
    - pods
    - events
    - services
    - ingress
    - deployments
    - configmaps
    - replicasets
    - replicationcontrollers
  verbs:
    - get
    - watch
    - list
EOF

cat <<EOF | kubectl apply -f -
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  namespace: test
  name: deployment-test
rules:
- apiGroups:
  - ""
  - "extensions"
  resources:
    - pods
    - events
    - services
    - ingress
    - deployments
    - configmaps
    - replicasets
    - replicationcontrollers
  verbs:
    - get
    - watch
    - list
- apiGroups:
  - ""
  - "extensions"
  resources:
    - pods
    - pods/exec
    - deployments
    - configmaps
    - replicasets
    - replicationcontrollers
  verbs:
    - get
    - watch
    - list
    - create
    - update
    - patch
    - delete
    - deletecollection
    - exec
EOF

cat <<EOF | kubectl apply -f -
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  namespace: test
  name: mesh-test
rules:
- apiGroups:
  - ""
  - "extensions"
  resources:
    - pods
    - events
    - services
    - ingress
    - deployments
    - configmaps
    - replicasets
    - replicationcontrollers
  verbs:
    - get
    - watch
    - list
- apiGroups:
  - ""
  - "extensions"
  resources:
    - services
  verbs:
    - get
    - watch
    - list
    - create
    - update
    - patch
    - delete
    - deletecollection
EOF

cat <<EOF | kubectl apply -f -
kind: Role
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  namespace: test
  name: secret-test
rules:
- apiGroups:
  - ""
  resources:
    - secrets
  verbs:
    - get
    - watch
    - list
    - create
    - update
    - patch
    - delete
    - deletecollection
EOF

cat <<EOF | kubectl create -f -
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: usr-reader-test
  namespace: test
subjects:
- apiGroup: rbac.authorization.k8s.io
  kind: User
  name: "valda@cloudfield.cz"
roleRef:
  kind: Role
  name: reader-test
  apiGroup: rbac.authorization.k8s.io
EOF

cat <<EOF | kubectl create -f -
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: usr-deployment-test
  namespace: test
subjects:
- apiGroup: rbac.authorization.k8s.io
  kind: User
  name: "valda@cloudfield.cz"
roleRef:
  kind: Role
  name: deployment-test
  apiGroup: rbac.authorization.k8s.io
EOF

cat <<EOF | kubectl create -f -
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: usr-secret-test
  namespace: test
subjects:
- apiGroup: rbac.authorization.k8s.io
  kind: User
  name: "valda@cloudfield.cz"
roleRef:
  kind: Role
  name: secret-test
  apiGroup: rbac.authorization.k8s.io
EOF

cat <<EOF | kubectl create -f -
kind: RoleBinding
apiVersion: rbac.authorization.k8s.io/v1
metadata:
  name: usr-mesh-test
  namespace: test
subjects:
- apiGroup: rbac.authorization.k8s.io
  kind: User
  name: "valda@cloudfield.cz"
roleRef:
  kind: Role
  name: mesh-test
  apiGroup: rbac.authorization.k8s.io
EOF

```

### try do deploy container in different roles

```bash
# create simple POD
cat <<EOF | kubectl create -n test -f -
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
EOF
```

* user is not in any roles - what happens?
* put user to reader role - what can you do?
* put user to different roles - what changes?