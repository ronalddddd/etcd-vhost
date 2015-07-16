var _ = require('lodash'),
    Promise = require('bluebird');

var Vhost = function (options){
    var vhost = this;

    // Defaults
    options = _.defaults(options, {});

    // Required options
    if (!options.host) throw new Error('`options.host` is missing!');
    if (!options.vp) throw new Error('`options.vp` is missing!');

    // Instance variables
    vhost.host = options.host;
    vhost.vp = options.vp;
    vhost.targets = options.targets || [];

    return vhost;
};

Vhost.deserialize = function(jsonStr, vp){
    var o = JSON.parse(jsonStr);
    return new Vhost({
        vp: vp,
        host: o.host,
        targets: o.targets
    });
};

Vhost.prototype.addTargetHost = function(targetHost){
    var vhost = this,
        existingIndex = vhost.targets.indexOf(targetHost);

    if (existingIndex < 0){
        vhost.targets.push(targetHost);
        console.log("[Vhost: %s]: added target host %s", vhost.host, targetHost);
    }
};

Vhost.prototype.removeTargetHost = function(targetHost){
    var vhost = this,
        removeIndex = vhost.targets.indexOf(targetHost);

    if (removeIndex !== -1){
        vhost.targets.splice(removeIndex,1);
        vhost.nextTargetIndex = 0;
        console.log("[Vhost %s]: removed target host %s",vhost.host,targetHost);
    }
};

/**
 * Round-robin rotation from the vhost.targets list of target hosts
 *
 * @return {string}
 */
Vhost.prototype.getNextTarget = function(){
    var vhost = this,
        nextTarget;

    if (vhost.targets.length < 1){
        throw new Error("No Targets for vhost '%s'", vhost.host);
    }

    if (vhost.nextTargetIndex === undefined || vhost.nextTargetIndex === vhost.targets.length){
        vhost.nextTargetIndex =  0;
    }

    nextTarget = vhost.targets[vhost.nextTargetIndex];
    vhost.nextTargetIndex++;

    return nextTarget;
};


/**
 * Forwards a request to a vhost target
 *
 * @param req
 * @param res
 */
Vhost.prototype.handleRequest = function(req, res){
    var vhost = this,
        target = vhost.getNextTarget();

    vhost.vp.proxy.web(req, res, { target: target }); // TODO: handle web sockets
};

Vhost.prototype.toJSON = function(){
    var vhost = this;
    return JSON.stringify({
        host: vhost.host,
        targets: vhost.targets
    });
};

module.exports = Vhost;