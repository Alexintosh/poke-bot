const BigNumber = require('bignumber.js');
const ethers = require('ethers');
const Table = require('cli-table2');
const pieABI = require('../abis/pie.json');
const erc20ABI = require('../abis/erc20.json');
const provider = require('../wallet').provider;
const alertThreshold = BigNumber(process.env.TOKEN_SUPPLY_ALERT_THRESHOLD || '0.1');


class TokenSupplyCheck {
  constructor(address) {
    this.address = address;
  }

  async init() {
    this.pie = new ethers.Contract(this.address, pieABI, provider);
    let tokens = await this.pie.functions.getTokens();
    this.tokens = tokens[0];
    this.contracts = this.tokens.map((token) => new ethers.Contract(token, erc20ABI, provider));
    this.decimals = await Promise.all(this.contracts.map(c => c.functions.decimals() ));

    const promises = this.contracts.map(c => c.functions.symbol() )
    this.symbols = await Promise.all(promises.map(p => p.catch(e => ['-'])));
    
    this.supplyes = await Promise.all(this.contracts.map((c, i) => {
      return fetchSupply(c, this.decimals[i]);
    }));
    this.initialized = true;
    this.shifts = {};
  }

  async run() {
    this.running = true;
    const newBalances = await Promise.all(this.contracts.map((c, i) => {
      return fetchSupply(c, this.decimals[i]);
    }));
    this.diffs = newBalances.map((balance, index) => balance.minus(this.supplyes[index]));
    const shifts = {};
    
    this.diffs.forEach((diff, index) => {
      const percentageShift = diff.dividedBy(this.supplyes[index]);
      if (alertThreshold.isLessThan(percentageShift)) {
        const message = `${this.tokens[index].toString()} shift exceeds alert threshold`;
        console.log(message);
      }
      if (!diff.isZero()) {
        console.log('diff');
      }
      shifts[this.tokens[index]] = `${percentageShift.multipliedBy(100).toFixed(2)}%`;
    });

    this.shifts = shifts;
    await this.log();
    this.running = false;
  }

  async log() {
    const payload = await Promise.all(this.tokens.map(async (token, index) => {
      return [
        this.symbols[index][0],
        token,
        this.shifts[token],
        this.supplyes[index].toFixed(5),
      ];
    }));
  
    const table1 = new Table({ style: { head: [], border: [] } });
    const table2 = new Table({ style: { head: [], border: [] } });
    table1.push(['Symbol', 'Token', 'Change', 'Supply']);
    table2.push(['Symbol', 'Token', 'Change', 'Supply']);
    payload.forEach((record, index) => {
      table1.push(record);
      if (!this.diffs[index].isZero()) {
        table2.push(record);
      }
    });
  
    console.log(table1.toString());
  }
}

const fetchSupply = async (contract, decimals) => {
  const supply = await contract.functions.totalSupply();
  return BigNumber(supply.toString()).dividedBy(10 ** decimals);
};

module.exports = {
  TokenSupplyCheck
}