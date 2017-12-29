/*
 * Personal Capital API NodeJS Wrapper
 * @author John Collins
 * @license MIT
 * @version 0.1.0
 */

'use strict';

// Dependencies

let Promise = require("bluebird");
let request = require('request-promise');
let readline = require('readline');
let fs = require('fs');
let cookieStore = require('tough-cookie-file-store');
let cookieJar = request.jar(new cookieStore('./pc-cookie.json'));
request = request.defaults({
    "headers" : {
        "Accept" : "*/*",
        "User-Agent" : "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36",
    },
    "jar" : cookieJar
});

const DEVICE_NAME = "pcjs";
const URL_BASE = "https://home.personalcapital.com";
const ENDPOINTS = {
    //Auth
    "identifyUser" : "/api/login/identifyUser",
    "querySession" : "/api/login/querySession",
    //Auth
    "challengeSms" : "/api/credential/challengeSms",
    "authenticateSms" : "/api/credential/authenticateSms",
    "challengeEmail" : "/api/credential/challengeEmail",
    "authenticateEmail" : "/api/credential/authenticateEmail",
    "authenticatePassword" : "/api/credential/authenticatePassword",
    //DeAuth
    "switchUser" : "/api/login/switchUser",
    //Fetch
    "getCategories" : "/api/transactioncategory/getCategories",
    "getUserMessages" : "/api/message/getUserMessages",
    "getAccounts" : "/api/newaccount/getAccounts2",
    "getAdvisor" : "/api/profile/getAdvisor",
    "getFunnelAttributes" : "/api/profile/getFunnelAttributes",
    "getPerson" : "/api/person/getPerson",
    "getHistories" : "/api/account/getHistories",
    "getUserSpending" : "/api/account/getUserSpending",
    "getRetirementCashFlow" : "/api/account/getRetirementCashFlow",
    "getQuotes" : "/api/invest/getQuotes",
    "getHoldings" : "/api/invest/getHoldings",
    "searchSecurity" : "/api/invest/searchSecurity",
    "getUserTransactions" : "/api/transaction/getUserTransactions",
    "getCustomProducts" : "/api/search/getCustomProducts",
    //Push
    "updateUserMessages" : "/api/message/updateUserMessages",
    "createAccounts2" : "/api/newaccount/createAccounts2",

};
const PAYLOADS = {
    "template" : function(csrf) {
        this.apiClient = "WEB";
        this.csrf = csrf;
        return this;
    },
    "identifyUser" : function(csrf, username) {
        let temp = new PAYLOADS["template"](csrf);
        temp.bindDevice = false;
        temp.skipLinkAccount = false;
        temp.username = username;
        return temp;
    },
    "template2fa" : function(csrf) {
        let temp = new PAYLOADS["template"](csrf);
        temp.bindDevice = false;
        temp.challengeReason = "DEVICE_AUTH";
        temp.challengeMethod = "OP";
    },
    "challenge2fa" : function(csrf, challengeType) {
        let temp = new PAYLOADS["template2fa"](csrf);
        temp.challengeType = challengeType;
        return temp;
    },
    "authenticate2fa" : function(csrf, code) {
        let temp = new PAYLOADS["template2fa"](csrf);
        temp.code = code;
        return temp;
    },
    "authenticatePassword" : function(csrf, password, deviceName) {
        let temp = new PAYLOADS["template"](csrf);
        temp.bindDevice = false;
        temp.skipLinkAccount = false;
        temp.passwd = password;
        temp.deviceName = deviceName;
        return temp;
    },
    "endpoint" : function(csrf) {
        let temp = new PAYLOADS["template"](csrf);
        temp.lastServerChangeId = -1;
        return temp;
    },
    /* Below are endpoint() payloads.*/
    "getTransactions" : function(accounts, start_date, end_date) {
        this.userAccountIds = accounts;
        this.startDate = start_date;
        this.endDate = end_date;
        this.page = 0;
        this.rows = -1;
        this.sort_cols = "transactionTime";
        //this.sort_rev = "true"; //Recent transactions first
        this.component = "DATAGRID";
        return this;
    },
    "getHoldings" : function(accounts) {
        this.userAccountIds = accounts;
        return this;
    },
    "getHistories" : function(accounts, start_date, end_date, interval, types) {
        this.userAccountIds = accounts;
        this.startDate = start_date;
        this.endDate = end_date;
        this.intervalType = interval;
        this.types = types;
    },
    "getCashFlow" : function(accounts, start_date, end_date, interval) {
        return new PAYLOADS["getHistories"](accounts, start_date, end_date, interval, ["cashflows"]);
    }
};

module.exports = new PersonalCapital();

function PersonalCapital() {

/*
 *  Authenticates a PersonalCapital-js session.
 *  Requires an email, password, and set up 2FA type. (not sure how it handles if no 2FA is set up)
 */

    this.auth = function auth(email, password, two_factor_type) {
        let self = this;
        self.two_factor_type = two_factor_type;
        self.email = email;
        self.passwd = password;
        return new Promise(function(resolve, reject) {
            getTempCsrf(self).catch(reject)
                .then(identifyUser).catch(reject)
                .then(twoFactorAuth).catch(reject)
                .then(authPassword).catch(reject)
                .then(function(res){
                    resolve();
                })
        });
    };

/*
 *  Destroys the current session cookies, effectively de-authenticating the current stored session.
 */

    this.deauth = function deauth() {
        let self = this;
        return new Promise(function(resolve, reject) {
            fs.unlinkSync("pc-cookie.json");
            cookieJar = request.jar(new cookieStore('./pc-cookie.json'));
            self.csrf = null;
            resolve();
        });
    };

/*
 *  Generic function to access any endpoint in the Personal Capital API.
 *  Endpoint string and payload data are available above and in the documentation for currently implemented
 *  API endpoints.
 */

    this.endpoint = function endpoint(endpoint, data) {
        let self = this;
        return new Promise(function(resolve, reject) {
            let payload = PAYLOADS.endpoint(self.csrf);
            Object.keys(data).forEach(function(key) { payload[key] = data[key]; });
            let uri = URL_BASE + ENDPOINTS[endpoint];
            let options = {
                "uri" : uri,
                "form" : payload,
                "jar" : cookieJar,
            };
            request.post(options)
                .catch(reject)
                .then(function(body){
                    resolve(JSON.parse(body)["spData"]);
                });
        });
    };

/*
 *  Calls the getAccounts endpoint with standard parameters.
 *  Resolves the raw JSON that is provided from the server for this endpoint.
 */

    this._getAccounts = function _getAccounts() {
        let self = this;
        return new Promise(function(resolve, reject) {
            self.endpoint("getAccounts", {})
                .catch(reject)
                .then(function(data){
                    resolve(data);
                })
        });
    };

/*
 *  Sugar function for _getAccounts.
 *  Resolves only the net worth breakdown section of the returned JSON.
 */

    this.getNetWorthBreakdown = function getNetWorthBreakdown() {
        let self = this;
        return new Promise(function(resolve, reject) {
            self._getAccounts()
                .catch(reject)
                .then(function(data) {
                    delete data["accounts"];
                    resolve(data);
                });
        });
    };

/*
 *  Sugar function for _getAccounts.
 *  Resolves only the account summaries section of the returned JSON.
 */

    this.getAccounts = function getAccounts() {
        let self = this;
        return new Promise(function(resolve, reject) {
            self._getAccounts()
                .catch(reject)
                .then(function(data) {
                    resolve(data["accounts"]);
                });
        });
    };

/*
 *  Resolves a JSON object of all transactions between the start_date and end_date for the provided accounts.
 *  If accounts is null, will gather data for all accounts.
 *  If start_date is null, will get all available data as far back as January 1st 1970, if for some reason you need
 *  data before this it can be manually specified.
 *  If end_date is null, will get up to the most recent gathered data.
 */

    this.getTransactions = function getTransactions(accounts, start_date, end_date) {
        let self = this;
        return new Promise(function(resolve, reject) {
            let now = new Date();
            if(start_date == null){
                start_date = "1970-01-01";
            }
            if(end_date == null){
                end_date = now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate();
            }
            self.endpoint("getUserTransactions", PAYLOADS.getTransactions(accounts, start_date, end_date))
                .catch(reject)
                .then(function(data){
                    resolve(data);
                })
        });
    };

/*
 *  Resolves a JSON object of all investment holdings for the specified accounts.
 *  If accounts is null, will return investment holdings for all accounts.
 */

    this.getHoldings = function getHoldings(accounts) {
        let self = this;
        return new Promise(function(resolve, reject) {
            self.endpoint("getHoldings", PAYLOADS.getHoldings(accounts))
                .catch(reject)
                .then(function(data){
                    resolve(data);
                })
        });
    };

/*
 *
 *
 *
 */

    this.getHistories = function getTransactions(accounts, start_date, end_date, interval, types) {
        let self = this;
        return new Promise(function(resolve, reject) {
            let now = new Date();
            if(start_date == null){
                start_date = "1970-01-01";
            }
            if(end_date == null){
                end_date = now.getFullYear()+'-'+(now.getMonth()+1)+'-'+now.getDate();
            }
            self.endpoint("getHistories", PAYLOADS.getHistories(accounts, start_date, end_date, interval, types))
                .catch(reject)
                .then(function(data){
                    resolve(data);
                })
        });
    };
}

/* Private Functions */

function getTempCsrf(self) {
    return new Promise(function(resolve, reject) {
        let options = {
            url : URL_BASE,
        };
        request.get(options)
            .catch(function(reason){
                reject(reason);
            })
            .then(function(body){
                let csrf_regex = new RegExp("globals.csrf='([a-f0-9-]+)'");
                let csrf_temp = body.match(csrf_regex);
                if(csrf_temp == null){
                    self.csrf = fs.readFileSync("pc-config.json");
                } else {
                    csrf_temp = csrf_temp[0].slice(14, csrf_temp.length - 1);
                    self.csrf = csrf_temp;
                }
                resolve(self);
            })
    });
}

function identifyUser(self) {
    return new Promise(function(resolve, reject) {
        let uri = URL_BASE + ENDPOINTS["identifyUser"];
        let options = {
            "uri" : uri,
            "form" : PAYLOADS.identifyUser(self.csrf, self.email),
        };
        request.post(options)
            .catch(function(reason){
                reject(reason);
            })
            .then(function(body){
                self.csrf = JSON.parse(body)["spHeader"]["csrf"];
                fs.writeFileSync("pc-config.json", self.csrf);
                self.auth_level = JSON.parse(body)["spHeader"]["authLevel"];
                resolve(self);
            })
    });
}

function twoFactorAuth(self) {
    return new Promise(function(resolve, reject) {
        if(self.auth_level === "USER_REMEMBERED")
        {
            resolve(self);
        } else {
            let auth_uri = "";
            let challenge_uri = "";
            let auth_type = "";
            if(self.two_factor_type === "SMS"){
                auth_type = 0;
                challenge_uri = URL_BASE + ENDPOINTS["challengeSms"];
                auth_uri = URL_BASE + ENDPOINTS["authenticateSms"];
            } else if(self.two_factor_type === "EMAIL") {
                challenge_uri = URL_BASE + ENDPOINTS["challengeEmail"];
                auth_type = 2;
                auth_uri = URL_BASE + ENDPOINTS["authenticateEmail"];
            }
            let options = {
                "uri" : challenge_uri,
                "form" : PAYLOADS.challenge2fa(self.csrf, auth_type),
            };
            request.post(options)
                .catch(function(reason){
                    reject(reason);
                })
                .then(function(body){
                    self.auth_level = JSON.parse(body)["spHeader"]["authLevel"];
                    let r1 = readline.createInterface({
                        input : process.stdin,
                        output : process.stdout
                    });
                    r1.question("Enter 2FA code : ", function(answer) {
                        let options = {
                            "uri" : auth_uri,
                            "form" : PAYLOADS.authenticate2fa(self.csrf, answer),
                        };
                        r1.close();
                        request.post(options)
                            .catch(reject)
                            .then(function(body){
                                self.auth_level = JSON.parse(body)["spHeader"]["authLevel"];
                                resolve(self);
                            });
                    });
                })
        }
    });
}

function authPassword(self) {
    return new Promise(function(resolve, reject) {
        let uri = URL_BASE + ENDPOINTS["authenticatePassword"];
        let options = {
            "uri" : uri,
            "form" : PAYLOADS.authenticatePassword(self.csrf, self.passwd, DEVICE_NAME),
        };
        request.post(options)
            .catch(reject)
            .then(function(body){
                self.auth_level = JSON.parse(body)["spHeader"]["authLevel"];
                resolve(self);
            })
    });
}
