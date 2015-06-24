FROM iojs:2.3.0

ENV NPM_CONFIG_LOGLEVEL warn

# iojs wants to put everything in /usr/src/app, so let's avoid that.
RUN mkdir -p /app
WORKDIR /app

# first copy over the package.json, since changes to source code shouldn't
# invalidate the installed packages, only changes to package.json.
COPY ./package.json ./
RUN npm install

# Then copy the actual stuff over.
COPY . .

EXPOSE 3000
ENV DEBUG *
CMD ["node", "webhook.js"]