var _ = require('lodash'),
    Promise = require('bluebird'),
    httpProxy = require('http-proxy'),
    Vhost = require('./Vhost'),
    Etcd = require('node-etcd'),
    http = require('http'),
    path = require('path');

var VhostProxy = function (options) {
    var vp = this;

    // Instance variables
    options = options || {};
    vp.options = _.defaults(options, {
        etcdHosts: ['127.0.0.1:4001'],
        etcdSSLOptions: undefined,
        httpProxyOptions: {},
        uri: "/etcd_vhost"
    });
    vp.etcd = new Etcd(vp.options.etcdHosts, vp.options.etcdSSLOptions);
    vp.options.vhostUri = path.resolve(vp.options.uri, "vhosts");
    vp.vhostCollection = {};
    vp.proxy = httpProxy.createProxyServer(vp.options.httpProxyOptions);

    // Create etcd dir key
    vp.etcd.mkdirSync(vp.options.uri);
    vp.etcd.mkdirSync(vp.options.vhostUri);

    // Etcd vhost dir watcher
    vp.vhostsWatcher = vp.etcd.watcher(vp.options.vhostUri, null, {recursive: true});
    vp.vhostsWatcher.on("set",vp.handleSet.bind(vp));
    vp.vhostsWatcher.on("delete",vp.handleDelete.bind(vp));

    return vp;
};

VhostProxy.prototype.createVhost = function(hostStr, options){
    var vp = this;

    options = options || {};
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
    var vp = this,
        keyNormalized = path.resolve(etcdKey), // example etcd value: "/etcd_vhost/vhosts/dev.example.com:8080/10.0.0.1:80"
        subPath = keyNormalized.replace(vp.options.vhostUri, "").substr(1),
        res = (!subPath)? [] : subPath.split("/");
    console.log(res);
    return res;
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
            vhost = vp.vhostCollection[pathArr[0]];
            if (!vhost) {
                // create new vhost if not found
                vp.createVhost(pathArr[0]);
                vhost = vp.vhostCollection[pathArr[0]];
            }
            console.log("Adding new vhost target [%s] => [%s]", pathArr[0], pathArr[1]);
            vhost.addTargetHost(data.node.value);
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
        vhost = vp.vhostCollection[pathArr[0]];
        if (vhost){
            vp.removeVhost(pathArr[0]);
        } else {
            console.warn("Vhost %s does not exist",pathArr[0]);
        }
    } else if (pathArr.length === 2) {
        // remove vhost target
        vhost = vp.vhostCollection[pathArr[0]];
        if (vhost){
            vhost.removeTargetHost(pathArr[1]);
        } else {
            console.warn("Vhost %s does not exist",pathArr[0]);
        }
    } else {
        console.warn("Unknown key format: %s", data.node.key);
    }
};

VhostProxy.prototype.doHealthChecks = function(){ // TODO: check and remove unhealthy vhost targets

};

module.exports = VhostProxy;
