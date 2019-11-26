/*
 * Personal Capital API NodeJS Wrapper
 * @author John Collins
 * @license MIT
 * @version 2.1.0
 */

'use strict';

const uris = {
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

const payload = (self) => ({
  loginid: (username) => ({ ...(self.__payload_consts__.__login__()), username }),
  loginpass: (passwd) => ({ ...(self.__payload_consts__.__login__()), passwd, deviceName: self.__name__, bindDevice: true }),
  twofcha: (challengeType) => ({ ...(self.__payload_consts__.__twof__()), challengeType }),
  twofauth: (code) => ({ ...(self.__payload_consts__.__twof__()), code }),
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
        ...account, isTransferPending: false, isTransferEligible: true,
        employerMatchLimitType: "dollar", requestSource: "USER",
        balance: newBalance, currentBalance: newBalance, availableBalance: newBalance
    }),
    addholding: (userAccountId, ticker, description, quantity, price, costBasis) => ({
      userAccountId, ticker, description, quantity, price, value: price * quantity,
      costBasis, source: "USER"
    }),
    updateholding: (holding, quantity, price, costBasis) => ({
      ...holding, quantity, price, value: price * quantity, costBasis, source: "USER"
    }),
    updateinvestmentcashbalance: (userAccountId, newBalance) => ({
      userAccountId, description: "Cash", quantity: newBalance, price: newBalance,
      priceSource: "USER", sourceAssetId: "USER_DESCR_Cash"
    }),
  }
})

module.exports = {uris, payload};
