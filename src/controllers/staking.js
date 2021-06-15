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
  return new Promise(function(resolve, reject) {
    staking.getStake(address).then(resolve).catch(reject);
  });
};

StakingController.stakeToJSON = function(stake) {
  return staking.stakeToJSON(stake);
};

module.exports = StakingController;
