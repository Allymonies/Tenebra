/**
 * Created by Drew Lemmy, 2016-2021
 *
 * This file is part of Tenebra.
 *
 * Tenebra is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Tenebra is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Tenebra. If not, see <http://www.gnu.org/licenses/>.
 *
 * For more project information, see <https://github.com/allymonies/tenebra>.
 */

const utils        = require("./utils.js");
const schemas      = require("./schemas.js");
const websockets   = require("./websockets.js");
const addresses    = require("./addresses.js");
const { Op }       = require("sequelize");
const escapeRegExp = require("lodash.escaperegexp");

const promClient = require("prom-client");
const promTransactionCounter = new promClient.Counter({
  name: "tenebra_transactions_total",
  help: "Total number of transactions since the Tenebra server started.",
  labelNames: ["type"]
});

// Initialize the counters to prevent 'no data' in Grafana
promTransactionCounter.inc({ type: "unknown" }, 0);
promTransactionCounter.inc({ type: "mined" }, 0);
promTransactionCounter.inc({ type: "name_purchase" }, 0);
promTransactionCounter.inc({ type: "name_a_record" }, 0);
promTransactionCounter.inc({ type: "name_transfer" }, 0);
promTransactionCounter.inc({ type: "transfer" }, 0);

// Query operator to exclude mined transactions in the 'from' field
const EXCLUDE_MINED = {
  [Op.notIn]: ["", " "], // From field that isn't a blank string or a space
  [Op.not]: null // And is not null
};

function Transactions() {}

Transactions.getTransaction = function(id) {
  return schemas.transaction.findByPk(id);
};

Transactions.getTransactions = function (limit, offset, asc, includeMined) {
  return schemas.transaction.findAndCountAll({
    order: [["id", asc ? "ASC" : "DESC"]],
    limit: utils.sanitiseLimit(limit),
    offset: utils.sanitiseOffset(offset),
    where: includeMined ? {} : { from: EXCLUDE_MINED }
  });
};

Transactions.getRecentTransactions = function(limit, offset) {
  return schemas.transaction.findAll({
    order: [["id", "DESC"]],
    limit: utils.sanitiseLimit(limit, 100),
    offset: utils.sanitiseOffset(offset),
    where: { from: EXCLUDE_MINED }
  });
};

Transactions.getTransactionsByAddress = function(address, limit, offset, includeMined, countOnly, orderBy, order) {
  const fn = countOnly ? "count" : "findAndCountAll";
  return schemas.transaction[fn]({
    where: includeMined
      // When including mined transactions, we only care if from or to is the
      // queried address:
      ? {[Op.or]: [{ from: address }, { to: address }]}
      // However, when we exclude mined transactions, we care about the
      // transactions from the queried address, or transactions to it from a
      // non-null sender (mined transactions):
      : {[Op.or]: [
        { from: address }, // Transactions from this address
        { // Non-mined txes to this address
          from: EXCLUDE_MINED, // Non-blank from
          to: address
        }
      ]},

    // Don't bother including the order, etc. when we only care about the count
    ...(countOnly ? {} : {
      order: [[orderBy || "id", order || "DESC"]],
      limit: utils.sanitiseLimit(limit),
      offset: utils.sanitiseOffset(offset)
    })
  });
};

Transactions.lookupTransactions = function(addressList, limit, offset, orderBy, order, includeMined) {
  return schemas.transaction.findAndCountAll({
    order: [[orderBy || "id", order || "ASC"]],
    limit: utils.sanitiseLimit(limit),
    offset: utils.sanitiseOffset(offset),
    where: addressList
      ? (includeMined
        ? {[Op.or]: [
          { from: {[Op.in]: addressList} },
          { to: {[Op.in]: addressList} }
        ]}
        : {[Op.or]: [
          { from: {[Op.in]: addressList} },
          {
            from: EXCLUDE_MINED,
            to: {[Op.in]: addressList}
          }
        ]})
      : includeMined ? {} : { from: EXCLUDE_MINED }
  });
};

Transactions.lookupTransactionsToName = function(name, limit, offset, orderBy, order) {
  return schemas.transaction.findAndCountAll({
    order: [[orderBy || "id", order || "ASC"]],
    limit: utils.sanitiseLimit(limit),
    offset: utils.sanitiseOffset(offset),
    where: { sent_name: name }
  });
};

Transactions.lookupNameHistory = function(name, limit, offset, orderBy, order) {
  return schemas.transaction.findAndCountAll({
    order: [[orderBy || "id", order || "ASC"]],
    limit: utils.sanitiseLimit(limit),
    offset: utils.sanitiseOffset(offset),
    where: { name }
  });
};

Transactions.searchByName = function(query, countOnly, limit, offset, orderBy, order) {
  const fn = countOnly ? "count" : "findAndCountAll";
  return schemas.transaction[fn]({
    where: {
      [Op.or]: [
        { name: query },
        { sent_name: query }
      ]
    },

    // Don't bother including the order, etc. when we only care about the count
    ...(countOnly ? {} : {
      order: [[orderBy || "id", order || "ASC"]],
      limit: utils.sanitiseLimit(limit),
      offset: utils.sanitiseOffset(offset)
    })
  });
};

Transactions.searchMetadata = function(query, countOnly, limit, offset, orderBy, order) {
  const fn = countOnly ? "count" : "findAndCountAll";
  return schemas.transaction[fn]({
    where: {
      [Op.and]: [
        { op: { [Op.ne]: null }},
        { op: { [Op.ne]: "" }},
        { op: { [Op.like]: utils.sanitiseLike(query) }}
      ]
    },

    // Don't bother including the order, etc. when we only care about the count
    ...(countOnly ? {} : {
      order: [[orderBy || "id", order || "ASC"]],
      limit: utils.sanitiseLimit(limit),
      offset: utils.sanitiseOffset(offset)
    })
  });
};

Transactions.createTransaction = async function (to, from, value, name, op, dbTx, useragent, origin, sent_metaname, sent_name) {
  // Create the new transaction object
  const newTransaction = await schemas.transaction.create({
    to,
    from,
    value,
    name,
    time: new Date(),
    op,
    useragent,
    origin,
    sent_metaname,
    sent_name
  }, { transaction: dbTx });

  promTransactionCounter.inc({
    type: Transactions.identifyTransactionType(newTransaction)
  });

  // Broadcast the transaction to websockets subscribed to transactions (async)
  websockets.broadcastEvent({
    type: "event",
    event: "transaction",
    transaction: Transactions.transactionToJSON(newTransaction)
  });

  return newTransaction;
};

Transactions.pushTransaction = async function(sender, recipientAddress, amount, metadata, name, dbTx, userAgent, origin, sentMetaname, sentName) {
  const recipient = await addresses.getAddress(recipientAddress);

  // Do these in parallel:
  const [,, newTransaction] = await Promise.all([
    // Decrease the sender's own balance
    sender.decrement({ balance: amount }, { transaction: dbTx }),
    // Increase the sender's totalout
    sender.increment({ totalout: amount }, { transaction: dbTx }),

    // Create the transaction
    Transactions.createTransaction(recipientAddress, sender.address, amount, name, metadata, dbTx, userAgent, origin, sentMetaname, sentName),

    // Create the recipient if they don't exist,
    !recipient
      ? schemas.address.create({
        address: recipientAddress.toLowerCase(),
        firstseen: new Date(),
        balance: amount,
        totalin: amount,
        totalout: 0
      }, { transaction: dbTx })
    // Otherwise, increment their balance and totalin
      : recipient.increment({ balance: amount, totalin: amount }, { transaction: dbTx })
  ]);

  return newTransaction;
};

Transactions.identifyTransactionType = function(transaction) {
  if (!transaction) return "unknown";
  if (!transaction.from) return "mined";
  if (transaction.from === "staking" || transaction.to === "staking") return "staking";

  if (transaction.name) {
    if (transaction.to === "name") return "name_purchase";
    else if (transaction.to === "a") return "name_a_record";
    else return "name_transfer";
  }

  return "transfer";
};

Transactions.transactionToJSON = function(transaction) {
  return {
    id: transaction.id,
    from: transaction.from,
    to: transaction.to,
    value: transaction.value,
    time: transaction.time,
    name: transaction.name,
    metadata: transaction.op,
    sent_metaname: transaction.sent_metaname,
    sent_name: transaction.sent_name,
    type: Transactions.identifyTransactionType(transaction)
  };
};

module.exports = Transactions;
