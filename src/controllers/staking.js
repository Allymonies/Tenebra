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

const staking      = require("./../staking.js");
const addresses    = require("./../addresses.js");
const tenebra      = require("./../tenebra.js");
const errors       = require("./../errors/errors.js");

function StakingController() {}

StakingController.getStakes = function (limit, offset, asc, includeMined) {
  return new Promise(function(resolve, reject) {
    if ((limit && isNaN(limit)) || (limit && limit <= 0)) {
      return reject(new errors.ErrorInvalidParameter("limit"));
    }

    if ((offset && isNaN(offset)) || (offset && offset < 0)) {
      return reject(new errors.ErrorInvalidParameter("offset"));
    }

    staking.getStakes(limit, offset, asc, includeMined).then(resolve).catch(reject);
  });
};

StakingController.getStake = function (address) {
  if (!tenebra.isValidTenebraAddress(address))
    throw new errors.ErrorInvalidParameter("address");

  const result = await staking.getStake(address);
  if (!result) throw new errors.ErrorAddressNotFound();

  return result;
};

StakingController.getValidator = function () {
  return new Promise(function(resolve, reject) {
    staking.getValidator().then(resolve).catch(reject);
  });
};

StakingController.stakeToJSON = function(stake) {
  return staking.stakeToJSON(stake);
};

StakingController.deposit = async function(req, privatekey, amount, userAgent, origin) {
  // Input validation
  if (!privatekey) throw new errors.ErrorMissingParameter("privatekey");
  if (!amount) throw new errors.ErrorMissingParameter("amount");

  if (isNaN(amount) || amount < 1) throw new errors.ErrorInvalidParameter("amount");

  const from = tenebra.makeV2Address(privatekey);
  amount = parseInt(amount);

  // Address auth validation
  const { authed, address: sender } = await addresses.verify(req, from, privatekey);
  if (!authed) throw new errors.ErrorAuthFailed();

  // Reject insufficient funds
  if (!sender || sender.balance < amount) throw new errors.ErrorInsufficientFunds();
  
  return staking.deposit(sender, amount);
};

StakingController.withdraw = async function(req, privatekey, amount, userAgent, origin) {
  // Input validation
  if (!privatekey) throw new errors.ErrorMissingParameter("privatekey");
  if (!amount) throw new errors.ErrorMissingParameter("amount");

  if (isNaN(amount) || amount < 1) throw new errors.ErrorInvalidParameter("amount");

  const from = tenebra.makeV2Address(privatekey);
  amount = parseInt(amount);

  // Address auth validation
  const { authed, address: sender } = await addresses.verify(req, from, privatekey);
  if (!authed) throw new errors.ErrorAuthFailed();

  // Reject insufficient funds
  if (!sender || sender.stake < amount) throw new errors.ErrorInsufficientFunds();
  
  return staking.withdraw(sender, amount);
};

module.exports = StakingController;
