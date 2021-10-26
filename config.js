//process.env.VALIDATING_PROXY_KEY must be set this is 
//process.env.VALIDATING_PROXY_JWTSECRET
module.exports={
    //http://myremedyserver.prod.local:8008/api/jwt/login
    https:false,
    server:'myremedyserver.prod.local',
    port:8008,
    handleExpect:true,
    loglevel:"debug",
    console:'debug'
}
