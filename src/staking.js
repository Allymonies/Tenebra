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

 const { getRedis }  = require("./redis");
const utils        = require("./utils.js");
const constants    = require("./constants.js");
const schemas      = require("./schemas.js");
const websockets   = require("./websockets.js");
const transactions = require("./../transactions.js");
const { Op }       = require("sequelize");

const promClient = require("prom-client");
const promStakesCounter = new promClient.Counter({
  name: "tenebra_stakes_total",
  help: "Total number of stakes."
});

// Query operator to exclude stakes that aren't active
const EXCLUDE_INACTIVE = {
  [Op.eq]: 1, // Active field is true
  [Op.is]: null // Or active field is not set
};

const EXCLUDE_NO_STAKE = {
  [Op.gt]: 0 //Stake is more than 0
};

function Staking() {}

/*Transactions.getTransaction = function(id) {
  return schemas.transaction.findByPk(id);
};*/

Staking.getStakes = function (limit, offset, asc, includeInactive) {
  return schemas.address.findAndCountAll({
    order: [["stake", asc ? "ASC" : "DESC"]],
    limit: utils.sanitiseLimit(limit),
    offset: utils.sanitiseOffset(offset),
    where: includeInactive ? {stake: EXCLUDE_NO_STAKE} : { stake: EXCLUDE_NO_STAKE, stake_active: EXCLUDE_INACTIVE }
  });
};

Staking.getStakeWeights = function () {
  return schemas.address.findAndCountAll({
    where: { stake: EXCLUDE_NO_STAKE, stake_active: EXCLUDE_INACTIVE }
  });
};

Staking.getStake = function (address) {
  return schemas.address.findOne({
    where: { address: {[Op.eq]: address}}
  });
};

Staking.penalize = async function(staker, dbTx) {

  // Do these in parallel:
  const [,, newTransaction] = await Promise.all([
    // Decrease the staker's stake
    staker.decrement({ stake: Math.min(constants.validatorPenalty, staker.stake) }, { transaction: dbTx }),

    // Set their stake to inactive so they don't lose more
    staker.update({"stake_active": false}),

    // Create the transaction
    transactions.createTransaction("penalty", staker.address, amount, null, null, dbTx, null, null, null, null),
  ]);

  return newTransaction;

};

Staking.getValidator = async function (work) {
  return await getRedis().get("validator");
};

Staking.setValidator = async function (validator) {
  websockets.broadcastEvent({
    type: "event",
    event: "validator",
    validator: validator
  });
  await getRedis().set("validator", validator);
};

Staking.getUnpaidPenaltyCount = function(t) {
  return schemas.address.count({where: {penalty: {[Op.gt]: 0}}}, { transaction: t });
};


Staking.stakeToJSON = function(stake) {
  return {
    owner: stake.address,
    stake: stake.stake,
    active: stake.stake_active == 1
  };
};

module.exports = Staking;
