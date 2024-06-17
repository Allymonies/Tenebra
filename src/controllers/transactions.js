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

const transactions = require("./../transactions.js");
const addresses    = require("./../addresses.js");
const tenebra        = require("./../tenebra.js");
const names        = require("./../names.js");
const errors       = require("./../errors/errors.js");

function TransactionsController() {}

TransactionsController.getTransactions = function (limit, offset, asc, includeMined) {
  return new Promise(function(resolve, reject) {
    if ((limit && isNaN(limit)) || (limit && limit <= 0)) {
      return reject(new errors.ErrorInvalidParameter("limit"));
    }

    if ((offset && isNaN(offset)) || (offset && offset < 0)) {
      return reject(new errors.ErrorInvalidParameter("offset"));
    }

    transactions.getTransactions(limit, offset, asc, includeMined).then(resolve).catch(reject);
  });
};

TransactionsController.getTransactionsByAddress = function(address, limit, offset, includeMined) {
  return new Promise(function(resolve, reject) {
    if ((limit && isNaN(limit)) || (limit && limit <= 0)) {
      return reject(new errors.ErrorInvalidParameter("limit"));
    }

    if ((offset && isNaN(offset)) || (offset && offset < 0)) {
      return reject(new errors.ErrorInvalidParameter("offset"));
    }

    addresses.getAddress(address).then(function(addr) {
      if (addr) {
        transactions.getTransactionsByAddress(addr.address, limit, offset, includeMined).then(resolve).catch(reject);
      } else {
        reject(new errors.ErrorAddressNotFound());
      }
    }).catch(reject);
  });
};

TransactionsController.getTransaction = function(id) {
  return new Promise(function(resolve, reject) {
    if (isNaN(id)) {
      return reject(new errors.ErrorInvalidParameter("id"));
    }

    id = Math.max(parseInt(id), 0);

    transactions.getTransaction(id).then(function(result) {
      if (!result) {
        return reject(new errors.ErrorTransactionNotFound());
      }

      resolve(result);
    }).catch(reject);
  });
};

TransactionsController.makeTransaction = async function(req, privatekey, to, amount, metadata, userAgent, origin) {
  // Input validation
  if (!privatekey) throw new errors.ErrorMissingParameter("privatekey");
  if (!to) throw new errors.ErrorMissingParameter("to");
  if (!amount) throw new errors.ErrorMissingParameter("amount");

  // Check if we're paying to a name
  const isName = tenebra.nameMetaRegex.test(to.toLowerCase());
  // Handle the potential legacy behaviour of manually paying to a name via the
  // transaction metadata
  const metadataIsName = metadata && tenebra.metanameMetadataRegex.test(metadata);

  const nameInfo = isName ? tenebra.nameMetaRegex.exec(to.toLowerCase()) : undefined;
  const metadataNameInfo = metadataIsName ? tenebra.metanameMetadataRegex.exec(metadata) : undefined;

  // Verify this is a valid v2 address
  amount = typeof amount === "string" ? Math.trunc(parseInt(amount)) : Math.trunc(amount);
  if (!isName && !tenebra.isValidTenebraAddress(to, true))
    throw new errors.ErrorInvalidParameter("to");

  if (isNaN(amount) || amount < 1) throw new errors.ErrorInvalidParameter("amount");
  if (metadata && (!/^[\x20-\x7F\n]+$/i.test(metadata) || metadata.length > 255))
    throw new errors.ErrorInvalidParameter("metadata");

  const from = tenebra.makeV2Address(privatekey);

  // Address auth validation
  const { authed, address: sender } = await addresses.verify(req, from, privatekey);
  if (!authed) throw new errors.ErrorAuthFailed();

  // Reject insufficient funds
  if (!sender || sender.balance < amount) throw new errors.ErrorInsufficientFunds();

  // If this is a name, pay to the owner of the name
  if (isName || metadataIsName) {
    // Fetch the name
    const metaname = isName ? nameInfo[1] : metadataNameInfo[1];
    const dbName = await names.getNameByName(isName ? nameInfo[2] : metadataNameInfo[2]);
    if (!dbName) throw new errors.ErrorNameNotFound();

    // Add the original name spec to the metadata
    if (isName) {
      if (metadata) { // Append with a semicolon if we already have metadata
        metadata = to.toLowerCase() + ";" + metadata;
      } else { // Set new metadata otherwise
        metadata = to.toLowerCase();
      }
    }

    // Create the transaction to the name's owner
    return transactions.pushTransaction(sender, dbName.owner, amount, metadata, undefined, undefined, userAgent, origin, metaname, dbName.name);
  } else {
    // Create the transaction to the provided address
    return transactions.pushTransaction(sender, to, amount, metadata, undefined, undefined, userAgent, origin);
  }
};

TransactionsController.transactionToJSON = function(transaction) {
  return transactions.transactionToJSON(transaction);
};

module.exports = TransactionsController;
