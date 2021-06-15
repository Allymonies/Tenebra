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

function Tenebra() { }

module.exports = Tenebra;

require("./websockets.js"); // hack to deal with circular deps
const utils = require("./utils.js");
const constants = require("./constants.js");
const schemas = require("./schemas.js");
const chalk = require("chalk");
const { getRedis } = require("./redis.js");

const { cleanAuthLog, getAddress } = require("./addresses.js");
const staking = require("./staking.js");
const cron = require("node-cron");
const e = require("express");

const addressRegex = /^(?:t[a-z0-9]{9}|[a-f0-9]{10})$/;
const addressRegexV2 = /^t[a-z0-9]{9}$/;
const addressListRegex = /^(?:t[a-z0-9]{9}|[a-f0-9]{10})(?:,(?:t[a-z0-9]{9}|[a-f0-9]{10}))*$/;
const nameRegex = /^[a-z0-9]{1,64}$/i;
const nameFetchRegex = /^(?:xn--)?[a-z0-9]{1,64}$/i;
const aRecordRegex = /^[^\s.?#].[^\s]*$/i;

Tenebra.nameMetaRegex = /^(?:([a-z0-9-_]{1,32})@)?([a-z0-9]{1,64})\.tst$/i;
Tenebra.metanameMetadataRegex = /^(?:([a-z0-9-_]{1,32})@)?([a-z0-9]{1,64})\.tst/i;

Tenebra.freeNonceSubmission = false;

Tenebra.workOverTime = [];

Tenebra.checkGenesisBlockStatus = async function () {
  const lastBlock = await schemas.block.findOne({ order: [["id", "DESC"]] });
  return Boolean(lastBlock);
}

Tenebra.init = async function () {
  console.log(chalk`{bold [Tenebra]} Loading...`);

  // Check if mining is enabled
  const r = getRedis();
  if (process.env.MINING_ENABLED === "true") await r.set("mining-enabled", "true");
  if (process.env.STAKING_ENABLED === "true") await r.set("staking-enabled", "true");
  if (!await r.exists("staking-enabled")) {
    console.log(chalk`{yellow.bold [Tenebra]} Note: Initialised with staking disabled.`);
    await r.set("staking-enabled", "false");
  }
  if (!await r.exists("mining-enabled")) {
    console.log(chalk`{yellow.bold [Tenebra]} Note: Initialised with mining disabled.`);
    await r.set("mining-enabled", "false");
  }
  const miningEnabled = await Tenebra.isMiningEnabled();
  let stakingEnabled = await Tenebra.isStakingEnabled();
  if (miningEnabled)
  { 
    if (stakingEnabled) {
      stakingEnabled = false;
      await r.set("staking-enabled", "false");
    }
    console.log(chalk`{green.bold [Tenebra]} Mining is enabled.`);
  }
  else if (stakingEnabled) console.log(chalk`{green.bold [Tenebra]} Staking is enabled.`);
  else console.log(chalk`{red.bold [Tenebra]} No mining method enabled!`);

  if (process.env.GEN_GENESIS === "true") await Tenebra.genGenesis();

  // Check for a genesis block
  if (!(await Tenebra.checkGenesisBlockStatus())) {
    console.log(chalk`{yellow.bold [Tenebra]} Warning: Genesis block not found. Mining may not behave correctly.`);
  }

  // Pre-initialise the work to 100,000
  if (!await r.exists("work")) {
    const defaultWork = Tenebra.getMaxWork();
    console.log(chalk`{yellow.bold [Tenebra]} Warning: Work was not yet set in Redis. It will be initialised to: {green ${defaultWork}}`);
    await Tenebra.setWork(defaultWork);
  }
  console.log(chalk`{bold [Tenebra]} Current work: {green ${await Tenebra.getWork()}}`);

  if (!await r.exists("validator")) {
    const defaultValidator = "";
    console.log(chalk`{yellow.bold [Tenebra]} Warning: Validator was not yet set in Redis. It will be initialised to: {green ${defaultValidator}}`);
    await staking.setValidator(defaultValidator);
  }

  // Update the work over time every minute
  Tenebra.workOverTimeInterval = setInterval(async function () {
    await r.lpush("work-over-time", await Tenebra.getWork());
    await r.ltrim("work-over-time", 0, 1440);
  }, 60 * 1000);

  if (stakingEnabled) {
    Tenebra.validatorSelectionInterval = setInterval(Tenebra.selectValidator, Tenebra.getSecondsPerBlock() * 1000);
  }
  

  // Start the hourly auth log cleaner, and also run it immediately
  cron.schedule("0 0 * * * *", () => cleanAuthLog().catch(console.error));
  cleanAuthLog().catch(console.error);
};

Tenebra.genGenesis = async function () {
  const r = getRedis();

  if ((!await Tenebra.checkGenesisBlockStatus()) || (!await r.exists("genesis-genned"))) {
    await schemas.block.create({
      value: Tenebra.getDefaultBlockValue(),
      hash: "0000000000000000000000000000000000000000000000000000000000000000",
      address: "0000000000",
      nonce: 0,
      difficulty: Tenebra.getMaxWork(),
      time: new Date()
    });

    await r.set("genesis-genned", "true");
  }
};

Tenebra.isMiningEnabled = async () => (await getRedis().get("mining-enabled")) === "true";

Tenebra.isStakingEnabled = async () => (await getRedis().get("staking-enabled")) === "true";

Tenebra.getWork = async function () {
  return parseInt(await getRedis().get("work"));
};

Tenebra.selectValidator = async function() {
  const prevValidator = await staking.getValidator();
  if (prevValidator && prevValidator != "" ) {
    //Need to punish previous validator for not validating.
    const prevValidatorAddress = await getAddress(prevValidator);
    if (prevValidatorAddress) {
      await staking.penalize(prevValidatorAddress);
    }
  }

  const stakes = await staking.getStakeWeights();
  const stakeWeights = [];
  let total = 0;
  for (let i = 0; i < stakes.rows.length; i++) {
    const stake = staking.stakeToJSON(stakes.rows[i]);
    total += stake.stake;
    stakeWeights.push({address: stake.owner, sum: total});
  }

  if (total > 0) {
    const selectedSum = Math.random() * total;
    for(let i = 0; i < stakeWeights.length; i++) {
      const weight = stakeWeights[i];
      if (selectedSum < weight.sum) {
        await staking.setValidator(weight.address);
        break;
      }
    }
  } else {
    await staking.setValidator("");
  }
  
  
};

Tenebra.getWorkOverTime = async function () {
  return (await getRedis().lrange("work-over-time", 0, 1440))
    .map(i => parseInt(i))
    .reverse();
};

Tenebra.setWork = async function (work) {
  await getRedis().set("work", work);
};

Tenebra.getDefaultBlockValue = function () {
  return constants.defaultBlockValue;
}

Tenebra.getWalletVersion = function () {
  return constants.walletVersion;
};

Tenebra.getMoneySupply = function () {
  return schemas.address.sum("balance");
};

Tenebra.getMinWork = function () {
  return constants.minWork;
};

Tenebra.getMaxWork = function () {
  return constants.maxWork;
};

Tenebra.getWorkFactor = function () {
  return constants.workFactor;
};

Tenebra.getSecondsPerBlock = function () {
  return constants.secondsPerBlock;
};

Tenebra.makeV2Address = function (key) {
  const chars = ["", "", "", "", "", "", "", "", ""];
  let prefix = "t";
  let hash = utils.sha256(utils.sha256(key));

  for (let i = 0; i <= 8; i++) {
    chars[i] = hash.substring(0, 2);
    hash = utils.sha256(utils.sha256(hash));
  }

  for (let i = 0; i <= 8;) {
    const index = parseInt(hash.substring(2 * i, 2 + (2 * i)), 16) % 9;

    if (chars[index] === "") {
      hash = utils.sha256(hash);
    } else {
      prefix += utils.hexToBase36(parseInt(chars[index], 16));
      chars[index] = "";
      i++;
    }
  }

  return prefix;
};

Tenebra.isValidTenebraAddress = function (address, v2Only) {
  return v2Only
    ? addressRegexV2.test(address)
    : addressRegex.test(address);
};

Tenebra.isValidTenebraAddressList = function (addressList) {
  return addressListRegex.test(addressList);
};

Tenebra.isValidName = function (name, fetching) {
  const re = fetching ? nameFetchRegex : nameRegex;
  return re.test(name) && name.length > 0 && name.length < 65;
};

Tenebra.isValidARecord = function (ar) {
  return ar && ar.length > 0 && ar.length <= 255 && aRecordRegex.test(ar);
};

Tenebra.stripNameSuffix = function (name) {
  if (!name) return "";

  // TODO: Support custom name suffixes (see TenebraWeb v2 code for safe RegExp
  //       compilation and memoization)
  return name.replace(/\.tst$/, "");
};

Tenebra.getMOTD = async function () {
  const r = getRedis();
  const motd = await r.get("motd") || "Welcome to Tenebra!";
  const date = new Date(await r.get("motd:date"));

  return {
    motd,
    motd_set: date,
    debug_mode: process.env.NODE_ENV !== "production"
  };
};

Tenebra.setMOTD = async function (motd) {
  const r = getRedis();
  await r.set("motd", motd);
  await r.set("motd:date", (new Date()).toString());
};
