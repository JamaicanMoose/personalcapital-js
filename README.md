<h1><img src="https://github.com/JamaicanMoose/personalcapital-js/raw/master/.github/personal-capital-js.png"/></h1>

NodeJS Wrapper for the [Personal Capital](https://www.personalcapital.com/) private API.

SMS 2FA must be enabled on your account in order to use this, this is not an API limitation, should someone need non-sms auth it can be implemented.

Wrapper Functions :
  * Auth :
    - [`auth(username /*String*/, passwd /*String*/, twofactormode /*TwoFactorMode*/)`]()
    - [`authCompleted()`]()
    - [`twoFactorCompleted()`]()
  * Generic :
    - [`endpoint(target /*String*/, data /*Object*/)`]()
  * Authenticated :
    - [`getNetWorth()`]()
    - [`getAccounts()`]()
    - [`getTransactions(accounts /*Array[String]*/, startDate /*String*/, endDate /*String*/)`]()
    - [`getHoldings(accounts /*Array[String]*/)`]()
    - [`getHistories(accounts /*Array[String]*/, startDate /*String*/, endDate /*String*/, intervalType /*String*/, types /*Array[String]*/)`]()
    - [`updateBalance(accountName /*String*/, newBalance /*Number*/)`]()
    - [`addHolding(accountName, /*String*/ ticker, /*String*/ description, /*String*/ quantity, /*Number*/ price, /*Number*/ costBasis /*Number*/)`]()
    - [`updateHolding(accounts, /*Array[String]*/ holdingTicker, /*String*/ quantity, /*Number*/ price, /*Number*/ costBasis /*Number*/)`]()
    - [`updateInvestmentCashBalance(accountName, /*String*/ newBalance /*Number*/)`]()
    - [`getHoldingByTicker(accounts, /*Array[String]*/ holdingTicker /*String*/)`]()
    - [`getAccountByName(accountName /*String*/)`]()

`updateBalance` method works with all custom accounts other than Custom Stock Options and Manual Investment Holdings.
`addHolding`, `updateHolding`, and `updateInvestmentCashBalance` methods work with Manual Investment Holdings asset type

## Installation
```bash
$ npm install personalcapital
$ npm install request@^2.34
```

## Usage

```js
({PersonalCapital, TwoFactorMode} = require('./personalcapital/personalcapital.js'));
let tcfs = require('tough-cookie-file-store');
let request = require('request-promise-native');
let pc = new PersonalCapital(name='pcjs', cookiejar=request.jar(new tcfs('./pc-cookie.json')));

let main = async () => {
  await pc.auth('USERNAME', 'PASSWORD');
  let accounts = await pc.getAccounts();
  let accountIds = accounts.map((e) => e.accountId).slice(0,3);
  console.log(await pc.getHistories(accounts=accountIds));
  return '';
};

main().then(() => process.exit());
```

# Attributions
* John Collins ([@jamaicanmoose](https://github.com/jamaicanmoose)) : Wrapper Development
* Haochi Chen ([@haochi](https://github.com/haochi)) : Inspiration for authentication method from his Python wrapper
