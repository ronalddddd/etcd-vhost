# etcd-vhost

A virtual-hosting proxy configured using etcd.
It is designed to simplify web service discovery and vhost setups on clustered hosts like CoreOS.

```
          Load Balancer
               ||
        -----------------
        |               |
        V               V
  etcd-vhost          etcd-vhost
        |               |
        -----------------
               ||
        -----------------
        |               |
        V               V
  Web App 1           Web App 2

```

# Features

- Uses etcd for service discovery, e.g. adding a target host for the vhost "www.example.com":
  - key: `/etcd_vhost/vhosts/www.example.com/10.0.0.1:8080`
  - value: `"http://10.0.0.1:8080"`
- Multiple targets for a single vhost, which will be accessed in a round-robin fashion

# Usage

You can run the vhost proxy as a docker container or as a stand-alone node app.
The docker container will be run with the argument `--etcd-hosts=172.17.42.1:4001`, which is the default docker host on the docker0 interface.

## Running the server with Docker

`docker run ronalddddd/etcd-vhost`

## Running the server with NPM

        # Install
        npm install etcd-vhost

        # Run
        npm start --port=8080 --etcd-hosts=127.0.0.1:4001

## Options (applies to both methods above):

- `--port`: port number the server listens on
- `--etcd-hosts`: a comma separated list of etcd servers in the form of `<address>:<port>`
- `--uri`: the base directory key for the etcd configurations, default is `/etcd_vhost/`

## Registering a new virtual host on etcd

Create a virtual host www.example.com that points to http://10.0.0.1:8080:

```
core@coreos01 ~ $ etcdctl set /etcd_vhost/vhosts/www.example.com/10.0.0.1:8080 "http://10.0.0.1:8080"
http://10.0.0.1:8080
```


# Running tests

- make sure a local etcd endpoint localhost:4001 is accessible
- run `npm test`

# TODO:

- health check and auto-remove unhealthy vhost targets
- separate presence daemon to add docker containers to vhost entries based on env variables
- support web sockets

# Related Readings

- [etcd](https://coreos.com/etcd/)
- [etcd - Reading and Writing from Inside a Container](https://coreos.com/etcd/docs/latest/getting-started-with-etcd.html)
