const env = process.env.NODE_ENV || "dev";

let config = {
    dev : {
        fireBaseUrl : 'https://firebasestorage.googleapis.com/v0/b/hire2inspire-62f96.appspot.com/o/'
    } ,
    prod : {
         fireBaseUrl : 'https://firebasestorage.googleapis.com/v0/b/hire2inspire-62f96.appspot.com/o/'
    }

}

module.exports = config[env]