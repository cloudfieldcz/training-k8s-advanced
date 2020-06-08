# Network policies with HELM

```bash
# goto directory for this lab
cd ../module02
```

## Creating AKS inside a custom VNET
```bash
# variables
source ./rc

# Create a resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create a virtual network and subnet
az network vnet create \
    --resource-group $RESOURCE_GROUP \
    --name $AKS_VNET_NAME \
    --address-prefixes 10.0.0.0/8 \
    --subnet-name $AKS_SUBNET_NAME \
    --subnet-prefix 10.240.0.0/16

# Create a service principal and read in the application ID
SP=$(az ad sp create-for-rbac --output json)
CLIENT_ID=$(echo $SP | jq -r .appId)
SP_PASSWORD=$(echo $SP | jq -r .password)

# Get the virtual network resource ID
VNET_ID=$(az network vnet show --resource-group $RESOURCE_GROUP --name $AKS_VNET_NAME --query id -o tsv)

# Get the virtual network subnet resource ID
SUBNET_ID=$(az network vnet subnet show --resource-group $RESOURCE_GROUP --vnet-name $AKS_VNET_NAME --name $AKS_SUBNET_NAME --query id -o tsv)


# Create the AKS cluster and specify the virtual network and service principal information
# Enable network policy by using the `--network-policy` parameter
az aks create \
    --resource-group ${RESOURCE_GROUP} \
    --name ${AKS_CLUSTER_NAME} \
    --kubernetes-version 1.16.9 \
    --node-count 2 \
    --ssh-key-value ~/.ssh/test/id_rsa.pub \
    --network-plugin azure \
    --service-cidr 10.0.0.0/16 \
    --dns-service-ip 10.0.0.10 \
    --docker-bridge-address 172.17.0.1/16 \
    --vnet-subnet-id $SUBNET_ID \
    --service-principal $CLIENT_ID \
    --client-secret $SP_PASSWORD \
    --node-vm-size Standard_B2s \
    --network-policy azure

# Get the ACR registry resource id
ACR_ID=$(az acr show --name $ACR_NAME --resource-group $RESOURCE_GROUP --query "id" --output tsv)

# Create role assignment for ACR
az role assignment create --assignee $CLIENT_ID --role AcrPull --scope $ACR_ID
# Assign the service principal Contributor permissions to the virtual network resource
az role assignment create --assignee $CLIENT_ID --scope $VNET_ID --role Contributor

# Get config
az aks get-credentials --admin --name ${AKS_CLUSTER_NAME} --resource-group ${RESOURCE_GROUP} --file ~/.kube/testing/${AKS_CLUSTER_NAME}
```

## Deploy production a development environment
```bash
# create namespace
kubectl create namespace development
kubectl create namespace production

# create secrets to store DB connection string  
POSTGRESQL_URL="jdbc:postgresql://${POSTGRESQL_NAME}.postgres.database.azure.com:5432/todo?user=${POSTGRESQL_USER}@${POSTGRESQL_NAME}&password=${POSTGRESQL_PASSWORD}&ssl=true"
kubectl create secret generic myrelease-myapp \
  --from-literal=postgresqlurl="$POSTGRESQL_URL" \
  --namespace development

kubectl create secret generic myrelease-myapp \
  --from-literal=postgresqlurl="$POSTGRESQL_URL" \
  --namespace production

# Let's now use Helm to deploy nginx Ingress solution.

# create namespace
kubectl create namespace nginx-ingress

# update helm repos
helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
helm repo update 

# install ingress
helm install nginx-ingress ingress-nginx/ingress-nginx --namespace nginx-ingress
helm install nginx-ingress-dev ingress-nginx/ingress-nginx --namespace nginx-ingress

# Get ingress public IP
export INGRESS_IP=$(kubectl get service nginx-ingress-ingress-nginx-controller  -n nginx-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
export INGRESS_DEV_IP=$(kubectl get service nginx-ingress-dev-ingress-nginx-controller  -n nginx-ingress -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "You will be able to access prod application on this URL: http://${INGRESS_IP}.xip.io"
echo "You will be able to access dev application on this URL: http://${INGRESS_DEV_IP}.xip.io"


# deploy from ACR helm repository
helm upgrade --install myrelease helm/myapp --namespace='development' --set-string appspa.image.repository="${ACR_NAME}.azurecr.io/myappspa",appspa.image.tag='v2',apptodo.image.repository="${ACR_NAME}.azurecr.io/myapptodo",apptodo.image.tag='v1',apphost="${INGRESS_DEV_IP}.xip.io"

helm upgrade --install myrelease helm/myapp --namespace='production' --set-string appspa.image.repository="${ACR_NAME}.azurecr.io/myappspa",appspa.image.tag='v1',apptodo.image.repository="${ACR_NAME}.azurecr.io/myapptodo",apptodo.image.tag='v1',apphost="${INGRESS_IP}.xip.io"
```

## Deploy Network policy
```bash
# Add labels to our namespaces
kubectl label namespace/development purpose=development
kubectl label namespace/production purpose=production
kubectl label namespace/nginx-ingress purpose=nginx

# Install network policies
helm upgrade --install network-policy helm/network-policy --namespace='development' -f  helm/network-policy/values-development.yaml
helm upgrade --install network-policy helm/network-policy --namespace='production' -f  helm/network-policy/values-production.yaml

# Describe network policies
kubectl describe networkpolicies.networking.k8s.io  --namespace production
kubectl describe networkpolicies.networking.k8s.io  --namespace development

# Delete helm release
helm --namespace development delete network-policy
helm --namespace production delete network-policy
```

## How to connect to a K8s node using SSH 
```bash
# Run an alpine container image and attach a terminal session to it. This container can be used to create an SSH session with any node in the AKS cluster:
kubectl run --generator=run-pod/v1 -it --rm aks-ssh --image=debian -n development

# Install ssh client
apt-get update && apt-get install openssh-client wget -y

# Copy private key file to a remote debian
kubectl cp ~/.ssh/test/id_rsa $(kubectl get pod -l run=aks-ssh -o jsonpath='{.items[0].metadata.name}' -n development):/id_rsa -n development

# Change PK file permissions
chmod 0600 id_rsa

# Try to call existing services
wget --timeout=5  --tries=1 -qO-  http://myrelease-myapp-todo.development:8080/api/todo
wget --timeout=5  --tries=1 -qO-  http://myrelease-myapp-todo.production:8080/api/todo

# Connect to node
ssh -i id_rsa azureuser@10.240.0.4

# List all iptables rules
sudo iptables -S
...
-A AZURE-NPM-EGRESS-PORT -m set --match-set azure-npm-3874932646 src -m comment --comment ALLOW-ALL-FROM-ns-production -j ACCEPT
-A AZURE-NPM-EGRESS-PORT -m set --match-set azure-npm-3874932646 src -m comment --comment ALLOW-ALL-FROM-ns-production-TO-JUMP-TO-AZURE-NPM-TARGET-SETS -j AZURE-NPM-TARGET-SETS
-A AZURE-NPM-INGRESS-FROM -m set --match-set azure-npm-3274860383 src -m set --match-set azure-npm-3874932646 dst -m comment --comment "ALLOW-ns-purpose:nginx-TO-ns-production" -j ACCEPT
-A AZURE-NPM-INGRESS-FROM -m set --match-set azure-npm-1492649642 src -m set --match-set azure-npm-3874932646 dst -m comment --comment "ALLOW-ns-purpose:production-TO-ns-production" -j ACCEPT
-A AZURE-NPM-INGRESS-FROM -s 10.0.0.0/16 -m set --match-set azure-npm-3874932646 dst -m comment --comment "ALLOW-10.0.0.0/16-TO-ns-production" -j ACCEPT
-A AZURE-NPM-INGRESS-FROM -m set --match-set azure-npm-3874932646 dst -m comment --comment ALLOW-ALL-TO-ns-production-TO-JUMP-TO-AZURE-NPM-TARGET-SETS -j AZURE-NPM-TARGET-SETS
-A AZURE-NPM-INGRESS-PORT -m set --match-set azure-npm-3874932646 dst -m comment --comment ALLOW-ALL-TO-ns-production-TO-JUMP-TO-AZURE-NPM-INGRESS-FROM -j AZURE-NPM-INGRESS-FROM
-A AZURE-NPM-TARGET-SETS -m set --match-set azure-npm-3874932646 dst -m comment --comment DROP-ALL-TO-ns-production -j DROP
-A DOCKER-ISOLATION-STAGE-1 -i docker0 ! -o docker0 -j DOCKER-ISOLATION-STAGE-2
-A DOCKER-ISOLATION-STAGE-1 -j RETURN
-A DOCKER-ISOLATION-STAGE-2 -o docker0 -j DROP
-A DOCKER-ISOLATION-STAGE-2 -j RETURN
-A DOCKER-USER -j RETURN
-A KUBE-FIREWALL -m comment --comment "kubernetes firewall for dropping marked packets" -m mark --mark 0x8000/0x8000 -j DROP
...
```

## Create Private Endpoint to add DB server into VNET
```bash
# Create a new subnet for services (e.g. DB)
az network vnet subnet create -g $RESOURCE_GROUP --vnet-name $AKS_VNET_NAME -n $SERVICE_SUBNET_NAME \
    --address-prefixes 10.250.0.0/16

az network vnet subnet update \
 --name $SERVICE_SUBNET_NAME \
 --resource-group $RESOURCE_GROUP \
 --vnet-name $AKS_VNET_NAME \
 --disable-private-endpoint-network-policies true

# Get POSGRESQL RESSOURCE ID
POSGRESQL_ID=$(az postgres server show --resource-group $RESOURCE_GROUP --name $POSTGRESQL_NAME --query id -o tsv)

# Create Private Endpoint
az network private-endpoint create \
    --name $PRIVATE_ENDPOINT_NAME \
    --resource-group $RESOURCE_GROUP \
    --vnet-name $AKS_VNET_NAME \
    --subnet $SERVICE_SUBNET_NAME \
    --private-connection-resource-id $POSGRESQL_ID \
    --group-ids postgresqlServer \
    --connection-name postgresqlConnection \
    --location $LOCATION  

# clean-up deployment
helm --namespace development delete network-policy
helm --namespace production delete network-policy
# delete namespace
kubectl delete namespace development
kubectl delete namespace production
```