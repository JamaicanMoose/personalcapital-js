<h1><img src="https://raw.githubusercontent.com/jamaicanmoose/ppersonalcapital-js/master/.github/personal-capital-js.png"/></h1>

[![npm](https://img.shields.io/npm/v/personalcapital.svg?style=flat-square)](https://www.npmjs.com/package/personalcapital)
[![npm](https://img.shields.io/npm/dm/personalcapital.svg)](https://www.npmjs.com/package/personalcapital)

NodeJS Wrapper for the [Personal Capital](https://www.personalcapital.com/) private API.

Uses Bluebird promises.

SMS 2FA must be enabled on your account in order to use this, this is not an API limitation, should someone need non-sms auth it can be implemented.

Unofficial documentation for the API can be found [here]().

Wrapper Functions :
  * Auth :
    - [`auth(email, password, two_factor_type)`]()
    - [`deauth()`]()
  * Generic :
    - [`endpoint(endpoint, data)`]()
  * Authenticated :
    - [`_getAccounts()`]()
    - [`getAccounts()`]()
    - [`getNetWorthBreakdown()`]()
    - [`getTransactions(accounts, start_date, end_date)`]()
    - [`getHoldings(accounts)`]()
    - [`getHistories(accounts, start_date, end_date, interval, types)`]()
  * UnAuthenticated :
    - [`getCustomProducts()`]()
    - [`searchSecurity()`]()
    - [`getQuotes()`]()

## Installation
```bash
$ npm install personalcapital --save
```

## Usage

Authenticate an account with auth() (this will require
entering the 2FA code via the calling terminal), then call the desired endpoint
wrappers or call the endpoint() function for unimplemented endpoints.

```js
var pc = require('personalcapital');
pc.auth("email", "password", "SMS")
.then(pc.getHoldings([1111111]))
.then(console.log);
```

## API

> **NOTE:** Any error is going to be a passthrough from the "request-promise" library.

### `auth(email, password, two_factor_type)`
Authenticates a PersonalCapital-js session, the session will persist across program restarts as it is written to a file.

```js
pc.auth("email", "password", "SMS");
```

### `deauth()`
Destroys the current session cookies, effectively de-authenticating the current stored session.

```js
pc.deauth();
```

### `endpoint(endpoint, data)`
Generic function to access any endpoint in the Personal Capital API.

```js
pc.endpoint("getAccounts", null);
```

### `_getAccounts()`
Calls the getAccounts endpoint with standard parameters. Resolves the raw JSON that is provided from the server.

```js
pc._getAccounts();
```

### `getAccounts()`
Sugar function for _getAccounts(). Resolves only the account summaries secion of the resolved JSON.

```js
pc.getAccounts();
```

### `getNetWorthBreakdown()`
Sugar function for _getAccounts(). Resolves only the net worth breakdown section of the resolved JSON.

```js
pc.getNetWorthBreakdown();
```

### `getTransactions(accounts, start_date, end_date)`
Resolves a JSON object of all transactions between start_date and end_date for the provided accounts. If accounts is null, will gather data for all accounts. If start_date is null, will get all available data as far back as January 1st 1970. If end_date is null, will get up to the most recent transaction.

```js
pc.getTransactions(null, null, null);
```

### `getHoldings(accounts)`
Resolves a JSON object of all investment holdings for the specified accounts. If accounts is null, will resolve investment holdings for all accounts.

```js
pc.getHoldings(null);
```

# Attributions
* John Collins ([@jamaicanmoose](https://github.com/jamaicanmoose)) : Wrapper Development
* Haochi Chen ([@haochi](https://github.com/haochi)) : Inspiration for authentication method from his Python wrapper
