#!/usr/bin/env node

var deviceName = "pcjs";

var URL_BASE = "https://home.personalcapital.com";
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
        //Push
        "updateUserMessages" : "/api/message/updateUserMessages",
        "createAccounts2" : "/api/newaccount/createAccounts2",
        "getQuotes" : "/api/invest/getQuotes",
        "getHoldings" : "/api/invest/getHoldings",
        "searchSecurity" : "/api/invest/searchSecurity",
        "getUserTransactions" : "/api/transaction/getUserTransactions",
        "getCustomProducts" : "/api/search/getCustomProducts",

};
const PAYLOADS = {
        "template" : function(csrf) {
                this.apiClient = "WEB";
                this.bindDevice = false;
                this.csrf = csrf;
                return this;
        },
        "identifyUser" : function(csrf, username) {
                let temp = new PAYLOADS["template"](csrf);
                temp.skipLinkAccount = false;
                temp.username = username;
                return temp;
        },
        "template2fa" : function(csrf) {
                let temp = new PAYLOADS["template"](csrf);
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
        }
}
function POST_OPTIONS(uri, cookiejar, payload){
        var temp = {
                uri : uri,
                jar : cookiejar,
                form : payload,
        };
        return temp;
}

var Promise = require("bluebird");
var request = require('request-promise');
const readline = require('readline');
var fs = require('fs');
var cookieStore = require('tough-cookie-file-store');
var cookieJar = request.jar(new cookieStore('./pc-cookie.json'));

module.exports = new PersonalCapital();

function PersonalCapital() {}

PersonalCapital.prototype.auth = function(email, password, two_factor_type) {
        var self = {
                two_factor_type : two_factor_type,
                email : email,
                passwd : password,
        };
        return new Promise(function(resolve, reject) {
                getTempCsrf(self).catch(reject)
                .then(identifyUser).catch(reject)
                .then(twoFactorAuth).catch(reject)
                .then(authPassword).catch(reject)
                .then(function(res){
                        this.csrf = res.csrf;
                        resolve();
                })
        });
}

PersonalCapital.prototype.deauth = function() {
        return new Promise(function(resolve, reject) {
                fs.unlinkSync("pc-cookie.json");
                cookieJar = request.jar(new cookieStore('./pc-cookie.json'));
                this.csrf = null;
                resolve();
        });
}

PersonalCapital.prototype.endpoint = function(endpoint, data) {
        return promise = new Promise(function(resolve, reject) {
                let payload = {
                        "lastServerChangeId" : "-1",
                        "csrf" : this.csrf,
                        "apiClient" : "WEB"
                };
                payload = Object.assign(payload, data);
                let uri = URL_BASE + ENDPOINTS[endpoint];
                let options = {
                        "uri" : uri,
                        "form" : payload,
                        "jar" : cookieJar,
                };
                request.post(options)
                .catch(reject)
                .then(function(body){
                        console.log(body);
                        resolve(body);
                });
        });
}


function getTempCsrf(self) {
        return new Promise(function(resolve, reject) {
                let options = {
                        url : URL_BASE,
                        jar : cookieJar
                }
                request.get(options)
                .catch(function(reason){
                        reject(reason);
                })
                .then(function(body){
                        let csrf_regex = new RegExp("globals.csrf='([a-f0-9-]+)'");
                        let csrf_temp = body.match(csrf_regex)
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
                let payload = {
                        "username" : self.email,
                        "csrf" : self.csrf,
                        "apiClient" : "WEB",
                        "bindDevice" : "false",
                        "skipLinkAccount" : "false",
                        "redirectTo" : "",
                        "skipFirstUse" : "",
                        "referrerId" : "",
                };
                let uri = URL_BASE + ENDPOINTS["identifyUser"];
                let options = {
                        "uri" : uri,
                        "form" : payload,
                        "jar" : cookieJar,
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
                if(self.auth_level == "USER_REMEMBERED")
                {
                        resolve(self);
                } else {
                        let auth_uri = "";
                        let challenge_uri = "";
                        let auth_type = "";
                        if(self.two_factor_type == "SMS"){
                                auth_type = 0;
                                challenge_uri = URL_BASE + ENDPOINTS["challengeSms"];
                                auth_uri = URL_BASE + ENDPOINTS["authenticateSms"];
                        } else if(self.two_factor_type == "EMAIL") {
                                challenge_uri = URL_BASE + ENDPOINTS["challengeEmail"];
                                auth_type = 2;
                                auth_uri = URL_BASE + ENDPOINTS["authenticateEmail"];
                        }
                        let payload = {
                                "challengeReason" : "DEVICE_AUTH",
                                "challengeMethod" : "OP",
                                "challengeType" : auth_type,
                                "apiClient" : "WEB",
                                "bindDevice" : "false",
                                "csrf" : self.csrf,

                        };
                        let options = {
                                "uri" : challenge_uri,
                                "form" : payload,
                                "jar" : cookieJar,
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
                                        delete payload["challengeType"];
                                        payload["code"] = answer;
                                        options["uri"] = auth_uri;
                                        options["form"] = payload;
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
                let payload = {
                        "bindDevice" : "true",
                        "deviceName" : deviceName,
                        "redirectTo" : "",
                        "skipFirstUse" : "",
                        "skipLinkAccount" : "false",
                        "referrerId" : "",
                        "passwd" : self.passwd,
                        "apiClient" : "WEB",
                        "csrf" : self.csrf,
                }
                let uri = URL_BASE + ENDPOINTS["authenticatePassword"];
                let options = {
                        "uri" : uri,
                        "form" : payload,
                        "jar" : cookieJar,
                }
                request.post(options)
                .catch(reject)
                .then(function(body){
                        self.auth_level = JSON.parse(body)["spHeader"]["authLevel"];
                        resolve(self);
                })
        });
}
