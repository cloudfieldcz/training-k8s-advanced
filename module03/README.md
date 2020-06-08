# Azure web app demo

```bash
# goto directory for this lab
cd ../module03
```
## Creating AKS inside a custom VNET
```bash
# variables
source ./rc

# Create a resource group
az group create --name $RESOURCE_GROUP --location $LOCATION
SP=$(az ad sp create-for-rbac --output json)
CLIENT_ID=$(echo $SP | jq -r .appId)
SP_PASSWORD=$(echo $SP | jq -r .password)

# Create an AKS cluster
az aks create -g $RESOURCE_GROUP -n aks-dev-spaces \
    --kubernetes-version 1.16.9 \
    --location $LOCATION \
    --node-count 2 \
    --service-principal $CLIENT_ID \
    --client-secret $SP_PASSWORD

#Enable dev-spaces
az aks use-dev-spaces -g $RESOURCE_GROUP -n aks-dev-spaces --space dev --yes

#Use the azds show-context command to show the HostSuffix for dev.
azds show-context
```

## Deploy a testing application
```bash
git clone https://github.com/Azure/dev-spaces
cd dev-spaces/samples/BikeSharingApp/
azds show-context
#Open charts/values.yaml and replace all instances of <REPLACE_ME_WITH_HOST_SUFFIX> with the HostSuffix value you retrieved earlier. Save your changes and close the file.

cd charts/
# Deploying application with helm
helm install bikesharingsampleappsampleapp . --dependency-update --namespace dev --atomic

#Use the azds space select command to create two child spaces under dev:
azds space select -n dev/azureuser1 -y
azds space select -n dev/azureuser2 -y

# Check available uris
azds list-uris
```

## Make changes to our code

```bash
cd ../BikeSharingWeb/
```
Open BikeSharingWeb/components/Header.js with a text editor and change the text
```bash
azds up
```
1. Open web and check deployed changed
2. Check namespace to see azureuser2 namespace and bikesharingweb in it.
## Clean dev spaces
```bash
azds space remove -n dev/azureuser1 -y
azds space remove -n dev/azureuser2 -y
azds space select -n dev
azds list-uris
```
