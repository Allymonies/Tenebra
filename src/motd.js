/**
 * Created by Drew Lemmy, 2021
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

const package = require("../package.json");
const tenebra = require("./tenebra");
const blocks = require("./blocks");
const constants = require("./constants");

async function getDetailedMOTD() {
  const { motd, motd_set, debug_mode } = await tenebra.getMOTD();
  const lastBlock = await blocks.getLastBlock();

  return {
    server_time: new Date(),

    motd,
    set: motd_set, // support for backwards compatibility
    motd_set,

    public_url: process.env.PUBLIC_URL || "localhost:8080",
    mining_enabled: await tenebra.isMiningEnabled(),
    staking_enabled: await tenebra.isStakingEnabled(),
    debug_mode,

    work: await tenebra.getWork(),
    last_block: lastBlock ? blocks.blockToJSON(lastBlock) : null,

    package: {
      name: package.name,
      version: package.version,
      author: package.author,
      licence: package.license,
      repository: package.repository.url
    },

    constants: {
      wallet_version: constants.walletVersion,
      nonce_max_size: constants.nonceMaxSize,
      name_cost: constants.nameCost,
      min_work: constants.minWork,
      max_work: constants.maxWork,
      work_factor: constants.workFactor,
      seconds_per_block: constants.secondsPerBlock
    },

    currency: {
      address_prefix: "t",
      name_suffix: "tst",

      currency_name: "Tenebra",
      currency_symbol: "TST"
    },

    // NOTE: It is against the license to modify this string on a fork node
    notice: "Tenebra was originally created by 3d6 and Lemmmy. It is now owned"
          + " and operated by tmpim, and licensed under GPL-3.0."
  };
}

module.exports = { getDetailedMOTD };
