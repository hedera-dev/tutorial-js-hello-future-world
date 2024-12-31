#!/usr/bin/env node

import {
  Client,
  Hbar,
  PrivateKey,
  AccountId,
  TokenCreateTransaction,
  TokenType,
} from '@hashgraph/sdk';
import dotenv from 'dotenv';
import { createLogger } from '../util/util.js';

const logger = await createLogger({
  scriptId: 'htsFt',
  scriptCategory: 'task',
});
let client;

async function scriptHtsFungibleToken() {
  logger.logStart('Hello Future World - HTS Fungible Token - start');

  // Read in environment variables from `.env` file in parent directory
  dotenv.config({ path: '../.env' });
  logger.log('Read .env file');

  // Initialize the operator account
  const operatorIdStr = process.env.OPERATOR_ACCOUNT_ID;
  const operatorKeyStr = process.env.OPERATOR_ACCOUNT_PRIVATE_KEY;
  if (!operatorIdStr || !operatorKeyStr) {
    throw new Error(
      'Must set OPERATOR_ACCOUNT_ID and OPERATOR_ACCOUNT_PRIVATE_KEY environment variables',
    );
  }
  const operatorId = AccountId.fromString(operatorIdStr);
  const operatorKey = PrivateKey.fromStringECDSA(operatorKeyStr);
  client = Client.forTestnet().setOperator(operatorId, operatorKey);
  logger.log('Using account:', operatorIdStr);

  // Set the default maximum transaction fee (in HBAR)
  client.setDefaultMaxTransactionFee(new Hbar(100));
  // Set the default maximum payment for queries (in HBAR)
  client.setDefaultMaxQueryPayment(new Hbar(50));

  // NOTE: Create an HTS token
  await logger.logSection('Creating new HTS token');
  const tokenCreateTx = await new TokenCreateTransaction()
    .setTransactionMemo(`Hello Future World token - ${logger.version}`)
    .setTokenType(TokenType.FungibleCommon)
    .setTokenName(`${logger.scriptId} coin`)
    .setTokenSymbol(logger.scriptId.toUpperCase())
    .setDecimals(2)
    .setInitialSupply(1_000_000)
    .setTreasuryAccountId(operatorId)
    .setFreezeDefault(false)
    .freezeWith(client);

  const tokenCreateTxId = tokenCreateTx.transactionId;
  logger.log('The token create transaction ID: ', tokenCreateTxId.toString());

  const tokenCreateTxSigned = await tokenCreateTx.sign(operatorKey);
  const tokenCreateTxSubmitted = await tokenCreateTxSigned.execute(client);

  // Get the transaction receipt and check the status
  const tokenCreateTxReceipt = await tokenCreateTxSubmitted.getReceipt(client);

  if (tokenCreateTxReceipt.status.toString() === 'SUCCESS') {
    const tokenId = tokenCreateTxReceipt.tokenId;
    logger.log('✅ Token created successfully. Token ID:', tokenId.toString());
    logger.log(
      `Transaction was successful. View it at: https://hashscan.io/testnet/transaction/${tokenCreateTxId}`,
    );
  } else {
    throw new Error(
      `❌ Token creation transaction failed with status: ${tokenCreateTxReceipt.status}`,
    );
  }

  client.close();

  // Verify transactions using Hashscan
  await logger.logSection('View the token on HashScan');
  const tokenVerifyHashscanUrl = `https://hashscan.io/testnet/token/${tokenCreateTxReceipt.tokenId.toString()}`;
  logger.log(
    'Paste URL in browser:\n',
    ...logger.applyAnsi('URL', tokenVerifyHashscanUrl),
  );

  // Wait for 6s for record files (blocks) to propagate to mirror nodes
  await new Promise((resolve) => setTimeout(resolve, 6_000));

  // NOTE: Verify token using Mirror Node API
  await logger.logSection('Get token data from the Hedera Mirror Node');
  const tokenVerifyMirrorNodeApiUrl = `https://testnet.mirrornode.hedera.com/api/v1/tokens/${tokenCreateTxReceipt.tokenId.toString()}`;
  logger.log(
    'The token Hedera Mirror Node API URL:\n',
    ...logger.applyAnsi('URL', tokenVerifyMirrorNodeApiUrl),
  );
  const tokenVerifyFetch = await fetch(tokenVerifyMirrorNodeApiUrl);
  const tokenVerifyJson = await tokenVerifyFetch.json();
  const tokenVerifyName = tokenVerifyJson?.name;
  logger.log('The name of this token:', tokenVerifyName);
  const tokenVerifyTotalSupply = tokenVerifyJson?.total_supply;
  logger.log('The total supply of this token:', tokenVerifyTotalSupply);

  logger.logComplete('Hello Future World - HTS Fungible Token - complete');
}

scriptHtsFungibleToken().catch((ex) => {
  client && client.close();
  logger ? logger.logError(ex) : console.error(ex);
});
