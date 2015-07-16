var VhostProxy = require('../lib/VhostProxy'),
    Vhost = require('../lib/Vhost'),
    expect = require('chai').expect,
    Promise = require('bluebird'),
    http = require('http'),
    requestAsync = Promise.promisify(require('request')),
    Etcd = require('node-etcd'),
//    etcd = Promise.promisifyAll(new Etcd());
    etcd = new Etcd();

describe("VhostProxy.js", function(){
    var vp,
        serverA,
        serverB;

    beforeEach(function(ready){
        if(vp) vp.stop();
        etcd.delSync("etcd_vhost", {recursive: true});

        vp = new VhostProxy();
        vp.start();

        serverA = serverA || http.createServer(function(req, res){
            res.end("serverA");
        }).listen(8081);

        serverB = serverB || http.createServer(function(req, res){
            res.end("serverB");
        }).listen(8082);

        ready();
    });

    describe("`createVhost()` method", function(){
        it("should create a vhost with targets provided", function(done){
            var vhost;

            vp.createVhost("localhost:8080", {
                targets: ["http://localhost:8081", "http://localhost:8082"]
            });

            vhost = vp.vhostCollection["localhost:8080"];
            expect(vhost).to.exist;
            expect(vhost.targets).to.exist;
            expect(vhost.targets.length).to.equal(2);

            done();
        });

        it("should create a vhost which is usable", function(done){
            vp.createVhost("localhost:8080", {
                targets: ["http://localhost:8081", "http://localhost:8082"]
            });

            requestAsync("http://localhost:8080")
                .spread(function(res, body){
                    expect(body).to.equal("serverA");
                    done();
                });
        });
    });

    describe("`removeVhost()` method", function(){
        it("should remove the vhost object from the collection", function(done){
            var vhostKey = "localhost:8080",
                vhost;

            vp.createVhost(vhostKey, {
                targets: ["http://localhost:8081", "http://localhost:8082"]
            });

            expect(vp.vhostCollection[vhostKey]).to.exist;
            vp.removeVhost(vhostKey);
            expect(vp.vhostCollection[vhostKey]).not.to.exist;

            done();
        });
    });

    describe("`addVhostTarget()` method", function(){ });
    describe("`removeVhostTarget` method", function(){ });

    describe("`handleRequest()` method", function(){
        it("should handle requests on vhosts with multiple targets using a round-robin access pattern", function(done){
            vp.createVhost("localhost:8080", {
                targets: ["http://localhost:8081", "http://localhost:8082"]
            });

            requestAsync("http://localhost:8080")
                .spread(function(res, body){
                    expect(body).to.equal("serverA");
                    return requestAsync("http://localhost:8080");
                })
                .spread(function(res, body){
                    expect(body).to.equal("serverB");
                    done();
                });
        });
    });

    describe("`handleSet` etcd watcher event handler", function(){
        it("should create a vhost object when an entry is added to etcd", function(done){
            var host = 'localhost:8080',
                targetHost = 'localhost:8081', // serverA
                targets = ["http://"+targetHost],
                vhost = new Vhost({
                    vp: vp,
                    host: host,
                    targets: targets
                });

            etcd.rmdirSync('/etcd_vhost/vhosts/'+host+'/', {recursive: true});
            etcd.mkdirSync('/etcd_vhost/vhosts/'+host+'/');
            etcd.setSync('etcd_vhost/vhosts/'+host+'/'+targetHost, targets[0]);

            var newVhost = vp.vhostCollection[host];
            expect(newVhost).to.exist;
            expect(newVhost.targets).to.exist;
            expect(newVhost.targets[0]).to.exist.and.equal(targets[0]);
            //done();

            requestAsync("http://localhost:8080")
                .spread(function(res, body){
                    expect(body).to.equal("serverA");
                    done();
                })
                .catch(function(err){
                    done(err);
                });
        }, 1000);
    });
});
