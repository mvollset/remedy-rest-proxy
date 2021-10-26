# remedy-rest-proxy

For some reason BMC decided that the smart thing would be to use their "own" authentication method. Even if it is very similar to an Oauth, it still requires some special handling 
of token prefixes etc. This means that the, actually really fast and well functioning, ARS rest api can be somewhat hard to get too without writing code. 

So to enable "Basic auth" for the remedy rest api, I wrote this little proxy a few years ago. I say this because the connect-app style is somewhat dated, even if it works really well. 
There are traces in the code of a larger and slightly richer implementation, 
but this can easily be reintroduced by anyone interested. 

## How to use.
Install node on a server that has access to the port that exposes the remedy rest api. Edit the config.js file in the config directory. Set the environment variable PORT to the port
the proxy should listen on, and run server.js. By pointing your rest calls to the preoxy you should be able to access it sending the username and password in the Basic header. 

## TODO:
If this is suppose to handle any real traffic, you should implement some kind of reuse of tokens and logout any expired or unused tokens.
