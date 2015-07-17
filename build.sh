#!/bin/sh

set -e

IMAGE_NAME="ronalddddd/etcd-vhost"

echo "Will try to remove image ${IMAGE_NAME}..."
docker rmi -f ${IMAGE_NAME} || echo "Nothing to remove.";
docker build --no-cache -t ${IMAGE_NAME} .
