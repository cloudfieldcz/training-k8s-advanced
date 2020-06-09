## it uses node js image alpine version from image registries.
FROM node:8.16.1-alpine
ARG INSTRUMENTATION_KEY
ENV PORT=3000
RUN echo ${INSTRUMENTATION_KEY}
## it sets directory in the container to /app to store files and launch our app.
WORKDIR /app
## it copies the app to /app directory with dependencies.
COPY package.json /app
RUN npm install --save applicationinsights
RUN npm install --save prom-client
RUN npm install --save express-prometheus-middleware
RUN npm install
COPY . /app

RUN sed -i 's/#INSTRUMENTATION_KEY#/'$INSTRUMENTATION_KEY'/g' index.js
RUN sed -i 's/#INSTRUMENTATION_KEY#/'$INSTRUMENTATION_KEY'/g' public/test.html
## it commands to run our app which is index.js.
CMD node index.js
##  it exposes the port where our app is running that is port 8080.
EXPOSE 3000