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
const database   = require("./database.js");
const websockets   = require("./websockets.js");
const transactions = require("./transactions.js");
const { Op, QueryTypes } = require("sequelize");

const promClient = require("prom-client");
const promStakesCounter = new promClient.Counter({
  name: "tenebra_stakes_total",
  help: "Total number of stakes."
});

// Query operator to exclude stakes that aren't active
const EXCLUDE_INACTIVE = {
  [Op.ne]: 0 // Active field is not false
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

Staking.lookupStakes = function(addressList) {
  return schemas.address.findAll({ where: { address: addressList } });
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
  const amount = Math.min(constants.validatorPenalty, staker.stake)
  const [,, newTransaction] = await Promise.all([
    // Decrease the staker's stake
    staker.decrement({ stake: amount }, { transaction: dbTx }),
    staker.increment({ penalty: amount }, { transaction: dbTx }),

    // Set their stake to inactive so they don't lose more
    staker.update({"stake_active": false}),

    // Create the transaction
    //transactions.createTransaction("penalty", staker.address, amount, null, null, dbTx, null, null, null, null),

    // Broadcast the transaction to websockets subscribed to transactions (async)
    websockets.broadcastEvent({
      type: "event",
      event: "stake",
      stake: {owner: staker.address, stake: staker.stake - amount, active: false}
    })
  ]);

  return newTransaction;

};

Staking.deposit = async function(staker, amount, dbTx) {

  // Do these in parallel:
  const [,, newTransaction] = await Promise.all([
    // Decrease the staker's balance
    staker.decrement({ balance: amount }, { transaction: dbTx }),
    // Increase their stake
    staker.increment({ stake: amount}, { transaction: dbTx }),

    // Set their stake to active
    staker.update({"stake_active": true}),

    // Create the transaction
    transactions.createTransaction("staking", staker.address, amount, null, null, dbTx, null, null, null, null),
  ]);

  staker.stake += amount;
  staker.stake_active = true;

  websockets.broadcastEvent({
    type: "event",
    event: "stake",
    stake: Staking.stakeToJSON(staker)
  })

  return staker;

};

Staking.withdraw = async function(staker, amount, dbTx) {

  // Do these in parallel:
  const [,, newTransaction] = await Promise.all([
    // Increase the staker's balance
    staker.increment({ balance: amount }, { transaction: dbTx }),
    // Decrease their stake
    staker.decrement({ stake: amount}, { transaction: dbTx }),

    // Set their stake to active if they still have a stake remaining
    staker.update({"stake_active": (staker.stake - amount) > 0}),

    // Create the transaction
    transactions.createTransaction(staker.address, "staking", amount, null, null, dbTx, null, null, null, null),
  ]);

  staker.stake -= amount;
  staker.stake_active = staker.stake > 0;

  websockets.broadcastEvent({
    type: "event",
    event: "stake",
    stake: Staking.stakeToJSON(staker)
  })

  return staker;

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

Staking.getDetailedUnpaidPenalties = function() {
  return database.getSequelize().query(`
    SELECT COUNT(*) AS \`count\`, \`penalty\` FROM \`addresses\`
    GROUP BY \`penalty\`
    ORDER BY \`penalty\` ASC;
  `, { type: QueryTypes.SELECT });
};

Staking.getPenalties = function (limit, offset, asc) {
  return schemas.address.findAndCountAll({
    order: [["penalty", asc ? "ASC" : "DESC"]],
    limit: utils.sanitiseLimit(limit),
    offset: utils.sanitiseOffset(offset),
    where: {penalty: {[Op.gt]: 0}}
  });
};

Staking.getTotalStaked = function () {
  return schemas.address.sum("stake", { where: { stake_active: EXCLUDE_INACTIVE } });
};

Staking.stakeToJSON = function(stake) {
  return {
    owner: stake.address,
    stake: stake.stake,
    active: stake.stake_active == 1
  };
};

Staking.penaltyToJSON = function(penalty) {
  return {
    address: penalty.address,
    amount: penalty.penalty
  };
};


module.exports = Staking;
