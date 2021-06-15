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

const constants = require("./../constants.js");
const blocks    = require("./../blocks.js");
const staking   = require("./../staking.js");
const tenebra   = require("./../tenebra.js");
const utils     = require("./../utils.js");
const errors    = require("./../errors/errors.js");

function BlocksController() {}

BlocksController.getBlocks = function(limit, offset, asc) {
  return new Promise(function(resolve, reject) {
    if ((limit && isNaN(limit)) || (limit && limit <= 0)) {
      return reject(new errors.ErrorInvalidParameter("limit"));
    }

    if ((offset && isNaN(offset)) || (offset && offset < 0)) {
      return reject(new errors.ErrorInvalidParameter("offset"));
    }

    blocks.getBlocks(limit, offset, asc).then(resolve).catch(reject);
  });
};

BlocksController.getLastBlock = function() {
  return new Promise(function(resolve, reject) {
    blocks.getLastBlock().then(resolve).catch(reject);
  });
};

BlocksController.getBlocksByOrder = function(order, limit, offset) {
  return new Promise(function(resolve, reject) {
    if ((limit && isNaN(limit)) || (limit && limit <= 0)) {
      return reject(new errors.ErrorInvalidParameter("limit"));
    }

    if ((offset && isNaN(offset)) || (offset && offset < 0)) {
      return reject(new errors.ErrorInvalidParameter("offset"));
    }

    blocks.getBlocksByOrder(order, limit, offset).then(resolve).catch(reject);
  });
};

BlocksController.getLowestHashes = async function(limit, offset) {
  if ((limit && isNaN(limit)) || (limit && limit <= 0))
    throw new errors.ErrorInvalidParameter("limit");

  if ((offset && isNaN(offset)) || (offset && offset < 0))
    throw new errors.ErrorInvalidParameter("offset");

  return blocks.getLowestHashes(limit, offset);
};

BlocksController.getBlock = function(height) {
  return new Promise(function(resolve, reject) {
    if (isNaN(height)) {
      return reject(new errors.ErrorInvalidParameter("height"));
    }

    height = Math.max(parseInt(height), 0);

    blocks.getBlock(height).then(function(result) {
      if (!result) {
        return reject(new errors.ErrorBlockNotFound());
      }

      resolve(result);
    }).catch(reject);
  });
};

BlocksController.blockToJSON = function(block) {
  return blocks.blockToJSON(block); // i needed to move it but i didnt want to change 1000 lines of code ok
};

BlocksController.submitBlock = async function(req, address, rawNonce, userAgent, origin) {
  const miningEnabled = await tenebra.isMiningEnabled();
  const stakingEnabled = await tenebra.isStakingEnabled();
  if (!miningEnabled && !stakingEnabled) throw new errors.ErrorMiningDisabled();

  if (!address) throw new errors.ErrorMissingParameter("address");
  if (!tenebra.isValidTenebraAddress(address, true))
    throw new errors.ErrorInvalidParameter("address");

  if (!rawNonce) throw new errors.ErrorMissingParameter("nonce");
  if (rawNonce.length < 1 || rawNonce.length > constants.nonceMaxSize)
    throw new errors.ErrorInvalidParameter("nonce");

  const nonce = Array.isArray(rawNonce) ? new Uint8Array(rawNonce) : rawNonce;
  const lastBlock = await blocks.getLastBlock();

  const last = lastBlock.hash.substr(0, 12);
  const difficulty = await tenebra.getWork();
  const hash = utils.sha256(address, last, nonce);

  if ((miningEnabled && (parseInt(hash.substr(0, 12), 16) <= difficulty || tenebra.freeNonceSubmission)) || (stakingEnabled && address === await staking.getValidator())) {
    try {
      const block = await blocks.submit(req, hash, address, nonce, userAgent, origin);
      return block;
    } catch (err) {
      // Reject duplicate hashes
      if (Array.isArray(err.errors) && err.errors[0].type === "unique violation" && err.errors[0].path === "hash")
        throw new errors.ErrorSolutionDuplicate();

      console.error(err);
      throw err;
    }
  } else if (miningEnabled && parseInt(hash.substr(0, 12), 16) > difficulty) {
    throw new errors.ErrorSolutionIncorrect();
  } else {
    throw new errors.UnselectedValidator();
  }
};

module.exports = BlocksController;
