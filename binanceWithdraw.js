import axios from "axios";
import fs from 'fs';
import { config } from './config.js'
import crypto from 'node:crypto';
import _ from "lodash";

const txStatuses = { 0: "Email Sent", 1: "Cancelled", 2: "Awaiting Approval", 3: "Rejected", 4: "Processing", 5: "Failure", 6: "Completed" };
const timeout = ms => new Promise(res => setTimeout(res, ms));
const sign = query_string => crypto.createHmac('sha256', config.secret).update(query_string).digest('hex');

async function validateWallets(wallets, networkData) {
  const invalidWallets = [];
  
  for (const wallet of wallets) {
    if (!wallet.match(networkData.addressRegex)) {
      invalidWallets.push(wallet);
    }
  }
  
  if (invalidWallets.length > 0) {
    console.log('\x1b[31m%s\x1b[0m', `Invalid wallets: ${invalidWallets.join("\n")}`);
    return false;
  } else {
    return true;
  }
}

async function getCoinInformation(coin) {
    const query = `timestamp=${Date.now()}`;
    const signature = sign(query);

    try {
      const res = await axios.get(`https://api.binance.com/sapi/v1/capital/config/getall?${query}&signature=${signature}`, {
          headers: { 'X-MBX-APIKEY': config.apikey }
      });

      return res.data.find(query => query.coin === coin);
    } catch (err) {
      console.error(err.response.data.msg);
    }
}

async function getTransactionInfo(coin, txid) {
    const query = `coin=${coin}&timestamp=${Date.now()}`
    const signature = sign(query);

    try {
      const res = await axios.get(`https://api.binance.com/sapi/v1/capital/withdraw/history?${query}&signature=${signature}`, {
          headers: { 'X-MBX-APIKEY': config.apikey }
      });

      const tx = res.data.find(query => query.id === txid)
      console.log('\x1b[32m%s\x1b[0m', `Sent ${tx.amount} ${tx.coin}, fee: ${tx.transactionFee} ${tx.coin}, status: ${txStatuses[tx.status]} for address ${tx.address}`);

      return res.data;
    } catch (err) {
      console.error(err.response.data.msg);
    }
}

async function withdraw(coin, address, amount, network) {
    const query = `coin=${coin}&address=${address}&amount=${amount}&network=${network}&timestamp=${Date.now()}`;
    const signature = sign(query);

    try {
      const res = await axios.post(`https://api.binance.com/sapi/v1/capital/withdraw/apply?${query}&signature=${signature}`, {}, {
          headers: { 'X-MBX-APIKEY': config.apikey }
      });

      if (res?.data) {
          await timeout(_.random(config.delay.min, config.delay.max) * 1000)
          await getTransactionInfo(coin, res.data.id)

          return res
      }
    } catch (err) {
        console.error(err.response.data.msg);
    }
}

(async () => {
    try {
      const coinData = await getCoinInformation(config.token.toUpperCase());
      const networks = coinData.networkList.map(item => item.network);
      const balance = coinData.free;
      console.log('\x1b[35m%s\x1b[0m', `Balance: ${balance} ${coinData.coin}`);
  
      if (!networks.includes(config.network.toUpperCase())) {
        throw new Error(`Invalid network, available networks: ${networks.join(', ')}`);
      }
  
      const networkData = coinData.networkList.find(item => item.network === config.network.toUpperCase());
      if (!networkData) {
        throw new Error(`Invalid network data for ${config.network.toUpperCase()}`);
      }
  
      const readFile = fs.readFileSync('wallets.json');
      const wallets = JSON.parse(readFile).wallets;
  
      validateWallets(wallets, networkData.addressRegex);
  
      const amount = typeof (config.amount) === 'string' ? config.amount.replace('.', ',') : config.amount;
  
      const totalWithdrawalAmount = wallets.length * amount;
      if (balance < totalWithdrawalAmount) {
        throw new Error('Insufficient funds');
      }
  
      for (const wallet of wallets) {
        const decimals = networkData.withdrawIntegerMultiple.length > 1 ? networkData.withdrawIntegerMultiple.split('.')[1].length : 0;
        const finalAmount = config.randomizeAmount
          ? (amount * (_.random(1 - (config.spread / 100), 1))).toFixed(decimals)
          : amount;
  
        if (+finalAmount < +networkData.withdrawMin) {
            console.log('\x1b[31m%s\x1b[0m', `Minimal amount is: ${networkData.withdrawMin} ${networkData.coin}, current amount is: ${finalAmount} ${networkData.coin}`);
          continue;
        }
  
        await withdraw(config.token.toUpperCase(), wallet, finalAmount, config.network.toUpperCase());
      }
    } catch (err) {
      console.error(err.message);
    }
  })();
  