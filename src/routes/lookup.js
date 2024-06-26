/**
 * Created by Drew Lemmy, 2020
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

const express      = require("express");
const tenebra      = require("../tenebra");
const Addresses    = require("../addresses");
const Blocks       = require("../blocks");
const Staking      = require("../staking");
const Transactions = require("../transactions");
const Names        = require("../names");
const errors       = require("../errors/errors");
const utils        = require("../utils");

// Fair tradeoff between flexibility and parameter limitations
const ADDRESS_LIST_LIMIT = 128;

// Valid fields to order block lookups by
const BLOCK_FIELDS = ["height", "address", "hash", "value", "time", "difficulty"];
// Valid fields to order transaction lookups by
const TRANSACTION_FIELDS = ["id", "from", "to", "value", "time", "sent_name", "sent_metaname"];
// Valid fields to order name lookups by
const NAME_FIELDS = ["name", "owner", "original_owner", "registered", "updated", "a", "unpaid"];

/** Validate a comma-separated list of addresses, returning an array of them
 * if it is valid, or throwing an error if it is not. */
function validateAddressList(addressList) {
  // If it doesn't match the address list regex, error
  if (!tenebra.isValidTenebraAddressList(addressList))
    throw new errors.ErrorInvalidParameter("addresses");

  // Deserialize, clean up, and deduplicate address list
  const addresses = [...new Set(addressList.trim().toLowerCase().split(","))];

  // Check that they didn't supply too many addresses
  if (addresses.length > ADDRESS_LIST_LIMIT)
    throw new errors.ErrorLargeParameter("addresses");

  return addresses;
}

function validateOrderBy(validFields, order) {
  // Ignore unsupplied parameter
  if (typeof order === "undefined") return;

  if (typeof order !== "string" || !validFields.includes(order))
    throw new errors.ErrorInvalidParameter("orderBy");

  return order;
}

function validateOrder(order) {
  // Ignore unsupplied parameter
  if (typeof order === "undefined") return "ASC";

  if (typeof order !== "string"
  || (order.toUpperCase() !== "ASC" && order.toUpperCase() !== "DESC"))
    throw new errors.ErrorInvalidParameter("order");

  return order.toUpperCase();
}

function validateLimit(limit) {
  // Ignore unsupplied parameter
  if (typeof limit === "undefined") return;

  // Convert to int
  limit = parseInt(limit);

  // Validate range
  if (isNaN(limit) || (limit && limit <= 0))
    throw new errors.ErrorInvalidParameter("limit");

  return limit;
}

function validateOffset(offset) {
  // Ignore unsupplied parameter
  if (typeof offset === "undefined") return;

  // Convert to int
  offset = parseInt(offset);

  // Validate range
  if (isNaN(offset) || (offset && offset <= 0))
    throw new errors.ErrorInvalidParameter("offset");

  return offset;
}

module.exports = function(app) {
  const api = express.Router();

  /**
	 * @apiDefine LookupGroup Lookup API
	 *
	 * Advanced bulk lookup queries designed for TenebraWeb v2.
   *
   * **WARNING:** The Lookup API is in Beta, and is subject to change at any
   * time without warning.
	 */

  /**
   * @api {get} /lookup/addresses/:addresses Lookup addresses
   * @apiName LookupAddresses
   * @apiGroup LookupGroup
   * @apiVersion 2.1.3
   *
   * @apiDescription Return an object containing the given address(es). Any
   * addresses that do not exist on the Tenebra server (i.e. they have not been
   * logged in to, or have not received Tenebra) will be assigned `null` in the
   * object.
   *
   * **WARNING:** The Lookup API is in Beta, and is subject to change at any
   * time without warning.
   *
	 * @apiParam (URLParameter) {String[]} [addresses] A comma-separated list of
   *           addresses to filter transactions to/from.
   *
	 * @apiParam (QueryParameter) {Boolean} fetchNames When supplied, fetch the
   *           count of owned names for each address.
   *
   * @apiSuccess {Number} found The amount of addresses that were successfully
   *             returned.
   * @apiSuccess {Number} notFound The amount of addresses that were not
   *             returned.
   * @apiSuccess {Object} addresses Object keyed by address containing their
   *             data, or `null` if the address was not found.
   *
   * @apiSuccessExample {json} Success
   * {
   *   "ok": true,
   *   "found": 3,
   *   "notFound": 1,
   *   "addresses": {
   *     "kfakeaddy0": null,
   *     "khugepoopy": {
   *       "address": "thugepoopy",
   *       "balance": 433,
   *       "totalin": 467572,
   *       "totalout": 242505,
   *       "firstseen": "2017-04-12T20:23:02.000Z"
   *     },
   *     "kreichdyes": {
   *       "address": "treichdyes",
   *       "balance": 210,
   *       "totalin": 65518,
   *       "totalout": 69767,
   *       "firstseen": "2018-06-28T17:30:50.000Z"
   *     },
   *     "kre3w0i79j": {
   *       "address": "tre3w0i79j",
   *       "balance": 0,
   *       "totalin": 227329,
   *       "totalout": 227277,
   *       "firstseen": "2015-03-13T12:55:18.000Z"
   *     }
   *   }
   * }
   */
  api.get("/addresses/:addresses", async (req, res) => {
    const { addresses: addressesParam } = req.params;
    const fetchNames = typeof req.query.fetchNames !== "undefined";

    // Validate address list
    if (!addressesParam) throw new errors.ErrorMissingParameter("addresses");
    const addressList = validateAddressList(addressesParam);

    // Perform the query
    const rows = await Addresses.lookupAddresses(addressList, fetchNames);

    // Prepare the output object (initialize all supplied addresses with 'null')
    const out = addressList.reduce((obj, address) => (obj[address] = null, obj), {});

    // Populate the output object with the addresses we actually found
    for (const address of rows) {
      out[address.address] = Addresses.addressToJSON(address);
    }

    return res.json({
      ok: true,
      found: rows.length,
      notFound: addressList.length - rows.length,
      addresses: out
    });
  });

  /**
   * @api {get} /lookup/stakes/:addresses Lookup stakes
   * @apiName LookupStakes
   * @apiGroup LookupGroup
   * @apiVersion 2.15.0
   *
   * @apiDescription Return an object containing the given address(es)' stakes. Any
   * addresses that do not exist on the Tenebra server (i.e. they have not been
   * logged in to, or have not received Tenebra) will be assigned `null` in the
   * object.
   *
   * **WARNING:** The Lookup API is in Beta, and is subject to change at any
   * time without warning.
   *
	 * @apiParam (URLParameter) {String[]} [addresses] A comma-separated list of
   *           addresses to filter stakes.
   *
   * @apiSuccess {Number} found The amount of stakes that were successfully
   *             returned.
   * @apiSuccess {Number} notFound The amount of stakes that were not
   *             returned.
   * @apiSuccess {Object} stakes Object keyed by address containing their
   *             data, or `null` if the address was not found.
   *
   * @apiSuccessExample {json} Success
   * {
   *   "ok": true,
   *   "found": 3,
   *   "notFound": 1,
   *   "addresses": {
   *     "kfakeaddy0": null,
   *     "thugepoopy": {
   *       "owner": "thugepoopy",
   *       "stake": 433,
   *       "active": true
   *     },
   *     "treichdyes": {
   *       "owner": "treichdyes",
   *       "stake": 210,
   *       "active": true
   *     },
   *     "tre3w0i79j": {
   *       "owner": "tre3w0i79j",
   *       "stake": 0,
   *       "active": false
   *     }
   *   }
   * }
   */
   api.get("/stakes/:addresses", async (req, res) => {
    const { addresses: addressesParam } = req.params;

    // Validate address list
    if (!addressesParam) throw new errors.ErrorMissingParameter("addresses");
    const addressList = validateAddressList(addressesParam);

    // Perform the query
    const rows = await Staking.lookupStakes(addressList);

    // Prepare the output object (initialize all supplied addresses with 'null')
    const out = addressList.reduce((obj, address) => (obj[address] = null, obj), {});

    // Populate the output object with the addresses we actually found
    for (const address of rows) {
      out[address.address] = Staking.stakeToJSON(address);
    }

    return res.json({
      ok: true,
      found: rows.length,
      notFound: addressList.length - rows.length,
      stakes: out
    });
  });

  /**
   * @api {get} /lookup/blocks Lookup blocks
   * @apiName LookupBlocks
   * @apiGroup LookupGroup
   * @apiVersion 2.1.3
   *
   * @apiDescription Return all the blocks.
   *
   * **WARNING:** The Lookup API is in Beta, and is subject to change at any
   * time without warning.
   *
	 * @apiParam (QueryParameter) {Number} [limit=50] The maximum amount of
   *           results to return.
	 * @apiParam (QueryParameter) {Number} [offset=0] The amount to offset the
   *           results.
	 * @apiParam (QueryParameter) {String} [orderBy=height] The field to order the
   *           results by. Must be one of `height`, `address`, `hash`, `value`,
   *           `time` or `difficulty`.
	 * @apiParam (QueryParameter) {String} [order=ASC] The direction to order
   *           the results in. Must be one of `ASC` or `DESC`.
   *
   * @apiSuccess {Number} count The count of results returned.
   * @apiSuccess {Number} total The total count of results available.
   * @apiUse Blocks
   *
   * @apiSuccessExample {json} Success
   * {
   *   "ok": true,
   *   "count": 20,
   *   "total": 1397410,
   *   "blocks": [
   *     {
   *       "height": 101496,
   *       "address": "t5ztameslf",
   *       "hash": "00000000224f08def4a2cef05fed91abdf8eb03feb79d80fe2b187487d2ad06b",
   *       "short_hash": "00000000224f",
   *       "value": 3013,
   *       "time": "2016-01-11T22:16:09.000Z",
   *       "difficulty": 18758
   *     },
   *     {
   *       "height": 1187992,
   *       "address": "tenebraallie",
   *       "hash": "00000000004fd4ededc6edc7528c99f10e74cdecd88627a5a98df9431f52473b",
   *       "short_hash": "00000000004f",
   *       "value": 152,
   *       "time": "2020-02-09T04:02:58.000Z",
   *       "difficulty": 100
   *     },
   *     ...
   */
  api.get("/blocks", async (req, res) => {
    // Query filtering parameters
    const limit = validateLimit(req.query.limit);
    const offset = validateOffset(req.query.offset);
    const orderBy = validateOrderBy(BLOCK_FIELDS, req.query.orderBy);
    const order = validateOrder(req.query.order);

    // Perform the query
    // NOTE: `height` is replaced with `id` to maintain compatibility with what
    //       the API typically returns for block objects.
    // NOTE: `time` is replaced with `id` as `time` is typically not indexed.
    //       While blocks are not _guaranteed_ to be monotonic, they generally
    //       are, so this is a worthwhile performance tradeoff.
    const { rows, count } = await Blocks.lookupBlocks(
      limit,
      offset,
      orderBy === "height"
        ? "id"
        : (orderBy === "time" ? "id" : orderBy),
      order
    );

    return res.json({
      ok: true,
      count: rows.length,
      total: count,
      blocks: rows.map(Blocks.blockToJSON)
    });
  });

  /**
   * @api {get} /lookup/transactions/:addresses? Lookup transactions
   * @apiName LookupTransactions
   * @apiGroup LookupGroup
   * @apiVersion 2.3.0
   *
   * @apiDescription Return all the transactions to/from the given address(es),
   *   or the whole network if no addresses are specified.
   *
   * **WARNING:** The Lookup API is in Beta, and is subject to change at any
   * time without warning.
   *
	 * @apiParam (URLParameter) {String[]} [addresses] A comma-separated list of
   *           addresses to filter transactions to/from.
   *
	 * @apiParam (QueryParameter) {Number} [limit=50] The maximum amount of
   *           results to return.
	 * @apiParam (QueryParameter) {Number} [offset=0] The amount to offset the
   *           results.
	 * @apiParam (QueryParameter) {String} [orderBy=id] The field to order the
   *           results by. Must be one of `id`, `from`, `to`, `value`, `time`,
   *           `sent_name` or `sent_metaname`.
	 * @apiParam (QueryParameter) {String} [order=ASC] The direction to order
   *           the results in. Must be one of `ASC` or `DESC`.
	 * @apiParam (QueryParameter) {Boolean} [includeMined] If supplied,
   *           transactions from mining will be included.
   *
   * @apiSuccess {Number} count The count of results returned.
   * @apiSuccess {Number} total The total count of results available.
   * @apiUse Transactions
   *
   * @apiSuccessExample {json} Success
   * {
   *   "ok": true,
   *   "count": 20,
   *   "total": 4785,
   *   "transactions": [
   *     {
   *       "id": 892595,
   *       "from": "thugepoopy",
   *       "to": "tqxhx5yn9v",
   *       "value": 7000,
   *       "time": "2018-12-29T13:02:05.000Z",
   *       "name": null,
   *       "metadata": "lignum@switchcraft.tst",
   *       "type": "transfer"
   *     },
   *     {
   *       "id": 1454706,
   *       "from": "t5cfswitch",
   *       "to": "thugepoopy",
   *       "value": 5050,
   *       "time": "2020-01-20T00:01:47.000Z",
   *       "name": null,
   *       "metadata": "",
   *       "type": "transfer"
   *     },
   *     ...
   */
  api.get("/transactions/:addresses?", async (req, res) => {
    const { addresses: addressesParam } = req.params;

    // Validate address list
    const addressList = addressesParam ? validateAddressList(addressesParam) : undefined;

    // Query filtering parameters
    const limit = validateLimit(req.query.limit);
    const offset = validateOffset(req.query.offset);
    const orderBy = validateOrderBy(TRANSACTION_FIELDS, req.query.orderBy);
    const order = validateOrder(req.query.order);
    const includeMined = typeof req.query.includeMined !== "undefined";

    // Perform the query
    // NOTE: `time` is replaced with `id` as `time` is typically not indexed.
    //       While transactions are not _guaranteed_ to be monotonic, they
    //       generally are, so this is a worthwhile performance tradeoff.
    const { rows, count } = await Transactions.lookupTransactions(
      addressList,
      limit,
      offset,
      orderBy === "time" ? "id" : orderBy,
      order,
      includeMined
    );

    return res.json({
      ok: true,
      count: rows.length,
      total: count,
      transactions: rows.map(Transactions.transactionToJSON)
    });
  });

  /**
   * @api {get} /lookup/names/:addresses? Lookup names
   * @apiName LookupNames
   * @apiGroup LookupGroup
   * @apiVersion 2.1.3
   *
   * @apiDescription Return all the names owned by the given address(es),
   *   or the whole network if no addresses are specified.
   *
   * **WARNING:** The Lookup API is in Beta, and is subject to change at any
   * time without warning.
   *
	 * @apiParam (URLParameter) {String[]} [addresses] A comma-separated list of
   *           addresses to filter name owners by.
   *
	 * @apiParam (QueryParameter) {Number} [limit=50] The maximum amount of
   *           results to return.
	 * @apiParam (QueryParameter) {Number} [offset=0] The amount to offset the
   *           results.
	 * @apiParam (QueryParameter) {String} [orderBy=name] The field to order the
   *           results by. Must be one of `name`, `owner`, `original_owner`,
   *           `registered` `updated`, `a` or `unpaid`.
	 * @apiParam (QueryParameter) {String} [order=ASC] The direction to order
   *           the results in. Must be one of `ASC` or `DESC`.
   *
   * @apiSuccess {Number} count The count of results returned.
   * @apiSuccess {Number} total The total count of results available.
   * @apiUse Names
   *
   * @apiSuccessExample {json} Success
   * {
   *   "ok": true,
   *   "count": 20,
   *   "total": 45,
   *   "names": [
   *     {
   *       "name": "ahh11",
   *       "owner": "thugepoopy",
   *       "registered": "2016-06-12T13:21:41.000Z",
   *       "updated": "2018-04-06T16:54:53.000Z",
   *       "a": ""
   *     },
   *     {
   *       "name": "antiblock",
   *       "owner": "treichdyes",
   *       "registered": "2020-01-25T12:18:14.000Z",
   *       "updated": "2020-01-25T12:18:14.000Z",
   *       "a": null
   *     },
   *     ...
   */
  api.get("/names/:addresses?", async (req, res) => {
    const { addresses: addressesParam } = req.params;

    // Validate address list
    const addressList = addressesParam ? validateAddressList(addressesParam) : undefined;

    // Query filtering parameters
    const limit = validateLimit(req.query.limit);
    const offset = validateOffset(req.query.offset);
    const orderBy = validateOrderBy(NAME_FIELDS, req.query.orderBy);
    const order = validateOrder(req.query.order);

    // Perform the query
    const { rows, count } = await Names.lookupNames(
      addressList, limit, offset, orderBy, order
    );

    return res.json({
      ok: true,
      count: rows.length,
      total: count,
      names: rows.map(Names.nameToJSON)
    });
  });

  /**
   * @api {get} /lookup/names/:name/history Lookup name history
   * @apiName LookupNameHistory
   * @apiGroup LookupGroup
   * @apiVersion 2.8.9
   *
   * @apiDescription Return all the transactions directly involving the given
   *   name. This is any transaction with the type `name_purchase`,
   *   `name_a_record` or `name_transfer`.
   *
   * **WARNING:** The Lookup API is in Beta, and is subject to change at any
   * time without warning.
   *
	 * @apiParam (URLParameter) {String} name The name to return history for.
   *
	 * @apiParam (QueryParameter) {Number} [limit=50] The maximum amount of
   *           results to return.
	 * @apiParam (QueryParameter) {Number} [offset=0] The amount to offset the
   *           results.
	 * @apiParam (QueryParameter) {String} [orderBy=id] The field to order the
   *           results by. Must be one of `id`, `from`, `to`, `value`, `time`,
   *           `sent_name` or `sent_metaname`.
	 * @apiParam (QueryParameter) {String} [order=ASC] The direction to order
   *           the results in. Must be one of `ASC` or `DESC`.
   *
   * @apiSuccess {Number} count The count of results returned.
   * @apiSuccess {Number} total The total count of results available.
   * @apiUse Transactions
   *
   * @apiSuccessExample {json} Success
   * {
   *   "ok": true,
   *   "count": 20,
   *   "total": 50,
   *   "transactions": [
   *     {
   *       "id": 892595,
   *       "from": "thugepoopy",
   *       "to": "tqxhx5yn9v",
   *       "value": 7000,
   *       "time": "2018-12-29T13:02:05.000Z",
   *       "name": null,
   *       "metadata": "lignum@switchcraft.tst",
   *       "type": "transfer"
   *     },
   *     {
   *       "id": 1454706,
   *       "from": "t5cfswitch",
   *       "to": "thugepoopy",
   *       "value": 5050,
   *       "time": "2020-01-20T00:01:47.000Z",
   *       "name": null,
   *       "metadata": "",
   *       "type": "transfer"
   *     },
   *     ...
   */
  api.get("/names/:name/history", async (req, res) => {
    const { name } = req.params;

    // Query filtering parameters
    const limit = validateLimit(req.query.limit);
    const offset = validateOffset(req.query.offset);
    const orderBy = validateOrderBy(TRANSACTION_FIELDS, req.query.orderBy);
    const order = validateOrder(req.query.order);

    // Perform the query. `time` is replaced with `id` as usual.
    const { rows, count } = await Transactions.lookupNameHistory(
      name,
      limit,
      offset,
      orderBy === "time" ? "id" : orderBy,
      order
    );

    return res.json({
      ok: true,
      count: rows.length,
      total: count,
      transactions: rows.map(Transactions.transactionToJSON)
    });
  });


  /**
   * @api {get} /lookup/names/:name/transactions Lookup name transactions
   * @apiName LookupNameTransactions
   * @apiGroup LookupGroup
   * @apiVersion 2.8.9
   *
   * @apiDescription Return all the transactions sent to the given name.
   *
   * **WARNING:** The Lookup API is in Beta, and is subject to change at any
   * time without warning.
   *
	 * @apiParam (URLParameter) {String} name The name to return transactions for.
   *
	 * @apiParam (QueryParameter) {Number} [limit=50] The maximum amount of
   *           results to return.
	 * @apiParam (QueryParameter) {Number} [offset=0] The amount to offset the
   *           results.
	 * @apiParam (QueryParameter) {String} [orderBy=id] The field to order the
   *           results by. Must be one of `id`, `from`, `to`, `value`, `time`,
   *           `sent_name` or `sent_metaname`.
	 * @apiParam (QueryParameter) {String} [order=ASC] The direction to order
   *           the results in. Must be one of `ASC` or `DESC`.
   *
   * @apiSuccess {Number} count The count of results returned.
   * @apiSuccess {Number} total The total count of results available.
   * @apiUse Transactions
   *
   * @apiSuccessExample {json} Success
   * {
   *   "ok": true,
   *   "count": 20,
   *   "total": 50,
   *   "transactions": [
   *     {
   *       "id": 892595,
   *       "from": "thugepoopy",
   *       "to": "tqxhx5yn9v",
   *       "value": 7000,
   *       "time": "2018-12-29T13:02:05.000Z",
   *       "name": null,
   *       "metadata": "lignum@switchcraft.tst",
   *       "type": "transfer"
   *     },
   *     {
   *       "id": 1454706,
   *       "from": "t5cfswitch",
   *       "to": "thugepoopy",
   *       "value": 5050,
   *       "time": "2020-01-20T00:01:47.000Z",
   *       "name": null,
   *       "metadata": "",
   *       "type": "transfer"
   *     },
   *     ...
   */
  api.get("/names/:name/transactions", async (req, res) => {
    const { name } = req.params;

    // Query filtering parameters
    const limit = validateLimit(req.query.limit);
    const offset = validateOffset(req.query.offset);
    const orderBy = validateOrderBy(TRANSACTION_FIELDS, req.query.orderBy);
    const order = validateOrder(req.query.order);

    // Perform the query. `time` is replaced with `id` as usual.
    const { rows, count } = await Transactions.lookupTransactionsToName(
      name,
      limit,
      offset,
      orderBy === "time" ? "id" : orderBy,
      order
    );

    return res.json({
      ok: true,
      count: rows.length,
      total: count,
      transactions: rows.map(Transactions.transactionToJSON)
    });
  });

  // Error handler
  // eslint-disable-next-line no-unused-vars
  api.use((err, req, res, next) => {
    utils.sendErrorToRes(req, res, err);
  });

  app.use("/lookup", api);
};

module.exports.utils = {
  ADDRESS_LIST_LIMIT,
  BLOCK_FIELDS, TRANSACTION_FIELDS, NAME_FIELDS,
  validateAddressList,
  validateOrderBy, validateOrder,
  validateLimit, validateOffset
};
