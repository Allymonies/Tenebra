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

function Blocks() {}
module.exports = Blocks;

const utils      = require("./utils.js");
const tenebra      = require("./tenebra.js");
const websockets = require("./websockets.js");
const schemas    = require("./schemas.js");
const addresses  = require("./addresses.js");
const names      = require("./names.js");
const tx         = require("./transactions.js");
const moment     = require("moment");
const Database   = require("./database.js");
const chalk      = require("chalk");
const { Op }     = require("sequelize");

const promClient = require("prom-client");
const promBlockCounter = new promClient.Counter({
  name: "tenebra_blocks_total",
  help: "Total number of blocks since the Tenebra server started."
});

Blocks.getBlock = function(id) {
  return schemas.block.findByPk(id);
};

Blocks.getBlocks = function(limit, offset, asc) {
  return schemas.block.findAndCountAll({order: [["id", asc ? "ASC" : "DESC"]],  limit: utils.sanitiseLimit(limit), offset: utils.sanitiseOffset(offset)});
};

Blocks.getBlocksByOrder = function(order, limit, offset) {
  return schemas.block.findAndCountAll({order: order, limit: utils.sanitiseLimit(limit), offset: utils.sanitiseOffset(offset)});
};

Blocks.getLastBlock = function(t) {
  return schemas.block.findOne({order: [["id","DESC"]]}, { transaction: t });
};

Blocks.getLowestHashes = function(limit, offset) {
  return schemas.block.findAndCountAll({
    where: {
      [Op.and]: [
        { hash: { [Op.not]: null } },
        { id: { [Op.gt]: 10 } } // Ignore the genesis block
      ]
    },
    order: [["hash", "ASC"]],
    limit: utils.sanitiseLimit(limit),
    offset: utils.sanitiseOffset(offset)
  });
};

Blocks.lookupBlocks = function(limit, offset, orderBy, order) {
  // This is a hack, but during 2020-03 to 2020-07, there were block hashes lost
  // due to a database reconstruction. They are currently marked as NULL in the
  // database. In Blocks.getLowestHashes, null hashes are ignored, but here,
  // they are still returned. As such, this pushes the nulls to the end of the
  // result set if sorting by hash ascending.
  const sq = Database.getSequelize();
  const dbOrder = orderBy === "hash" && order === "ASC"
    ? [sq.fn("isnull", sq.col("hash")), ["hash", "ASC"]]
    : [[orderBy || "id", order || "ASC"]];

  return schemas.block.findAndCountAll({
    order: dbOrder,
    limit: utils.sanitiseLimit(limit),
    offset: utils.sanitiseOffset(offset),
  });
};

Blocks.getLegacyWork = function(blockID) {
  // Early return for all existing blocks
  return null;
};

Blocks.getBaseBlockValue = function(blockID) {
  return blockID >= 325 ? 1 : 25;
};

Blocks.getBlockValue = async (t) => {
  const lastBlock = await Blocks.getLastBlock(t);
  const unpaidNames = await names.getUnpaidNameCount(t);
  return Blocks.getBaseBlockValue(lastBlock.id) + unpaidNames;
};

Blocks.submit = async function(req, hash, address, nonce, useragent, origin) {
  if (!await tenebra.isMiningEnabled())
    throw new Error("WTF: Attempted to submit block while mining is disabled!");

  const { logDetails } = utils.getLogDetails(req);
  addresses.logAuth(req, address, "mining");

  const { block, newWork } = await Database.getSequelize().transaction(async t => {
    const lastBlock = await Blocks.getLastBlock(t);
    const value = await Blocks.getBlockValue();
    const time = new Date();

    const oldWork = await tenebra.getWork();

    const seconds = (time - lastBlock.time) / 1000;
    const targetWork = seconds * oldWork / tenebra.getSecondsPerBlock();
    const diff = targetWork - oldWork;

    // eslint is wrong lmao
    // eslint-disable-next-line no-shadow
    const newWork = Math.round(Math.max(Math.min(oldWork + diff * tenebra.getWorkFactor(), tenebra.getMaxWork()), tenebra.getMinWork()));

    console.log(chalk`{bold [Tenebra]} Submitting {bold ${value} TST} block by {bold ${address}} at {cyan ${moment().format("HH:mm:ss DD/MM/YYYY")}} ${logDetails}`);
    promBlockCounter.inc();

    const unpaidNames = await schemas.name.findAll({
      where: {
        unpaid: { [Op.gt]: 0 }
      }
    }, { transaction: t });

    // Do all the fun stuff in parallel
    // eslint-disable-next-line no-shadow
    const [block] = await Promise.all([
      // Create the new block
      schemas.block.create({
        hash,
        address,
        // Convert a binary nonce to a string if necessary
        nonce: Buffer.from(nonce, "binary").toString("hex"),
        time,
        difficulty: oldWork,
        value,
        useragent,
        origin
      }, { transaction: t }),

      // Create the transaction
      tx.createTransaction(address, null, value, null, null, t, useragent, origin),

      // Decrement all unpaid name counters
      unpaidNames.map(name => name.decrement({ unpaid: 1 }, { transaction: t }))
    ]);

    // See if the address already exists before depositing Tenebra to it
    const tenebraAddress = await addresses.getAddress(address);
    if (tenebraAddress) { // Address exists, increment its balance
      await tenebraAddress.increment({ balance: value, totalin: value }, { transaction: t });
    } else { // Address doesn't exist, create it
      await schemas.address.create({
        address,
        firstseen: time,
        balance: value,
        totalin: value,
        totalout: 0
      }, { transaction: t });
    }

    return { block, newWork };
  });

  // Get the updated address balance to return to the API
  const tenebraAddress = await addresses.getAddress(address);

  // Save the new work
  console.log(chalk`        New work: {green ${newWork.toLocaleString()}} New balance: {green ${tenebraAddress.balance}}`);
  await tenebra.setWork(newWork);

  // Submit the new block event to all websockets (async)
  websockets.broadcastEvent({
    type: "event",
    event: "block",
    block: Blocks.blockToJSON(block),
    new_work: newWork
  });

  return { work: newWork, address: tenebraAddress, block };
};

Blocks.blockToJSON = function(block) {
  return {
    height: block.id,
    address: block.address,
    hash: block.hash,
    short_hash: block.hash ? block.hash.substring(0, 12) : null,
    value: block.value,
    time: block.time,
    difficulty: Blocks.getLegacyWork(block.id) || block.difficulty
  };
};
