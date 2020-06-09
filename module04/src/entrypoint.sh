#!/bin/sh
sed -i 's/#INSTRUMENTATION_KEY#/'$INSTRUMENTATION_KEY'/g' index.js
sed -i 's/#INSTRUMENTATION_KEY#/'$INSTRUMENTATION_KEY'/g' public/test.html
cat index.js
cat public/test.html
# This will exec the CMD from your Dockerfile, i.e. "npm start"
exec "$@"