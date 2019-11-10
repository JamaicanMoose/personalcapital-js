/*
 * Personal Capital API NodeJS Wrapper
 * @author John Collins
 * @license MIT
 * @version 2.0.1
 */

'use strict';

let request = require('request-promise-native');
let readline = require('readline-promise').default;
let fs = require('fs');
let path = require('path');
let assert = require('assert');
const Enum = require('enumify').Enum;

class AuthLevel extends Enum {}
AuthLevel.initEnum([
  'NONE',
  'USER_IDENTIFIED',
  'USER_REMEMBERED',
  'DEVICE_AUTHORIZED',
  'SESSION_AUTHENTICATED'
]);

const PASSED2FA = [AuthLevel.USER_REMEMBERED, AuthLevel.DEVICE_AUTHORIZED, AuthLevel.SESSION_AUTHENTICATED];

class TwoFactorMode extends Enum {}
TwoFactorMode.initEnum([
  'SMS',
  'PHONE',
  'EMAIL'
]);

class AccountNotFoundError extends Error {}
class HoldingNotFoundError extends Error {}

/*
 * PersonalCapital-js sesson class.
 */

class PersonalCapital {
  constructor(name = 'pcjs' /*String*/, cookiejar = request.jar() /*RequestJar*/) {
    Object.assign(this, {
      __name__ : name,
      __request__ : request.defaults({
          "baseUrl" : "https://home.personalcapital.com",
          "headers" : {
              "Accept" : "*/*",
              "User-Agent" : "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/41.0.2228.0 Safari/537.36",
          },
          "jar" : cookiejar
      }),
      __auth_mode__ : null,
      __auth_level__ : AuthLevel.NONE,
      __csrf__ : null,
    });
    this.authCompleted = () => this.__auth_level__ === AuthLevel.SESSION_AUTHENTICATED;
    this.twoFactorCompleted = () => PASSED2FA.includes(this.__auth_level__);
    Object.assign(this, {
      __payload_consts__ : {
        __core__ : () => ({ apiClient: 'WEB', csrf: this.__csrf__ }),
        __auth__ : () => ({ ...(this.__payload_consts__.__core__()), bindDevice: false }),
        __login__ : () => ({ ...(this.__payload_consts__.__auth__()), skipLinkAccount: false }),
        __twof__ : () => ({ ...(this.__payload_consts__.__auth__()), challengeReason: 'DEVICE_AUTH', challengeMethod: 'OP' }),
        __endpoint__ : () => ({ ...(this.__payload_consts__.__core__()), lastServerChangeId: -1 })
      },
      payload : {
        loginid: (username) => ({ ...(this.__payload_consts__.__login__()), username }),
        loginpass: (passwd) => ({ ...(this.__payload_consts__.__login__()), passwd, deviceName: this.__name__, bindDevice: true }),
        twofcha: (challengeType) => ({ ...(this.__payload_consts__.__twof__()), challengeType }),
        twofauth: (code) => ({ ...(this.__payload_consts__.__twof__()), code }),
        endpoint: {
          gettransactions: (accounts, startDate, endDate) => ({
            userAccountIds: accounts, startDate, endDate, page: 0, rows: -1,
            sort_cols: 'transactionTime', component: 'DATAGRID'
          }),
          getholdings: (accounts) => ({ userAccountIds: accounts }),
          gethistories: (accounts, startDate, endDate, intervalType, types) => ({
            userAccountIds: accounts, startDate, endDate, intervalType, types
          }),
          updatebalance: (account, newBalance) => ({
              ...account,
              isTransferPending: false,
              isTransferEligible: true,
              employerMatchLimitType: "dollar",
              requestSource: "USER",
              balance: newBalance,
              currentBalance: newBalance,
              availableBalance: newBalance
          }),
          addholding: (userAccountId, ticker, description, quantity, price, costBasis) => ({
            userAccountId,
            ticker,
            description,
            quantity,
            price,
            value: price * quantity,
            costBasis,
            source: "USER"
          }),
          updateholding: (holding, quantity, price, costBasis) => ({
            ...holding,
            quantity,
            price,
            value: price * quantity,
            costBasis,
            source: "USER"
          }),
          updateinvestmentcashbalance: (userAccountId, newBalance) => ({
            userAccountId,
            description: "Cash",
            quantity: newBalance,
            price: newBalance,
            priceSource: "USER",
            sourceAssetId: "USER_DESCR_Cash"
          }),
        }
      },
      uris : {
        loginid: '/api/login/identifyUser',
        loginpass: '/api/credential/authenticatePassword',
        twofcha: {
          SMS: '/api/credential/challengeSms',
          EMAIL: '/api/credential/challengeEmail'
        },
        twofauth: {
          SMS: '/api/credential/authenticateSms',
          EMAIL: '/api/credential/authenticateEmail'
        },
        getaccounts: '/api/newaccount/getAccounts2',
        gettransactions: '/api/transaction/getUserTransactions',
        getholdings: '/api/invest/getHoldings',
        gethistories: '/api/account/getHistories',
        updatebalance: '/api/newaccount/updateAccount',
        updateholding: '/api/account/updateHolding',
        addholding: '/api/account/addHolding'
      }
    });
  }


  async __getTempCsrf__() {
    let res = await this.__request__.get({uri:'/'});
    let match = res.match(/globals.csrf='([a-f0-9-]+)'/);
    this.__csrf__ = (match === null ? fs.readFileSync('pc-csrf.json') : match[1]);
    return;
  }

  async __identifyUser__(username /*String*/) {
    assert(this.__csrf__ !== null);
    let res = await this.__request__.post({
      uri: this.uris.loginid,
      form: this.payload.loginid(username)
    });
    let resHeader = JSON.parse(res).spHeader;
    if ('csrf' in resHeader) {
      this.__csrf__ = resHeader.csrf;
      fs.writeFileSync('pc-csrf.json', this.__csrf__);
    }
    this.__auth_level__ = AuthLevel.enumValueOf(resHeader.authLevel);
    return;
  }

  async __2FAChallenge__(mode /*TwoFactorMode*/) {
    assert(this.__auth_level__ !== AuthLevel.NONE);
    if (this.twoFactorCompleted()) return;
    assert(mode instanceof TwoFactorMode)
    this.__auth_mode__ = mode;
    let res = await this.__request__.post({
      uri: this.uris.twofcha[this.__auth_mode__.name],
      form: this.payload.twofcha(mode.ordinal)
    });
    let resHeader = JSON.parse(res).spHeader;
    return;
  }

  async __2FAAuth__(code /*String*/) {
    assert(this.__auth_level__ !== AuthLevel.NONE);
    if (this.twoFactorCompleted()) return;
    assert(this.__auth_mode__ !== null &&
      this.__auth_mode__ !== TwoFactorMode.PHONE);
    let res = await this.__request__.post({
      uri: this.uris.twofauth[this.__auth_mode__.name],
      form: this.payload.twofauth(code)
    });
    let resHeader = JSON.parse(res).spHeader;
    this.__auth_level__ = AuthLevel.enumValueOf(JSON.parse(res).spHeader.authLevel);
    return;
  }

  async __passwordAuth__(passwd /*String*/) {
    let res = await this.__request__.post({
      uri: this.uris.loginpass,
      form: this.payload.loginpass(passwd)
    });
    let resHeader = JSON.parse(res).spHeader;
    this.__auth_level__ = AuthLevel.enumValueOf(JSON.parse(res).spHeader.authLevel);
  }

  async auth(username /*String*/, passwd /*String*/, twofactormode = TwoFactorMode.SMS /*TwoFactorMode*/){
    await this.__getTempCsrf__();
    await this.__identifyUser__(username);
    if (!this.authCompleted()) {
      if (!this.twoFactorCompleted()) {
        await this.__2FAChallenge__(twofactormode);
        let r1 = readline.createInterface({input: process.stdin, output: process.stdout});
        const resp = await r1.questionAsync('Enter 2FA code : ');
        await this.__2FAAuth__(resp);
      }
      await this.__passwordAuth__(passwd);
    }
  }

  async endpoint(target /*String*/, data = {} /*Object*/) {
    let res = await this.__request__.post({
      uri: this.uris[target],
      form: { ...(this.__payload_consts__.__endpoint__()), ...data }
    });
    return JSON.parse(res).spData;
  }

  async getNetWorth() {
    let res = await this.endpoint('getaccounts');
    delete res.accounts;
    return res;
  }

  async getAccounts() {
    let res = await this.endpoint('getaccounts');
    return res.accounts;
  }

  async getTransactions(accounts /*Array[String]*/, startDate = '1970-01-01' /*String*/, endDate = new Date().toISOString().slice(0,10) /*String*/) {
    let res = await this.endpoint('gettransactions', this.payload.endpoint.gettransactions(accounts, startDate, endDate));
    return res;
  }

  async getHoldings(accounts /*Array[String]*/) {
    let res = await this.endpoint('getholdings', this.payload.endpoint.getholdings(accounts));
    return res;
  }
//["balances","dailyChangeAmount"]
//["networth","balances"]
//["balances"]
//[{"key":"includeNetworthCategoryDetails","value":"true"}]
  async getHistories(accounts /*Array[String]*/, startDate = '1970-01-01' /*String*/, endDate = new Date().toISOString().slice(0,10) /*String*/, intervalType /*String*/, types /*Array[String]*/) {
    let res = await this.endpoint('gethistories', this.payload.endpoint.gethistories(
      accounts, startDate, endDate, intervalType, types));
    return res;
  }

  // accountName must match name on account exactly
  // This method supports all custom accounts other than Custom Stock Options and Manual Investment Holdings
  async updateBalance(accountName /*String*/, newBalance /*Number*/) {
    const account = await this.getAccountByName(accountName);
    const res = await this.endpoint("updatebalance", this.payload.endpoint.updatebalance(account, newBalance));
    return res;
  }

  // Works with Manual Investment Holdings
  async addHolding(accountName, /*String*/ ticker, /*String*/ description, /*String*/ quantity, /*Number*/ price, /*Number*/ costBasis /*Number*/) {
    const account = await this.getAccountByName(accountName);
    const res = await this.endpoint("addholding", this.payload.endpoint.addholding(account.userAccountId, ticker, description, quantity, price, costBasis));
    return res;
  }

  // Works with Manual Investment Holdings
  async updateHolding(accounts, /*Array[String]*/ holdingTicker, /*String*/ quantity, /*Number*/ price, /*Number*/ costBasis /*Number*/) {
    const holding = await this.getHoldingByTicker(accounts, holdingTicker);
    const res = await this.endpoint("updateholding", this.payload.endpoint.updateholding(holding, quantity, price, costBasis));
    return res;
  }

  // Works With Manual Investment Holdings
  async updateInvestmentCashBalance(accountName, /*String*/ newBalance /*Number*/) {
    const account = await this.getAccountByName(accountName);
    const res = await this.endpoint("updateholding", this.payload.endpoint.updateinvestmentcashbalance(account.userAccountId, newBalance));
    return res;
  }

  async getHoldingByTicker(accounts, /*Array[String]*/ holdingTicker /*String*/) {
    const holdingsData = await this.getHoldings(accounts);
    const holdings = holdingsData.holdings;
    if(!holdings) {
      throw new HoldingNotFoundError(`Holdings data not found`);
    }
    const selectedHolding = holdings.find(holding => holding.ticker === holdingTicker);
    if (!selectedHolding) {
      throw new AccountNotFoundError(`Holding ${holdingTicker} not found!`);
    }
    return selectedHolding;
  }

  async getAccountByName(accountName /*String*/) {
    const accounts = await this.getAccounts();
    const selectedAccount = accounts.find(account => account.name === accountName);
    if (!selectedAccount) {
      throw new AccountNotFoundError(`Account ${accountName} not found!`);
    }
    return selectedAccount;
  }

}

module.exports = {PersonalCapital, TwoFactorMode, AccountNotFoundError, HoldingNotFoundError};
