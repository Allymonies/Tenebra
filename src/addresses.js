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

const chalk     = require("chalk");
const utils     = require("./utils.js");
const schemas   = require("./schemas.js");
const database  = require("./database.js");
const Sequelize = require("sequelize");
const { Op, QueryTypes } = require("sequelize");

const promClient = require("prom-client");
const promAddressesVerifiedCounter = new promClient.Counter({
  name: "tenebra_addresses_verified_total",
  help: "Total number of addresses verified since the Tenebra server started.",
  labelNames: ["type"]
});

promAddressesVerifiedCounter.inc({ type: "attempt" }, 0);
promAddressesVerifiedCounter.inc({ type: "failed" }, 0);
promAddressesVerifiedCounter.inc({ type: "authed" }, 0);

function Addresses() {}

Addresses.getAddress = async function(address, fetchNames) {
  if (fetchNames) {
    // Fetch the name count if requested
    const rows = await database.getSequelize().query(`
      SELECT
        \`addresses\`.*,
        COUNT(\`names\`.\`id\`) AS \`names\`
      FROM \`addresses\`
      LEFT JOIN \`names\` ON \`addresses\`.\`address\` = \`names\`.\`owner\`
      WHERE \`addresses\`.\`address\` = :address
      LIMIT 1
    `, {
      replacements: { address },
      type: QueryTypes.SELECT
    });

    // Only return the first result
    return rows && rows.length ? rows[0] : null;
  } else {
    // Perform the regular lookup
    return schemas.address.findOne({ where: { address: address } });
  }
};

Addresses.getAddresses = function(limit, offset) {
  return schemas.address.findAndCountAll({limit: utils.sanitiseLimit(limit), offset: utils.sanitiseOffset(offset)});
};

Addresses.lookupAddresses = function(addressList, fetchNames) {
  if (fetchNames) { // TODO: see if this can be done with sequelize
    return database.getSequelize().query(`
      SELECT
        \`addresses\`.*,
        COUNT(\`names\`.\`id\`) AS \`names\`
      FROM \`addresses\`
      LEFT JOIN \`names\` ON \`addresses\`.\`address\` = \`names\`.\`owner\`
      WHERE \`addresses\`.\`address\` IN (:addresses)
      GROUP BY \`addresses\`.\`address\`
      ORDER BY \`names\` DESC
    `, {
      replacements: { addresses: addressList },
      type: QueryTypes.SELECT
    });
  } else {
    return schemas.address.findAll({ where: { address: addressList } });
  }
};

Addresses.getRich = function(limit, offset) {
  return schemas.address.findAndCountAll({limit: utils.sanitiseLimit(limit), offset: utils.sanitiseOffset(offset), order: [["balance", "DESC"]]});
};

/** For privacy reasons, purge entries from the auth log older than 30 days. */
Addresses.cleanAuthLog = async function() {
  const destroyed = await schemas.authLog.destroy({
    where: {
      time: { [Op.lte]: Sequelize.literal("NOW() - INTERVAL 30 DAY")}
    }
  });
  console.log(chalk`{cyan [Auth]} Purged {bold ${destroyed}} auth log entries`);
};

Addresses.logAuth = async function(req, address, type) {
  const { ip, path, userAgent, origin, logDetails } = utils.getLogDetails(req);

  if (type === "auth") {
    console.log(chalk`{green [Auth]} ({bold ${path}}) Successful auth on address {bold ${address}} ${logDetails}`);
  }

  // Check if there's already a recent log entry with these details. If there
  // were any within the last 30 minutes, don't add any new ones.
  const existing = await schemas.authLog.findOne({
    where: {
      ip,
      address,
      time: { [Op.gte]: Sequelize.literal("NOW() - INTERVAL 30 MINUTE")},
      type
    }
  });
  if (existing) return;

  schemas.authLog.create({
    ip,
    address,
    time: new Date(),
    type,
    useragent: userAgent,
    origin
  });
};

Addresses.verify = async function(req, tenebraAddress, privatekey) {
  const { path, logDetails } = utils.getLogDetails(req);

  console.log(chalk`{cyan [Auth]} ({bold ${path}}) Auth attempt on address {bold ${tenebraAddress}} ${logDetails}`);
  promAddressesVerifiedCounter.inc({ type: "attempt" });

  const hash = utils.sha256(tenebraAddress + privatekey);
  const address = await Addresses.getAddress(tenebraAddress);
  if (!address) { // Unseen address, create it
    const newAddress = await schemas.address.create({
      address: tenebraAddress,
      firstseen: new Date(),
      balance: 0, totalin: 0, totalout: 0,
      privatekey: hash
    });

    Addresses.logAuth(req, tenebraAddress, "auth");
    promAddressesVerifiedCounter.inc({ type: "authed" });
    return { authed: true, address: newAddress };
  }

  if (address.privatekey) { // Address exists, auth if the privatekey is equal
    const authed = !address.locked && address.privatekey === hash;

    if (authed) Addresses.logAuth(req, tenebraAddress, "auth");
    else console.log(chalk`{red [Auth]} ({bold ${path}}) Auth failed on address {bold ${tenebraAddress}} ${logDetails}`);

    promAddressesVerifiedCounter.inc({ type: authed ? "authed" : "failed" });
    return { authed, address };
  } else { // Address doesn't yet have a privatekey, claim it as the first
    const updatedAddress = await address.update({ privatekey: hash });

    Addresses.logAuth(req, tenebraAddress, "auth");
    promAddressesVerifiedCounter.inc({ type: "authed" });
    return { authed: true, address: updatedAddress };
  }
};

Addresses.addressToJSON = function(address) {
  return {
    address: address.address.toLowerCase(),
    balance: address.balance,
    totalin: address.totalin,
    totalout: address.totalout,
    firstseen: address.firstseen,

    // Add the name count, but only if it was requested
    ...(typeof address.names !== "undefined"
      ? { names: address.names }
      : {})
  };
};

module.exports = Addresses;
