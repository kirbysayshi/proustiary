Proustiary
==========

A... proustionaire?

**THIS IS ONE HUGE EXPERIMENT, BE CAREFUL.**

Use SMS to respond to questions about your life in the moment. Maybe look at your responses in the future?

Responses are stored slightly anonymized, where your phone number is hashed to provide one level of indirection. Future plans include fully encrypted responses, if this idea pans out.

WHY
---

I was reading http://thehairpin.com/2015/01/since-living-alone/, by [Durga Chew-Bose](https://twitter.com/durgapolashi), and stumbled across something else she'd written: http://thehairpin.com/2015/06/addendum-to-the-proust-questionnaire/. I hadn't heard of the Proust Questionaire until then.

I then wondered about cataloging my responses to some of these questions over time, and if that would be neat or not. Also if it should be public, or something private.

I figured SMS was the easiest way to both remind myself and respond.

Adding questions
----------------

Edit `local-dist.json` and add more questions! Right now only text is supported as responses but I'd like images (MMS) to work soon in the future.

Code Inspiration
----------------

So many patterns, documentation, and code snippets taken from https://github.com/bigboringsystem/bigboringsystem, especially conf, twilio, and db patterns.

Development
-----------

Clone the repo, copy `local-dist.json` to `local.json`, then signup for a Twilio account and insert your SID and Auth Token from https://www.twilio.com/user/account/ into `local.json`. Also include your Twilio phone number for the `twilioNumber` field, including the leading `+`. For the US this looks like: `+17183069842`.

You'll likely want your server to be reachable by Twilio, so fire up ngrok:

```
npm run twilio-dev-tunnel
```

And add the URL it gives you to Twilio's web configuration, appending `/twebhook`. For example:

```
https://HEXNUMBERHERE.ngrok.com/twebhook
```

Then:

```
npm start
```

Deployment via Docker
---------------------

Clone this repo, and create a local.json.

**Build a container:**

```
docker build -t proustiary-container .
```

**Run the container:**

```
docker run -d -p 80:3000 --name proustiary -v $PWD/db:/db proustiary-container
```

**-d** runs the container as a daemon process

**-p 80:3000** binds port 3000 of the app to port 80 on our server

**--name bbs** a name we can use to refer to this process

**-v $PWD/db:/db** mount the db folder in our present working directory to the db folder used by the app (makes database persistent)

**proustiary-container** the name of the container to use

You can now easily stop and start this process with `docker stop proustiary` && `docker start proustiary`

If you make changes you will need to rebuild the container.

You can also link in your config file externally during the `run` command to prevent having to rebuild the container each time:

```
docker run -d -p 80:3000 --name proustiary -v $PWD/db:/db -v $PWD/local.json:/local.json proustiary-container
```


LICENSE
-------

BSD-3 Clause

Some code is taken directly from https://github.com/bigboringsystem/bigboringsystem, and is marked where applicable.
