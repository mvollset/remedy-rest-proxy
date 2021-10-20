const util = require('util'),
  http = require('http'),
  https = require("https"),
  connect = require('connect'),
  httpProxy = require('http-proxy'),
  config = require('./config'),
  winston = require("winston"),
  querystring = require('querystring')
///
///Logger setup
///
var transports = [new(winston.transports.File)({
  name: 'log',
  filename: './log/server.log',
  level: config.loglevel
})];
if (config.console) {
  transports.push(new(winston.transports.Console)({
    name: 'console',
    level: config.console
  }));
}
var logger = winston.createLogger({
  transports: transports
});
///End logger

const PROXY_URL = "http" + (config.https === true ? "s" : "") + "://" + config.server + (config.port ? (":" + config.port) : "") + "/";

if (!config.port) {
  if (config.https)
    config.port = 443;
  else
    config.port = 80;
}
var protocol = config.https ? https : http;
var agent = new protocol.Agent({
  maxSockets: Number.MAX_VALUE
});
function getAuthheader(request){
    const fullHeader = request.headers["authorization"];
    if(!fullHeader||fullHeader.length<7||!fullHeader.indexOf('Basic ')==0)
        throw new Error("Wrong authorization type");
    return fullHeader.substr(6) //Skip Basic 
}
function decodeAuthheader(headerValue){
    let buff = Buffer.from(headerValue,'base64');
    const result = buff.toString();
    const userandpass = result.split(':');
    return {
        user:userandpass[0],
        password:userandpass[1]
    } ;
}
function getCredentials(request){
    let logger = request.logger;
    logger.debug("debug");
    logger.warn('warn');
    const authHeader =  getAuthheader(request);
    return decodeAuthheader(authHeader);
    

}
///Basic connect app
var app = connect();
app.use(function(request,response,next){
    request.logger = logger;
    request.userinfo = getCredentials(request);
    next();
})
//Last callback function 
app.use(function(request, response) {
 request.logger = logger;
  //Lookup user from usercache
  console.log(request.userinfo);
  //If user exists in cache and token is still valid proxy request with existing token.
  
  logger.debug("Remedy Credentials:",request.userinfo);
  //logger.debug(user.remedyCredentials);
  var post_data = querystring.stringify({
    username: request.userinfo.user,
    password: request.userinfo.password
  });
  ///
  ///Log on to remedy 
  ///
  var postOptions = {
    path: "/api/jwt/login",
    host: config.server,
    port: config.port,
    https: config.https,
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Content-Length": Buffer.byteLength(post_data)
        /*"SKE-JWT-Auth": request.headers["ske-jwt-auth"],
        "korrelasjonsid": request.headers["korrelasjonsid"]*/
    }
  };
  if (config.alwaysForwardHeaders && config.alwaysForwardHeaders.length) {
    for (var i = 0; i < config.alwaysForwardHeaders; i++) {
      var header = config.alwaysForwardHeaders[i]
      postOptions.headers[header] = request.headers[header];
    }
  }
  logger.debug('Post options:', postOptions);
  var post_req = protocol.request(postOptions, function(resp) {
    logger.debug("returned from AR authenicate");
    var authenticated = false;
    if (resp.statusCode !== 200) {
      logger.error("Authentication returned: ", resp.statusCode);

    }
    else {
      authenticated = true;
    }

    var token;
    var body = ''
    resp.setEncoding("utf8");
    resp.on("data", function(chunk) {
      if (authenticated === true)
        token = "AR-JWT " + chunk;
      else
        body += chunk;
    }).on("end", function() {
      if (token && authenticated === true) {
        proxy.web(request, response, {
          target: request.rewrittenURL ? PROXY_URL + request.rewrittenURL : PROXY_URL,
          ignorePath: !(request.rewrittenURL === undefined),
          headers: getProxyHeaders(request.validateBody, token)
        });
      }
      else {
        logger.warn("Wrong Remedy password/user");
        logger.debug("Response from Remedy/UU", body);
        response.statusCode = 401;
        response.setHeader('WWW-Authenticate', 'Basic realm="example"');
        response.end("Access denied");
      }

    });
  });
  post_req.on("error", function(err) {
    logger.log('error', err);
    response.statusCode = 500;
    response.end("Error:", err);
  });
  post_req.write(post_data);
  post_req.end();
  logger.debug("Sent to Authentication");
});

function getProxyHeaders(validatedBody, token) {
  logger.debug("Get proxy headers");
  var headers = {};
  headers["Authorization"] = token;
  headers["host"] = config.server;
  if (validatedBody) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(validatedBody);
  }

  return headers

}
//
// Basic Http Proxy Server
//
var proxy = httpProxy.createProxyServer({
  secure: false,
  agent: agent
});
proxy.on('proxyReq', function(proxyReq, req, res, options) {
  logger.debug("proxied");
  if (req.validatedBody) {
    proxyReq.write(req.validatedBody);
  }
});
proxy.on('proxyRes', function(proxyRes, req, res) {
  logger.debug("Returned from proxy");
  logger.debug('RAW Response from the target', JSON.stringify(proxyRes.headers, true, 2));
});

//
// Target Http Server//
var server = http.createServer(app).listen(process.env.PORT || 8008);
//call userToken reaper to remove all expired user tokens every 2 minutes....
//Handle expect 100-continue header.
server.on('checkContinue', (req, res) => {
  if (config.handleExpect === true) {
    req.hasExpectations = true;
    res.writeContinue();
    server.emit('request', req, res);
  }

  else {

    logger.debug("Responded with 417");
    res.writeHead(417, {
      'Content-Type': 'text/plain'
    });
    res.end('Something went wrong. Please try again.');
  }
});
function logoutUser2(token,callback){
    var postOptions = {
        path: "/api/jwt/logout",
        host: config.server,
        port: config.port,
        https: config.https,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          'Authorization': token
        }
      };
      var logout_req = protocol.request(postOptions, function(resp) {
        logger.debug("returned from AR Logout");
        if (resp.statusCode !== 204 && resp.statusCode != 401) {
          logger.error("Failed to log out session" + userid);
          callback();
  
        }
        else {
          callback();
        }
      });
      logout_req.on("error", function(err) {
        logger.log('error', err);
        callback(err);
  
      });
      logout_req.write("");
      logout_req.end();
      logger.debug("Sent logout request for user " + userid);
    }

function logoutUser(userid, callback) {
  var user = users[userid];
  if (user.awtToken && (user.awtTokenExpiration - 500) < Math.floor(Date.now() / 1000)) {
    var postOptions = {
      path: "/api/jwt/logout",
      host: config.server,
      port: config.port,
      https: config.https,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        'Authorization': user.awtToken
      }
    };
    var logout_req = protocol.request(postOptions, function(resp) {
      logger.debug("returned from AR Logout");
      if (resp.statusCode !== 204 && resp.statusCode != 401) {
        logger.error("Failed to log out session" + userid);
        user.awtToken = null;
        user.awtTokenExpiration = null;
        callback();

      }
      else {
        user.awtToken = null;
        user.awtTokenExpiration = null;
        callback();
      }
    });
    logout_req.on("error", function(err) {
      logger.log('error', err);
      callback(err);

    });
    logout_req.write("");
    logout_req.end();
    logger.debug("Sent logout request for user " + userid);
  }
  else {
    callback();
  }
}
