FROM google/nodejs

WORKDIR /app
ADD package.json /app/
RUN npm install
ADD . /app

CMD ["--etcd-hosts=172.17.42.1:4001"]
ENTRYPOINT ["/nodejs/bin/npm", "start"]
EXPOSE 8080
