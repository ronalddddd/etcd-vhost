var _ = require('lodash'),
    Promise = require('bluebird'),
    httpProxy = require('http-proxy'),
    Vhost = require('./Vhost'),
    Etcd = require('node-etcd'),
    etcd = new Etcd(),
    http = require('http'),
    path = require('path');

var VhostProxy = function (options) {
    var vp = this;

    // Instance variables
    options = options || {};
    vp.options = _.defaults(options, {
        uri: "/etcd_vhost",
        httpProxyOptions: {}
    });
    vp.options.vhostUri = path.resolve(vp.options.uri, "vhosts/");
    vp.vhostCollection = {};
    vp.proxy = httpProxy.createProxyServer(vp.options.httpProxyOptions);

    // Create etcd dir key
    etcd.mkdirSync(vp.options.uri);
    etcd.mkdirSync(vp.options.vhostUri);

    // Etcd vhost dir watcher
    vp.vhostsWatcher = etcd.watcher(vp.options.vhostUri, null, {recursive: true});
    vp.vhostsWatcher.on("set",vp.handleSet.bind(vp));
    vp.vhostsWatcher.on("delete",vp.handleDelete.bind(vp));

    return vp;
};

VhostProxy.prototype.createVhost = function(hostStr, options){
    var vp = this;

    options = _.defaults(options, {
        targets: []
    });

    vp.vhostCollection[hostStr] = new Vhost({
        vp: vp,
        host: hostStr,
        targets: options.targets
    });

    console.log("Created [Vhost: %s]", hostStr);
};

VhostProxy.prototype.removeVhost = function(hostStr){
    var vp = this;

    delete vp.vhostCollection[hostStr];
};

VhostProxy.prototype.handleRequest = function(req, res) {
    var vp = this,
        host = req.headers.host;
        vhost = vp.vhostCollection[host];

    if (vhost){
        console.log("Handling request for vhost %s",vhost.host);
        vhost.handleRequest(req, res);
    } else {
        res.statusCode = 404;
        res.end(host + " does not exist.");
    }
};

VhostProxy.prototype.start = function(port){
    var vp = this;
    vp.proxyServer = http.createServer(vp.handleRequest.bind(vp)).listen(port || 8080);
};

VhostProxy.prototype.stop = function(){
    var vp = this;
    vp.proxyServer.close();
    vp.vhostsWatcher.stop();
};

function debugEtcdData(data){
    console.log("'%s' %saction on '%s'",data.action,((data.node.dir)? "(dir) " : ""),data.node.key);
}

VhostProxy.prototype.extractVhostPathArr = function(etcdKey){
    var vp = this;
    return etcdKey.replace(vp.options.vhostUri + "/", "").split("/"); // example etcd value: "/etcd_vhost/vhosts/dev.example.com:8080/10.0.0.1:80"
};

VhostProxy.prototype.handleSet = function(data){
    //console.log("Handling set: ", data);
    debugEtcdData(data);
    var vp = this,
        vhost,
        pathArr = vp.extractVhostPathArr(data.node.key);

        if (pathArr.length === 1) {
            // New vhost
            console.log("Adding new vhost %s", pathArr[0]);
            vp.createVhost(pathArr[0], {});
        } else if (pathArr.length === 2){
            // Add/update vhost target
            console.log("Adding new vhost target [%s] => [%s]", pathArr[0], pathArr[1]);
            vp.vhostCollection[pathArr[0]].addTargetHost(data.node.value);
        } else {
            console.warn("Unknown key format: %s", data.node.key);
        }
};

VhostProxy.prototype.handleDelete = function(data){ // TODO: remove handler for vhost targets and vhosts
    //console.log("Handling delete: ", data);
    debugEtcdData(data);
    var vp = this,
        vhost,
        pathArr = vp.extractVhostPathArr(data.node.key);

    if (pathArr.length === 1){
        // remove vhost
        vp.removeVhost(pathArr[0]);
    } else if (pathArr.length === 2) {
        // remove vhost target
        vhost = vp.vhostCollection[pathArr[0]];
        vhost.removeTargetHost(pathArr[1]);
    } else {
        console.warn("Unknown key format: %s", data.node.key);
    }
};

VhostProxy.prototype.doHealthChecks = function(){ // TODO: check and remove unhealthy vhost targets

};

module.exports = VhostProxy;
