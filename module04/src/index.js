const express = require('express')
const appInsights = require('applicationinsights');
const promCli = require('prom-client');
const promMid = require('express-prometheus-middleware');
const app = express()
const port = process.env.PORT || 3000
const instKey = "#INSTRUMENTATION_KEY#"

app.use(express.static('public'))
app.use(promMid({
    metricsPath: '/metrics',
    collectDefaultMetrics: true,
    requestDurationBuckets: [0.1, 0.5, 1, 1.5]
}));
   
console.log(`Using instrumentation key: ${instKey}`)

appInsights.setup(instKey).start();
let client = appInsights.defaultClient;
client.trackEvent({name: "my custom event", properties: {customProperty: "custom property value"}});
client.trackException({exception: new Error("handled exceptions can be logged with this method")});
client.trackMetric({name: "custom metric", value: 3});
client.trackTrace({message: "trace message"});
client.trackDependency({target:"http://dbname", name:"select customers proc", data:"SELECT * FROM Customers", duration:231, resultCode:0, success: true, dependencyTypeName: "ZSQL"});
client.trackRequest({name:"GET /customers", url:"http://myserver/customers", duration:309, resultCode:200, success:true});



app.get('/', (req, res) => {
    client.trackNodeHttpRequest({request: req, response: res}); 
    res.send('Hello World!')
})
app.listen(port, () => console.log(`Example app listening at http://localhost:${port}`))