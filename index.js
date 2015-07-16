var VhostProxy = require('./lib/VhostProxy');

// Options
var port = (process.env.npm_config_port !== undefined)? parseInt(process.env.npm_config_port) || 8080 : 8080,
    etcdHosts = ['127.0.0.1:4001'],
    uri = process.env.npm_config_uri || "/etcd_vhost";

if (process.env.npm_config_etcd_hosts){
    etcdHosts = process.env.npm_config_etcd_hosts.split(",");
}

var vp = new VhostProxy({
        etcdHosts: etcdHosts,
        //etcdSSLOptions: undefined,
        //httpProxyOptions: {},
        uri: uri
    });

vp.start( port || 8080);